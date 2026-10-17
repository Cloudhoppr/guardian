// POST /api/creao/tools/record_approval_answer
// CREAO's approval agent parses the approver's "yes"/"no" reply and calls
// this. We then either kick off payment or mark the order denied.

import { eq } from "drizzle-orm";
import { z } from "zod";

import { verifyCreaoRequest } from "@/lib/creao-auth";
import { db, schema } from "@/lib/db";
import { charge } from "@/lib/services/payments";

const Body = z.object({
  approvalId: z.string(),
  decision: z.enum(["approved", "denied"]),
});

export async function POST(req: Request) {
  const auth = await verifyCreaoRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const parsed = Body.safeParse(JSON.parse(auth.body));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const [approval] = await db
    .select()
    .from(schema.approval)
    .where(eq(schema.approval.id, parsed.data.approvalId))
    .limit(1);
  if (!approval) return Response.json({ error: "not_found" }, { status: 404 });
  if (approval.decision !== "pending") return Response.json({ error: "already_decided" }, { status: 409 });

  await db
    .update(schema.approval)
    .set({ decision: parsed.data.decision, decidedAt: new Date() })
    .where(eq(schema.approval.id, approval.id));

  if (parsed.data.decision === "denied") {
    await db.update(schema.order).set({ status: "denied" }).where(eq(schema.order.id, approval.orderId));
    return Response.json({ ok: true, charged: false });
  }

  const [order] = await db.select().from(schema.order).where(eq(schema.order.id, approval.orderId)).limit(1);
  const result = await charge({ orderId: order!.id, amountCents: order!.subtotalCents, merchantCategory: "grocery" });
  await db
    .update(schema.order)
    .set({ status: "paid", paidAt: new Date().toISOString(), paidVisaRef: result.ref })
    .where(eq(schema.order.id, order!.id));

  return Response.json({ ok: true, charged: true, ref: result.ref, mode: result.mode });
}
