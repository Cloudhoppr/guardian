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
