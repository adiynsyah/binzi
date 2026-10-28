// `npm run dev:db` — idempotent LOCAL development Postgres (card C-05 §1).
//
// Starts (or reuses) the Docker container `binzi-local-db` bound to
// 127.0.0.1:54330, then waits until it accepts connections. Mirrors
// e2e/db-container.ts (same pattern, same pinned image postgres:17.6 so the
// major matches binzi-dev). Unlike binzi_e2e, this database PERSISTS across
// runs — it is the everyday dev/manual-testing database.
//
// Credentials are LOCAL constants (like e2e/env.ts), never read from .env*:
// they only ever guard throwaway demo data on this machine.
//
// If Docker is missing, this script stops with a clear error — nothing is
// installed automatically.
import { spawnSync } from "node:child_process";

import { formatDatabaseTarget } from "../src/db/local-guard";

const CONTAINER_NAME = "binzi-local-db";
// Same pinned tag as e2e/db-container.ts (major matches binzi-dev).
const IMAGE = "postgres:17.6";
const HOST_PORT = 54330;
const DATABASE_NAME = "binzi_local";
const POSTGRES_USER = "postgres";
const POSTGRES_PASSWORD = "postgres";

// What the product owner puts into .env.local after this card (card C-05 §1).
// Host label `localhost` (resolves to the 127.0.0.1 binding above) so the
// drizzle target line reads `localhost:54330/binzi_local` as documented.
// Deliberately NOT exported: main() runs at module load, so importing this
// module must never be side-effect-free to rely on.
const DEV_DATABASE_URL = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${HOST_PORT}/${DATABASE_NAME}`;

const READY_TIMEOUT_MS = 60_000;

function run(command: string, args: string[]): { ok: boolean; output: string } {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

async function databaseReady(): Promise<boolean> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(DEV_DATABASE_URL, {
    connect_timeout: 2,
    // One probe connection only; errors are expected while booting.
    max: 1,
  });
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function main(): Promise<void> {
  const docker = run("docker", ["--version"]);
  if (!docker.ok) {
    console.error(
      "Docker tidak ditemukan. Nyalakan Docker Desktop terlebih dahulu, " +
        "lalu jalankan `npm run dev:db` lagi (kartu C-05: jangan memasang apa pun).",
    );
    process.exit(1);
  }

  const inspect = run("docker", ["container", "inspect", "-f", "{{.State.Running}}", CONTAINER_NAME]);
  if (inspect.ok) {
    if (inspect.output === "true") {
      console.log(`Container ${CONTAINER_NAME} sudah berjalan.`);
    } else {
      console.log(`Menjalankan ulang container ${CONTAINER_NAME}…`);
      const start = run("docker", ["start", CONTAINER_NAME]);
      if (!start.ok) {
        console.error(`docker start gagal: ${start.output}`);
        process.exit(1);
      }
    }
  } else {
    console.log(
      `Membuat container ${CONTAINER_NAME} (image ${IMAGE}, port ${HOST_PORT})…`,
    );
    const created = run("docker", [
      "run",
      "-d",
      "--name",
      CONTAINER_NAME,
      "-e", `POSTGRES_USER=${POSTGRES_USER}`,
      "-e", `POSTGRES_PASSWORD=${POSTGRES_PASSWORD}`,
      "-e", `POSTGRES_DB=${DATABASE_NAME}`,
      "-p", `127.0.0.1:${HOST_PORT}:5432`,
      IMAGE,
    ]);
    if (!created.ok) {
      console.error(`docker run gagal: ${created.output}`);
      process.exit(1);
    }
  }

  const deadline = Date.now() + READY_TIMEOUT_MS;
  process.stdout.write("Menunggu Postgres siap");
  while (Date.now() < deadline) {
    if (await databaseReady()) {
      console.log("\nPostgres development lokal siap.");
      // Same target-line format as drizzle.config.ts and CLAUDE.md.
      console.log(`Target: ${formatDatabaseTarget(DEV_DATABASE_URL)}`);
      console.log(
        "Isi .env.local (pemilik produk — agent tidak mengubahnya):\n" +
          `  DATABASE_URL=${DEV_DATABASE_URL}\n` +
          `  MIGRATION_DATABASE_URL=${DEV_DATABASE_URL}`,
      );
      return;
    }
    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.error(
    `\nPostgres belum siap setelah 60 detik — cek \`docker logs ${CONTAINER_NAME}\`.`,
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
