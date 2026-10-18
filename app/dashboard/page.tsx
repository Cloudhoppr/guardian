import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ActivityFeed, RefreshDashboard } from "./DashboardControls";
import { DashboardIcon } from "./DashboardIcon";
import { PrescriptionFollowUp } from "./PrescriptionFollowUp";
import { formatCents, humanStage, orderStatusLabels, reviewReason, workflowFor } from "./presentation";
import s from "./dashboard.module.css";

export const dynamic = "force-dynamic";

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

  const orderEvents = latestOrder ? events.filter(e => e.orderId === latestOrder.id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()) : [];
  const workflowSteps = latestOrder ? workflowFor(latestOrder.status, orderEvents.map(e => e.stage)) : [];
  const latestApproval = approvals[0];
  const matchingApproval = latestOrder ? approvals.find(a => a.orderId === latestOrder.id) : undefined;
  const pendingApprovals = approvals.filter(a => a.decision === "pending");
  const name = member?.preferredName ?? "Your family";
  const now = new Date();
  const timeZone = member?.timezone ?? "America/Los_Angeles";
  const date = (value: Date) => value.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
  const time = (value: Date) => value.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const frozen = Boolean(familyRules?.frozen);

  return <>
    <section id="overview" className={s.headingRow}>
      <div><p className={s.eyebrow}>A little closer, wherever you are</p><h1>{name === "Your family" ? "Your family, at a glance." : <>{name}, <em>at a glance.</em></>}</h1><p className={s.headingSupport}>The everyday, the updates, and the moments that need you.</p></div>
      <div className={s.headingActions}><span className={s.dateLabel}>{date(now)} <span>·</span> Updated {time(now)}</span><RefreshDashboard /></div>
    </section>

    {frozen && <div className={s.freezeBanner} role="status"><DashboardIcon name="shield" /><div><strong>Requests are paused by your family’s rules.</strong><p>The family freeze is enabled. New requests are blocked while it remains on.</p></div></div>}

    <div className={s.summaryStrip}>
      <a href="#reviews" className={s.summaryItem}><span className={s.summaryIcon}><DashboardIcon name="check" /></span><div><span className={s.metricLabel}>Pending family reviews</span><strong>{pendingApprovals.length}<small>in the latest {approvals.length} reviews</small></strong></div><span className={s.metricArrow}>↗</span></a>
      <a href="#latest-order" className={s.summaryItem}><span className={s.summaryIcon}><DashboardIcon name="bag" /></span><div><span className={s.metricLabel}>Latest order</span><strong>{latestOrder ? formatCents(latestOrder.subtotalCents) : "—"}<small>{latestOrder ? orderStatusLabels[latestOrder.status] : "No order recorded"}</small></strong></div><span className={s.metricArrow}>↗</span></a>
      <a href="#safeguards" className={s.summaryItem}><span className={s.summaryIcon}><DashboardIcon name="shield" /></span><div><span className={s.metricLabel}>Daily spending cap</span><strong>{familyRules ? formatCents(familyRules.dailySpendCapCents) : "Not set"}<small>{frozen ? "Family freeze enabled" : "Your configured family limit"}</small></strong></div><span className={s.metricArrow}>↗</span></a>
    </div>

    <section id="reviews" className={pendingApprovals.length ? s.reviewPanel : s.clearPanel}>
      <div className={s.reviewHeading}><span className={s.panelIcon}><DashboardIcon name={pendingApprovals.length ? "check" : "shield"} size={25} /></span><div><p className={s.eyebrow}>{pendingApprovals.length ? "Your attention makes the difference" : "A little breathing room"}</p><h2>{pendingApprovals.length ? `${pendingApprovals.length} request${pendingApprovals.length === 1 ? " needs" : "s need"} a family review.` : "No pending reviews among recent requests."}</h2><p>{pendingApprovals.length ? "Open a request to see its recorded review and decision status." : "New review requests will appear here. Refresh to check for updates."}</p></div><span className={s.reviewCount}>{pendingApprovals.length ? String(pendingApprovals.length).padStart(2, "0") : "✓"}</span></div>
      {pendingApprovals.length > 0 && <div className={s.reviewList}>{pendingApprovals.map(a => <a key={a.id} href={`/approvals/${a.id}`} className={s.reviewItem}><div><strong>Request #{a.orderId.slice(0, 6)}</strong><span>{date(a.requestedAt)} · {time(a.requestedAt)} · Risk score {a.riskScore}</span></div><span className={a.expiresAt <= now ? s.warningBadge : s.neutralBadge}>{a.expiresAt <= now ? "Past expiry · status pending" : "Awaiting decision"}</span><span className={s.reviewLink}>View request <DashboardIcon name="arrow" size={17} /></span></a>)}</div>}
    </section>

    <div className={s.contentGrid}>
      <div className={s.primaryColumn}>
        <section id="latest-order" className={s.orderPanel}>
          <div className={s.panelHeading}><div><p className={s.eyebrow}>The everyday essentials</p><h2>The latest request.</h2></div><span className={s.outlineIcon}><DashboardIcon name="bag" size={25} /></span></div>
          {latestOrder ? <>
            <div className={s.orderSummary}><div><span className={s.subLabel}>Order #{latestOrder.id.slice(0, 6)} · {date(latestOrder.createdAt)}</span><h3>{cartItems.some(i => i.category === "otc") ? "Groceries & everyday essentials" : "Everyday essentials"}</h3><p>{totalQuantity} item{totalQuantity === 1 ? "" : "s"} in this request</p></div><strong className={s.orderAmount}>{formatCents(latestOrder.subtotalCents)}</strong></div>
            <div className={s.orderStatusRow}><span className={["denied", "cancelled"].includes(latestOrder.status) ? s.warningBadge : latestOrder.status === "pending_approval" ? s.neutralBadge : s.successBadge}>{orderStatusLabels[latestOrder.status] ?? latestOrder.status}</span><span>Recorded order status</span></div>
            <ol className={s.workflowList} aria-label="Latest request progress">{workflowSteps.map((step, i) => <li key={step.title} className={s.workflowStep} data-state={step.state}><span className={s.stepDot}>{step.state === "done" ? <DashboardIcon name="check" size={13} /> : step.state === "blocked" ? "!" : i + 1}</span><h4>{step.title}</h4><p>{step.text}</p><span className="sr-only">{step.state}</span></li>)}</ol>
            <details className={s.orderItems}><summary>Inside the request <span>{cartItems.length} product{cartItems.length === 1 ? "" : "s"} <b aria-hidden="true">+</b></span></summary>{cartItems.length ? <ul>{cartItems.map((item, i) => <li key={i}><span>{item.quantity} × {item.productName ?? "Product unavailable"}</span><span>{formatCents(item.priceCentsAtAdd * item.quantity)}</span></li>)}</ul> : <p className={s.emptyNote}>No line items recorded for this order.</p>}</details>
            {matchingApproval && <a className={s.textLink} href={`/approvals/${matchingApproval.id}`}>View the recorded family review <DashboardIcon name="arrow" size={17} /></a>}
          </> : <div className={s.emptyState}><DashboardIcon name="bag" size={30} /><h3>Room for the everyday.</h3><p>When a request becomes an order, its items and recorded progress will appear here.</p></div>}
        </section>

        <section id="activity" className={s.activityPanel}>
          <div className={s.panelHeading}><div><p className={s.eyebrow}>The story, as it happens</p><h2>Recent activity.</h2></div><span className={s.panelCount}>{events.length} events</span></div>
          <ActivityFeed entries={events.map(e => ({ id: e.id, title: humanStage(e.stage), message: e.message, timestamp: `${date(e.createdAt)} · ${time(e.createdAt)}`, dateTime: e.createdAt.toISOString(), category: ["refused_scam", "error", "checking"].includes(e.stage) ? "safety" : ["needs_approval", "approver_notified", "approved_by_elena", "denied_by_elena", "approved_auto"].includes(e.stage) ? "reviews" : "requests" }))} />
          <p className={s.panelFootnote}>Latest {events.length} recorded events · Times shown in {timeZone.replace(/_/g, " ")}</p>
        </section>
      </div>

      <aside className={s.secondaryColumn} aria-label="Family safeguards and routines">
        <section id="safeguards" className={s.safetyPanel}>
          <div className={s.safetyTitle}><DashboardIcon name="shield" size={24} /><span>Thoughtful safeguards</span></div><h2>A little care.<br />Clear boundaries.</h2>
          <dl className={s.rulesList}><div><dt>Daily spending cap</dt><dd>{familyRules ? formatCents(familyRules.dailySpendCapCents) : "Not set"}</dd></div><div><dt>Auto-approval threshold</dt><dd>{familyRules ? formatCents(familyRules.autoApproveUnderCents) : "Not set"}</dd></div><div><dt>Family freeze</dt><dd>{familyRules ? frozen ? "Enabled · requests paused" : "Off" : "Not configured"}</dd></div></dl>
          <p className={s.safetyNote}>Auto-approval also depends on familiar items, risk checks, and your family’s rules.</p>
          {latestApproval ? <div className={s.lastReview}><span className={s.subLabel}>Latest recorded review</span><div><strong>{latestApproval.riskScore}<small> / 100 risk score</small></strong><span>{latestApproval.decision}</span></div>{latestApproval.reasons.length ? <ul>{latestApproval.reasons.map((reason, i) => <li key={i}>{reviewReason(reason)}</li>)}</ul> : <p>No reasons were recorded.</p>}<a href={`/approvals/${latestApproval.id}`}>See review details ↗</a></div> : <p className={s.safetyNote}>No safety review recorded yet.</p>}
        </section>

        <section className={s.shieldPanel}><div className={s.panelHeading}><h2>Scam Shield</h2><DashboardIcon name="shield" /></div><p className={s.shieldCount}>{scams.length}<span>recent blocked request{scams.length === 1 ? "" : "s"}</span></p><p className={s.emptyNote}>From the latest {scams.length} recorded scam events.</p>{scams.length > 0 && <details className={s.blockedDetails}><summary>View recorded blocks <span aria-hidden="true">+</span></summary><ul>{scams.map(event => <li key={event.id}><strong>{date(event.blockedAt)} · {time(event.blockedAt)}</strong><p>{event.reasons.map(r => r.replace(/_/g, " ")).join(" · ") || "No reason recorded"}</p></li>)}</ul></details>}</section>

        <PrescriptionFollowUp records={prescriptions} />
        <div className={s.familyNote}><DashboardIcon name="phone" size={24} /><p>Their independence.<br /><em>Your peace of mind.</em></p><span>Everyday help, a phone call away.</span></div>
      </aside>
    </div>
    <footer className={s.footer}><span>guardian. <span>·</span> A little help. A lot of life.</span><span>{approver?.fullName ?? "Family"} · {member ? `${name}’s recorded activity` : "No family member linked"} · Sandbox payments</span></footer>
  </>;
}
