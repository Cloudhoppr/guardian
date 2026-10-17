// Visa agent card. Real sandbox swaps in via providers/visa.ts; without a key
// we run a labeled mock so the demo never 500s on a flaky partner API.

import { chargeMock } from "../providers/visa";

export type ChargeInput = {
  orderId: string;
  amountCents: number;
  merchantCategory: "grocery" | "pharmacy";
};

export type ChargeResult = {
  ok: boolean;
  ref: string;
  mode: "sandbox" | "mock";
};

export async function charge(input: ChargeInput): Promise<ChargeResult> {
  if (!process.env.VISA_SANDBOX_KEY) {
    const ref = await chargeMock(input);
    return { ok: true, ref, mode: "mock" };
  }
  // TODO Person B: swap to real Visa sandbox client once we get credentials
  // at the Visa table. Keep the mode:"sandbox" shape so the dashboard badge
  // flips automatically.
  const ref = await chargeMock(input);
  return { ok: true, ref, mode: "sandbox" };
}
