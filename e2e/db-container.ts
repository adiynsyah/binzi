// `npm run e2e:db` — idempotent local E2E Postgres container (card A-19 §1).
//
// Starts (or reuses) the Docker container `binzi-e2e-db` on host port 54329,
// then waits until it accepts connections. The image major must match the
// binzi-dev Supabase Postgres (major 17, per the session brief; the minor
// tag is pinned). NOT used in CI — the `e2e` job provides the database as a
// service container on port 5432.
//
// If Docker is missing, this script stops with a clear error (card A-19:
// "berhenti dan tanyakan" — nothing is installed automatically).
import { spawnSync } from "node:child_process";

import { E2E_DATABASE_URL } from "./env";

const CONTAINER_NAME = "binzi-e2e-db";
// Same major as binzi-dev (session brief), pinned minor tag.
const IMAGE = "postgres:17.6";
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
  const sql = postgres(E2E_DATABASE_URL, {
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
        "lalu jalankan `npm run e2e:db` lagi (kartu A-19: jangan memasang apa pun).",
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
    console.log(`Membuat container ${CONTAINER_NAME} (image ${IMAGE}, port 54329)…`);
    const created = run("docker", [
      "run",
      "-d",
      "--name",
      CONTAINER_NAME,
      "-e",
      "POSTGRES_USER=postgres",
      "-e",
      "POSTGRES_PASSWORD=postgres",
      "-e",
      `POSTGRES_DB=binzi_e2e`,
      "-p",
      "127.0.0.1:54329:5432",
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
      console.log("\nPostgres E2E siap.");
      return;
    }
    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.error("\nPostgres belum siap setelah 60 detik — cek `docker logs " + CONTAINER_NAME + "`.");
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
