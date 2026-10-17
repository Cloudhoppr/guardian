// POST /api/creao/tools/freeze
// One text from the approver flips the family-wide freeze bit. All subsequent
// /check calls will return action: "block" until unfrozen.

import { eq } from "drizzle-orm";
import { z } from "zod";

import { verifyCreaoRequest } from "@/lib/creao-auth";
import { db, schema } from "@/lib/db";

const Body = z.object({ memberId: z.string(), frozen: z.boolean() });

export async function POST(req: Request) {
  const auth = await verifyCreaoRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const parsed = Body.safeParse(JSON.parse(auth.body));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  await db
    .update(schema.familyRules)
    .set({ frozen: parsed.data.frozen ? 1 : 0 })
    .where(eq(schema.familyRules.memberId, parsed.data.memberId));

  return Response.json({ ok: true, frozen: parsed.data.frozen });
}
