import { desc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SeniorView() {
  const [member] = await db.select().from(schema.member).limit(1);
  if (!member) {
    return <Big>No member set up yet.</Big>;
  }

  const [latestPaid] = await db
    .select()
    .from(schema.order)
    .where(eq(schema.order.memberId, member.id))
    .orderBy(desc(schema.order.paidAt))
    .limit(1);

  const [latestRx] = await db
    .select()
    .from(schema.prescription)
    .where(eq(schema.prescription.memberId, member.id))
    .orderBy(desc(schema.prescription.updatedAt))
    .limit(1);

  return (
    <main style={{ display: "grid", gap: 32 }}>
      <Big>Hello, {member.preferredName}.</Big>
      {latestPaid ? (
        <Big>Your groceries are on the way.</Big>
      ) : (
        <Big>No orders right now.</Big>
      )}
      {latestRx ? <Big>{latestRx.drug}: {latestRx.refillsLeft} refills left.</Big> : null}
      <a href="tel:+10000000000" style={{
        display: "block",
        padding: 32,
        background: "var(--accent)",
        color: "#000",
        fontSize: 36,
        fontWeight: 700,
        textAlign: "center",
        borderRadius: 16,
        textDecoration: "none",
      }}>Call my family</a>
    </main>
  );
}

function Big({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 42, lineHeight: 1.3, fontWeight: 600 }}>{children}</div>;
}
