// Photon messaging transport over a Beta shared iMessage line. Beta rules:
//   - a shared line cannot send the first message — Grandma texts the line
//     once to open the thread (see lib/demo.ts);
//   - sends go to a Space (pho_spc_), not a phone number, so we pin Grandma's
//     direct Space in PHOTON_SPACE_ID. Run scripts/photon-ids.ts to find it.
// Only Grandma has a seat. Sends to anyone else are logged and skipped so an
// Elena message never lands in Grandma's thread.
//
// Every text to Grandma is followed by an audio version (ElevenLabs MP3).
// The shared line rejects `type: "voice"` (422 UNSUPPORTED_CONTENT), so the
// MP3 goes as a plain attachment — a playable audio file in the thread.

import crypto from "node:crypto";

import { GRANDMA_PHONE_E164 } from "@/lib/demo";
import { textToSpeech } from "@/lib/providers/elevenlabs";

const DEFAULT_API_URL = "https://api.photon.codes";

export type SendTextInput = {
  // Recipient E.164. Must equal GRANDMA_PHONE_E164 to actually send.
  to: string;
  body: string;
  // Idempotency key so Photon dedupes retries. Default: (to+body hash+ms
  // timestamp), so repeat sends of the same text still go out — callers own
  // retry dedupe (status_update collapses repeats within 10s).
  idempotencyKey?: string;
  // Pre-rendered MP3 of `body` (e.g. from the speak tool) so we don't run TTS
  // twice. Omit to generate one; pass false to send text only.
  audio?: Buffer | false;
};

type PhotonConfig = { apiKey: string; projectId: string; spaceId: string; agentUserId: string; url: string };

export async function sendText(input: SendTextInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const config = photonConfig();
  if (!config) {
    console.warn("[photon] missing env, logging message instead:", input);
    return { ok: true, id: `mock-${Date.now()}` };
  }

  if (input.to !== GRANDMA_PHONE_E164) {
    console.warn("[photon] recipient has no shared-line seat, skipping:", input);
    return { ok: true, id: `skipped-${Date.now()}` };
  }

  const key = input.idempotencyKey ?? `${input.to}:${hash(input.body)}:${Date.now()}`;

  const sent = await sendContent(config, key, { type: "text", format: "plain", text: input.body });
  if (!sent.ok) return sent;

  if (input.audio !== false) {
    // Audio is a nice-to-have: a failure is logged, never fails the text.
    const voice = await sendAudio(config, key, input.body, input.audio);
    if (!voice.ok) console.error("[photon] audio follow-up failed:", voice.error);
  }

  return sent;
}

async function sendAudio(
  config: PhotonConfig,
  key: string,
  text: string,
  audio: Buffer | undefined,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  let bytes = audio;
  if (!bytes) {
    const tts = await textToSpeech({ text });
    if (!tts.ok) return tts;
    if (tts.mode === "mock") return { ok: true, id: "audio-mock" };
    bytes = Buffer.from(tts.audio);
  }
  if (bytes.length === 0) return { ok: true, id: "audio-empty" };

  // Upload is multipart/related: a JSON part describing the file, then bytes.
  const boundary = `guardian-${crypto.randomUUID()}`;
  const meta = JSON.stringify({ contentType: "audio/mpeg", sizeBytes: bytes.length, filename: "guardian.mp3" });
  const upload = await fetch(`${config.url}/v1/projects/${config.projectId}/attachments`, {
    method: "POST",
    headers: {
      "content-type": `multipart/related; boundary=${boundary}`,
      authorization: `Bearer ${config.apiKey}`,
      "idempotency-key": `${key}:audio-upload`,
    },
    body: Buffer.concat([
      Buffer.from(`--${boundary}\r\ncontent-type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\ncontent-type: audio/mpeg\r\n\r\n`),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  if (!upload.ok) return { ok: false, error: `photon upload ${upload.status}: ${await upload.text()}` };
  const { id: attachmentId } = (await upload.json()) as { id: string };

  return sendContent(config, `${key}:audio`, { type: "attachment", attachmentId });
}

async function sendContent(
  config: PhotonConfig,
  key: string,
  content: Record<string, unknown>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await fetch(`${config.url}/v1/projects/${config.projectId}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
      "idempotency-key": key,
    },
    body: JSON.stringify({ spaceId: config.spaceId, senderId: config.agentUserId, content }),
  });

  if (!res.ok) return { ok: false, error: `photon ${res.status}: ${await res.text()}` };
  const data = (await res.json()) as { id: string };
  return { ok: true, id: data.id };
}

function photonConfig(): PhotonConfig | null {
  const apiKey = process.env.PHOTON_API_KEY;
  const projectId = process.env.PHOTON_PROJECT_ID;
  const spaceId = process.env.PHOTON_SPACE_ID;
  const agentUserId = process.env.PHOTON_AGENT_USER_ID;
  if (!apiKey || !projectId || !spaceId || !agentUserId) return null;
  return { apiKey, projectId, spaceId, agentUserId, url: process.env.PHOTON_API_URL ?? DEFAULT_API_URL };
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h.toString(36);
}
