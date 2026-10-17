// Vercel cron pokes this every ~5 min. Four checks, each sending a message
// via Photon. Keep each check idempotent — a dedupe key per (memberId, kind,
// day) prevents double texting if cron overlaps or retries.

import { and, eq, lte } from "drizzle-orm";

import { db, schema } from "../db";
import { sendText } from "../providers/photon";

export async function tick(): Promise<{ sent: number }> {
  let sent = 0;

  sent += await refillsDueSoon();
  sent += await approverSilent();
  // TODO Person B: staple-runout and member-silent checks once we persist
  // last-reply timestamps on member and last-approver-reply on approval.

  return { sent };
}

// Prescriptions where days_supply has run down enough that we should remind
// the member 5 days before they're out. Needs a `nextDueOn` column on
// prescription or a computed field; for now this is a stub Person B wires up.
async function refillsDueSoon(): Promise<number> {
  // Pseudocode shape, waiting on nextDueOn.
  return 0;
}

async function approverSilent(): Promise<number> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const stale = await db
    .select()
    .from(schema.approval)
    .where(and(eq(schema.approval.decision, "pending"), lte(schema.approval.requestedAt, cutoff)));

  let n = 0;
  for (const a of stale) {
    await sendText({
      to: a.approverId,
      body: `Reminder: Guardian is still waiting on your approval for order ${a.orderId.slice(0, 6)}.`,
    });
    n++;
  }
  return n;
}
