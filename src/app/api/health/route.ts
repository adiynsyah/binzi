// Public health check (card A-18): one `select 1` proves both the app and
// its database are up. The response contract (200/503, `Cache-Control:
// no-store`, no internal details) lives in src/lib/health.ts — this file
// only wires the real database. Route Handlers are not cached by default
// in Next 16 (bundled docs, "Route Handlers → Caching"), so no segment
// config; the build output marks this route ƒ.
import { db } from "@/db";
import { pingDatabase } from "@/db/ping";
import { getHealth } from "@/lib/health";

export async function GET() {
  return getHealth({ ping: () => pingDatabase(db) });
}
