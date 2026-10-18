// POST /api/elevenlabs/call-ended
// Called by ElevenLabs when a voice call with Grandma finishes. We:
//  1. Log the call_received event
//  2. Text Grandma immediately so there's no dead silence while CREAO runs
//  3. Fire CREAO's Purchaser agent asynchronously (don't wait for its reply —
//     the agent itself will send progress updates via status_update)
//  4. Return 200 so ElevenLabs isn't blocked
//
// Two body shapes are accepted:
//  - ElevenLabs' native post-call webhook ({type, data: {transcript: [...]}}),
//    signed with an ElevenLabs-Signature header (ELEVENLABS_POSTCALL_SIGNING_SECRET).
//  - A flat {transcript, memberId?, callerPhone?} body with x-elevenlabs-secret,
//    which scripts/e2e*.ts send.

import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { triggerPurchaser } from "@/lib/providers/creao";
import { sendText } from "@/lib/providers/photon";
import { resolveMemberId } from "@/lib/services/members";

const Body = z.object({
  memberId: z.string().optional(),
  callerPhone: z.string().optional(),
  transcript: z.string().min(1),
  // ElevenLabs' extracted intent, if available. Falls through to CREAO even
  // if present — the agent decides what to do with the transcript.
  extractedIntent: z.string().optional(),
});

const NativeBody = z.object({
  type: z.string(),
  data: z.object({
    transcript: z.array(z.object({ role: z.string(), message: z.string().nullish() })),
    metadata: z.object({ phone_call: z.object({ external_number: z.string().nullish() }).passthrough().nullish() }).passthrough().nullish(),
    conversation_initiation_client_data: z
      .object({ dynamic_variables: z.record(z.unknown()).nullish() })
      .passthrough()
      .nullish(),
  }).passthrough(),
});

// ElevenLabs-Signature: t=<unix secs>,v0=<hex HMAC-SHA256 of "<t>.<raw body>">
const SIGNATURE_TOLERANCE_SECS = 30 * 60;

function verifyElevenLabsSignature(header: string, rawBody: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!parts.v0 || !Number.isFinite(t)) return false;
  if (Math.abs(Date.now() / 1000 - t) > SIGNATURE_TOLERANCE_SECS) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const a = Buffer.from(parts.v0, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("elevenlabs-signature");

  if (signature !== null) {
    const signingSecret = process.env.ELEVENLABS_POSTCALL_SIGNING_SECRET;
    if (!signingSecret) {
      return Response.json({ error: "ELEVENLABS_POSTCALL_SIGNING_SECRET not set" }, { status: 500 });
    }
    if (!verifyElevenLabsSignature(signature, rawBody, signingSecret)) {
      return Response.json({ error: "bad signature" }, { status: 401 });
    }
  } else {
    const sharedSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (!sharedSecret) {
      // Fail closed in production. In dev, warn but allow — matches the
      // creao-auth pattern so local testing doesn't need a secret configured.
      if (process.env.NODE_ENV === "production") {
        return Response.json({ error: "ELEVENLABS_WEBHOOK_SECRET not set" }, { status: 500 });
      }
      console.warn("[elevenlabs/call-ended] ELEVENLABS_WEBHOOK_SECRET not set — allowing in dev");
    } else {
      const got = req.headers.get("x-elevenlabs-secret");
      if (got !== sharedSecret) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
    }
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  let input: z.infer<typeof Body>;
  const native = NativeBody.safeParse(json);
  if (native.success) {
    // Audio and call-initiation-failure events also hit this URL; only the
    // transcript event carries anything for the Purchaser. 200 so ElevenLabs
    // doesn't count them as failures.
    if (native.data.type !== "post_call_transcription") {
      return Response.json({ ok: true, ignored: native.data.type });
    }
    const { data } = native.data;
    const transcript = data.transcript
      .filter((turn) => turn.message)
      .map((turn) => `${turn.role === "agent" ? "Agent" : "Caller"}: ${turn.message}`)
      .join("\n");
    const callerId = data.conversation_initiation_client_data?.dynamic_variables?.system__caller_id;
    input = {
      transcript,
      callerPhone: (typeof callerId === "string" ? callerId : undefined) ?? data.metadata?.phone_call?.external_number ?? undefined,
    };
    if (!input.transcript) return Response.json({ ok: true, ignored: "empty_transcript" });
  } else {
    const parsed = Body.safeParse(json);
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    input = parsed.data;
  }

  const memberId = await resolveMemberId(input);
  if (!memberId) {
    return Response.json({ error: "could_not_resolve_member" }, { status: 400 });
  }

  const [member] = await db.select().from(schema.member).where(eq(schema.member.id, memberId)).limit(1);
  if (!member) return Response.json({ error: "could_not_resolve_member" }, { status: 400 });
  const resolvedMember = member;

  await db.insert(schema.orderEvent).values({
    memberId: resolvedMember.id,
    stage: "call_received",
    message: "Call ended, transcript handed to Purchaser agent.",
    payload: JSON.stringify({ transcriptPreview: input.transcript.slice(0, 200) }),
  });

  // Fire the immediate ack so Grandma's phone buzzes right after the call.
  // Keep it short and warm — this is the "I heard you, I'm on it" moment.
  const ackText = `Got it ${resolvedMember.preferredName}, putting your order together. I'll text you updates.`;
  await sendText({ to: resolvedMember.phoneE164, body: ackText });
  await db.insert(schema.orderEvent).values({
    memberId: resolvedMember.id,
    stage: "acknowledged",
    message: ackText,
  });

  // Fire-and-forget to the saved CREAO Purchaser agent via its API Trigger.
  // Don't await — ElevenLabs is waiting on us and the agent runs for ~30-90s.
  // The Purchaser calls our /api/creao/tools/* endpoints as it works, so
  // status updates flow back to Grandma via Photon in real time without us
  // holding this request open.
  void triggerPurchaser({
    memberId: resolvedMember.id,
    transcript: input.transcript,
    channel: "voice",
    newItems: input.extractedIntent ?? undefined,
  }).then((result) => {
    if (!result.ok) {
      console.error("[call-ended] triggerPurchaser failed:", result.error);
    }
  });

  return Response.json({ ok: true, memberId: resolvedMember.id });
}
