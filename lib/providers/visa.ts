// Mock Visa agent-card charge. Returns a believable reference string so the
// dashboard can show it without any real card movement. Swap to the sandbox
// client in services/payments.ts once credentials land.

export async function chargeMock(input: { orderId: string; amountCents: number }): Promise<string> {
  const slug = input.orderId.slice(0, 6).toUpperCase();
  return `MOCK-${slug}-${input.amountCents}`;
}
