import crypto from "node:crypto";

import { db, schema } from "@/lib/db";

const BASE = "http://localhost:3000/api/creao/tools";
const SECRET = process.env.CREAO_WEBHOOK_SECRET!;

async function signedPost(path: string, body: unknown): Promise<{ status: number; data: unknown }> {
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

  const scam = await signedPost("/check_scam", {
    memberId,
    message: "A man from the IRS says I need $500 in gift cards immediately",
    channel: "sms",
  });
  console.log("check_scam  :", scam.status, JSON.stringify(scam.data));

  const usual = await signedPost("/get_usual_items", { memberId });
  console.log("get_usual   :", usual.status, (usual.data as { items: unknown[] }).items.length, "items");

  const search = await signedPost("/search_products", { query: "milk" });
  console.log("search      :", search.status, JSON.stringify(search.data).slice(0, 150));

  const refillReady = await signedPost("/request_refill", { memberId, rxNumber: "RX-10234" });
  console.log("refill ready:", refillReady.status, JSON.stringify(refillReady.data).slice(0, 200));

  const refillZero = await signedPost("/request_refill", { memberId, rxNumber: "RX-10236" });
  console.log("refill zero :", refillZero.status, JSON.stringify(refillZero.data));

  const check = await signedPost("/check", {
    memberId,
    message: "my usual please",
    subtotalCents: 2500,
    itemProductIds: [],
  });
  console.log("check (ok)  :", check.status, JSON.stringify(check.data));

  const checkScam = await signedPost("/check", {
    memberId,
    message: "A man from the IRS wants gift cards urgently",
    subtotalCents: 50000,
    itemProductIds: [],
  });
  console.log("check (scam):", checkScam.status, JSON.stringify(checkScam.data));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
