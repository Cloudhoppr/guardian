import { desc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

// Groups of order_event.stage values, in pipeline order, matching the 5-step
// "Guardian in action" process: Request received -> Order prepared -> Family
// safeguards -> Payment -> Order completed. Grouping real enum values under a
// human label, not inventing new states.
const WORKFLOW_GROUPS = [
  { title: "Request received", text: "An ordinary conversation.", stages: ["call_received", "acknowledged", "intake_processing"] },
  { title: "Order prepared", text: "The usual essentials.", stages: ["cart_built"] },
  { title: "Family safeguards", text: "Your family's rules, checked.", stages: ["checking", "refused_scam", "error"] },
  {
    title: "Payment",
    text: "The next step, after approval.",
    stages: ["approved_auto", "needs_approval", "approver_notified", "approved_by_elena", "denied_by_elena", "paid"],
  },
  { title: "Order completed", text: "A clear record for your family.", stages: ["delivery_scheduled"] },
] as const;

const BLOCKED_STAGES = new Set(["refused_scam", "error"]);
const HIGH_RISK_THRESHOLD = 70; // mirrors lib/services/rules.ts

type OrderEvent = typeof schema.orderEvent.$inferSelect;
type StepState = "done" | "active" | "pending" | "blocked";

function computeWorkflowSteps(orderEvents: OrderEvent[]) {
  let blocked = false;

  const matches = WORKFLOW_GROUPS.map((group) => {
    const match = [...orderEvents].reverse().find((e) => (group.stages as readonly string[]).includes(e.stage));
    const isBlocked = match ? BLOCKED_STAGES.has(match.stage) : false;
    if (isBlocked) blocked = true;
    return { group, match, isBlocked };
  });

  const lastMatchedIndex = matches.reduce((acc, s, i) => (s.match ? i : acc), -1);

  return matches.map(({ group, match, isBlocked }, i) => {
    const implicitlyDone = !blocked && i < lastMatchedIndex;
    const done = Boolean(match) || implicitlyDone;
    const active = !blocked && !done && i === lastMatchedIndex + 1;
    const state: StepState = isBlocked ? "blocked" : done ? "done" : active ? "active" : "pending";
    return { title: group.title, text: group.text, state };
  });
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function humanStage(stage: string): string {
  const labels: Record<string, string> = {
    call_received: "Call received",
    acknowledged: "Request acknowledged",
    intake_processing: "Request understood",
    cart_built: "Order prepared",
    checking: "Family safeguards checked",
    approved_auto: "Order approved",
    needs_approval: "Family review requested",
    approver_notified: "Family notified",
    approved_by_elena: "Approved by family",
    denied_by_elena: "Declined by family",
    paid: "Payment authorized",
    delivery_scheduled: "Order confirmed",
    refused_scam: "Request declined for safety",
    error: "Something needs a second look",
  };
  return labels[stage] ?? stage.replace(/_/g, " ");
}

export default async function Dashboard() {
  const [approver] = await db.select().from(schema.approver).limit(1);
  const [member] = await db.select().from(schema.member).limit(1);
  const [familyRules] = member
    ? await db.select().from(schema.familyRules).where(eq(schema.familyRules.memberId, member.id)).limit(1)
    : [];

  const [latestOrder] = await db.select().from(schema.order).orderBy(desc(schema.order.createdAt)).limit(1);

  const [events, approvals, scams, prescriptions] = await Promise.all([
    db.select().from(schema.orderEvent).orderBy(desc(schema.orderEvent.createdAt)).limit(10),
    db.select().from(schema.approval).orderBy(desc(schema.approval.requestedAt)).limit(10),
    db.select().from(schema.scamEvent).orderBy(desc(schema.scamEvent.blockedAt)).limit(10),
    member
      ? db.select().from(schema.prescription).where(eq(schema.prescription.memberId, member.id)).orderBy(desc(schema.prescription.updatedAt)).limit(3)
      : Promise.resolve([]),
  ]);

  const cartItems = latestOrder
    ? await db
        .select({ quantity: schema.cartItem.quantity, priceCentsAtAdd: schema.cartItem.priceCentsAtAdd, productName: schema.product.name, category: schema.product.category })
        .from(schema.cartItem)
        .leftJoin(schema.product, eq(schema.cartItem.productId, schema.product.id))
        .where(eq(schema.cartItem.cartId, latestOrder.cartId))
    : [];

  const orderEvents = latestOrder ? events.filter((e) => e.orderId === latestOrder.id || e.orderId === null).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()) : [];
  const workflowSteps = latestOrder ? computeWorkflowSteps(orderEvents) : [];

  const latestApproval = approvals[0];
  const matchingApproval = latestOrder ? approvals.find((a) => a.orderId === latestOrder.id) : undefined;
  const pendingApprovals = approvals.filter((a) => a.decision === "pending");
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

  // Group cart items by category for the summary row, matching the "Fresh
  // produce / Pantry essentials / Milk & breakfast staples" style grouping —
  // derived from the real product categories, not invented buckets.
  const itemGroups = cartItems.reduce<Record<string, number>>((acc, item) => {
    const key = item.category === "otc" ? "Household & OTC" : "Grocery essentials";
    acc[key] = (acc[key] ?? 0) + item.quantity;
    return acc;
  }, {});

  return (
    <>
      <div className={styles.breadcrumbRow}>
        <span className={styles.breadcrumb}>Your family / Overview</span>
        <span className={styles.breadcrumbDate}>{today}</span>
      </div>

      <section className={styles.heroPanel}>
        <p className={styles.heroEyebrow}>A quieter kind of support</p>
        <h1 className={styles.heroHeadline}>
          {member?.preferredName ?? "Ruth"}&rsquo;s week looks {pendingApprovals.length > 0 ? "steady" : "good"}.
        </h1>
        <p className={styles.heroSupport}>
          A quiet view of what Guardian handled, what is safe, and where your attention is needed.
        </p>
        <div className={styles.heroPills}>
          <span className={styles.pill}>
            <span className={styles.pillDot} aria-hidden="true" />
            Guardian &middot; Sandbox payments
          </span>
          <span className={styles.pill}>
            Daily order limit &middot; {familyRules ? formatCents(familyRules.dailySpendCapCents) : "Not set"}
          </span>
          <span className={styles.pillMuted}>Card status not available</span>
        </div>
      </section>

      <div className={styles.twoCol}>
        <section className={styles.col}>
          <p className={styles.sectionEyebrow}>The everyday, taken care of</p>
          <h2 className={styles.sectionTitle}>A little more peace of mind.</h2>
          <div className={styles.activityList}>
            {events.length === 0 ? (
              <p className={styles.emptyNote}>No activity yet. Trigger a call or text to see Guardian think.</p>
            ) : (
              events.slice(0, 4).map((e) => (
                <div key={e.id} className={styles.activityRow}>
                  <span className={BLOCKED_STAGES.has(e.stage) ? styles.activityCheckAlert : styles.activityCheck} aria-hidden="true">
                    {BLOCKED_STAGES.has(e.stage) ? "!" : "✓"}
                  </span>
                  <div className={styles.activityBody}>
                    <div className={styles.activityTitleRow}>
                      <span className={styles.activityTitle}>{humanStage(e.stage)}</span>
                      <span className={styles.activityTime}>{e.createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                    <p className={styles.activityText}>{e.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <a href="#" className={styles.viewLink}>
            View full activity history →
          </a>
        </section>

        <section className={styles.col}>
          <p className={styles.sectionEyebrow}>Everyday essentials</p>
          <h2 className={styles.sectionTitle}>The latest order.</h2>
          {latestOrder ? (
            <>
              <p className={styles.orderMeta}>
                {latestOrder.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric" })} &middot; {cartItems.length} item{cartItems.length === 1 ? "" : "s"} &middot; Grocery request
              </p>
              <div className={styles.orderAmountRow}>
                <span className={styles.orderLabel}>Everyday essentials</span>
                <span className={styles.orderAmount}>{formatCents(latestOrder.subtotalCents)}</span>
              </div>
              <div className={styles.orderTags}>
                <span className={styles.tag}>Family rules met</span>
                <span className={styles.tagStrong}>{latestOrder.status === "pending_approval" ? "Awaiting approval" : "Approved"}</span>
              </div>
              {Object.keys(itemGroups).length > 0 ? (
                <div className={styles.itemGroupList}>
                  {Object.entries(itemGroups).map(([label, count]) => (
                    <div key={label} className={styles.itemGroupRow}>
                      <span>{label}</span>
                      <span>{count} items</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {matchingApproval ? (
                <a href={`/approvals/${matchingApproval.id}`} className={styles.orderDetailsButton}>
                  View order details ↗
                </a>
              ) : null}
            </>
          ) : (
            <p className={styles.emptyNote}>No orders yet.</p>
          )}
        </section>
      </div>

      <section className={styles.workflowSection}>
        <p className={styles.sectionEyebrow}>Guardian in action</p>
        <h2 className={styles.sectionTitle}>A familiar request. A thoughtful process.</h2>
        {workflowSteps.length === 0 ? (
          <p className={styles.emptyNote}>No requests yet.</p>
        ) : (
          <ol className={styles.workflowList}>
            {workflowSteps.map((step, i) => (
              <li key={step.title} className={styles.workflowStep}>
                <div className={step.state === "pending" ? styles.workflowBarPending : step.state === "blocked" ? styles.workflowBarBlocked : styles.workflowBarDone} />
                <span className={styles.workflowIndex}>0{i + 1}</span>
                <h3 className={styles.workflowTitle}>{step.title}</h3>
                <p className={styles.workflowText}>{step.text}</p>
                <span
                  className={
                    step.state === "done"
                      ? styles.statusBadgeDone
                      : step.state === "active"
                        ? styles.statusBadgeActive
                        : step.state === "blocked"
                          ? styles.statusBadgeBlocked
                          : styles.statusBadgePending
                  }
                >
                  {step.state === "done" ? "Completed" : step.state === "active" ? "Active" : step.state === "blocked" ? "Needs review" : "Waiting"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.scamShieldPanel}>
        <div className={styles.scamShieldHeader}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2l8 3.5v5.3c0 5-3.4 8.9-8 10.2-4.6-1.3-8-5.2-8-10.2V5.5L12 2z" stroke="#c96b5a" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          <span className={styles.scamShieldLabel}>Scam Shield</span>
        </div>
        <h2 className={styles.scamShieldHeadline}>Thoughtful safeguards. At every step.</h2>
        {latestApproval ? (
          <>
            <h3 className={styles.scamShieldSubheading}>Family rules checked</h3>
            <p className={styles.scamShieldText}>
              {latestApproval.riskScore >= HIGH_RISK_THRESHOLD
                ? `This request scored ${latestApproval.riskScore} and was flagged for a closer look before anything happens.`
                : "This request contains usual items and is within the family's configured approval limit."}
            </p>
            <p className={styles.scamShieldMeta}>
              {latestApproval.requestedAt.toLocaleDateString("en-US", { month: "long", day: "numeric" })} &middot;{" "}
              {latestApproval.requestedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} &middot;{" "}
              {latestApproval.decision === "pending" ? "No family decision requested for this review" : `Decision: ${latestApproval.decision}`}
            </p>
          </>
        ) : (
          <p className={styles.scamShieldText}>No safety reviews yet.</p>
        )}
        {scams.length > 0 ? (
          <p className={styles.scamShieldMeta}>
            Scam Shield has blocked {scams.length} suspicious request{scams.length === 1 ? "" : "s"} for this family.
          </p>
        ) : null}
      </section>

      <div className={styles.twoCol}>
        <section className={styles.col}>
          <p className={styles.sectionEyebrow}>The familiar routine</p>
          <h2 className={styles.sectionTitle}>Prescriptions.</h2>
          {prescriptions.length === 0 ? (
            <p className={styles.emptyNote}>No prescriptions are linked to this family view yet.</p>
          ) : (
            <div className={styles.itemGroupList}>
              {prescriptions.map((rx) => (
                <div key={rx.id} className={styles.itemGroupRow}>
                  <span>{rx.drug}</span>
                  <span>{rx.refillsLeft} refills left</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.col}>
          <p className={styles.sectionEyebrow}>You&rsquo;re in the loop</p>
          <h2 className={styles.sectionTitle}>Family updates.</h2>
          <p className={styles.emptyNote}>No confirmed message deliveries to show yet. Review requests appear in your activity history.</p>
        </section>
      </div>

      <section className={pendingApprovals.length > 0 ? styles.peacePanelAlert : styles.peacePanel}>
        <div className={styles.peaceHeader}>
          <span className={styles.peaceLabel}>Family peace of mind</span>
        </div>
        <div className={styles.peaceRow}>
          <div>
            <h2 className={styles.peaceHeadline}>
              {pendingApprovals.length === 0
                ? "No requests awaiting family review."
                : `${pendingApprovals.length} request${pendingApprovals.length === 1 ? "" : "s"} awaiting family review.`}
            </h2>
            <p className={styles.peaceText}>
              {pendingApprovals.length === 0
                ? "A clear view of recorded activity, without the need to interrupt their day."
                : "Take a look when you have a moment — nothing has been acted on yet."}
            </p>
          </div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke={pendingApprovals.length > 0 ? "#c96b5a" : "#6e8a63"} strokeWidth="1.5" />
            {pendingApprovals.length === 0 ? (
              <path d="M8 12l2.5 2.5L16 9" stroke="#6e8a63" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M12 8v5M12 16h.01" stroke="#c96b5a" strokeWidth="1.5" strokeLinecap="round" />
            )}
          </svg>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>guardian. &middot; Independence, with peace of mind</span>
        <span>{approver?.fullName ?? "Family"} &middot; Connected to {member?.preferredName ?? "your family"}&rsquo;s real activity &middot; Sandbox payments</span>
      </footer>
    </>
  );
}
