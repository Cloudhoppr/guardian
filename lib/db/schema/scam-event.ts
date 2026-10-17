import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { id, timestamps } from "../columns";
import { channel, scamReason } from "../enums";

// Every scam attempt the shield blocks goes here. This is the dashboard's
// "wall of blocked bad stuff" and the demo money shot.
export const scamEvent = pgTable(
  "scam_event",
  {
    id: id(),
    memberId: text("member_id").notNull(),
    channelOrigin: channel("channel_origin").notNull(),
    rawMessage: text("raw_message").notNull(),
    riskScore: integer("risk_score").notNull(),
    reasons: scamReason("reasons").array().notNull(),
    blockedAt: timestamp("blocked_at").defaultNow().notNull(),
    ...timestamps(),
  },
  (t) => [index("scam_event_member_idx").on(t.memberId)],
);
