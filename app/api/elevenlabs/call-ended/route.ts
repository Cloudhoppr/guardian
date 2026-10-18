// POST /api/elevenlabs/call-ended
// Called by ElevenLabs when a voice call with Grandma finishes. We:
//  1. Log the call_received event
//  2. Text Grandma immediately so there's no dead silence while CREAO runs
//  3. Fire CREAO's Purchaser agent asynchronously (don't wait for its reply —
//     the agent itself will send progress updates via status_update)
//  4. Return 200 so ElevenLabs isn't blocked

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { askAgent } from "@/lib/providers/creao";
import { sendText } from "@/lib/providers/photon";

const Body = z.object({
  memberId: z.string().optional(),
  callerPhone: z.string().optional(),
  transcript: z.string().min(1),
  // ElevenLabs' extracted intent, if available. Falls through to CREAO even
  // if present — the agent decides what to do with the transcript.
  extractedIntent: z.string().optional(),
});

export async function POST(req: Request) {
  const sharedSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (sharedSecret) {
    const got = req.headers.get("x-elevenlabs-secret");
    if (got !== sharedSecret) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  let memberId = input.memberId;
  if (!memberId && input.callerPhone) {
    const [m] = await db
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(eq(schema.member.phoneE164, input.callerPhone))
      .limit(1);
    memberId = m?.id;
  }
  if (!memberId) {
    return Response.json({ error: "could_not_resolve_member" }, { status: 400 });
  }

  const [member] = await db.select().from(schema.member).where(eq(schema.member.id, memberId)).limit(1);
  const resolvedMember = member!;

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

  // Fire-and-forget to CREAO. Don't await — ElevenLabs is waiting on us and
  // the agent runs for minutes. Any error inside the Purchaser is captured
  // by that side's own status_update("error", ...) call.
  void askAgent({
    memberId: resolvedMember.id,
    intent: "compose_approval_request",
    payload: { transcript: input.transcript, extractedIntent: input.extractedIntent ?? null },
  });

  return Response.json({ ok: true, memberId: resolvedMember.id });
}
