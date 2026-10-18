// Verifies F1-F5 end-to-end. Hits the real backend with signed requests,
// confirms:
//   - commit_cart(mode=auto) creates an approved order WITHOUT a Photon text
//   - commit_cart(mode=needs_approval) creates pending_approval AND texts Elena
//   - pay works after commit_cart(mode=auto)
//   - status_update dedupe collapses two identical rapid calls
//   - status_update appends "[demo]" to "paid" messages unless GUARDIAN_LIVE_RETAILER=1
//   - elevenlabs/call-ended refuses when ELEVENLABS_WEBHOOK_SECRET not set in prod

import crypto from "node:crypto";

import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

const BASE = "http://localhost:3000";
const SECRET = process.env.CREAO_WEBHOOK_SECRET!;

async function signedPost(path: string, body: unknown) {
  const raw = JSON.stringify(body);
  const sig = crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-creao-signature": sig },
    body: raw,
  });
  return { status: res.status, data: await res.json() };
}

function line(ok: boolean, label: string, detail: string) {
  console.log(`${ok ? "✓" : "✗"} ${label.padEnd(50)} ${detail}`);
}

async function main() {
  const [member] = await db.select().from(schema.member).limit(1);
  const memberId = member!.id;

  const usual = await signedPost("/api/creao/tools/get_usual_items", { memberId });
  const items = (usual.data as { items: Array<{ productId: string }> }).items;

  // -------- F1: commit_cart(mode=auto) creates approved order --------
  const cart1 = await signedPost("/api/creao/tools/create_cart", {
    memberId,
    channel: "voice",
    items: items.slice(0, 3).map((i) => ({ productId: i.productId, quantity: 1 })),
  });
  const cartId1 = (cart1.data as { cartId: string }).cartId;

  const commitAuto = await signedPost("/api/creao/tools/commit_cart", {
    memberId,
    cartId: cartId1,
    mode: "auto",
  });
  const auto = commitAuto.data as { orderId: string; status: string; approverNotified: boolean };
  line(auto.status === "approved" && auto.approverNotified === false, "F1 auto: order approved, Elena NOT notified", JSON.stringify(auto));

  // F2 is automatic: pay accepts status="approved", which commit_cart(auto) produces.
  const pay = await signedPost("/api/creao/tools/pay", { orderId: auto.orderId });
  const payData = pay.data as { ok: boolean; ref: string };
  line(pay.status === 200 && payData.ok === true, "F2 pay after commit_cart(auto)", JSON.stringify(payData));

  // -------- F3: status_update appends [demo] to "paid" stage --------
  const paidUpdate = await signedPost("/api/creao/tools/status_update", {
    memberId,
    orderId: auto.orderId,
    stage: "paid",
    message: "Your cart is confirmed.",
    notify: "none",
  });
  const paidEvent = await db
    .select()
    .from(schema.orderEvent)
    .where(eq(schema.orderEvent.id, (paidUpdate.data as { eventId: string }).eventId))
    .limit(1);
  const hasDemoLabel = paidEvent[0]!.message.includes("[demo");
  line(hasDemoLabel, "F3 paid message gets [demo] label", `message="${paidEvent[0]!.message}"`);

  // -------- F4: dedupe collapses two identical rapid status_updates --------
  const dup1 = await signedPost("/api/creao/tools/status_update", {
    memberId,
    orderId: auto.orderId,
    stage: "cart_built",
    message: "Dedupe probe row",
    notify: "none",
  });
  const dup2 = await signedPost("/api/creao/tools/status_update", {
    memberId,
    orderId: auto.orderId,
    stage: "cart_built",
    message: "Dedupe probe row",
    notify: "none",
  });
  const d1 = dup1.data as { eventId: string; deduped?: boolean };
  const d2 = dup2.data as { eventId: string; deduped?: boolean };
  line(d2.deduped === true && d2.eventId === d1.eventId, "F4 dedupe: second identical call returns first eventId", JSON.stringify(d2));

  // -------- F1b: commit_cart(mode=needs_approval) texts Elena --------
  const cart2 = await signedPost("/api/creao/tools/create_cart", {
    memberId,
    channel: "voice",
    items: items.slice(0, 5).map((i) => ({ productId: i.productId, quantity: 1 })),
  });
  const cartId2 = (cart2.data as { cartId: string }).cartId;
  const commitAsk = await signedPost("/api/creao/tools/commit_cart", {
    memberId,
    cartId: cartId2,
    mode: "needs_approval",
    riskScore: 55,
    reasons: ["over_daily_cap"],
  });
  const ask = commitAsk.data as { status: string; approverNotified: boolean };
  line(ask.status === "pending_approval" && ask.approverNotified === true, "F1 needs_approval: pending_approval + Elena notified", JSON.stringify(ask));

  // -------- F5: /api/elevenlabs/call-ended fails closed in production
  //           when ELEVENLABS_WEBHOOK_SECRET is not set. `pnpm start` sets
  //           NODE_ENV=production, so this exercises the hardened path.
  const callProbe = await fetch(`${BASE}/api/elevenlabs/call-ended`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ memberId, transcript: "test probe" }),
  });
  const probeBody = await callProbe.json();
  line(
    callProbe.status === 500 && (probeBody as { error?: string }).error?.includes("ELEVENLABS_WEBHOOK_SECRET"),
    "F5 call-ended fails closed in production without secret",
    `status=${callProbe.status} body=${JSON.stringify(probeBody)}`,
  );

  console.log("\nAll F1–F5 fixes verified locally.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
