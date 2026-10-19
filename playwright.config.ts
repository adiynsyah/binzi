// Playwright harness config (card A-19). One Chromium project, 1280×800 —
// widths/keyboard/axe are A-19b's scope, not this card's.
//
// webServer.command chains EVERYTHING in order: db-setup (guard → drop →
// migrate → seed) → next build → next start. globalSetup is NOT used: the
// relative order of globalSetup vs webServer is not guaranteed by Playwright,
// while the guard must run before the server env is ever used. webServer.env
// is E2E_SERVER_ENV MERGED over the inherited process env (Playwright merges,
// it does not replace) — the isolation guarantee is the explicit DB/URL/
// auth/Turnstile values it overrides, plus the smoke CSP test that fails if
// VERCEL_ENV ever leaks in (see e2e/env.ts).
//
// reuseExistingServer is false EVERYWHERE: a dev server on 3100 (connected
// to binzi-dev) must never be reused. bypassCSP is NOT set — tests run
// under the same CSP as Production (that is the point of mutation 7).
import { defineConfig, devices } from "@playwright/test";

import { E2E_BASE_URL, E2E_SERVER_ENV } from "./e2e/env";

export default defineConfig({
  testDir: "e2e",
  // Email flows poll the server log; API lockout tests fire six requests
  // behind real Turnstile verification — keep generous per-test budgets.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // workers: 1 — deterministic order across files (the e-mail log reader
  // depends on stable line offsets). Test files are NOT declared serial:
  // a failure must not mask the next one (session decision #7).
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Since v1.52. No effect while retries: 0 (nothing can be *marked* flaky
  // without a retry pass) — kept on as belt-and-braces for the card §5 rule
  // "flaky must never pass silently" should retries ever be revisited.
  failOnFlakyTests: true,
  forbidOnly: !!process.env.CI,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    // Only `next start` is redirected into test-results/server.log (the
    // [mail:log] lines tests read come from the server process). db-setup
    // and next build print to the console so guard rejections and build
    // errors stay visible (session decision #4).
    command:
      "npx tsx e2e/db-setup.ts && npx next build && mkdir -p test-results && npx next start -p 3100 > test-results/server.log 2>&1",
    // /api/health proves the server is up AND connected to the E2E database.
    url: `${E2E_BASE_URL}/api/health`,
    timeout: 600_000,
    reuseExistingServer: false,
    stdout: "pipe",
    env: { ...E2E_SERVER_ENV },
  },
});
