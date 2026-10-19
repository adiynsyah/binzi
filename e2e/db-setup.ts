// One-shot E2E database setup, first link of webServer.command (card A-19 §1).
//
// Order matters and is fixed: guard (via e2e/env.ts, at import) → connection
// check → drop & recreate schemas → migrate → seed. Everything finishes
// before `next build`/`next start` run and long before the first test sends
// a request (Playwright waits for webServer.url afterwards).
//
// This script does NOT start Docker itself — that is `npm run e2e:db`
// (session decision #5). If the database is unreachable it stops with a
// message pointing there.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// Guard runs at import, before any connection is opened.
import { E2E_DATABASE_URL } from "./env";

const MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../src/db/migrations", import.meta.url),
);
const SEED_SCRIPT = fileURLToPath(new URL("../src/db/seed.ts", import.meta.url));

async function main(): Promise<void> {
  const sql = postgres(E2E_DATABASE_URL, { max: 1 });

  try {
    try {
      await sql`select 1`;
    } catch {
      console.error(
        "Tidak bisa terhubung ke database E2E. Jalankan `npm run e2e:db` " +
          "untuk menyalakan container lokal (binzi-e2e-db, port 54329), " +
          "lalu jalankan ulang. (Di CI, database menyala sebagai service container.)",
      );
      process.exit(1);
    }

    // Quiet the DROP NOTICE spam; errors still surface normally.
    await sql`set client_min_messages to warning`;

    // Fresh schema every run ("Selesai jika": green twice in a row, with the
    // database reset between runs). Both the app schema (public) and the
    // drizzle migrations bookkeeping schema (drizzle) go away; migration
    // 0000 then recreates everything inside a fresh `public`.
    console.log("[e2e-db] DROP SCHEMA public/drizzle …");
    await sql`drop schema public cascade`;
    await sql`drop schema if exists drizzle cascade`;
    await sql`create schema public`;

    console.log("[e2e-db] migrate (drizzle-orm/postgres-js/migrator) …");
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    console.log("[e2e-db] seed (src/db/seed.ts via tsx) …");
    // Child process with DATABASE_URL set in ITS environment: dotenv inside
    // seed.ts never overwrites variables that already exist, and the script
    // itself only reads process.env — so `.env.local` cannot redirect it.
    const seed = spawnSync("npx", ["tsx", SEED_SCRIPT], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    });
    if (seed.status !== 0) {
      console.error("Seed gagal — lihat output di atas.");
      process.exit(seed.status ?? 1);
    }

    console.log("[e2e-db] siap.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
