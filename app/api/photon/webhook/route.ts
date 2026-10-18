// POST /api/photon/webhook
// Inbound SMS/iMessage from Photon. Route by sender:
//
//   From the elderly member (Grandma)  → fire Scam Shield agent.
//     Shield checks for scams (deterministic + LLM) and either refuses +
//     alerts family, or passes "safe". For the hackathon demo, text ordering
//     is deferred to voice calls — Grandma texts us mostly to report
//     suspicious messages or to answer a reminder.
//
//   From the approver (Elena)          → fire Purchaser agent with the
//     reply as the transcript. Purchaser's workflow includes parsing yes/no
//     and calling record_approval_answer.
//
//   Unknown number                     → log it, drop it silently. The
//     dashboard shows it as "unknown contact" so the family can see attempts.

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { triggerPurchaser, triggerScamShield } from "@/lib/providers/creao";

type PhotonInbound = {
  spaceId?: string;
  from: string;
  body: string;
  messageId?: string;
};

export async function POST(req: Request) {
  // TODO Person A: verify Photon signature header once we see what they send.
  const payload = (await req.json()) as PhotonInbound;

  const [member] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.phoneE164, payload.from))
    .limit(1);

  if (member) {
    await db.insert(schema.orderEvent).values({
      memberId: member.id,
      stage: "intake_processing",
      message: `Inbound text from ${member.preferredName}: "${payload.body.slice(0, 120)}"`,
      payload: JSON.stringify({ messageId: payload.messageId, channel: "sms" }),
    });

    // Fire-and-forget: Scam Shield runs ~30s and uses our tool API to text
    // Grandma back + alert Elena if it detects a scam.
    void triggerScamShield({
      memberId: member.id,
      inboundMessage: payload.body,
      channel: "sms",
    }).then((r) => {
      if (!r.ok) console.error("[photon/inbound] triggerScamShield failed:", r.error);
    });

    return Response.json({ ok: true, routed: "scam_shield" });
  }

  const [approver] = await db
    .select()
    .from(schema.approver)
    .where(eq(schema.approver.phoneE164, payload.from))
    .limit(1);

  if (approver) {
    await db.insert(schema.orderEvent).values({
      memberId: approver.memberId,
      stage: "intake_processing",
      message: `Approver reply from ${approver.fullName}: "${payload.body.slice(0, 120)}"`,
      payload: JSON.stringify({ messageId: payload.messageId, from: "approver" }),
    });

    // Approver replies ("yes" / "no" / etc) go to Purchaser so its approval
    // sub-flow can parse the answer and call record_approval_answer.
    void triggerPurchaser({
      memberId: approver.memberId,
      transcript: payload.body,
      channel: "sms",
    }).then((r) => {
      if (!r.ok) console.error("[photon/inbound] triggerPurchaser failed:", r.error);
    });

    return Response.json({ ok: true, routed: "purchaser" });
  }

  return Response.json({ ok: true, ignored: "unknown_number" });
}
