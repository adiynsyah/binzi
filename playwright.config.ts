// Playwright harness config (cards A-19 + A-19b). The A-19 `chromium`
// project (1280×800, auth/RBAC flows) is unchanged; A-19b adds one project
// per breakpoint range (e2e/layout/widths.ts is the single width table).
// Layout specs live in e2e/layout/ and NEVER run in `chromium`; A-19 specs
// never run in the width projects (testMatch/testIgnore below).
//
// reducedMotion: "reduce" on the width projects: globals.css honors
// prefers-reduced-motion, and the drawer/dropdown zoom animations must not
// race getBoundingClientRect position assertions.
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
import { WIDTHS } from "./e2e/layout/widths";

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
      // A-19b: the layout specs (e2e/layout/) never run here.
      testIgnore: /layout[/\\]/,
    },
    // A-19b width projects. Every one runs ONLY e2e/layout/**; which spec
    // files a width actually needs is declared per project below (card §4
    // is w360-only, §5 keyboard is w360+w1280, §6 axe is w360+w1280, and
    // w1440 only covers / and /masuk — card §1 table).
    {
      name: "w360",
      use: { viewport: WIDTHS.w360.viewport, reducedMotion: "reduce" },
      testMatch: /layout[/\\].*\.spec\.ts$/,
      testIgnore: /w1440\.spec\.ts$/,
    },
    {
      name: "w700",
      use: { viewport: WIDTHS.w700.viewport, reducedMotion: "reduce" },
      testMatch: /layout[/\\].*\.spec\.ts$/,
      testIgnore:
        /w1440\.spec\.ts$|touch-targets\.spec\.ts$|keyboard\.spec\.ts$|axe\.spec\.ts$/,
    },
    {
      name: "w768",
      use: { viewport: WIDTHS.w768.viewport, reducedMotion: "reduce" },
      testMatch: /layout[/\\].*\.spec\.ts$/,
      testIgnore:
        /w1440\.spec\.ts$|touch-targets\.spec\.ts$|keyboard\.spec\.ts$|axe\.spec\.ts$/,
    },
    {
      name: "w1280",
      use: { viewport: WIDTHS.w1280.viewport, reducedMotion: "reduce" },
      testMatch: /layout[/\\].*\.spec\.ts$/,
      testIgnore: /w1440\.spec\.ts$|touch-targets\.spec\.ts$/,
    },
    {
      name: "w1440",
      use: { viewport: WIDTHS.w1440.viewport, reducedMotion: "reduce" },
      testMatch: /(w1440|viewport)\.spec\.ts$/,
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
