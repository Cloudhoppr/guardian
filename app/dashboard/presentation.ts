// Presentation only: backend states remain the source of truth.
export const orderStatusLabels: Record<string, string> = {
  pending_approval: "Awaiting family review", approved: "Approved", denied: "Declined",
  paid: "Payment recorded", delivered: "Delivered", cancelled: "Cancelled",
};

export function humanStage(stage: string): string {
  const labels: Record<string, string> = {
    call_received: "Call received", acknowledged: "Request acknowledged", intake_processing: "Understanding the request",
    cart_built: "Order prepared", checking: "Safety review started", approved_auto: "Approved by family rules",
    needs_approval: "Family review requested", approver_notified: "Family notified", approved_by_elena: "Approved by family",
    denied_by_elena: "Declined by family", paid: "Payment recorded", delivery_scheduled: "Delivery scheduled",
    refused_scam: "Request stopped for safety", error: "Request needs attention",
  };
  return labels[stage] ?? stage.replace(/_/g, " ");
}

export type StepState = "done" | "active" | "pending" | "blocked";
export function workflowFor(status: string, stages: string[]) {
  const lastStage = stages[stages.length - 1];
  const blocked = lastStage === "refused_scam" || lastStage === "error";
  const stopped = status === "denied" || status === "cancelled" || blocked;
  const approved = ["approved", "paid", "delivered"].includes(status);
  const paid = ["paid", "delivered"].includes(status);
  const reviewed = approved || status === "denied" || stages.some(s => ["needs_approval", "approver_notified", "approved_auto", "approved_by_elena", "denied_by_elena"].includes(s));
  return [
    { title: "Request", text: "Order recorded", state: "done" as StepState },
    { title: "Safety review", text: blocked ? "Needs attention" : reviewed ? "Review recorded" : "Awaiting review", state: (blocked ? "blocked" : reviewed ? "done" : stopped ? "pending" : "active") as StepState },
    { title: "Family decision", text: status === "denied" ? "Declined" : approved ? "Approved" : status === "pending_approval" ? "Awaiting approval" : "No decision recorded", state: (status === "denied" ? "blocked" : approved ? "done" : stopped ? "pending" : reviewed ? "active" : "pending") as StepState },
    { title: "Payment", text: paid ? "Payment recorded" : "Not recorded", state: (paid ? "done" : !stopped && approved ? "active" : "pending") as StepState },
    { title: "Delivery", text: status === "delivered" ? "Delivered" : stages.includes("delivery_scheduled") ? "Scheduled" : "Not confirmed", state: (status === "delivered" ? "done" : !stopped && paid ? "active" : "pending") as StepState },
  ];
}

export function formatCents(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

export function reviewReason(reason: string): string {
  const labels: Record<string, string> = {
    contains_new_item_or_over_cap: "The request contains an unfamiliar item or exceeds the auto-approval threshold.",
    no_rules_configured: "Family approval rules have not been configured.",
    family_freeze_active: "The family freeze was enabled when this request was checked.",
    scam_shield_flagged: "Scam Shield flagged this request for safety.",
    high_risk_score: "The risk score requires a family review.",
    over_daily_cap: "The request exceeds the configured daily spending cap.",
    usual_items_under_cap: "The request contains familiar items and is within the auto-approval threshold.",
  };
  return labels[reason] ?? reason.replace(/_/g, " ");
}
