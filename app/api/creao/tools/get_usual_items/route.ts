// POST /api/creao/tools/get_usual_items
// CREAO's shopping agent reads this to resolve "the usual" into actual SKUs.

import { eq } from "drizzle-orm";
import { z } from "zod";

import { verifyCreaoRequest } from "@/lib/creao-auth";
import { db, schema } from "@/lib/db";

const Body = z.object({ memberId: z.string() });

export async function POST(req: Request) {
  const auth = await verifyCreaoRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const parsed = Body.safeParse(JSON.parse(auth.body));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const rows = await db
    .select({
      productId: schema.usualItem.productId,
      quantity: schema.usualItem.typicalQuantity,
      name: schema.product.name,
      priceCents: schema.product.priceCents,
    })
    .from(schema.usualItem)
    .innerJoin(schema.product, eq(schema.product.id, schema.usualItem.productId))
    .where(eq(schema.usualItem.memberId, parsed.data.memberId));

  return Response.json({ items: rows });
}
