// POST /api/instacart/webhook
// Instacart POSTs here for order lifecycle events. Most important for the
// demo: substitution_proposed → fire the Voice Reader agent so Grandma hears
// the substitution question read aloud (not just a text she might miss).

import { eq } from "drizzle-orm";
import { after } from "next/server";

import { db, schema } from "@/lib/db";
import { proposeSubstitution } from "@/lib/services/substitution";

type SubstitutionDetails = {
  originalItem?: string;
  substituteItem?: string;
};

type InstacartEvent = {
  type: "substitution_proposed" | "order_placed" | "order_delivered" | string;
  orderId?: string;
  memberId?: string;
  details?: SubstitutionDetails & Record<string, unknown>;
};

export async function POST(req: Request) {
  const event = (await req.json()) as InstacartEvent;

  if (!event.memberId) {
    return Response.json({ ok: true, ignored: "no member id" });
  }

  const [member] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.id, event.memberId))
    .limit(1);
  if (!member) return Response.json({ error: "unknown_member" }, { status: 404 });

  // Substitutions log their own needs_approval row and fire the Voice Reader
  // so Grandma hears the question read aloud (shared with create_cart).
  if (event.type === "substitution_proposed" && event.details) {
    after(proposeSubstitution({
      memberId: member.id,
      orderId: event.orderId,
      originalItem: event.details.originalItem,
      substituteItem: event.details.substituteItem,
    }));
    return Response.json({ ok: true });
  }

  const stage =
    event.type === "order_placed"
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

  return Response.json({ ok: true });
}
