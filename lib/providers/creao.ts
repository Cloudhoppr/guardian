// Outbound to CREAO. Our scheduler and webhook handlers use this to ask
// CREAO's agent to compose a message in character (e.g. "pills ready
// Thursday") rather than hand-rolling the string. CREAO owns the voice; we
// own the facts.

export type AgentCall = {
  memberId: string;
  // intent is the CREAO agent identifier we want to run. Keep this list in
  // sync with the agents configured on agent.creao.ai — if the agent isn't
  // registered there, we silently fall back to canned text so the demo keeps
  // moving.
  intent:
    | "compose_refill_ready"
    | "compose_approval_request"
    | "compose_scam_refusal"
    | "run_purchaser"
    | "run_scam_shield";
  payload: Record<string, unknown>;
};

export async function askAgent(call: AgentCall): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const url = process.env.CREAO_API_URL;
  const key = process.env.CREAO_API_KEY;
  if (!url || !key) {
    // Fallback copy so the demo still speaks even if CREAO is down.
    return { ok: true, text: fallbackText(call) };
  }

  const res = await fetch(`${url}/agent/compose`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(call),
  });
  if (!res.ok) return { ok: false, error: `creao ${res.status}` };
  const data = (await res.json()) as { text: string };
  return { ok: true, text: data.text };
}

function fallbackText(call: AgentCall): string {
  switch (call.intent) {
    case "compose_refill_ready":
      return `Your prescription is ready for pickup.`;
    case "compose_approval_request":
      return `Guardian needs your approval on an order.`;
    case "compose_scam_refusal":
      return `I'm not able to help with that — it looks like a scam. I've let your family know.`;
    case "run_purchaser":
      return `Working on your order...`;
    case "run_scam_shield":
      return `Checking that message for scams...`;
  }
}
