// postgres-js connection factory shared by the app runtime and CLI scripts.
// PRD §9.6: connect through the Supabase transaction pooler (port 6543) with
// prepared statements disabled — required in transaction mode. The URL itself
// comes from the caller: the app passes the validated A-02 env module, while
// standalone scripts (seed) load it from dotenv because `server-only` in the
// env module cannot be imported outside a React Server bundle.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>["db"];

export function createDb(url: string) {
  const client = postgres(url, { prepare: false });
  const db = drizzle(client, { schema });
  return { db, client };
}
