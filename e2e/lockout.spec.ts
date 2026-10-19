// Login lockout & enumeration (§14.2, AUTH-08, V-10) — card A-19 §4d.
// Copy is asserted as LITERALS; API sequences compare a REGISTERED against
// an UNKNOWN address so the anti-enumeration property (identical status AND
// error-code sequences) is proven without pinning Better Auth's exact code.
import { expect, test } from "./fixtures";
import {
  authHeaders,
  markVerifiedInE2eDb,
  randomPassword,
  signUpViaApi,
  uniqueEmail,
} from "./fixtures";

const WRONG_COPY = "Email atau password salah. Periksa kembali dan coba lagi.";
const LOCKED_COPY = "Terlalu banyak percobaan. Coba lagi dalam 15 menit";

test.describe("kunci 5× (UI)", () => {
  // Five wrong attempts each wait for a FRESH Turnstile token (the widget
  // remounts after every submit) — generous budget, session decision.
  test.setTimeout(240_000);

  test("5× wrong password → wrong-credentials copy; 6th → locked copy", async ({
    page,
    request,
  }) => {
    const account = {
      name: "E2E Lock",
      email: uniqueEmail("lock"),
      password: randomPassword(),
    };
    await test.step("create a verified account", async () => {
      await signUpViaApi(request, account);
      await markVerifiedInE2eDb(account.email);
    });

    await page.goto("/masuk");
    await page.getByLabel("Email").fill(account.email);

    const wrongPassword = `Wrong-${randomPassword()}`;
    for (let attempt = 1; attempt <= 5; attempt++) {
      await page.locator("#login-password").fill(wrongPassword);
      const submit = page.getByRole("button", { name: "Masuk", exact: true });
      await expect(submit).toBeEnabled(); // fresh Turnstile token
      await submit.click();
      await expect(page.getByRole("alert")).toContainText(WRONG_COPY);
    }

    await page.locator("#login-password").fill(wrongPassword);
    const submit = page.getByRole("button", { name: "Masuk", exact: true });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByRole("alert")).toContainText(LOCKED_COPY);
  });
});

test.describe("enumerasi via API", () => {
  test("6 attempts: registered and unknown emails get identical sequences", async ({
    request,
  }) => {
    const registered = {
      name: "E2E Enum",
      email: uniqueEmail("enum"),
      password: randomPassword(),
    };
    await signUpViaApi(request, registered);
    await markVerifiedInE2eDb(registered.email);
    const unknownAddress = uniqueEmail("enum-unknown");

    /** Status + error code for six wrong-password attempts. */
    async function attemptSequence(email: string): Promise<string[]> {
      const sequence: string[] = [];
      for (let i = 0; i < 6; i++) {
        const response = await request.post("/api/auth/sign-in/email", {
          headers: authHeaders(),
          data: { email, password: `Wrong-${randomPassword()}` },
        });
        const body = (await response.json().catch(() => ({}))) as {
          code?: string;
          error?: { code?: string } | null;
        };
        const code = body.code ?? body.error?.code ?? "<no-code>";
        sequence.push(`${response.status()} ${code}`);
      }
      return sequence;
    }

    const registeredSequence = await attemptSequence(registered.email);
    const unknownSequence = await attemptSequence(unknownAddress);

    // AUTH-08: 5 attempts / 15 minutes — the 6th is 429. The 401 code is
    // Better Auth's; asserting "same code five times" (not a guessed value)
    // keeps the oracle on the behavior this card cares about.
    expect(registeredSequence).toHaveLength(6);
    for (let i = 0; i < 5; i++) {
      expect(registeredSequence[i], `attempt ${i + 1}`).toMatch(/^401 /);
      expect(registeredSequence[i]).toBe(registeredSequence[0]);
    }
    expect(registeredSequence[5]).toMatch(/^429 /);
    // §14.2: the sequence must not reveal whether the address exists.
    expect(unknownSequence).toEqual(registeredSequence);
  });
});

test.describe("Turnstile wajib", () => {
  const ENDPOINTS = [
    {
      path: "/api/auth/sign-in/email",
      body: { email: uniqueEmail("nocaptcha"), password: "Whatever1" },
    },
    {
      path: "/api/auth/sign-up/email",
      body: { name: "No Captcha", email: uniqueEmail("nocaptcha"), password: "Whatever1" },
    },
    {
      path: "/api/auth/request-password-reset",
      body: { email: uniqueEmail("nocaptcha") },
    },
    {
      path: "/api/auth/send-verification-email",
      body: { email: uniqueEmail("nocaptcha"), callbackURL: "/daftar/verifikasi" },
    },
  ] as const;

  test("no x-captcha-response header → 400 on all protected endpoints", async ({
    request,
  }) => {
    for (const endpoint of ENDPOINTS) {
      const response = await request.post(endpoint.path, {
        headers: { Origin: "http://localhost:3100" }, // no captcha header
        data: endpoint.body,
      });
      expect(
        response.status(),
        `${endpoint.path} without x-captcha-response`,
      ).toBe(400);
    }
  });
});
