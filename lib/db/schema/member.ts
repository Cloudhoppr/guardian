import { date, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { id, timestamps } from "../columns";
import { approverRole } from "../enums";

// The elderly parent. Identified on inbound by caller ID + optional PIN; no
// account, no app. phoneE164 is unique because inbound call routing resolves
// by phone alone (unlike nestegg, we don't share phones across demo members).
export const member = pgTable(
  "member",
  {
    id: id(),
    fullName: text("full_name").notNull(),
    preferredName: text("preferred_name").notNull(),
    phoneE164: text("phone_e164").notNull(),
    // DOB appears on the pharmacy pickup message, so it has to be real.
    dateOfBirth: date("date_of_birth").notNull(),
    dietaryPrefs: text("dietary_prefs").array().notNull().default([]),
    timezone: text("timezone").notNull().default("America/Los_Angeles"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("member_phone_idx").on(t.phoneE164)],
);

// The adult child. One per family in the demo; schema supports more because
// a viewer role might watch the dashboard without decision rights.
export const approver = pgTable(
  "approver",
  {
    id: id(),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    phoneE164: text("phone_e164").notNull(),
    email: text("email"),
    role: approverRole("role").notNull().default("primary"),
    ...timestamps(),
  },
  (t) => [
    index("approver_member_idx").on(t.memberId),
    uniqueIndex("approver_member_phone_idx").on(t.memberId, t.phoneE164),
  ],
);

// Family rules that drive the auto-approve / needs-approval decision. One row
// per member; the primary approver edits it from the dashboard.
export const familyRules = pgTable("family_rules", {
  id: id(),
  memberId: text("member_id")
    .notNull()
    .unique()
    .references(() => member.id, { onDelete: "cascade" }),
  autoApproveUnderCents: integer("auto_approve_under_cents").notNull().default(5000),
  dailySpendCapCents: integer("daily_spend_cap_cents").notNull().default(15000),
  // When true, everything blocks regardless of other rules. One text toggles it.
  frozen: integer("frozen").notNull().default(0),
  ...timestamps(),
});
