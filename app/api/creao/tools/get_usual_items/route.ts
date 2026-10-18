// POST /api/creao/tools/get_usual_items
// CREAO's shopping agent reads this to resolve "the usual" into actual SKUs.
// The ElevenLabs voice agent calls it too, passing callerPhone instead of memberId.

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { resolveMemberId } from "@/lib/services/members";
import { verifyToolRequest } from "@/lib/tool-auth";

const Body = z.object({ memberId: z.string().optional(), callerPhone: z.string().optional() });

export async function POST(req: Request) {
  const auth = await verifyToolRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const parsed = Body.safeParse(JSON.parse(auth.body));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const memberId = await resolveMemberId(parsed.data);
  if (!memberId) return Response.json({ error: "could_not_resolve_member" }, { status: 400 });

  const rows = await db
    .select({
      productId: schema.usualItem.productId,
      quantity: schema.usualItem.typicalQuantity,
      name: schema.product.name,
      priceCents: schema.product.priceCents,
    })
    .from(schema.usualItem)
    .innerJoin(schema.product, eq(schema.product.id, schema.usualItem.productId))
    .where(eq(schema.usualItem.memberId, memberId));

  return Response.json({ items: rows });
}
