// Fail-closed guard for the E2E database URL (card A-19 §1).
//
// binzi-dev is shared by local development AND Production (including the
// rate-limit bucket rows), while this harness DROPs and recreates schemas.
// Three repo code paths fall back to `.env.local` when a variable is unset
// (`drizzle.config.ts`, `src/db/seed.ts`, `next start`), so one forgotten
// variable would point at binzi-dev. The guard therefore runs BEFORE the
// first DB connection and before the server env is built, and accepts ONLY
// a local host (localhost / 127.0.0.1 / [::1]) with the database name
// EXACTLY `binzi_e2e`.
//
// Error messages name the REASON but never echo the URL or its password.

const E2E_DATABASE_NAME = "binzi_e2e";
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const ALLOWED_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

function reject(reason: string): never {
  throw new Error(
    `E2E database URL rejected: ${reason}. ` +
      "The E2E harness drops and recreates the database schema, so it must only " +
      "point at a LOCAL PostgreSQL whose database name is exactly " +
      `'${E2E_DATABASE_NAME}' (binzi-dev is shared with Production). ` +
      "Start the local container with `npm run e2e:db` and/or fix E2E_DATABASE_URL. " +
      "The URL itself (and any password in it) is intentionally not printed.",
  );
}

/**
 * Validates an E2E database URL and returns it unchanged. Throws on anything
 * that is not `<postgres|postgresql>://<local-host>/binzi_e2e`.
 *
 * Multi-host URLs (postgres-js accepts `host1:port,host2:port`) fail
 * `new URL()` parsing and are therefore rejected here — which is the safe
 * direction, since a pooler host in the list must never reach the harness.
 */
export function assertE2eDatabaseUrl(input: string | undefined): string {
  if (input === undefined || input.trim() === "") {
    reject("the value is empty (E2E_DATABASE_URL unset or blank)");
  }
  let parsed: URL;
  try {
    parsed = new URL(input as string);
  } catch {
    // Also covers the multi-host form: URL.hostname keeps IPv6 brackets
    // ("[::1]"), so strip them before comparing.
    reject("it is not a valid URL (including multi-host connection strings)");
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    reject(`protocol ${parsed.protocol} is not postgres/postgresql`);
  }
  // Strip IPv6 brackets for the comparison ("[::1]" → "::1").
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!ALLOWED_HOSTS.has(host)) {
    reject(`host ${host} is not local (localhost / 127.0.0.1 / [::1] only)`);
  }
  if (parsed.pathname !== `/${E2E_DATABASE_NAME}`) {
    reject(
      `database name must be exactly '${E2E_DATABASE_NAME}' (got ${parsed.pathname})`,
    );
  }
  return input as string;
}
