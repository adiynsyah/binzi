// Health & keep-alive endpoint logic (card A-18) — kept out of the route
// files so vitest can pin the security-critical decisions: fail-closed
// secret check BEFORE the database is touched, a 5 s ping budget, and
// response bodies that carry no internal details. Dependencies (secret,
// ping) are injected, mirroring the SessionReader pattern in src/lib/rbac.ts;
// relative imports keep the module loadable under vitest (no `@/` alias).
//
// The handlers return standard Response objects — exactly what the routes
// send, so the status/headers/body these tests see are the real ones.
import { isCronSecretValid } from "./cron-auth";
import { toErrorResponse, UnauthorizedError } from "./errors";

/** Anything ping-like: resolves when the database answers. */
export type PingFn = () => Promise<unknown>;

export type HealthDeps = {
  ping: PingFn;
};

export type KeepAliveDeps = HealthDeps & {
  /** Server-side CRON_SECRET (serverEnv.CRON_SECRET); empty/undefined = not configured. */
  secret: string | undefined;
  /** Raw x-cron-secret request header; null when absent. */
  header: string | null;
};

/** Health must answer within ~5 s even when the database hangs (card A-18 §3). */
const PING_TIMEOUT_MS = 5_000;

/** Every response of both endpoints is uncacheable by contract (card A-18 §1). */
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

class PingTimeoutError extends Error {
  constructor() {
    super(`Database ping did not answer within ${PING_TIMEOUT_MS} ms`);
    this.name = "PingTimeoutError";
  }
}

const SERVICE_UNAVAILABLE_BODY = {
  error: {
    code: "SERVICE_UNAVAILABLE",
    message: "Layanan sedang tidak tersedia.",
  },
} as const;

function okResponse(): Response {
  return Response.json(
    { data: { status: "ok" } },
    { headers: NO_STORE_HEADERS },
  );
}

function serviceUnavailableResponse(): Response {
  return Response.json(SERVICE_UNAVAILABLE_BODY, {
    status: 503,
    headers: NO_STORE_HEADERS,
  });
}

function unauthorizedResponse(): Response {
  const { status, body } = toErrorResponse(new UnauthorizedError());
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

/**
 * Runs `ping` under the 5 s budget. Never throws: returns the outcome plus
 * the original error for logging. The timer is cleared as soon as the race
 * settles, and a rejection arriving after the timeout won the race is
 * absorbed by the race's own handlers — no unhandled rejection.
 */
async function settlePing(
  ping: PingFn,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new PingTimeoutError()), PING_TIMEOUT_MS);
    });
    await Promise.race([Promise.resolve(ping()), timeout]);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/health — public, no session (response contract in card A-18 §1). */
export async function getHealth(deps: HealthDeps): Promise<Response> {
  const outcome = await settlePing(deps.ping);
  if (!outcome.ok) {
    // Report the original error before the generic 503 (A-08 rule).
    console.error("[GET /api/health]", outcome.error);
    return serviceUnavailableResponse();
  }
  return okResponse();
}

/**
 * POST /api/cron/keep-alive — protected by x-cron-secret (response contract
 * in card A-18 §1).
 */
export async function postKeepAlive(deps: KeepAliveDeps): Promise<Response> {
  // Secret first: a request without the correct secret never triggers a
  // database query (card A-18 §1).
  if (!isCronSecretValid(deps.secret, deps.header)) {
    if (!deps.secret) {
      // One line, variable names only — the header value must not leak.
      console.warn(
        "[POST /api/cron/keep-alive] CRON_SECRET is not set on the server; rejecting the request",
      );
    }
    return unauthorizedResponse();
  }

  const outcome = await settlePing(deps.ping);
  if (!outcome.ok) {
    // Report the original error before the generic 503 (A-08 rule).
    console.error("[POST /api/cron/keep-alive]", outcome.error);
    return serviceUnavailableResponse();
  }
  return okResponse();
}
