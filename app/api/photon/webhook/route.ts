// POST /api/photon/webhook
// Receives inbound messages from Photon (SMS/iMessage) and forwards to CREAO
// so the right agent handles the intent. We don't do any NLP here — just
// identity resolution + forward.

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

type PhotonInbound = {
  spaceId: string;
  from: string; // E.164
  body: string;
  messageId: string;
};

export async function POST(req: Request) {
  // TODO Person A: verify Photon signature header once we see what they send.
  const payload = (await req.json()) as PhotonInbound;

  const [member] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.phoneE164, payload.from))
    .limit(1);
  const [approver] = member
    ? [null]
    : await db
        .select()
        .from(schema.approver)
        .where(eq(schema.approver.phoneE164, payload.from))
        .limit(1);

  if (!member && !approver) {
    // Unknown number — silent drop; dashboard shows it as "unknown contact".
    return Response.json({ ok: true, ignored: true });
  }

  const forward = await fetch(`${process.env.CREAO_API_URL}/agent/inbound`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.CREAO_API_KEY}`,
    },
    body: JSON.stringify({
      channel: "sms",
      from: payload.from,
      body: payload.body,
      role: member ? "member" : "approver",
      memberId: member?.id ?? approver!.memberId,
    }),
  });

  if (!forward.ok) {
    console.error("[photon webhook] CREAO forward failed", forward.status);
  }

  return Response.json({ ok: true });
}
