// POST /api/creao/tools/narrate
// The composition entrypoint for Guardian's voice-to-Grandma.
//
// Other CREAO agents (Purchaser, Scam Shield, scheduler) call this when
// they want a warm, grandmother-friendly message sent — instead of writing
// the message themselves and calling status_update directly. We fire the
// Status Updater agent with the structured event + data; that agent
// composes the sentence and calls status_update itself.
//
// Fire-and-forget: Status Updater runs for ~5-15s and sends the Photon
// text as its final step. Callers don't need to wait.
//
// If the Status Updater agent isn't configured yet (CREAO_STATUS_UPDATER_API_KEY
// or _AGENT_ID missing), we fall back to a canned message so the pipeline
// never silently drops Grandma's updates.

import { z } from "zod";

import { verifyCreaoRequest } from "@/lib/creao-auth";
import { db, schema } from "@/lib/db";
import { triggerStatusUpdater } from "@/lib/providers/creao";
import { sendText } from "@/lib/providers/photon";
import { eq } from "drizzle-orm";

const Body = z.object({
  memberId: z.string(),
  event: z.string(),
  data: z.record(z.unknown()).optional(),
  orderId: z.string().optional(),
});

const FALLBACK: Record<string, string> = {
  cart_built: "Your cart is ready.",
  checking: "Giving everything a safety check.",
  paid: "Your cart is confirmed.",
  needs_approval: "Checking with your family, I'll let you know.",
  refused_scam: "I'm not able to help with that — it looks like a scam.",
};

export async function POST(req: Request) {
  const auth = await verifyCreaoRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const parsed = Body.safeParse(JSON.parse(auth.body));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  const result = await triggerStatusUpdater({
    memberId: input.memberId,
    event: input.event,
    data: input.data,
    orderId: input.orderId,
  });

  if (result.ok) {
    return Response.json({ ok: true, runId: result.runId, mode: "agent" });
  }

  // Fallback path: no Status Updater agent configured. Send a canned message
  // so Grandma's phone still buzzes with something sensible.
  const canned = FALLBACK[input.event] ?? `Guardian: ${input.event}`;
  const [member] = await db.select().from(schema.member).where(eq(schema.member.id, input.memberId)).limit(1);
  if (member) {
    await sendText({ to: member.phoneE164, body: canned });
  }
  await db.insert(schema.orderEvent).values({
    memberId: input.memberId,
    orderId: input.orderId,
    stage: "intake_processing",
    message: `narrate fallback: ${canned}`,
    payload: JSON.stringify({ event: input.event, data: input.data, reason: result.error }),
  });

  return Response.json({ ok: true, mode: "fallback", reason: result.error });
}
