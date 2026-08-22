import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/lib/env";
import * as schema from "./schema";

/**
 * BINZI server-side database client (Drizzle Spec §2).
 *
 * `import "server-only"` makes any Client Component import of this
 * module a build error — privileged database access can never reach
 * the browser (Decisions Log #8).
 *
 * Schema (TASK 006) is bound so relational queries
 * (db.query.*) can resolve all tables and relations.
 */
const queryClient = postgres(getServerEnv().DATABASE_URL);

export const db = drizzle(queryClient, { schema });

export { schema };
