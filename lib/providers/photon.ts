// Photon messaging transport. iMessage first, SMS fallback. Beta rule: a
// shared line cannot send the first message — Grandma and the approver each
// text "Hi Guardian" once during setup to open the thread.

export type SendTextInput = {
  // Approver/member id OR raw E.164 — Person A: pick one once we settle
  // on how the dashboard addresses recipients.
  to: string;
  body: string;
  // Idempotency key so Photon dedupes retries. Default: hash of (to+body+day).
  idempotencyKey?: string;
};

export async function sendText(input: SendTextInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const apiKey = process.env.PHOTON_API_KEY;
  const spaceId = process.env.PHOTON_SPACE_ID;
  const agentUserId = process.env.PHOTON_AGENT_USER_ID;
  const url = process.env.PHOTON_API_URL;

  if (!apiKey || !spaceId || !agentUserId || !url) {
    console.warn("[photon] missing env, logging message instead:", input);
    return { ok: true, id: `mock-${Date.now()}` };
  }

  const key = input.idempotencyKey ?? `${input.to}:${hash(input.body)}:${new Date().toISOString().slice(0, 10)}`;

  const res = await fetch(`${url}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "idempotency-key": key,
    },
    body: JSON.stringify({ spaceId, agentUserId, to: input.to, body: input.body }),
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
