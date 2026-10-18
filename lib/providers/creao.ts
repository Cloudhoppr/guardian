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

// --- App-scoped API Trigger (saved CREAO agents) ---
// Docs: https://docs.creao.ai/pro/api-trigger
// Fire a saved agent (identified by its appId) with structured inputs. CREAO
// returns 202 immediately with a runId; the agent runs for ~30-90s. If we
// pass webhookUrl, CREAO POSTs the final result back to us when it finishes.
// During the run, the agent calls our /api/creao/tools/* endpoints directly
// via its own `callTool` helper — this fire-and-forget is just the kickoff.

export type TriggerPurchaserInput = {
  memberId: string;
  transcript: string;
  channel: "sms" | "imessage" | "voice";
  newItems?: string;
};

export type TriggerResult =
  | { ok: true; runId: string; status: string }
  | { ok: false; error: string };

const PURCHASER_APP_ID = "e60ae93c-e43c-428d-a31b-b8bde26b06ac";

export async function triggerPurchaser(input: TriggerPurchaserInput): Promise<TriggerResult> {
  const apiKey = process.env.CREAO_PURCHASER_API_KEY;
  if (!apiKey) {
    console.warn("[creao] CREAO_PURCHASER_API_KEY not set — skipping real trigger");
    return { ok: false, error: "no_api_key_configured" };
  }

  const callbackSecret = process.env.CREAO_CALLBACK_SECRET;
  const publicUrl = process.env.PUBLIC_BASE_URL ?? "https://guardian-three-tau.vercel.app";
  const webhookUrl = callbackSecret
    ? `${publicUrl}/api/creao/callback?secret=${encodeURIComponent(callbackSecret)}`
    : undefined;

  const res = await fetch(`https://agent.creao.ai/api/v1/apps/${PURCHASER_APP_ID}/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      inputs: {
        memberId: input.memberId,
        transcript: input.transcript,
        channel: input.channel,
        ...(input.newItems ? { newItems: input.newItems } : {}),
      },
      ...(webhookUrl ? { webhookUrl } : {}),
    }),
  });

  if (!res.ok) {
    return { ok: false, error: `creao ${res.status}: ${await res.text()}` };
  }
  const data = (await res.json()) as { id: string; status: string };
  return { ok: true, runId: data.id, status: data.status };
}

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
