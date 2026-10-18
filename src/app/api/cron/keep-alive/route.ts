// Supabase free-tier keep-alive endpoint (card A-18, PRD §10.5): one cheap
// query every 3 days from .github/workflows/cron.yml so the project is
// never paused for inactivity. Protected by the x-cron-secret header —
// checked BEFORE the database is touched (src/lib/health.ts). Other methods
// (GET etc.) get Next.js's default 405.
import { serverEnv } from "@/config/env.server";
import { db } from "@/db";
import { pingDatabase } from "@/db/ping";
import { postKeepAlive } from "@/lib/health";

export async function POST(request: Request) {
  return postKeepAlive({
    secret: serverEnv.CRON_SECRET,
    header: request.headers.get("x-cron-secret"),
    ping: () => pingDatabase(db),
  });
}
