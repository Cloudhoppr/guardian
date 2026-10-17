import { index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { id, timestamps } from "../columns";

// One fake pharmacy in the demo. Phone is on the pickup message the approver
// receives, so make it realistic even in seed.
export const pharmacy = pgTable("pharmacy", {
  id: id(),
  name: text("name").notNull(),
  phoneE164: text("phone_e164").notNull(),
  address: text("address").notNull(),
  ...timestamps(),
});

// Doctor-written prescriptions Guardian can refill — Guardian never creates
// new ones. refillsLeft = 0 is a valid state; the agent prompts a renewal.
export const prescription = pgTable(
  "prescription",
  {
    id: id(),
    memberId: text("member_id").notNull(),
    pharmacyId: text("pharmacy_id")
      .notNull()
      .references(() => pharmacy.id, { onDelete: "restrict" }),
    rxNumber: text("rx_number").notNull(),
    drug: text("drug").notNull(),
    refillsLeft: integer("refills_left").notNull(),
    daysSupply: integer("days_supply").notNull().default(30),
    lastFilledOn: text("last_filled_on"),
    ...timestamps(),
  },
  (t) => [
    index("prescription_member_idx").on(t.memberId),
    uniqueIndex("prescription_rx_idx").on(t.pharmacyId, t.rxNumber),
  ],
);
