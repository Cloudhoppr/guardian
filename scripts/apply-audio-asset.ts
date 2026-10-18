import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "audio_asset" (
      "id" text PRIMARY KEY NOT NULL,
      "member_id" text NOT NULL,
      "text" text NOT NULL,
      "mime_type" text NOT NULL DEFAULT 'audio/mpeg',
      "bytes_base64" text NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "audio_asset_member_idx" ON "audio_asset" ("member_id");`);
  console.log("audio_asset ready.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
