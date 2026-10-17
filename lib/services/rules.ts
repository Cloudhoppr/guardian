import { eq } from "drizzle-orm";

import { db, schema } from "../db";

// Pure, synchronous rules engine. The risk score decides HOW bad something is;
// this file decides WHAT HAPPENS NEXT (auto-approve / needs approval / block).
// Order matters: freeze beats everything, scam beats dollar caps, dollar caps
// beat the usual-list auto-approve. Mirror this ordering in UI explanations.

export type RulesInput = {
  memberId: string;
  subtotalCents: number;
  itemProductIds: string[];
  riskScore: number;
  scamFlagged: boolean;
};

export type RulesVerdict = {
  action: "auto_approve" | "needs_approval" | "block";
  reasons: string[];
};

export async function applyRules(input: RulesInput): Promise<RulesVerdict> {
  const [rules] = await db
    .select()
    .from(schema.familyRules)
    .where(eq(schema.familyRules.memberId, input.memberId))
    .limit(1);

  if (!rules) {
    return { action: "needs_approval", reasons: ["no_rules_configured"] };
  }

  if (rules.frozen === 1) {
    return { action: "block", reasons: ["family_freeze_active"] };
  }

  if (input.scamFlagged) {
    return { action: "block", reasons: ["scam_shield_flagged"] };
  }

  if (input.riskScore >= 70) {
    return { action: "needs_approval", reasons: ["high_risk_score"] };
  }

  if (input.subtotalCents > rules.dailySpendCapCents) {
    return { action: "needs_approval", reasons: ["over_daily_cap"] };
  }

  const usualIds = new Set(
    (
      await db
        .select({ productId: schema.usualItem.productId })
        .from(schema.usualItem)
        .where(eq(schema.usualItem.memberId, input.memberId))
    ).map((r) => r.productId),
  );
  const everyItemIsUsual = input.itemProductIds.every((id) => usualIds.has(id));

  if (everyItemIsUsual && input.subtotalCents <= rules.autoApproveUnderCents) {
    return { action: "auto_approve", reasons: ["usual_items_under_cap"] };
  }

  return { action: "needs_approval", reasons: ["contains_new_item_or_over_cap"] };
}
