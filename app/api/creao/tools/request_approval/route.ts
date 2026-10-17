// POST /api/creao/tools/request_approval
// Freezes the cart into an order, creates an approval row, and texts the
// approver via Photon. Returns approvalId so CREAO can poll or wait for the
// answer endpoint to be called.

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { verifyCreaoRequest } from "@/lib/creao-auth";
import { db, schema } from "@/lib/db";
import { askAgent } from "@/lib/providers/creao";
import { sendText } from "@/lib/providers/photon";

const Body = z.object({
  memberId: z.string(),
  cartId: z.string(),
  riskScore: z.number().int().min(0).max(100),
  reasons: z.array(z.string()),
  recommendedAction: z.enum(["auto_approve", "needs_approval", "block"]),
});

const APPROVAL_TTL_MINUTES = 30;

export async function POST(req: Request) {
  const auth = await verifyCreaoRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const parsed = Body.safeParse(JSON.parse(auth.body));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  const items = await db.select().from(schema.cartItem).where(eq(schema.cartItem.cartId, input.cartId));
  const subtotalCents = items.reduce((s, it) => s + it.priceCentsAtAdd * it.quantity, 0);

  const [order] = await db
    .insert(schema.order)
    .values({ memberId: input.memberId, cartId: input.cartId, subtotalCents })
    .returning();

  const [approver] = await db
    .select()
    .from(schema.approver)
    .where(and(eq(schema.approver.memberId, input.memberId), eq(schema.approver.role, "primary")))
    .limit(1);
  if (!approver) return Response.json({ error: "no_primary_approver" }, { status: 400 });

  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MINUTES * 60 * 1000);
  const [approval] = await db
    .insert(schema.approval)
    .values({
      orderId: order!.id,
      approverId: approver.id,
      riskScore: input.riskScore,
      reasons: input.reasons,
      recommendedAction: input.recommendedAction,
      expiresAt,
    })
    .returning();

  const composed = await askAgent({
    memberId: input.memberId,
    intent: "compose_approval_request",
    payload: { subtotalCents, itemCount: items.length, reasons: input.reasons },
  });
  const body = composed.ok ? composed.text : `Guardian: approve $${(subtotalCents / 100).toFixed(2)} order? Reply YES or NO.`;

  await sendText({ to: approver.phoneE164, body });

  return Response.json({ approvalId: approval!.id, orderId: order!.id, expiresAt });
}
