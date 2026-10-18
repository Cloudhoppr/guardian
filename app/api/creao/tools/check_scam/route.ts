// POST /api/creao/tools/check_scam
// CREAO can call this on raw inbound text before even building a cart. The
// scam shield is also run inside /check — this endpoint exists so the agent
// can refuse a message that never becomes a cart (gift-card ask, IRS story).
// The ElevenLabs voice agent calls it mid-call, passing callerPhone instead of memberId.

import { z } from "zod";

import { db, schema } from "@/lib/db";
import { resolveMemberId } from "@/lib/services/members";
import { runScamShield } from "@/lib/services/scam-shield";
import { verifyToolRequest } from "@/lib/tool-auth";

const Body = z.object({
  memberId: z.string().optional(),
  callerPhone: z.string().optional(),
  message: z.string(),
  channel: z.enum(["sms", "imessage", "voice"]),
  mentionedDomains: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const auth = await verifyToolRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const parsed = Body.safeParse(JSON.parse(auth.body));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  const memberId = await resolveMemberId(input);
  if (!memberId) return Response.json({ error: "could_not_resolve_member" }, { status: 400 });

  const result = runScamShield({ message: input.message, mentionedDomains: input.mentionedDomains });

  if (result.flagged) {
    await db.insert(schema.scamEvent).values({
      memberId,
      channelOrigin: input.channel,
      rawMessage: input.message,
      riskScore: Math.min(result.reasons.length * 30, 100),
      reasons: result.reasons,
    });
  }

  return Response.json({ flagged: result.flagged, reasons: result.reasons });
}
