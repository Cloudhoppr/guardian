import { desc } from "drizzle-orm";

import { db, schema } from "@/lib/db";

async function main() {
  const events = await db
    .select()
    .from(schema.orderEvent)
    .orderBy(desc(schema.orderEvent.createdAt))
    .limit(12);
  for (const e of events) {
    console.log(
      e.createdAt.toISOString().slice(11, 19),
      e.stage.padEnd(20),
      e.message.slice(0, 90),
    );
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
