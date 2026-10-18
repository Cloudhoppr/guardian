import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";

async function main() {
  const rows = await db.select().from(schema.audioAsset).orderBy(desc(schema.audioAsset.createdAt)).limit(5);
  for (const r of rows) {
    const bytes = Buffer.from(r.bytesBase64, "base64").length;
    console.log(r.createdAt.toISOString().slice(11, 19), "bytes:", bytes, "| text:", r.text.slice(0, 60));
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
