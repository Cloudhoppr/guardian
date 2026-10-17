// Verifies CREAO signed every tool call it made to us. Default to HMAC-SHA256
// over the raw body with the shared secret in CREAO_WEBHOOK_SECRET; if their
// table tells you otherwise, swap the body of verify() to match.

import crypto from "node:crypto";

export async function verifyCreaoRequest(req: Request): Promise<{ ok: true; body: string } | { ok: false; status: number; error: string }> {
  const secret = process.env.CREAO_WEBHOOK_SECRET;
  const body = await req.text();

  if (!secret) {
    // Dev-only: skip verification so we can iterate without a real signer.
    if (process.env.NODE_ENV !== "production") return { ok: true, body };
    return { ok: false, status: 500, error: "CREAO_WEBHOOK_SECRET not set" };
  }

  const header = req.headers.get("x-creao-signature");
  if (!header) return { ok: false, status: 401, error: "missing signature" };

  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(header, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "bad signature" };
  }
  return { ok: true, body };
}
