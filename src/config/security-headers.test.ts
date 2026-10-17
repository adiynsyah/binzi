import { afterEach, describe, expect, it, vi } from "vitest";

// Card A-16: assert the EXACT §12.5 header values served by next.config.ts.
// Expected strings are written out here (not imported from the config) so a
// mutated config value fails the test instead of silently matching itself.
// NODE_ENV is read at module level in next.config.ts, so each case stubs the
// env, resets the module registry, and re-imports it dynamically.

type HeaderEntry = { key: string; value: string };

const HSTS = "max-age=63072000; includeSubDomains; preload";
const CSP_ENFORCED = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'";
const CSP_REPORT_ONLY_PRODUCTION = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "img-src 'self' data:",
  "font-src 'self'",
  "media-src 'self'",
  "form-action 'self'",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const CSP_REPORT_ONLY_DEVELOPMENT = CSP_REPORT_ONLY_PRODUCTION.replace(
  "script-src 'self' https://challenges.cloudflare.com",
  "script-src 'self' https://challenges.cloudflare.com 'unsafe-eval'",
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
  return route.headers as HeaderEntry[];
}

function expectExactHeaders(
  headers: HeaderEntry[],
  expected: Record<string, string>,
) {
  expect(Object.fromEntries(headers.map((h) => [h.key, h.value]))).toEqual(
    expected,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("security headers from next.config.ts", () => {
  it("serves the exact §12.5 values in production (no 'unsafe-eval')", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const headers = await loadSecurityHeaders();

    expectExactHeaders(headers, {
      "Strict-Transport-Security": HSTS,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy": CSP_ENFORCED,
      "Content-Security-Policy-Report-Only": CSP_REPORT_ONLY_PRODUCTION,
    });
    // The value users receive in production must never contain 'unsafe-eval'.
    const reportOnly = headers.find(
      (h) => h.key === "Content-Security-Policy-Report-Only",
    );
    expect(reportOnly?.value).not.toContain("unsafe-eval");
  });

  it("adds 'unsafe-eval' to the report-only script-src in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const headers = await loadSecurityHeaders();

    expectExactHeaders(headers, {
      "Strict-Transport-Security": HSTS,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy": CSP_ENFORCED,
      "Content-Security-Policy-Report-Only": CSP_REPORT_ONLY_DEVELOPMENT,
    });
  });
});
