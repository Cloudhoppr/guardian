// POST /api/photon/webhook
// Inbound iMessage from Photon (Beta webhook destination, event
// message.received). Route by sender:
//
//   From the elderly member (Grandma)
//     → yes/no while a substitution is open: apply it (swap or drop the item)
//       and text her a confirmation. See lib/services/substitution.ts.
//     → anything else: fire Scam Shield. Shield checks for scams
//       (deterministic + LLM) and either refuses + alerts family, or passes
//       "safe". Text ordering is deferred to voice calls — Grandma texts us
//       mostly to report suspicious messages or to answer a question.
//
//   From the approver (Elena)          → fire Purchaser agent with the
//     reply as the transcript. Purchaser's workflow includes parsing yes/no
//     and calling record_approval_answer. (Elena has no shared-line seat
//     today, so this branch only runs once she gets one.)
//
//   Unknown number                     → log it, drop it silently.

import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { after } from "next/server";

import { db, schema } from "@/lib/db";
import { triggerPurchaser, triggerScamShield } from "@/lib/providers/creao";
import { answerPendingSubstitution } from "@/lib/services/substitution";

// Beta envelope: { id, type, apiVersion, source, timestamp, data } where
// data.object is the Message. Only the fields we route on are typed.
type PhotonEvent = {
  id: string;
  type: string;
  data?: {
    object?: {
      id: string;
      platform: string;
      sentBy?: { handle?: string; kind?: string };
      content?: { type: string; text?: string };
    };
  };
};

const SIGNATURE_TOLERANCE_SECS = 5 * 60;

// Photon's Beta docs don't spell out the signature header, so accept the two
// schemes Photon documents elsewhere: Spectrum (`X-Spectrum-Signature:
// v0=<hex>` over `v0:<ts>:<body>`) and Standard Webhooks (`webhook-signature:
// v1,<base64>` over `<id>.<ts>.<body>`). On failure we log header *names* so
// the real scheme shows up in Vercel logs.
function verifyPhotonSignature(req: Request, rawBody: string, secret: string): boolean {
  const h = req.headers;
  const now = Date.now() / 1000;
  const fresh = (ts: string | null) => ts !== null && Math.abs(now - Number(ts)) <= SIGNATURE_TOLERANCE_SECS;

  const spectrumSig = h.get("x-spectrum-signature");
  const spectrumTs = h.get("x-spectrum-timestamp");
  if (spectrumSig && fresh(spectrumTs)) {
    const expected = `v0=${crypto.createHmac("sha256", secret).update(`v0:${spectrumTs}:${rawBody}`).digest("hex")}`;
    if (safeEqual(spectrumSig, expected)) return true;
  }

  const swSig = h.get("webhook-signature");
  const swId = h.get("webhook-id");
  const swTs = h.get("webhook-timestamp");
  if (swSig && swId && fresh(swTs)) {
    const key = secret.startsWith("whsec_") ? Buffer.from(secret.slice(6), "base64") : Buffer.from(secret);
    const expected = crypto.createHmac("sha256", key).update(`${swId}.${swTs}.${rawBody}`).digest("base64");
    if (swSig.split(" ").some((part) => safeEqual(part.split(",")[1] ?? "", expected))) return true;
  }

  console.warn("[photon/webhook] signature check failed; header names:", [...h.keys()].join(","));
  return false;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  const secret = process.env.PHOTON_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed in production; allow in dev, matching creao-auth.
    if (process.env.NODE_ENV === "production") {
      return Response.json({ error: "PHOTON_WEBHOOK_SECRET not set" }, { status: 500 });
    }
    console.warn("[photon/webhook] PHOTON_WEBHOOK_SECRET not set — allowing in dev");
  } else if (!verifyPhotonSignature(req, rawBody, secret)) {
    return Response.json({ error: "bad signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as PhotonEvent;
  const message = event.data?.object;
  const from = message?.sentBy?.handle;
  const text = message?.content?.type === "text" ? message.content.text : undefined;
  // Only human-sent text matters; ignore our own sends, reads, typing, etc.
  if (event.type !== "message.received" || !from || !text || message?.sentBy?.kind === "agent") {
    return Response.json({ ok: true, ignored: event.type });
  }

  const [member] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.phoneE164, from))
    .limit(1);

  if (member) {
    await db.insert(schema.orderEvent).values({
      memberId: member.id,
      stage: "intake_processing",
      message: `Inbound text from ${member.preferredName}: "${text.slice(0, 120)}"`,
      payload: JSON.stringify({ messageId: message!.id, eventId: event.id, channel: "imessage" }),
    });

    const substitution = await answerPendingSubstitution({ memberId: member.id, text });
    if (substitution.handled) {
      return Response.json({ ok: true, routed: "substitution", answer: substitution.answer });
    }

    // Fire-and-forget: Scam Shield runs ~30s and uses our tool API to text
    // Grandma back + alert Elena if it detects a scam.
    after(triggerScamShield({
      memberId: member.id,
      inboundMessage: text,
      channel: "imessage",
    }).then((r) => {
      if (!r.ok) console.error("[photon/inbound] triggerScamShield failed:", r.error);
    }));

    return Response.json({ ok: true, routed: "scam_shield" });
  }

  const [approver] = await db
    .select()
    .from(schema.approver)
    .where(eq(schema.approver.phoneE164, from))
    .limit(1);

  if (approver) {
    await db.insert(schema.orderEvent).values({
      memberId: approver.memberId,
      stage: "intake_processing",
      message: `Approver reply from ${approver.fullName}: "${text.slice(0, 120)}"`,
      payload: JSON.stringify({ messageId: message!.id, from: "approver" }),
    });

    // Approver replies ("yes" / "no" / etc) go to Purchaser so its approval
    // sub-flow can parse the answer and call record_approval_answer.
    after(triggerPurchaser({
      memberId: approver.memberId,
      transcript: text,
      channel: "imessage",
    }).then((r) => {
      if (!r.ok) console.error("[photon/inbound] triggerPurchaser failed:", r.error);
    }));

    return Response.json({ ok: true, routed: "purchaser" });
  }

  return Response.json({ ok: true, ignored: "unknown_number" });
}
