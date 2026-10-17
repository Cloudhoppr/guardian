import { index, integer, pgTable, text } from "drizzle-orm/pg-core";

import { id, timestamps } from "../columns";
import { channel } from "../enums";

// In-flight cart before approval. A cart is immutable once approved — the
// corresponding row in `order` is the frozen version. Keeping carts separate
// lets the agent iterate (add/remove items) without touching order history.
export const cart = pgTable(
  "cart",
  {
    id: id(),
    memberId: text("member_id").notNull(),
    openedChannel: channel("opened_channel").notNull(),
    note: text("note"),
    ...timestamps(),
  },
  (t) => [index("cart_member_idx").on(t.memberId)],
);

export const cartItem = pgTable(
  "cart_item",
  {
    id: id(),
    cartId: text("cart_id")
      .notNull()
      .references(() => cart.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    quantity: integer("quantity").notNull().default(1),
    priceCentsAtAdd: integer("price_cents_at_add").notNull(),
    ...timestamps(),
  },
  (t) => [index("cart_item_cart_idx").on(t.cartId)],
);
