// POST /api/creao/tools/speak
// Voice Reader agent's one tool: generate an MP3 of the given text via
// ElevenLabs TTS and store it in audio_asset. Returns an audioId the agent
// can hand off to status_update (as payload.audioId) so the dashboard shows
// a 🔊 play button on that row.
//
// Also logs an order_event with the audioId so clicking play from the
// timeline just works, no extra wiring needed.
//
// Then texts the member the same words plus the MP3 via Photon.
//
// Mock mode: if ELEVENLABS_API_KEY is not set, we store a zero-byte row
// and the dashboard still renders a disabled-looking play button labeled
// "voice: mock" — the demo doesn't 500.

import { eq } from "drizzle-orm";
import { z } from "zod";

import { verifyCreaoRequest } from "@/lib/creao-auth";
import { db, schema } from "@/lib/db";
import { textToSpeech } from "@/lib/providers/elevenlabs";
import { sendText } from "@/lib/providers/photon";

const Body = z.object({
  memberId: z.string(),
  text: z.string().min(1).max(800),
  orderId: z.string().optional(),
  // Why we're generating audio — "substitution", "scam_refusal", etc.
  // Shows up in the dashboard payload so judges can see context.
  context: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await verifyCreaoRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const parsed = Body.safeParse(JSON.parse(auth.body));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  const tts = await textToSpeech({ text: input.text });
  if (!tts.ok) {
    return Response.json({ error: tts.error }, { status: 502 });
  }

  const bytes = Buffer.from(tts.audio);
  const bytesBase64 = bytes.toString("base64");

  const [row] = await db
    .insert(schema.audioAsset)
    .values({
      memberId: input.memberId,
      text: input.text,
      mimeType: "audio/mpeg",
      bytesBase64,
    })
    .returning();

  // Log a timeline event with the audioId so the dashboard can wire up a
  // play button. If the Voice Reader agent is firing speak as part of a
  // larger flow (substitution, scam refusal), it also calls status_update
  // separately — this row is the per-audio marker.
  await db.insert(schema.orderEvent).values({
    memberId: input.memberId,
    orderId: input.orderId,
    stage: "intake_processing",
    message: `Voice note generated: "${input.text.slice(0, 80)}${input.text.length > 80 ? "…" : ""}"`,
    payload: JSON.stringify({ audioId: row!.id, context: input.context, mode: tts.mode }),
  });

  // Deliver to Grandma's phone too: the text plus this same MP3, so the
  // substitution question reaches her even if the agent never calls
  // status_update. Reuses the bytes — no second TTS run.
  const [member] = await db.select().from(schema.member).where(eq(schema.member.id, input.memberId)).limit(1);
  const delivery = member
    ? await sendText({ to: member.phoneE164, body: input.text, audio: tts.mode === "live" ? bytes : false })
    : { ok: false as const, error: "unknown_member" };
  if (!delivery.ok) console.error("[speak] delivery failed:", delivery.error);

  return Response.json({
    ok: true,
    delivered: delivery.ok,
    audioId: row!.id,
    url: `/api/audio/${row!.id}`,
    mode: tts.mode,
    bytes: bytes.length,
  });
}
