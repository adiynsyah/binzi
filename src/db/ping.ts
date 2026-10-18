// Database ping for /api/health and /api/cron/keep-alive (card A-18): one
// `select 1` through Drizzle — cheap enough for the Supabase free-tier
// keep-alive job (PRD §10.5) and enough signal for a health check.
//
// Relative imports only (the Db type is import-only, so no runtime chain)
// because vitest has no `@/` alias configured (src/modules/README.md).
import { sql } from "drizzle-orm";

import type { Db } from "./client";

/** Runs `select 1`; resolves when the database answers, rejects otherwise. */
export async function pingDatabase(db: Db): Promise<void> {
  await db.execute(sql`select 1`);
}
