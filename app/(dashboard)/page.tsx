import { desc } from "drizzle-orm";

import { db, schema } from "@/lib/db";

// Family dashboard. Live orders, blocked scams, risk breakdown. Keep it one
// page for the demo — judges don't want to click around.
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [orders, scams, approvals, events] = await Promise.all([
    db.select().from(schema.order).orderBy(desc(schema.order.createdAt)).limit(10),
    db.select().from(schema.scamEvent).orderBy(desc(schema.scamEvent.blockedAt)).limit(10),
    db.select().from(schema.approval).orderBy(desc(schema.approval.requestedAt)).limit(10),
    db.select().from(schema.orderEvent).orderBy(desc(schema.orderEvent.createdAt)).limit(20),
  ]);

  return (
    <main style={{ display: "grid", gap: 24 }}>
      <Section title="Live timeline">
        {events.length === 0 ? (
          <Empty>No events yet. Trigger a call or text to see Guardian think.</Empty>
        ) : (
          events.map((e) => {
            const audioId = parseAudioId(e.payload);
            return (
              <Row key={e.id}>
                <code style={{ color: stageColor(e.stage) }}>{e.stage}</code> · {e.message}
                {audioId ? (
                  <audio
                    controls
                    src={`/api/audio/${audioId}`}
                    style={{ height: 24, verticalAlign: "middle", marginLeft: 8 }}
                  />
                ) : null}
                <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 8 }}>
                  {new Date(e.createdAt).toLocaleTimeString()}
                </span>
              </Row>
            );
          })
        )}
      </Section>

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

function parseAudioId(payload: string | null): string | null {
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload) as { audioId?: unknown };
    return typeof parsed.audioId === "string" ? parsed.audioId : null;
  } catch {
    return null;
  }
}

function stageColor(stage: string): string {
  if (stage === "paid" || stage === "approved_auto" || stage === "approved_by_elena") return "var(--good)";
  if (stage === "refused_scam" || stage === "denied_by_elena" || stage === "error") return "var(--danger)";
  if (stage === "needs_approval" || stage === "approver_notified") return "var(--accent)";
  return "var(--muted)";
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
