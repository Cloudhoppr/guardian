// GET /api/cron/scheduler
// GitHub Actions (.github/workflows/cron-scheduler.yml) fires this every ~5 min. Protect with a shared secret so random
// internet traffic can't spam reminders.

import { tick } from "@/lib/services/scheduler";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await tick();
  return Response.json(result);
}
