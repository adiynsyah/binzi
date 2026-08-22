import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/lib/env";

/**
 * BINZI server-side database client (TASK 004, Drizzle Spec §2).
 *
 * `import "server-only"` makes any Client Component import of this
 * module a build error — privileged database access can never reach
 * the browser (Decisions Log #8).
 *
 * The Drizzle schema (src/db/schema/, TASK 006) is not bound yet;
 * relational query support is added together with the schema.
 */
const connectionString = getServerEnv().DATABASE_URL;

const queryClient = postgres(connectionString);

export const db = drizzle(queryClient);
