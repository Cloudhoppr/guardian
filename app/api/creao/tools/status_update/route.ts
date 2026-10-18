// POST /api/creao/tools/status_update
// The Purchaser agent calls this after every meaningful stage of its run.
// We do two things: (1) log the event to order_event (dashboard timeline),
// (2) text the chosen recipient via Photon so Grandma's phone keeps buzzing
// with progress instead of radio silence.
//
// Two guardrails live here, both important before any demo:
//   - Truthful-messaging label: for stages that imply a real-world outcome
//     ("paid", "delivery_scheduled"), we append "[demo — not a real delivery]"
//     unless GUARDIAN_LIVE_RETAILER=1. Prevents Grandma from being told
//     "arrives Thursday" when nothing's shipping.
//   - Short-window dedupe: if the Purchaser retries, we don't want three
//     identical rows on the dashboard or three identical texts on her phone.
//     Within 10s, same (memberId, stage, orderId, message) collapses to one.

import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";

import { verifyCreaoRequest } from "@/lib/creao-auth";
import { db, schema } from "@/lib/db";
import { sendText } from "@/lib/providers/photon";

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

const STAGES_IMPLYING_REAL_WORLD = new Set(["paid", "delivery_scheduled"]);
const DEDUPE_WINDOW_SECONDS = 10;

const Body = z.object({
  memberId: z.string(),
  orderId: z.string().optional(),
  stage: z.enum(STAGES),
  message: z.string().min(1).max(500),
  payload: z.record(z.unknown()).optional(),
  notify: z.enum(["grandma", "elena", "both", "none"]).default("grandma"),
});

export async function POST(req: Request) {
  const auth = await verifyCreaoRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const parsed = Body.safeParse(JSON.parse(auth.body));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  const liveRetailer = process.env.GUARDIAN_LIVE_RETAILER === "1";
  const outboundMessage = STAGES_IMPLYING_REAL_WORLD.has(input.stage) && !liveRetailer
    ? `${input.message} [demo — not a real delivery]`
    : input.message;

  const windowStart = new Date(Date.now() - DEDUPE_WINDOW_SECONDS * 1000);
  const orderIdFilter = input.orderId
    ? eq(schema.orderEvent.orderId, input.orderId)
    : isNull(schema.orderEvent.orderId);
  const [existing] = await db
    .select()
    .from(schema.orderEvent)
    .where(
      and(
        eq(schema.orderEvent.memberId, input.memberId),
        eq(schema.orderEvent.stage, input.stage),
        eq(schema.orderEvent.message, outboundMessage),
        orderIdFilter,
        gt(schema.orderEvent.createdAt, windowStart),
      ),
    )
    .limit(1);

  if (existing) {
    return Response.json({ ok: true, deduped: true, eventId: existing.id, notified: "none" });
  }

  const [row] = await db
    .insert(schema.orderEvent)
    .values({
      memberId: input.memberId,
      orderId: input.orderId,
      stage: input.stage,
      message: outboundMessage,
      payload: input.payload ? JSON.stringify(input.payload) : null,
    })
    .returning();

  if (input.notify === "none") return Response.json({ ok: true, eventId: row!.id, notified: "none" });

  const [member] = await db.select().from(schema.member).where(eq(schema.member.id, input.memberId)).limit(1);
  const [elena] = await db
    .select()
    .from(schema.approver)
    .where(and(eq(schema.approver.memberId, input.memberId), eq(schema.approver.role, "primary")))
    .limit(1);

  const sends: Promise<unknown>[] = [];
  if ((input.notify === "grandma" || input.notify === "both") && member) {
    sends.push(sendText({ to: member.phoneE164, body: outboundMessage }));
  }
  if ((input.notify === "elena" || input.notify === "both") && elena) {
    sends.push(sendText({ to: elena.phoneE164, body: outboundMessage }));
  }
  await Promise.all(sends);

  return Response.json({ ok: true, eventId: row!.id, notified: input.notify });
}
