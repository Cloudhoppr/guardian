import { sql as rawSql } from "drizzle-orm";

import { db, schema } from "@/lib/db";

async function main() {
  const [m] = await db.select({ n: rawSql<number>`count(*)` }).from(schema.member);
  const [a] = await db.select({ n: rawSql<number>`count(*)` }).from(schema.approver);
  const [p] = await db.select({ n: rawSql<number>`count(*)` }).from(schema.product);
  const [rx] = await db.select({ n: rawSql<number>`count(*)` }).from(schema.prescription);
  const [u] = await db.select({ n: rawSql<number>`count(*)` }).from(schema.usualItem);
  console.log({ members: m?.n, approvers: a?.n, products: p?.n, prescriptions: rx?.n, usualItems: u?.n });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
