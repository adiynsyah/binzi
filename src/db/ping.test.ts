// pingDatabase against a real PGlite instance — same harness idea as
// src/lib/rbac.integration.test.ts. `select 1` needs no tables, so no
// migrations are run, and PGlite keeps it off the network entirely.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";

import type { Db } from "./client";
import { pingDatabase } from "./ping";
import * as schema from "./schema";

describe("pingDatabase", () => {
  it("resolves after `select 1` on a real (PGlite) database", async () => {
    const pglite = new PGlite();
    try {
      const pgliteDb = drizzle(pglite, { schema });
      await expect(pingDatabase(pgliteDb as unknown as Db)).resolves.toBe(
        undefined,
      );
    } finally {
      await pglite.close();
    }
  });
});
