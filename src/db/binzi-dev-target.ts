// Pure core of the binzi-dev wrapper (card C-05 §3). NO I/O here — the CLI
// (scripts/binzi-dev.ts) reads .env.binzi-dev, calls these functions, prints
// the target and spawns the child process. Tests feed fake file CONTENT as
// strings (vitest only picks up src/**, hence this module's location).
//
// Fail-closed rules, all enforced BEFORE any child process runs:
//   - a required key must be present AND non-empty IN THE FILE — the
//     process env (and .env.local) is NEVER a fallback;
//   - the value must parse as a postgres/postgresql URL;
//   - the host must NOT be local (localhost / 127.0.0.1 / ::1 — the same
//     one-source host set as the demo-seed guard in local-guard.ts);
//   - the host must not be empty.
//
// Error messages name the reason (and at most the bare host) but never echo
// the URL or its password.
import { parse } from "dotenv";

import {
  ALLOWED_PG_PROTOCOLS,
  formatDatabaseTarget,
  LOCAL_PG_HOSTS,
  normalizeHostname,
} from "./local-guard";

export type BinziDevTarget = {
  /** Raw URL from the file — only ever passed to the child env, never printed. */
  url: string;
  /** `host:port/nama-db`, safe to print (no user, no password). */
  target: string;
};

/**
 * Parse `.env.binzi-dev` CONTENT (a string — not a path) and validate the
 * required keys. Returns one target per key. Throws on any fail-closed rule
 * above.
 */
export function resolveBinziDevTargets(
  fileContent: string,
  requiredKeys: readonly string[],
): ReadonlyMap<string, BinziDevTarget> {
  const fileValues = parse(fileContent);
  const targets = new Map<string, BinziDevTarget>();

  for (const key of requiredKeys) {
    const value = fileValues[key];
    if (value === undefined || value.trim() === "") {
      throw new Error(
        `kunci ${key} tidak ada atau kosong di .env.binzi-dev ` +
          "(nilai di env proses dan .env.local tidak pernah menjadi cadangan)",
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`nilai ${key} tidak bisa diurai sebagai URL`);
    }
    if (!ALLOWED_PG_PROTOCOLS.has(parsed.protocol)) {
      throw new Error(
        `protokol ${key} (${parsed.protocol}) bukan postgres/postgresql`,
      );
    }
    const host = normalizeHostname(parsed.hostname);
    if (host === "") {
      throw new Error(`nilai ${key} tidak memuat host`);
    }
    if (LOCAL_PG_HOSTS.has(host)) {
      throw new Error(
        `${key} menunjuk host lokal (${host}) — host lokal bukan target ` +
          "binzi-dev; perintah ini hanya untuk database Production",
      );
    }

    targets.set(key, { url: value, target: formatDatabaseTarget(value) });
  }

  return targets;
}

/** Loose env shape so tests can pass plain objects (@types/node makes
 *  NODE_ENV a required member of NodeJS.ProcessEnv). */
export type EnvRecord = Record<string, string | undefined>;

/**
 * Child-process env: everything inherited from the process env EXCEPT the
 * resolved keys, whose FILE values OVERWRITE any value already present in
 * the process env — the child can never fall back to a stale local value
 * (card C-05 §3, review decision 28 Okt).
 */
export function buildChildEnv(
  processEnv: EnvRecord,
  targets: ReadonlyMap<string, BinziDevTarget>,
): NodeJS.ProcessEnv {
  const childEnv: EnvRecord = { ...processEnv };
  for (const [key, { url }] of targets) {
    childEnv[key] = url;
  }
  // Runtime shape is a plain env object; the cast only satisfies the
  // statically-required NODE_ENV member of NodeJS.ProcessEnv.
  return childEnv as NodeJS.ProcessEnv;
}
