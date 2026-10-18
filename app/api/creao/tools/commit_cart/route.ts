// POST /api/creao/tools/commit_cart
// Freezes a cart into an order. This is the branch point for the Purchaser:
//   mode="auto"           → routine order. Creates order with status="approved"
//                            and NO approval row. Elena is NOT texted. The
//                            Purchaser's next step is pay(orderId).
//   mode="needs_approval" → not routine. Creates order with status="pending_approval"
//                            PLUS an approval row AND texts Elena with the
//                            dollar amount. The Purchaser then exits and
//                            waits for record_approval_answer.
//
// Keeping this split explicit (instead of overloading request_approval) means
// a routine order can NEVER accidentally notify Elena — the only path that
// texts her is the one that literally takes "needs_approval" as its mode.

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { verifyCreaoRequest } from "@/lib/creao-auth";
import { db, schema } from "@/lib/db";
import { sendText } from "@/lib/providers/photon";

const Body = z.object({
  memberId: z.string(),
  cartId: z.string(),
  mode: z.enum(["auto", "needs_approval"]),
  // Only required when mode="needs_approval" so the Elena text can quote the
  // risk reasons back to her.
  riskScore: z.number().int().min(0).max(100).optional(),
  reasons: z.array(z.string()).optional(),
});

const APPROVAL_TTL_MINUTES = 30;

export async function POST(req: Request) {
  const auth = await verifyCreaoRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const parsed = Body.safeParse(JSON.parse(auth.body));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  const items = await db.select().from(schema.cartItem).where(eq(schema.cartItem.cartId, input.cartId));
  if (items.length === 0) {
    return Response.json({ error: "cart_empty_or_missing" }, { status: 400 });
  }
  const subtotalCents = items.reduce((s, it) => s + it.priceCentsAtAdd * it.quantity, 0);

  if (input.mode === "auto") {
    const [order] = await db
      .insert(schema.order)
      .values({
        memberId: input.memberId,
        cartId: input.cartId,
        status: "approved",
        subtotalCents,
      })
      .returning();

    await db.insert(schema.orderEvent).values({
      memberId: input.memberId,
      orderId: order!.id,
      stage: "approved_auto",
      message: `Routine order approved: $${(subtotalCents / 100).toFixed(2)}`,
    });

    return Response.json({
      orderId: order!.id,
      status: "approved",
      subtotalCents,
      approverNotified: false,
    });
  }

  // mode === "needs_approval"
  if (input.riskScore === undefined || !input.reasons) {
    return Response.json(
      { error: "riskScore and reasons are required when mode='needs_approval'" },
      { status: 400 },
    );
  }

  const [approver] = await db
    .select()
    .from(schema.approver)
    .where(and(eq(schema.approver.memberId, input.memberId), eq(schema.approver.role, "primary")))
    .limit(1);
  if (!approver) return Response.json({ error: "no_primary_approver" }, { status: 400 });

  const [order] = await db
    .insert(schema.order)
    .values({
      memberId: input.memberId,
      cartId: input.cartId,
      status: "pending_approval",
      subtotalCents,
    })
    .returning();

  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MINUTES * 60 * 1000);
  const [approval] = await db
    .insert(schema.approval)
    .values({
      orderId: order!.id,
      approverId: approver.id,
      riskScore: input.riskScore,
      reasons: input.reasons,
      recommendedAction: "needs_approval",
      expiresAt,
    })
    .returning();

  const body = `Guardian: Ruth's order is $${(subtotalCents / 100).toFixed(2)} (${input.reasons.slice(0, 2).join(", ")}). Reply YES to approve, NO to deny.`;
  await sendText({ to: approver.phoneE164, body });

  await db.insert(schema.orderEvent).values({
    memberId: input.memberId,
    orderId: order!.id,
    stage: "approver_notified",
    message: `Texted Elena for approval: $${(subtotalCents / 100).toFixed(2)}`,
  });

  return Response.json({
    orderId: order!.id,
    approvalId: approval!.id,
    status: "pending_approval",
    subtotalCents,
    expiresAt,
    approverNotified: true,
  });
}
