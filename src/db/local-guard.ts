// Shared guard + target formatter for LOCAL databases (card C-05).
//
// This module is the ONE source for the set of local PostgreSQL hosts used
// by BOTH the demo-seed guard (below) and the binzi-dev wrapper core
// (src/db/binzi-dev-target.ts). e2e/db-guard.ts deliberately keeps its own
// copy — the E2E harness is out of scope for card C-05 (known duplication,
// stated in the PR).
//
// It is imported by drizzle.config.ts (bundled by drizzle-kit) and by tsx
// scripts, so it must only use Node built-ins: no dotenv, no server-only,
// no path aliases. Error messages name the REASON but never echo the URL or
// its password (same rule as e2e/db-guard.ts).
/** Postgres default port — shown when the URL omits its port. */
export const DEFAULT_PG_PORT = "5432";

/**
 * One target line, `host:port/nama-db`, WITHOUT user or password — the
 * proof-of-target format shared by drizzle.config.ts, the demo seed and the
 * binzi-dev wrapper (card C-05 §3). An unparseable URL yields a fixed text
 * that never includes any part of the URL.
 */
export function formatDatabaseTarget(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "[URL tidak bisa diurai — isinya tidak dicetak]";
  }
  const host = normalizeHostname(parsed.hostname);
  const port = parsed.port === "" ? DEFAULT_PG_PORT : parsed.port;
  const name = parsed.pathname.replace(/^\//, "");
  return `${host}:${port}/${name}`;
}

/** Hosts that mean "this machine" — one source for all local-DB checks. */
export const LOCAL_PG_HOSTS: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
]);

/** postgres/postgresql only — anything else is not a database URL we accept. */
export const ALLOWED_PG_PROTOCOLS: ReadonlySet<string> = new Set([
  "postgres:",
  "postgresql:",
]);

/** Database names the demo seed may write to (card C-05 §2). */
export const LOCAL_DEMO_DB_NAMES: ReadonlySet<string> = new Set([
  "binzi_local",
  "binzi_e2e",
]);

/** Strip IPv6 brackets ("[::1]" → "::1") before host comparisons. */
export function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "");
}

function reject(reason: string): never {
  throw new Error(
    `URL database demo ditolak: ${reason}. ` +
      "Seed demo hanya boleh menulis ke Postgres LOKAL dengan nama database " +
      "'binzi_local' atau 'binzi_e2e' (binzi-dev dipakai bersama Production). " +
      "Nyalakan container dengan `npm run dev:db` dan/atau perbaiki DATABASE_URL. " +
      "URL itu sendiri (dan sandi di dalamnya) sengaja tidak dicetak.",
  );
}

/**
 * Fail-closed guard for the demo seed URL: accepts ONLY
 * `<postgres|postgresql>://<local-host>/binzi_local|binzi_e2e` and throws on
 * everything else — BEFORE the first DB connection is created (card C-05 §2).
 *
 * Multi-host URLs (postgres-js accepts `host1:port,host2:port`) fail
 * `new URL()` parsing and are rejected — the safe direction, same as
 * e2e/db-guard.ts.
 */
export function assertLocalDemoDatabaseUrl(input: string | undefined): string {
  if (input === undefined || input.trim() === "") {
    reject("nilainya kosong (DATABASE_URL belum diisi)");
  }
  let parsed: URL;
  try {
    parsed = new URL(input as string);
  } catch {
    reject("bukan URL valid (termasuk connection string multi-host)");
  }
  if (!ALLOWED_PG_PROTOCOLS.has(parsed.protocol)) {
    reject(`protokol ${parsed.protocol} bukan postgres/postgresql`);
  }
  const host = normalizeHostname(parsed.hostname);
  if (!LOCAL_PG_HOSTS.has(host)) {
    reject(`host ${host} bukan lokal (hanya localhost / 127.0.0.1 / [::1])`);
  }
  const name = parsed.pathname.replace(/^\//, "");
  if (!LOCAL_DEMO_DB_NAMES.has(name)) {
    reject(
      `nama database harus 'binzi_local' atau 'binzi_e2e' (dibaca: '${name}')`,
    );
  }
  return input as string;
}
