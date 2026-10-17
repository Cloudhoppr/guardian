// POST /api/creao/tools/search_products
// Simple catalog search. For the demo, LIKE on name + aliases is enough.

import { ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

import { verifyCreaoRequest } from "@/lib/creao-auth";
import { db, schema } from "@/lib/db";

const Body = z.object({ query: z.string().min(1), limit: z.number().int().positive().max(20).default(5) });

export async function POST(req: Request) {
  const auth = await verifyCreaoRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const parsed = Body.safeParse(JSON.parse(auth.body));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const q = `%${parsed.data.query}%`;
  const rows = await db
    .select({ id: schema.product.id, name: schema.product.name, priceCents: schema.product.priceCents, category: schema.product.category })
    .from(schema.product)
    .where(or(ilike(schema.product.name, q), sql`${schema.product.aliases}::text ILIKE ${q}`))
    .limit(parsed.data.limit);

  return Response.json({ results: rows });
}
