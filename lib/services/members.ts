// Figures out which senior a request is about. CREAO passes memberId directly;
// the ElevenLabs voice agent only knows the caller's phone number. Dashboard
// and web-widget test calls have no phone at all, so ELEVENLABS_FALLBACK_MEMBER_ID
// (the seeded demo senior) covers them. Leave it unset in production to disable.

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

export async function resolveMemberId(input: { memberId?: string; callerPhone?: string }): Promise<string | undefined> {
  if (input.memberId) return input.memberId;

  if (input.callerPhone) {
    const [m] = await db
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(eq(schema.member.phoneE164, input.callerPhone))
      .limit(1);
    if (m) return m.id;
  }

  return process.env.ELEVENLABS_FALLBACK_MEMBER_ID || undefined;
}
