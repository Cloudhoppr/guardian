import { index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { id, timestamps } from "../columns";
import { productCategory } from "../enums";

// Catalog of what the demo store sells. ~30 grocery + ~15 OTC rows in seed.
// aliases is how the shopping agent finds "the cereal with the blue box".
export const product = pgTable(
  "product",
  {
    id: id(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    category: productCategory("category").notNull(),
    priceCents: integer("price_cents").notNull(),
    aliases: text("aliases").array().notNull().default([]),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("product_sku_idx").on(t.sku),
    index("product_category_idx").on(t.category),
  ],
);

// What Grandma typically reorders. Membership in this list is what makes an
// item eligible for auto-approve under the dollar cap.
export const usualItem = pgTable(
  "usual_item",
  {
    id: id(),
    memberId: text("member_id").notNull(),
    productId: text("product_id").notNull(),
    typicalQuantity: integer("typical_quantity").notNull().default(1),
    ...timestamps(),
  },
  (t) => [uniqueIndex("usual_member_product_idx").on(t.memberId, t.productId)],
);
