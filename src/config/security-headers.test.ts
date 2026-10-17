import { afterEach, describe, expect, it, vi } from "vitest";

// Card A-16b: assert the EXACT §12.5 v1.5 CSP served by next.config.ts —
// one enforced header, no report-only. Expected strings are written out here
// (not imported from the config) so a mutated config value fails the test
// instead of silently matching itself. NODE_ENV and VERCEL_ENV are read at
// module level in next.config.ts, so each case stubs the env, resets the
// module registry, and re-imports it dynamically.

type HeaderEntry = { key: string; value: string };

const HSTS = "max-age=63072000; includeSubDomains; preload";

// PRD §12.5 v1.5 verbatim (Q45, option b+) — the production policy.
const CSP_V1_5 = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "media-src 'self'",
  "connect-src 'self'",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

// Development: base policy + 'unsafe-eval' for next dev tooling.
const CSP_DEVELOPMENT = CSP_V1_5.replace(
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com;",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com 'unsafe-eval';",
);

// Vercel preview: base policy + toolbar origins appended per directive
// (vercel.com/docs/vercel-toolbar/managing-toolbar). No 'unsafe-eval'.
const CSP_VERCEL_PREVIEW = CSP_V1_5.replace(
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com;",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://vercel.live;",
)
  .replace(
    "style-src 'self' 'unsafe-inline';",
    "style-src 'self' 'unsafe-inline' https://vercel.live;",
  )
  .replace(
    "img-src 'self' data:;",
    "img-src 'self' data: https://vercel.live https://vercel.com blob:;",
  )
  .replace(
    "font-src 'self';",
    "font-src 'self' https://vercel.live https://assets.vercel.com;",
  )
  .replace(
    "connect-src 'self';",
    "connect-src 'self' https://vercel.live wss://ws-us3.pusher.com;",
  )
  .replace(
    "frame-src https://challenges.cloudflare.com;",
    "frame-src https://challenges.cloudflare.com https://vercel.live;",
  );

async function loadSecurityHeaders(): Promise<HeaderEntry[]> {
  vi.resetModules();
  const mod = await import("../../next.config");
  const config = mod.default;
  if (typeof config.headers !== "function") {
    throw new Error("next.config.ts must define headers()");
  }
  const routes = await config.headers();
  const route = routes[0];
  if (!route) throw new Error("headers() must return one catch-all route");
  expect(routes).toHaveLength(1);
  expect(route.source).toBe("/(.*)");
  const headers = route.headers as HeaderEntry[];
  // The A-16 report-only header is gone for good (A-16b, decision Q45).
  expect(
    headers.some((h) => h.key === "Content-Security-Policy-Report-Only"),
  ).toBe(false);
  return headers;
}

function expectExactHeaders(
  headers: HeaderEntry[],
  expected: Record<string, string>,
) {
  expect(Object.fromEntries(headers.map((h) => [h.key, h.value]))).toEqual(
    expected,
  );
}

// Production must never serve 'unsafe-eval' nor toolbar origins; preview
// allows vercel.live but still no 'unsafe-eval'.
function expectNoUnsafeEval(headers: HeaderEntry[]) {
  const csp = headers.find((h) => h.key === "Content-Security-Policy");
  expect(csp?.value).not.toContain("unsafe-eval");
}

function expectProductionCsp(headers: HeaderEntry[]) {
  expectNoUnsafeEval(headers);
  const csp = headers.find((h) => h.key === "Content-Security-Policy");
  expect(csp?.value).not.toContain("vercel.live");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("security headers from next.config.ts", () => {
  it("serves the exact §12.5 policy on Vercel Production (VERCEL_ENV=production)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    const headers = await loadSecurityHeaders();

    expectExactHeaders(headers, {
      "Strict-Transport-Security": HSTS,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy": CSP_V1_5,
    });
    expectProductionCsp(headers);
  });

  it("serves the exact §12.5 policy on a local/CI build (VERCEL_ENV unset)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", undefined);
    const headers = await loadSecurityHeaders();

    expectExactHeaders(headers, {
      "Strict-Transport-Security": HSTS,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy": CSP_V1_5,
    });
    expectProductionCsp(headers);
  });

  it("adds 'unsafe-eval' to script-src in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const headers = await loadSecurityHeaders();

    expectExactHeaders(headers, {
      "Strict-Transport-Security": HSTS,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy": CSP_DEVELOPMENT,
    });
  });

  it("adds the Vercel toolbar origins in preview without 'unsafe-eval'", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    const headers = await loadSecurityHeaders();

    expectExactHeaders(headers, {
      "Strict-Transport-Security": HSTS,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy": CSP_VERCEL_PREVIEW,
    });
    expectNoUnsafeEval(headers);
  });
});
