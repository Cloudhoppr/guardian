// POST /api/creao/tools/status_update
// The Purchaser agent calls this after every meaningful stage of its run.
// We do two things: (1) log the event to order_event (dashboard timeline),
// (2) text the chosen recipient via Photon so Grandma's phone keeps buzzing
// with progress instead of radio silence.
//
// Keep this endpoint snappy — CREAO's agent may call it 5-10 times per order.

import { z } from "zod";

import { verifyCreaoRequest } from "@/lib/creao-auth";
import { db, schema } from "@/lib/db";
import { sendText } from "@/lib/providers/photon";
import { and, eq } from "drizzle-orm";

const STAGES = [
  "call_received",
  "acknowledged",
  "intake_processing",
  "cart_built",
  "checking",
  "approved_auto",
  "needs_approval",
  "approver_notified",
  "approved_by_elena",
  "denied_by_elena",
  "paid",
  "delivery_scheduled",
  "refused_scam",
  "error",
] as const;

const Body = z.object({
  memberId: z.string(),
  orderId: z.string().optional(),
  stage: z.enum(STAGES),
  message: z.string().min(1).max(500),
  payload: z.record(z.unknown()).optional(),
  // Default: tell Grandma. For scam / approval flows the agent sets this to
  // "elena" or "both".
  notify: z.enum(["grandma", "elena", "both", "none"]).default("grandma"),
});

export async function POST(req: Request) {
  const auth = await verifyCreaoRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const parsed = Body.safeParse(JSON.parse(auth.body));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  await db.insert(schema.orderEvent).values({
    memberId: input.memberId,
    orderId: input.orderId,
    stage: input.stage,
    message: input.message,
    payload: input.payload ? JSON.stringify(input.payload) : null,
  });

  if (input.notify === "none") return Response.json({ ok: true, notified: [] });

  const [member] = await db.select().from(schema.member).where(eq(schema.member.id, input.memberId)).limit(1);
  const [elena] = await db
    .select()
    .from(schema.approver)
    .where(and(eq(schema.approver.memberId, input.memberId), eq(schema.approver.role, "primary")))
    .limit(1);

  const sends: Promise<unknown>[] = [];
  if ((input.notify === "grandma" || input.notify === "both") && member) {
    sends.push(sendText({ to: member.phoneE164, body: input.message }));
  }
  if ((input.notify === "elena" || input.notify === "both") && elena) {
    sends.push(sendText({ to: elena.phoneE164, body: input.message }));
  }
  await Promise.all(sends);

  return Response.json({ ok: true, notified: input.notify });
}
