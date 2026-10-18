import { and, desc, eq, gt, inArray, like } from "drizzle-orm";

import { db, schema } from "../db";
import { triggerVoiceReader } from "../providers/creao";
import { sendText } from "../providers/photon";

const PROPOSED_MESSAGE = "Instacart: substitution_proposed";
const ANSWER_PREFIX = "Substitution answer:";
const DEDUPE_WINDOW_SECONDS = 2 * 60;
// How long a proposal stays open for a yes/no reply.
const ANSWER_WINDOW_SECONDS = 60 * 60;

// Demo stock-outs: SKU → substitute name. There's no real Instacart
// partnership, so create_cart treats these as unavailable and proposes the
// swap itself — saying "avocados" on a call is enough to see the flow.
export const OUT_OF_STOCK: Record<string, { originalItem: string; substituteItem: string; substituteSku: string }> = {
  "GRO-AVOCADO": { originalItem: "avocados", substituteItem: "roma tomatoes", substituteSku: "GRO-TOMATO" },
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

const YES = new Set(["yes", "y", "yeah", "yep", "yup", "sure", "ok", "okay", "please", "sounds good", "that's fine", "fine"]);
const NO = new Set(["no", "n", "nope", "nah", "no thanks", "no thank you", "don't", "dont"]);

export function parseYesNo(text: string): "yes" | "no" | null {
  const t = text.trim().toLowerCase().replace(/[.!?,]+$/g, "");
  if (YES.has(t)) return "yes";
  if (NO.has(t)) return "no";
  return null;
}

// Applies a yes/no text reply to the member's open substitution, if any.
// yes swaps the out-of-stock item for its substitute in the latest cart that
// has it; no drops it. Either way the order subtotal follows and the member
// gets a confirmation. Returns handled: false when there's nothing to answer
// so the caller can route the text elsewhere (Scam Shield).
export async function answerPendingSubstitution(input: {
  memberId: string;
  text: string;
}): Promise<{ handled: false } | { handled: true; answer: "yes" | "no" }> {
  const answer = parseYesNo(input.text);
  if (!answer) return { handled: false };

  const windowStart = new Date(Date.now() - ANSWER_WINDOW_SECONDS * 1000);
  const [proposal] = await db
    .select()
    .from(schema.orderEvent)
    .where(
      and(
        eq(schema.orderEvent.memberId, input.memberId),
        eq(schema.orderEvent.message, PROPOSED_MESSAGE),
        gt(schema.orderEvent.createdAt, windowStart),
      ),
    )
    .orderBy(desc(schema.orderEvent.createdAt))
    .limit(1);
  if (!proposal) return { handled: false };

  const [answered] = await db
    .select({ id: schema.orderEvent.id })
    .from(schema.orderEvent)
    .where(
      and(
        eq(schema.orderEvent.memberId, input.memberId),
        like(schema.orderEvent.message, `${ANSWER_PREFIX}%`),
        gt(schema.orderEvent.createdAt, proposal.createdAt),
      ),
    )
    .limit(1);
  if (answered) return { handled: false };

  const { originalItem } = JSON.parse(proposal.payload ?? "{}") as { originalItem?: string };
  const [sku, sub] = Object.entries(OUT_OF_STOCK).find(([, s]) => s.originalItem === originalItem) ?? [];
  if (!sku || !sub) return { handled: false };

  const products = await db.select().from(schema.product).where(inArray(schema.product.sku, [sku, sub.substituteSku]));
  const original = products.find((p) => p.sku === sku);
  const substitute = products.find((p) => p.sku === sub.substituteSku);

  // Latest cart of this member that still holds the out-of-stock item.
  const [line] = original
    ? await db
        .select({ itemId: schema.cartItem.id, cartId: schema.cartItem.cartId })
        .from(schema.cartItem)
        .innerJoin(schema.cart, eq(schema.cart.id, schema.cartItem.cartId))
        .where(and(eq(schema.cart.memberId, input.memberId), eq(schema.cartItem.productId, original.id)))
        .orderBy(desc(schema.cart.createdAt))
        .limit(1)
    : [];

  if (line) {
    if (answer === "yes" && substitute) {
      await db
        .update(schema.cartItem)
        .set({ productId: substitute.id, priceCentsAtAdd: substitute.priceCents })
        .where(eq(schema.cartItem.id, line.itemId));
    } else {
      await db.delete(schema.cartItem).where(eq(schema.cartItem.id, line.itemId));
    }
    const items = await db.select().from(schema.cartItem).where(eq(schema.cartItem.cartId, line.cartId));
    const subtotalCents = items.reduce((s, it) => s + it.priceCentsAtAdd * it.quantity, 0);
    await db.update(schema.order).set({ subtotalCents }).where(eq(schema.order.cartId, line.cartId));
  }

  const confirmation =
    answer === "yes"
      ? `Okay, I'll get ${sub.substituteItem} instead of ${sub.originalItem}.`
      : `Okay, I'll leave out the ${sub.originalItem}.`;

  await db.insert(schema.orderEvent).values({
    memberId: input.memberId,
    orderId: proposal.orderId,
    stage: "intake_processing",
    message: `${ANSWER_PREFIX} ${answer} — ${confirmation}`,
    payload: JSON.stringify({ answer, originalItem: sub.originalItem, substituteItem: sub.substituteItem, cartId: line?.cartId }),
  });

  const [member] = await db.select().from(schema.member).where(eq(schema.member.id, input.memberId)).limit(1);
  if (member) await sendText({ to: member.phoneE164, body: confirmation });

  return { handled: true, answer };
}
