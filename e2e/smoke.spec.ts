// Smoke tests (card A-19 §4a): the E2E server answers /api/health (200 —
// proving it is connected to the E2E database), the development-only
// /dev/ui is absent in a production build, the served CSP is the Production
// variant, and accounts created through the API really live in the E2E DB.
import { expect, test } from "@playwright/test";

import {
  markVerifiedInE2eDb,
  signUpViaApi,
  uniqueEmail,
  randomPassword,
  withE2eDb,
} from "./fixtures";

test.describe("smoke", () => {
  test("GET /api/health → 200 (server connected to the E2E database)", async ({
    request,
  }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
  });

  test("GET /dev/ui → 404 (development-only route)", async ({ request }) => {
    const response = await request.get("/dev/ui");
    expect(response.status()).toBe(404);
  });

  test("serves the Production CSP: no vercel.live, no 'unsafe-eval'", async ({
    request,
  }) => {
    const response = await request.get("/");
    expect(response.status()).toBe(200);
    const csp = response.headers()["content-security-policy"];
    expect(csp, "Content-Security-Policy header must be present").toBeTruthy();
    expect(csp).not.toContain("vercel.live");
    expect(csp).not.toContain("'unsafe-eval'");
    // The Turnstile script source must be present (mutation 7 relies on it).
    expect(csp).toContain("https://challenges.cloudflare.com");
  });

  test("an API-created account exists in the E2E database", async ({
    request,
  }) => {
    const email = uniqueEmail("smoke");
    await signUpViaApi(request, {
      name: "E2E Smoke",
      email,
      password: randomPassword(),
    });
    await markVerifiedInE2eDb(email);
    const count = await withE2eDb(
      (sql) => sql`select count(*)::int as n from users where email = ${email}`,
    );
    expect(count[0]?.n).toBe(1);
  });
});
