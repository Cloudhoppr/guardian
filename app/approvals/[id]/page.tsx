import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { DashboardIcon } from "../../dashboard/DashboardIcon";
import { RefreshDashboard } from "../../dashboard/DashboardControls";
import { formatCents, orderStatusLabels, reviewReason } from "../../dashboard/presentation";
import s from "../../dashboard/dashboard.module.css";

export const dynamic = "force-dynamic";

export default async function ApprovalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [approval] = await db.select().from(schema.approval).where(eq(schema.approval.id, id)).limit(1);
  if (!approval) notFound();

  const [order] = await db.select().from(schema.order).where(eq(schema.order.id, approval.orderId)).limit(1);
  // Read the catalog label alongside the original cart snapshot. Prices stay
  // anchored to priceCentsAtAdd, never the current catalog price.
  const items = order
    ? await db.select({ id: schema.cartItem.id, quantity: schema.cartItem.quantity, priceCentsAtAdd: schema.cartItem.priceCentsAtAdd, productName: schema.product.name })
      .from(schema.cartItem).leftJoin(schema.product, eq(schema.cartItem.productId, schema.product.id))
      .where(eq(schema.cartItem.cartId, order.cartId))
    : [];
  const pending = approval.decision === "pending";
  const pastExpiry = pending && approval.expiresAt.getTime() <= Date.now();
  const status = { pending: "Awaiting a family decision", approved: "Approved by family", denied: "Declined by family", expired: "Review expired" }[approval.decision];
  const recommendation = { auto_approve: "Automatic approval", needs_approval: "Family review", block: "Stop request" }[approval.recommendedAction];
  const dateTime = (date: Date) => date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles", timeZoneName: "short" });

  return <>
    <Link href="/dashboard#reviews" className={s.backLink}>← Back to family reviews</Link>
    <section className={s.headingRow}><div><p className={s.eyebrow}>A clear view before the next step</p><h1>Request <em>review.</em></h1><p className={s.headingSupport}>Review #{approval.id.slice(0, 6)} · Requested {dateTime(approval.requestedAt)}</p></div><RefreshDashboard /></section>
    <section className={s.reviewDetailBanner} data-decision={approval.decision}><DashboardIcon name="shield" size={28} /><div><p className={s.eyebrow}>Recorded family decision</p><h2>{status}</h2><p>{approval.decidedAt ? `Decision recorded ${dateTime(approval.decidedAt)}.` : pastExpiry ? "The expiry time has passed, but the stored review status is still pending." : "No family decision has been recorded for this review."}</p></div><span className={pending ? s.neutralBadge : approval.decision === "approved" ? s.successBadge : s.warningBadge}>{approval.decision}</span></section>
    <div className={s.reviewDetailGrid}>
      <section className={s.orderPanel}>
        <div className={s.panelHeading}><div><p className={s.eyebrow}>What was requested</p><h2>Inside the order.</h2></div><DashboardIcon name="bag" size={24} /></div>
        {order ? <>
          <div className={s.reviewOrderMeta}><span>Order #{order.id.slice(0, 6)}</span><span className={["denied", "cancelled"].includes(order.status) ? s.warningBadge : order.status === "pending_approval" ? s.neutralBadge : s.successBadge}>{orderStatusLabels[order.status]}</span></div>
          {items.length ? <div className={s.tableScroll}><table className={s.reviewTable}><caption className="sr-only">Requested products and recorded prices</caption><thead><tr><th scope="col">Item</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Total</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><th scope="row">{item.productName ?? "Product no longer in catalog"}</th><td>{item.quantity}</td><td>{formatCents(item.priceCentsAtAdd)}</td><td>{formatCents(item.quantity * item.priceCentsAtAdd)}</td></tr>)}</tbody></table></div> : <p className={s.emptyNote}>No line items are recorded for this order.</p>}
          <div className={s.reviewSubtotal}><span>Recorded order subtotal</span><strong>{formatCents(order.subtotalCents)}</strong></div><p className={s.panelFootnote}>Item prices are recorded at the time they were added. The subtotal is the amount saved on the order.</p>
        </> : <p className={s.emptyNote}>The order linked to this review could not be found.</p>}
      </section>
      <aside className={s.reviewAside}>
        <section className={s.safetyPanel}><div className={s.safetyTitle}><DashboardIcon name="shield" /><span>Why this review exists</span></div><h2>Context for<br />the decision.</h2><div className={s.reviewRisk}><strong>{approval.riskScore}<small> / 100</small></strong><span>Recorded risk score</span></div><p className={s.safetyNote}>A low risk score does not mean a request meets every family rule.</p><ul className={s.reviewReasons}>{approval.reasons.length ? approval.reasons.map((reason, i) => <li key={i}>{reviewReason(reason)}</li>) : <li>No reasons were saved with this review.</li>}</ul><dl className={s.rulesList}><div><dt>Recommended action</dt><dd>{recommendation}</dd></div><div><dt>Review expires</dt><dd>{dateTime(approval.expiresAt)}</dd></div></dl></section>
        <section className={s.decisionHelp}><DashboardIcon name="phone" /><h2>How decisions reach Guardian</h2><p>Family decisions are recorded through Guardian’s existing approval-message workflow. This page shows the saved review; it does not submit an approval or payment.</p><Link href="/dashboard#activity" className={s.textLink}>Check recent activity <DashboardIcon name="arrow" size={16} /></Link></section>
      </aside>
    </div>
  </>;
}
