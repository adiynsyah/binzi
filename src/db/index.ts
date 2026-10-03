// App database instance. The URL comes exclusively from the validated A-02
// environment module — no dotenv here; Next.js loads .env.local itself.
import { serverEnv } from "@/config/env.server";

import { createDb } from "./client";

if (!serverEnv.DATABASE_URL) {
  throw new Error(
    "Invalid database configuration: DATABASE_URL is not set. " +
      "It must point at the Supabase transaction pooler (port 6543) and is required from A-07.",
  );
}

export const db = createDb(serverEnv.DATABASE_URL).db;
