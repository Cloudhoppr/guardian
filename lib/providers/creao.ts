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
const SCAM_SHIELD_APP_ID = "d6d408af-c7d8-40e9-ae78-12a2b9c29d50";
const STATUS_UPDATER_APP_ID = "7cccd992-1b61-4c4a-b7eb-f687a70f12c5";

async function triggerAgent(
  appId: string,
  apiKey: string | undefined,
  inputs: Record<string, unknown>,
): Promise<TriggerResult> {
  if (!apiKey) {
    console.warn(`[creao] api key for app ${appId} not set — skipping`);
    return { ok: false, error: "no_api_key_configured" };
  }

  const callbackSecret = process.env.CREAO_CALLBACK_SECRET;
  const publicUrl = process.env.PUBLIC_BASE_URL ?? "https://guardian-three-tau.vercel.app";
  const webhookUrl = callbackSecret
    ? `${publicUrl}/api/creao/callback?secret=${encodeURIComponent(callbackSecret)}`
    : undefined;

  const res = await fetch(`https://agent.creao.ai/api/v1/apps/${appId}/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ inputs, ...(webhookUrl ? { webhookUrl } : {}) }),
  });

  if (!res.ok) {
    return { ok: false, error: `creao ${res.status}: ${await res.text()}` };
  }
  const data = (await res.json()) as { id: string; status: string };
  return { ok: true, runId: data.id, status: data.status };
}

export function triggerPurchaser(input: TriggerPurchaserInput): Promise<TriggerResult> {
  return triggerAgent(PURCHASER_APP_ID, process.env.CREAO_PURCHASER_API_KEY, {
    memberId: input.memberId,
    transcript: input.transcript,
    channel: input.channel,
    ...(input.newItems ? { newItems: input.newItems } : {}),
  });
}

export type TriggerScamShieldInput = {
  memberId: string;
  inboundMessage: string;
  channel: "sms" | "imessage" | "voice";
};

export function triggerScamShield(input: TriggerScamShieldInput): Promise<TriggerResult> {
  return triggerAgent(SCAM_SHIELD_APP_ID, process.env.CREAO_SCAM_SHIELD_API_KEY, {
    memberId: input.memberId,
    inboundMessage: input.inboundMessage,
    channel: input.channel,
  });
}

// Status Updater: a composition agent. Other agents (Purchaser, Scam Shield)
// call /api/creao/tools/narrate when they want a warm, grandma-friendly text
// sent to the member. We fire this agent, it composes the message, and it
// calls status_update to actually deliver via Photon.
export type TriggerStatusUpdaterInput = {
  memberId: string;
  event: string; // matches orderEventStage enum values
  data?: Record<string, unknown>;
  orderId?: string;
};

export function triggerStatusUpdater(input: TriggerStatusUpdaterInput): Promise<TriggerResult> {
  return triggerAgent(STATUS_UPDATER_APP_ID, process.env.CREAO_STATUS_UPDATER_API_KEY, {
    memberId: input.memberId,
    event: input.event,
    data: JSON.stringify(input.data ?? {}),
    ...(input.orderId ? { orderId: input.orderId } : {}),
  });
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
