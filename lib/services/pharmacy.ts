import { and, eq } from "drizzle-orm";

import { db, schema } from "../db";

// Guardian never creates prescriptions — only refills existing ones. The
// "ready Thursday 2pm" string is faked for the demo; a real integration would
// go through NCPDP SCRIPT or the pharmacy's refill API.

export type RefillRequest = {
  memberId: string;
  rxNumber: string;
};

export type RefillResult =
  | { status: "ready"; drug: string; pickupAt: string; pickupName: string; pickupDob: string; pharmacyName: string; pharmacyPhone: string }
  | { status: "no_refills_left"; drug: string; message: string }
  | { status: "not_found" };

export async function requestRefill(input: RefillRequest): Promise<RefillResult> {
  const [rx] = await db
    .select()
    .from(schema.prescription)
    .where(and(eq(schema.prescription.memberId, input.memberId), eq(schema.prescription.rxNumber, input.rxNumber)))
    .limit(1);

  if (!rx) return { status: "not_found" };

  if (rx.refillsLeft <= 0) {
    return {
      status: "no_refills_left",
      drug: rx.drug,
      message: `No refills left on ${rx.drug}. The doctor needs to renew it.`,
    };
  }

  const [pharmacy] = await db
    .select()
    .from(schema.pharmacy)
    .where(eq(schema.pharmacy.id, rx.pharmacyId))
    .limit(1);
  const [member] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.id, input.memberId))
    .limit(1);

  // Pickup window is faked to a stable "next business day 2pm" for the demo
  // so the texted summary is predictable during rehearsal.
  const pickupAt = nextWeekdayAt(14, 0);

  await db
    .update(schema.prescription)
    .set({ refillsLeft: rx.refillsLeft - 1, lastFilledOn: new Date().toISOString().slice(0, 10) })
    .where(eq(schema.prescription.id, rx.id));

  return {
    status: "ready",
    drug: rx.drug,
    pickupAt,
    pickupName: member!.fullName,
    pickupDob: member!.dateOfBirth,
    pharmacyName: pharmacy!.name,
    pharmacyPhone: pharmacy!.phoneE164,
  };
}

function nextWeekdayAt(hour: number, minute: number): string {
  const d = new Date();
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
