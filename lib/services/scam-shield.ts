// Deterministic scam detector. CREAO's LLM agent does softer reasoning on
// top; this file is the floor — the demo CANNOT depend on an LLM call to
// catch "a man from the IRS wants gift cards". Both layers combine in /check.

import type { scamReason } from "../db/enums";

type Reason = (typeof scamReason.enumValues)[number];

const PATTERNS: Array<{ reason: Reason; test: RegExp }> = [
  { reason: "gift_card", test: /gift[\s-]?card/i },
  { reason: "irs_impersonation", test: /\b(irs|internal revenue|tax (agent|office))\b/i },
  { reason: "medicare_impersonation", test: /\b(medicare|medicaid|social security office)\b/i },
  { reason: "grandchild_story", test: /\b(grand\s?(son|daughter|child)|nephew|niece).{0,40}\b(jail|bail|accident|hospital|stuck|arrested)\b/i },
  { reason: "urgency", test: /\b(immediately|right now|within the hour|urgent|final notice)\b/i },
  { reason: "secrecy", test: /\b(don'?t tell|keep (this|it) (secret|private|between us)|do not mention)\b/i },
];

// Pharmacy domains the agent should NEVER order from. In production this is a
// managed allowlist; for the demo, a tiny denylist is enough to look sharp.
const FAKE_PHARMACY_DOMAINS = new Set([
  "canadian-cheap-rx.com",
  "best-pills-online.net",
  "pharma-express-save.co",
]);

export type ScamShieldInput = {
  message: string;
  mentionedDomains?: string[];
};

export type ScamShieldResult = {
  reasons: Reason[];
  flagged: boolean;
};

export function runScamShield(input: ScamShieldInput): ScamShieldResult {
  const hits: Reason[] = [];

  for (const { reason, test } of PATTERNS) {
    if (test.test(input.message)) hits.push(reason);
  }

  for (const d of input.mentionedDomains ?? []) {
    if (FAKE_PHARMACY_DOMAINS.has(d.toLowerCase())) {
      hits.push("fake_pharmacy");
      break;
    }
  }

  return { reasons: hits, flagged: hits.length > 0 };
}
