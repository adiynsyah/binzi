// CLI wrapper for BINZI-DEV (Production) database commands (card C-05 §3).
//
//   npm run db:migrate:binzi-dev
//   npm run user:role:binzi-dev -- <email> <ROLE>
//
// After this card, .env.local points at the LOCAL dev database, so plain
// db:migrate/user:role would hit the wrong target. Production still needs
// migrations and role management on binzi-dev — this wrapper sources BOTH
// from .env.binzi-dev (git-ignored via the .env* pattern; created and owned
// by the product owner, never opened by an agent) and runs the real command
// as a child process with those values OVERWRITING anything in the parent
// env.
//
// All validation lives in the pure core (src/db/binzi-dev-target.ts, tested
// in src/db/binzi-dev-target.test.ts); this file only does I/O: read the
// file, validate via the core, print the target line, spawn, forward the
// child's exit code. Fail-closed: exit ≠ 0 BEFORE any child runs when the
// file is missing, a key is missing/empty, the URL is unparseable, the
// protocol is not postgres/postgresql, or the host is LOCAL.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildChildEnv,
  resolveBinziDevTargets,
  type BinziDevTarget,
} from "../src/db/binzi-dev-target";

// Repo root derived from THIS file's location — never from cwd (card C-05
// review: the wrapper must find .env.binzi-dev and the local binaries no
// matter where it is invoked from).
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(REPO_ROOT, ".env.binzi-dev");

function fail(message: string): never {
  console.error(`[binzi-dev] GAGAL: ${message}`);
  process.exit(1);
}

function printUsage(): void {
  console.error("Pemakaian (lewat npm run):");
  console.error("  npm run db:migrate:binzi-dev");
  console.error("  npm run user:role:binzi-dev -- <email> <ROLE>");
}

/**
 * Resolve targets from the file, printing each `host:port/nama-db` line
 * (without user/password) BEFORE the child runs — the pre-flight proof of
 * target (card C-05 §3).
 */
function resolveFromFile(
  requiredKeys: readonly string[],
): ReadonlyMap<string, BinziDevTarget> {
  let content: string;
  try {
    content = readFileSync(ENV_FILE, "utf8");
  } catch {
    fail(
      `berkas .env.binzi-dev tidak ditemukan di root repo ` +
        `(${join(REPO_ROOT, ".env.binzi-dev")}). Pemilik produk membuatnya ` +
        "berisi DATABASE_URL dan MIGRATION_DATABASE_URL binzi-dev — lihat " +
        "docs/development-lokal.md.",
    );
  }
  try {
    const targets = resolveBinziDevTargets(content, requiredKeys);
    for (const [key, { target }] of targets) {
      console.log(`[binzi-dev] ${key} → target: ${target}`);
    }
    return targets;
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

/** Spawn without shell, inherit stdio; a signal kill exits 1. */
function runChild(bin: string, args: string[], env: NodeJS.ProcessEnv): never {
  const result = spawnSync(join(REPO_ROOT, "node_modules", ".bin", bin), args, {
    stdio: "inherit",
    env,
    cwd: REPO_ROOT,
  });
  if (result.error) {
    fail(`tidak bisa menjalankan ${bin}: ${result.error.message}`);
  }
  process.exit(result.status === null ? 1 : result.status);
}

async function main(): Promise<void> {
  const [, , subcommand, ...rest] = process.argv;

  if (subcommand === "migrate") {
    const targets = resolveFromFile(["MIGRATION_DATABASE_URL"]);
    const target = targets.get("MIGRATION_DATABASE_URL");
    if (!target) fail("MIGRATION_DATABASE_URL tidak terpecahkan");
    // drizzle-kit loads drizzle.config.ts, which prints its own target line
    // from INSIDE the connected process — both lines must agree (host
    // pooler Supabase, bukan localhost).
    runChild("drizzle-kit", ["migrate"], buildChildEnv(process.env, targets));
  } else if (subcommand === "set-role") {
    // Email and role are forwarded AS-IS; scripts/set-role.ts validates
    // them itself. Run directly through tsx WITHOUT --env-file flags so
    // .env.local is never loaded (the child env carries the file value).
    const targets = resolveFromFile(["DATABASE_URL"]);
    const target = targets.get("DATABASE_URL");
    if (!target) fail("DATABASE_URL tidak terpecahkan");
    runChild(
      "tsx",
      ["scripts/set-role.ts", ...rest],
      buildChildEnv(process.env, targets),
    );
  } else {
    printUsage();
    process.exit(1);
  }
}

// Run only when executed as a script (tsx), not when imported.
const entry = process.argv[1];
const invokedAsScript =
  entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href;
if (invokedAsScript) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
