// Thin wrapper over ElevenLabs TTS. For Phase 1 we only need text-to-speech
// so Grandma can hear status updates (she sometimes can't read fast). The
// voice agent for live calls is configured in ElevenLabs' dashboard; this
// file only covers the TTS endpoint our backend calls.

export async function textToSpeech(input: {
  text: string;
  voiceId?: string;
}): Promise<{ ok: true; audio: ArrayBuffer; mode: "live" | "mock" } | { ok: false; error: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = input.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL";

  if (!apiKey) {
    return { ok: true, audio: new ArrayBuffer(0), mode: "mock" };
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: input.text,
      model_id: "eleven_turbo_v2_5",
    }),
  });

  if (!res.ok) return { ok: false, error: `elevenlabs ${res.status}: ${await res.text()}` };
  const audio = await res.arrayBuffer();
  return { ok: true, audio, mode: "live" };
}
