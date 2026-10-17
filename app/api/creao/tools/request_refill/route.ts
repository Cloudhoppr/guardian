// POST /api/creao/tools/request_refill
// Thin wrapper over services/pharmacy — CREAO's pharmacy agent calls this.

import { z } from "zod";

import { verifyCreaoRequest } from "@/lib/creao-auth";
import { requestRefill } from "@/lib/services/pharmacy";

const Body = z.object({ memberId: z.string(), rxNumber: z.string() });

export async function POST(req: Request) {
  const auth = await verifyCreaoRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const parsed = Body.safeParse(JSON.parse(auth.body));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const result = await requestRefill(parsed.data);
  return Response.json(result);
}
