// drizzle-kit push is tripping on an unrelated existing primary-key diff.
// Apply just the new enum + table directly. Idempotent.

import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

async function main() {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."order_event_stage" AS ENUM(
        'call_received','acknowledged','intake_processing','cart_built','checking',
        'approved_auto','needs_approval','approver_notified','approved_by_elena',
        'denied_by_elena','paid','delivery_scheduled','refused_scam','error'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "order_event" (
      "id" text PRIMARY KEY NOT NULL,
      "member_id" text NOT NULL,
      "order_id" text,
      "stage" "order_event_stage" NOT NULL,
      "message" text NOT NULL,
      "payload" text,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "order_event_member_idx" ON "order_event" ("member_id");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "order_event_order_idx" ON "order_event" ("order_id");`);

  console.log("order_event ready.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
