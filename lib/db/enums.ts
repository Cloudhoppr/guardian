import { pgEnum } from "drizzle-orm/pg-core";

export const approverRole = pgEnum("approver_role", ["primary", "viewer"]);

export const productCategory = pgEnum("product_category", ["grocery", "otc"]);

// What happens after the agent builds a cart. Instant-auto = under the dollar
// limit and all items on the usual list; needs-approval = anything else;
// block = scam shield fired or freeze is on.
export const decisionAction = pgEnum("decision_action", [
  "auto_approve",
  "needs_approval",
  "block",
]);

export const orderStatus = pgEnum("order_status", [
  "pending_approval",
  "approved",
  "denied",
  "paid",
  "delivered",
  "cancelled",
]);

export const approvalDecision = pgEnum("approval_decision", [
  "pending",
  "approved",
  "denied",
  "expired",
]);

export const scamReason = pgEnum("scam_reason", [
  "gift_card",
  "irs_impersonation",
  "medicare_impersonation",
  "grandchild_story",
  "urgency",
  "secrecy",
  "fake_pharmacy",
  "unknown_contact",
  "llm_flagged",
]);

// Prescription refill result returned to the agent.
export const refillStatus = pgEnum("refill_status", [
  "ready",
  "requested",
  "no_refills_left",
  "pharmacy_closed",
]);

// Channel the member spoke on.
export const channel = pgEnum("channel", ["sms", "imessage", "voice"]);

// Timeline stages Grandma's phone (and the dashboard) sees as an order moves
// through CREAO's work. These are the only strings allowed in order_event.stage
// — if the Purchaser agent sends a stage not in this list, the status_update
// endpoint rejects it, so we can trust the dashboard timeline is consistent.
export const orderEventStage = pgEnum("order_event_stage", [
  "call_received",
  "acknowledged",
  "intake_processing",
  "cart_built",
  "checking",
  "approved_auto",
  "needs_approval",
  "approver_notified",
  "approved_by_elena",
  "denied_by_elena",
  "paid",
  "delivery_scheduled",
  "refused_scam",
  "error",
]);
