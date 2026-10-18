// Simulates an Instacart substitution webhook so we can demo Voice Reader
// without a real Instacart partnership. Run during the pitch:
//
//   npx tsx --env-file=.env.local scripts/trigger-substitution.ts
//
// Expected result: Instacart webhook fires → Voice Reader agent generates
// TTS of "Instacart is out of avocados..." → dashboard row shows a 🔊 play
// button → judge clicks and hears the warm voice question.

import { db, schema } from "@/lib/db";

const BASE = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";

async function main() {
  const [member] = await db.select().from(schema.member).limit(1);
  if (!member) {
    console.error("No member in DB — run seed first.");
    process.exit(1);
  }

  const payload = {
    type: "substitution_proposed",
    memberId: member.id,
    orderId: undefined,
    details: {
      originalItem: "avocados",
      substituteItem: "roma tomatoes",
    },
  };

  const res = await fetch(`${BASE}/api/instacart/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  console.log("instacart/webhook →", res.status, await res.text());
  console.log("\nWatch https://guardian-three-tau.vercel.app/ — a new row with a play button should appear in ~15s.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
