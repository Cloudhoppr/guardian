// POST /api/creao/tools/check
// The pipeline order the whole system depends on: scam -> rules -> risk ->
// decision. CREAO's cart agent must call this before showing a cart to the
// member.

import { z } from "zod";

import { verifyCreaoRequest } from "@/lib/creao-auth";
import { applyRules } from "@/lib/services/rules";
import { scoreRisk } from "@/lib/services/risk";
import { runScamShield } from "@/lib/services/scam-shield";

const Body = z.object({
  memberId: z.string(),
  message: z.string(),
  subtotalCents: z.number().int().nonnegative(),
  itemProductIds: z.array(z.string()),
  mentionedDomains: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const auth = await verifyCreaoRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const parsed = Body.safeParse(JSON.parse(auth.body));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  const scam = runScamShield({ message: input.message, mentionedDomains: input.mentionedDomains });

  const risk = scoreRisk({
    subtotalCents: input.subtotalCents,
    // TODO Person B: compute member rolling average from order history.
    memberAverageOrderCents: 4000,
    containsNewItem: false,
    isOffHours: isOffHours(),
    scamReasonCount: scam.reasons.length,
  });

  const verdict = await applyRules({
    memberId: input.memberId,
    subtotalCents: input.subtotalCents,
    itemProductIds: input.itemProductIds,
    riskScore: risk.score,
    scamFlagged: scam.flagged,
  });

  return Response.json({
    risk: risk.score,
    reasons: [...risk.reasons, ...verdict.reasons, ...scam.reasons],
    action: verdict.action,
  });
}

function isOffHours(): boolean {
  const h = new Date().getHours();
  return h < 7 || h >= 21;
}
