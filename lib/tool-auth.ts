// Auth for /api/creao/tools/* endpoints that the ElevenLabs voice agent also
// calls. ElevenLabs server tools can only send static headers (no per-body
// HMAC), so they authenticate with x-elevenlabs-secret = ELEVENLABS_WEBHOOK_SECRET.
// Anything without that header falls through to CREAO's HMAC check.

import crypto from "node:crypto";

import { verifyCreaoRequest } from "@/lib/creao-auth";

export async function verifyToolRequest(req: Request): Promise<{ ok: true; body: string } | { ok: false; status: number; error: string }> {
  const got = req.headers.get("x-elevenlabs-secret");
  if (got === null) return verifyCreaoRequest(req);

  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) return { ok: false, status: 500, error: "ELEVENLABS_WEBHOOK_SECRET not set" };

  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "bad elevenlabs secret" };
  }
  return { ok: true, body: await req.text() };
}
