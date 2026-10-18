// POST /api/instacart/webhook
// Instacart POSTs here for order lifecycle events. Most important for the
// demo: substitution_proposed → fire the Voice Reader agent so Grandma hears
// the substitution question read aloud (not just a text she might miss).

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { triggerVoiceReader } from "@/lib/providers/creao";

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

  // For substitutions, fire the Voice Reader so Grandma hears the question
  // read aloud. The agent composes a short "we're subbing X for Y, say yes
  // or no" and calls our speak tool to generate the audio.
  if (event.type === "substitution_proposed" && event.details) {
    const d = event.details;
    const textToRead =
      d.originalItem && d.substituteItem
        ? `Instacart is out of ${d.originalItem}. Can we substitute with ${d.substituteItem} instead? Say yes or no.`
        : `Instacart has a substitution for your order. Please check your messages and reply yes or no.`;

    void triggerVoiceReader({
      memberId: member.id,
      textToRead,
      context: "substitution",
      orderId: event.orderId,
    }).then((r) => {
      if (!r.ok) console.error("[instacart/webhook] triggerVoiceReader failed:", r.error);
    });
  }

  return Response.json({ ok: true });
}
