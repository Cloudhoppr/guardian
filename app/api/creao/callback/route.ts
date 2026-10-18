// POST /api/creao/callback?secret=<CREAO_CALLBACK_SECRET>
// CREAO POSTs here when a Purchaser (or any saved-agent) run finishes. CREAO
// delivers at-least-once with up to 3 retries, so this handler must be
// idempotent on X-Creao-Delivery-Id.
//
// Auth: CREAO doesn't HMAC webhooks. We put a shared secret in the webhookUrl
// query string and reject requests that don't carry it.
//
// What this handler does: write a terminal order_event row so the dashboard
// shows "the agent finished." The real-world side effects (Grandma texts,
// Elena approval request, Visa charge) already happened inside the agent's
// run via the signed /api/creao/tools/* tool calls DURING the run.

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";

const Body = z.object({
  runId: z.string(),
  status: z.enum(["completed", "failed"]),
  threadId: z.string().optional(),
  result: z
    .object({
      text: z.string().optional(),
      chatText: z.string().optional(),
      artifacts: z.array(z.unknown()).optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const url = new URL(req.url);
  const expectedSecret = process.env.CREAO_CALLBACK_SECRET;
  if (expectedSecret) {
    const got = url.searchParams.get("secret");
    if (got !== expectedSecret) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "CREAO_CALLBACK_SECRET not set" }, { status: 500 });
  }

  const deliveryId = req.headers.get("x-creao-delivery-id") ?? "no-delivery-id";

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  // We don't persist a runId → memberId mapping yet (would require a new
  // table). For the demo, pick the only member — if the project grows past
  // one member, add a `creao_run` table that maps runId to memberId at trigger
  // time and look it up here.
  const [member] = await db.select({ id: schema.member.id }).from(schema.member).limit(1);
  if (!member) {
    return Response.json({ ok: true, note: "no member in db" });
  }

  // Dedupe: if we've already logged this delivery, no-op.
  const existing = await db
    .select({ id: schema.orderEvent.id })
    .from(schema.orderEvent)
    .where(eq(schema.orderEvent.message, `CREAO run ${input.runId.slice(0, 8)} ${input.status} [${deliveryId.slice(0, 8)}]`))
    .limit(1);
  if (existing.length > 0) {
    return Response.json({ ok: true, deduped: true });
  }

  await db.insert(schema.orderEvent).values({
    memberId: member.id,
    stage: input.status === "completed" ? "delivery_scheduled" : "error",
    message: `CREAO run ${input.runId.slice(0, 8)} ${input.status} [${deliveryId.slice(0, 8)}]`,
    payload: JSON.stringify({ runId: input.runId, deliveryId, resultText: input.result?.text?.slice(0, 500) }),
  });

  return Response.json({ ok: true });
}
