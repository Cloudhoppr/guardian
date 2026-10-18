// Photon messaging transport over a Beta shared iMessage line. Beta rules:
//   - a shared line cannot send the first message — Grandma texts the line
//     once to open the thread (see lib/demo.ts);
//   - sends go to a Space (pho_spc_), not a phone number, so we pin Grandma's
//     direct Space in PHOTON_SPACE_ID. Run scripts/photon-ids.ts to find it.
// Only Grandma has a seat. Sends to anyone else are logged and skipped so an
// Elena message never lands in Grandma's thread.

import { GRANDMA_PHONE_E164 } from "@/lib/demo";

const DEFAULT_API_URL = "https://api.photon.codes";

export type SendTextInput = {
  // Recipient E.164. Must equal GRANDMA_PHONE_E164 to actually send.
  to: string;
  body: string;
  // Idempotency key so Photon dedupes retries. Default: hash of (to+body+day).
  idempotencyKey?: string;
};

export async function sendText(input: SendTextInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const apiKey = process.env.PHOTON_API_KEY;
  const projectId = process.env.PHOTON_PROJECT_ID;
  const spaceId = process.env.PHOTON_SPACE_ID;
  const agentUserId = process.env.PHOTON_AGENT_USER_ID;
  const url = process.env.PHOTON_API_URL ?? DEFAULT_API_URL;

  if (!apiKey || !projectId || !spaceId || !agentUserId) {
    console.warn("[photon] missing env, logging message instead:", input);
    return { ok: true, id: `mock-${Date.now()}` };
  }

  if (input.to !== GRANDMA_PHONE_E164) {
    console.warn("[photon] recipient has no shared-line seat, skipping:", input);
    return { ok: true, id: `skipped-${Date.now()}` };
  }

  const key = input.idempotencyKey ?? `${input.to}:${hash(input.body)}:${new Date().toISOString().slice(0, 10)}`;

  const res = await fetch(`${url}/v1/projects/${projectId}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "idempotency-key": key,
    },
    body: JSON.stringify({
      spaceId,
      senderId: agentUserId,
      content: { type: "text", format: "plain", text: input.body },
    }),
  });

  if (!res.ok) return { ok: false, error: `photon ${res.status}: ${await res.text()}` };
  const data = (await res.json()) as { id: string };
  return { ok: true, id: data.id };
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h.toString(36);
}
