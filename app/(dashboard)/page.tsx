import { desc } from "drizzle-orm";

import { db, schema } from "@/lib/db";

// Family dashboard. Live orders, blocked scams, risk breakdown. Keep it one
// page for the demo — judges don't want to click around.
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [orders, scams, approvals] = await Promise.all([
    db.select().from(schema.order).orderBy(desc(schema.order.createdAt)).limit(10),
    db.select().from(schema.scamEvent).orderBy(desc(schema.scamEvent.blockedAt)).limit(10),
    db.select().from(schema.approval).orderBy(desc(schema.approval.requestedAt)).limit(10),
  ]);

  return (
    <main style={{ display: "grid", gap: 24 }}>
      <Section title="Pending approvals">
        {approvals.filter((a) => a.decision === "pending").length === 0 ? (
          <Empty>Nothing waiting.</Empty>
        ) : (
          approvals
            .filter((a) => a.decision === "pending")
            .map((a) => (
              <Row key={a.id}>
                <strong>Risk {a.riskScore}</strong> · {a.reasons.join(", ")} · <a href={`/approvals/${a.id}`}>view</a>
              </Row>
            ))
        )}
      </Section>

      <Section title="Recent orders">
        {orders.length === 0 ? <Empty>No orders yet.</Empty> : orders.map((o) => (
          <Row key={o.id}>
            <code>{o.id.slice(0, 6)}</code> · ${(o.subtotalCents / 100).toFixed(2)} · <em>{o.status}</em>
          </Row>
        ))}
      </Section>

      <Section title="Blocked scams">
        {scams.length === 0 ? <Empty>Nothing blocked.</Empty> : scams.map((s) => (
          <Row key={s.id}>
            <strong style={{ color: "var(--danger)" }}>blocked</strong> · {s.reasons.join(", ")} · <q>{s.rawMessage}</q>
          </Row>
        ))}
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--panel)", borderRadius: 12, padding: 20 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</h2>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 14, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{children}</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 14, color: "var(--muted)" }}>{children}</div>;
}
