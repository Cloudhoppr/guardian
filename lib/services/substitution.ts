import { db, schema } from "../db";
import { triggerVoiceReader } from "../providers/creao";

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
  await db.insert(schema.orderEvent).values({
    memberId: input.memberId,
    orderId: input.orderId,
    stage: "needs_approval",
    message: "Instacart: substitution_proposed",
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
