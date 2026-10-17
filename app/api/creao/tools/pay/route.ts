// POST /api/creao/tools/pay
// Direct charge endpoint (bypass of record_approval_answer) for the rare case
// where an order is already approved and CREAO needs to retry a charge.

import { eq } from "drizzle-orm";
import { z } from "zod";

import { verifyCreaoRequest } from "@/lib/creao-auth";
import { db, schema } from "@/lib/db";
import { charge } from "@/lib/services/payments";

const Body = z.object({ orderId: z.string() });

export async function POST(req: Request) {
  const auth = await verifyCreaoRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const parsed = Body.safeParse(JSON.parse(auth.body));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const [order] = await db.select().from(schema.order).where(eq(schema.order.id, parsed.data.orderId)).limit(1);
  if (!order) return Response.json({ error: "not_found" }, { status: 404 });
  if (order.status !== "approved") return Response.json({ error: `bad_status:${order.status}` }, { status: 409 });

  const result = await charge({ orderId: order.id, amountCents: order.subtotalCents, merchantCategory: "grocery" });
  await db
    .update(schema.order)
    .set({ status: "paid", paidAt: new Date().toISOString(), paidVisaRef: result.ref })
    .where(eq(schema.order.id, order.id));

  return Response.json({ ok: true, ref: result.ref, mode: result.mode });
}
