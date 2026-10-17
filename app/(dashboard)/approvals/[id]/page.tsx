import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ApprovalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [approval] = await db.select().from(schema.approval).where(eq(schema.approval.id, id)).limit(1);
  if (!approval) return <p>Not found.</p>;

  const [order] = await db.select().from(schema.order).where(eq(schema.order.id, approval.orderId)).limit(1);
  const items = order
    ? await db.select().from(schema.cartItem).where(eq(schema.cartItem.cartId, order.cartId))
    : [];

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <h2>Approval {approval.id.slice(0, 6)}</h2>
      <p>Risk score: <strong>{approval.riskScore}</strong></p>
      <p>Reasons: {approval.reasons.join(", ")}</p>
      <p>Status: <strong>{approval.decision}</strong></p>
      <p>Subtotal: ${((order?.subtotalCents ?? 0) / 100).toFixed(2)}</p>
      <ul>
        {items.map((it) => (
          <li key={it.id}>{it.quantity} × product {it.productId.slice(0, 6)} @ ${(it.priceCentsAtAdd / 100).toFixed(2)}</li>
        ))}
      </ul>
    </main>
  );
}
