import { index, pgTable, text } from "drizzle-orm/pg-core";

import { id, timestamps } from "../columns";
import { orderEventStage } from "../enums";

// Every stage of an order as CREAO's Purchaser agent works through it.
// Rows here drive two things: Grandma's running SMS updates, and the
// dashboard's timeline view. orderId is nullable because the first few
// events ("call_received", "acknowledged") fire before an order row exists.
export const orderEvent = pgTable(
  "order_event",
  {
    id: id(),
    memberId: text("member_id").notNull(),
    orderId: text("order_id"),
    stage: orderEventStage("stage").notNull(),
    message: text("message").notNull(),
    // Optional JSON blob for extra context (cart snapshot, risk reasons, etc.)
    payload: text("payload"),
    ...timestamps(),
  },
  (t) => [index("order_event_member_idx").on(t.memberId), index("order_event_order_idx").on(t.orderId)],
);
