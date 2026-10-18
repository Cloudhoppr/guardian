// POST /api/instacart/webhook
// Instacart POSTs here for order lifecycle events — most importantly, item
// substitutions. For Phase 1 we just log the event; Phase 2 wires it to the
// Substitution Prompter agent that texts Grandma a yes/no.

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

type InstacartEvent = {
  type: "substitution_proposed" | "order_placed" | "order_delivered" | string;
  orderId?: string;
  memberId?: string;
  details?: Record<string, unknown>;
};

export async function POST(req: Request) {
  const event = (await req.json()) as InstacartEvent;

  if (!event.memberId) {
    return Response.json({ ok: true, ignored: "no member id" });
  }

  const [member] = await db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(eq(schema.member.id, event.memberId))
    .limit(1);
  if (!member) return Response.json({ error: "unknown_member" }, { status: 404 });

  const stage =
    event.type === "substitution_proposed"
      ? "needs_approval"
      : event.type === "order_placed"
        ? "paid"
        : event.type === "order_delivered"
          ? "delivery_scheduled"
          : "error";

  await db.insert(schema.orderEvent).values({
    memberId: member.id,
    orderId: event.orderId,
    stage: stage as (typeof schema.orderEventStage.enumValues)[number],
    message: `Instacart: ${event.type}`,
    payload: JSON.stringify(event.details ?? {}),
  });

  // Phase 2: fire CREAO Substitution Prompter agent here for
  // substitution_proposed events.

  return Response.json({ ok: true });
}
