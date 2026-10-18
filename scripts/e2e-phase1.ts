// Simulates what CREAO's Purchaser agent will do: fire several status_update
// calls in sequence to prove the dashboard timeline fills in and (in a real
// setup) Grandma's phone would buzz with each update.

import crypto from "node:crypto";

import { db, schema } from "@/lib/db";

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

async function main() {
  const [member] = await db.select().from(schema.member).limit(1);
  const memberId = member!.id;

  console.log("--- simulating a Purchaser run ---");

  const updates = [
    { stage: "intake_processing", message: "Understanding your request..." },
    { stage: "cart_built", message: "Built your cart: 10 items, $42.80" },
    { stage: "checking", message: "Making sure everything's safe..." },
    { stage: "approved_auto", message: "All good — these are your usual items." },
    { stage: "paid", message: "Done! Your groceries arrive Thursday around 2pm." },
  ];

  for (const u of updates) {
    const r = await signedPost("/api/creao/tools/status_update", {
      memberId,
      stage: u.stage,
      message: u.message,
      notify: "grandma",
    });
    console.log(`${u.stage.padEnd(20)} → ${r.status} ${JSON.stringify(r.data)}`);
    await new Promise((res) => setTimeout(res, 200));
  }

  console.log("\n--- simulating an ElevenLabs call-ended POST ---");
  const callRes = await fetch(`${BASE}/api/elevenlabs/call-ended`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      memberId,
      transcript: "Can I get my usual please, and some tylenol?",
    }),
  });
  console.log(`call-ended           → ${callRes.status} ${await callRes.text()}`);

  console.log("\n--- verifying timeline rows ---");
  const rows = await db
    .select()
    .from(schema.orderEvent)
    .orderBy(schema.orderEvent.createdAt);
  console.log(`Total order_event rows: ${rows.length}`);
  for (const r of rows.slice(-7)) {
    console.log(`  ${r.stage.padEnd(20)} ${r.message}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
