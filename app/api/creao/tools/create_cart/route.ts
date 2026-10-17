// POST /api/creao/tools/create_cart
// Builds a cart with the given items. Idempotent on (memberId, cartId) if the
// agent retries. Returns the cart with current pricing.

import { z } from "zod";

import { verifyCreaoRequest } from "@/lib/creao-auth";
import { db, schema } from "@/lib/db";
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

  return Response.json({ cartId: cart!.id, items, subtotalCents });
}
