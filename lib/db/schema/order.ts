import { index, integer, pgTable, text } from "drizzle-orm/pg-core";

import { id, timestamps } from "../columns";
import { orderStatus } from "../enums";

// Frozen snapshot of a cart at the moment approval was requested. Keeps
// price history even if the catalog changes later.
export const order = pgTable(
  "order",
  {
    id: id(),
    memberId: text("member_id").notNull(),
    cartId: text("cart_id").notNull(),
    status: orderStatus("status").notNull().default("pending_approval"),
    subtotalCents: integer("subtotal_cents").notNull(),
    paidAt: text("paid_at"),
    paidVisaRef: text("paid_visa_ref"),
    ...timestamps(),
  },
  (t) => [index("order_member_idx").on(t.memberId), index("order_status_idx").on(t.status)],
);
