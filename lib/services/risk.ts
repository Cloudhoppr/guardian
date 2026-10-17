// 0–100 score. Pure function on purpose — the same inputs always produce the
// same number, which makes the dashboard explanation ("why 72?") trivial. If
// this ever becomes stochastic, split out a `scoreVersion` field so old rows
// stay interpretable.

export type RiskInput = {
  subtotalCents: number;
  memberAverageOrderCents: number;
  containsNewItem: boolean;
  isOffHours: boolean; // local time outside 7am-9pm
  scamReasonCount: number; // from scam-shield
};

export type RiskResult = {
  score: number;
  reasons: string[];
};

export function scoreRisk(input: RiskInput): RiskResult {
  const reasons: string[] = [];
  let score = 0;

  if (input.containsNewItem) {
    score += 20;
    reasons.push("contains_item_not_on_usual_list");
  }

  const avg = Math.max(input.memberAverageOrderCents, 1000);
  const ratio = input.subtotalCents / avg;
  if (ratio >= 3) {
    score += 30;
    reasons.push("amount_3x_normal");
  } else if (ratio >= 1.5) {
    score += 15;
    reasons.push("amount_above_normal");
  }

  if (input.isOffHours) {
    score += 10;
    reasons.push("off_hours");
  }

  // Each scam signal adds weight; 2+ triggers a near-certain block downstream.
  score += Math.min(input.scamReasonCount * 25, 50);
  if (input.scamReasonCount > 0) reasons.push(`scam_signals:${input.scamReasonCount}`);

  return { score: Math.min(score, 100), reasons };
}
