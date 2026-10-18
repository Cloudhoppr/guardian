import { and, eq, gt, like } from "drizzle-orm";

import { db, schema } from "../db";
import { triggerVoiceReader } from "../providers/creao";

const PROPOSED_MESSAGE = "Instacart: substitution_proposed";
const DEDUPE_WINDOW_SECONDS = 2 * 60;

// Demo stock-outs: SKU → substitute name. There's no real Instacart
// partnership, so create_cart treats these as unavailable and proposes the
// swap itself — saying "avocados" on a call is enough to see the flow.
export const OUT_OF_STOCK: Record<string, { originalItem: string; substituteItem: string }> = {
  "GRO-AVOCADO": { originalItem: "avocados", substituteItem: "roma tomatoes" },
};

export type SubstitutionInput = {
  memberId: string;
  orderId?: string;
  originalItem?: string;
  substituteItem?: string;
};

// Logs the needs_approval row, then fires the Voice Reader. The agent reads
// the question aloud via the speak tool, which also texts it + the MP3 to the
// member. Never rejects; callers hand the promise to after().
export async function proposeSubstitution(input: SubstitutionInput): Promise<void> {
  // The Purchaser sometimes rebuilds the cart within one run; ask once.
  const windowStart = new Date(Date.now() - DEDUPE_WINDOW_SECONDS * 1000);
  const [recent] = await db
    .select({ id: schema.orderEvent.id })
    .from(schema.orderEvent)
    .where(
      and(
        eq(schema.orderEvent.memberId, input.memberId),
        eq(schema.orderEvent.message, PROPOSED_MESSAGE),
        like(schema.orderEvent.payload, `%${JSON.stringify({ originalItem: input.originalItem }).slice(1, -1)}%`),
        gt(schema.orderEvent.createdAt, windowStart),
      ),
    )
    .limit(1);
  if (recent) return;

  await db.insert(schema.orderEvent).values({
    memberId: input.memberId,
    orderId: input.orderId,
    stage: "needs_approval",
    message: PROPOSED_MESSAGE,
    payload: JSON.stringify({ originalItem: input.originalItem, substituteItem: input.substituteItem }),
  });

  const textToRead =
    input.originalItem && input.substituteItem
      ? `Instacart is out of ${input.originalItem}. Can we substitute with ${input.substituteItem} instead? Say yes or no.`
      : `Instacart has a substitution for your order. Please check your messages and reply yes or no.`;

  const r = await triggerVoiceReader({
    memberId: input.memberId,
    textToRead,
    context: "substitution",
    orderId: input.orderId,
  });
  if (!r.ok) console.error("[substitution] triggerVoiceReader failed:", r.error);
}
