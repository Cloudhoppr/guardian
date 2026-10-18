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
import { triggerPurchaser } from "@/lib/providers/creao";
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
