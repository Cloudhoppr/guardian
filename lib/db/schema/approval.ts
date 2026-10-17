import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { id, timestamps } from "../columns";
import { approvalDecision, decisionAction } from "../enums";

// One approval cycle per order. action is what the rules engine recommended
// before the human saw it; decision is what actually happened.
export const approval = pgTable(
  "approval",
  {
    id: id(),
    orderId: text("order_id").notNull(),
    approverId: text("approver_id").notNull(),
    riskScore: integer("risk_score").notNull(),
    reasons: text("reasons").array().notNull().default([]),
    recommendedAction: decisionAction("recommended_action").notNull(),
    decision: approvalDecision("decision").notNull().default("pending"),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    decidedAt: timestamp("decided_at"),
    expiresAt: timestamp("expires_at").notNull(),
    ...timestamps(),
  },
  (t) => [index("approval_order_idx").on(t.orderId), index("approval_approver_idx").on(t.approverId)],
);
