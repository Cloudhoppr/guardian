// POST /api/creao/tools/create_cart
// Builds a cart with the given items. Idempotent on (memberId, cartId) if the
// agent retries. Returns the cart with current pricing.

import { after } from "next/server";
import { z } from "zod";

import { verifyCreaoRequest } from "@/lib/creao-auth";
import { db, schema } from "@/lib/db";
import { OUT_OF_STOCK, proposeSubstitution } from "@/lib/services/substitution";
import { eq, inArray } from "drizzle-orm";

const Body = z.object({
  memberId: z.string(),
  channel: z.enum(["sms", "imessage", "voice"]),
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await verifyCreaoRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const parsed = Body.safeParse(JSON.parse(auth.body));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  // Collapse repeated productIds. Repeats come from the agent overlapping
  // "the usual" with an explicit ask ("the usual and some avocados" when
  // avocados are already usual), so keep the larger quantity rather than
  // summing — she wants one pack, not two.
  const quantityById = new Map<string, number>();
  for (const i of input.items) {
    quantityById.set(i.productId, Math.max(quantityById.get(i.productId) ?? 0, i.quantity));
  }
  input.items = [...quantityById].map(([productId, quantity]) => ({ productId, quantity }));

  const products = await db
    .select()
    .from(schema.product)
    .where(inArray(schema.product.id, input.items.map((i) => i.productId)));
  const priceById = new Map(products.map((p) => [p.id, p.priceCents]));

  const [cart] = await db
    .insert(schema.cart)
    .values({ memberId: input.memberId, openedChannel: input.channel, note: input.note })
    .returning();

  if (input.items.length > 0) {
    await db.insert(schema.cartItem).values(
      input.items.map((i) => ({
        cartId: cart!.id,
        productId: i.productId,
        quantity: i.quantity,
        priceCentsAtAdd: priceById.get(i.productId) ?? 0,
      })),
    );
  }

  const items = await db.select().from(schema.cartItem).where(eq(schema.cartItem.cartId, cart!.id));
  const subtotalCents = items.reduce((s, it) => s + it.priceCentsAtAdd * it.quantity, 0);

  // Demo stock-out: any OUT_OF_STOCK item in the cart proposes a substitution,
  // as Instacart would mid-shop. Runs after the response so the Purchaser
  // isn't held up; the question lands ~20s later via the Voice Reader.
  const outOfStock = products.map((p) => OUT_OF_STOCK[p.sku]).filter((s) => s !== undefined);
  for (const sub of outOfStock) {
    after(proposeSubstitution({ memberId: input.memberId, originalItem: sub.originalItem, substituteItem: sub.substituteItem }));
  }

  return Response.json({ cartId: cart!.id, items, subtotalCents });
}
