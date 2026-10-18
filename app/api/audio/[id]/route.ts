// GET /api/audio/[id]
// Serves a stored MP3 back to the browser so the dashboard's 🔊 play button
// just works via an <audio> tag. No auth: audio IDs are UUIDs; knowing one
// means someone already has access to the dashboard. For a real production
// deploy, scope by member session.

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db.select().from(schema.audioAsset).where(eq(schema.audioAsset.id, id)).limit(1);
  if (!row) return new Response("not found", { status: 404 });

  const bytes = Buffer.from(row.bytesBase64, "base64");
  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": row.mimeType,
      "content-length": String(bytes.length),
      "cache-control": "public, max-age=86400",
    },
  });
}
