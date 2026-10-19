// Sign-up/verification (AUTH-01, AUTH-03) and password-reset (AUTH-04,
// AUTH-06) flows — every test that reads e-mail lives in THIS file (card
// A-19 §3). NOT declared serial: with workers: 1 the files still run in
// order, but a failing test must not mask the next one, and every test
// creates its OWN account (session decision #7).
//
// E-mail waiting = polling test-results/server.log for the ONE [mail:log]
// line after this test's offset (more than one match fails the test).
import { expect, test } from "./fixtures";
import { mailLogOffset, waitForMailLink } from "./mail-log";
import {
  expectNoCspViolations,
  markVerifiedInE2eDb,
  newCollectedContext,
  randomPassword,
  signInViaApi,
  signUpViaApi,
  uniqueEmail,
  authHeaders,
} from "./fixtures";

/** Corrupts the token query param of an action link. */
function corruptToken(link: string): string {
  const url = new URL(link);
  url.searchParams.set("token", "e2e-corrupted-token");
  return url.toString();
}

test.describe("daftar & verifikasi", () => {
  test("sign-up → verification link → 'Akun aktif' signed in → /belajar", async ({
    page,
  }) => {
    const email = uniqueEmail("signup");
    const offset = await mailLogOffset();

    await page.goto("/daftar");
    await page.getByLabel("Nama lengkap").fill("E2E Signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(randomPassword());
    await page.locator("#register-consent").check();
    const submit = page.getByRole("button", { name: "Buat Akun Gratis" });
    // Waits for the always-pass Turnstile token to arm the button.
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByText("Cek email Anda.")).toBeVisible();

    const link = await waitForMailLink({
      sinceLine: offset,
      email,
      linkPathIncludes: "/verify-email",
    });
    await page.goto(link);

    // autoSignInAfterVerification: the success state is already signed in.
    await expect(page).toHaveURL(/\/daftar\/verifikasi/);
    await expect(page.getByRole("heading", { name: "Akun aktif" })).toBeVisible();

    await page.getByRole("link", { name: "Mulai belajar" }).click();
    // Via /masuk/lanjut (POST_LOGIN_DEFAULT_PATH) → landing per role.
    await expect(page).toHaveURL(/\/belajar$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Selamat datang",
    );
  });

  test("corrupted verification token → not-active state (?error=…)", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("corrupt");
    const offset = await mailLogOffset();
    await signUpViaApi(request, {
      name: "E2E Corrupt",
      email,
      password: randomPassword(),
    });

    const link = await waitForMailLink({
      sinceLine: offset,
      email,
      linkPathIncludes: "/verify-email",
    });
    await page.goto(corruptToken(link));

    await expect(page).toHaveURL(/\/daftar\/verifikasi\?error=/);
    await expect(page).not.toHaveURL(/token=/);
    await expect(page.getByText("Akun aktif")).toHaveCount(0);
  });

  test("sign-in before verification shows the not-verified copy", async ({
    page,
    request,
  }) => {
    const account = {
      name: "E2E Unverified",
      email: uniqueEmail("unverified"),
      password: randomPassword(),
    };
    await signUpViaApi(request, account); // deliberately NOT verified

    await page.goto("/masuk");
    await page.getByLabel("Email").fill(account.email);
    await page.locator("#login-password").fill(account.password);
    const submit = page.getByRole("button", { name: "Masuk", exact: true });
    await expect(submit).toBeEnabled();
    await submit.click();

    // AUTH-03 literal copy (2b): password was correct, e-mail is not.
    // Filtered: Next's route announcer also carries role="alert" (empty), so
    // the bare role selector is a strict-mode violation.
    const alert = page
      .getByRole("alert")
      .filter({ hasText: "belum diverifikasi" });
    await expect(alert).toContainText("Email Anda belum diverifikasi.");
    await expect(alert).toContainText("Kirim ulang tautan");
    await expect(alert).toContainText("berlaku 24 jam.");
  });
});

test.describe("reset password", () => {
  test("/reset-password without a token → expired panel", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(
      page.getByRole("heading", { name: "Tautan ini sudah tidak berlaku" }),
    ).toBeVisible();
  });

  test("fake token + submit → expired panel, token gone from the URL", async ({
    page,
  }) => {
    await page.goto("/reset-password?token=e2e-fake-token");
    await expect(page.getByText("Tautan valid")).toBeVisible();

    const newPassword = randomPassword();
    // exact: "Password baru" is a case-insensitive substring of "Ulangi
    // password baru" — without it the fill hits both inputs.
    await page.getByLabel("Password baru", { exact: true }).fill(newPassword);
    await page.getByLabel("Ulangi password baru").fill(newPassword);
    const submit = page.getByRole("button", { name: "Simpan password baru" });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page).toHaveURL(/\/reset-password\?error=INVALID_TOKEN/);
    await expect(page).not.toHaveURL(/token=/);
    await expect(
      page.getByRole("heading", { name: "Tautan ini sudah tidak berlaku" }),
    ).toBeVisible();
  });

  test("full reset: old password rejected, new accepted, other session revoked", async ({
    browser,
    page,
    request,
  }) => {
    const account = {
      name: "E2E Reset",
      email: uniqueEmail("reset"),
      password: randomPassword(),
    };
    await signUpViaApi(request, account);
    await markVerifiedInE2eDb(account.email);

    // Device A: signed in on the fixture page's context.
    await signInViaApi(page.context(), account);
    await page.goto("/belajar");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Selamat datang",
    );

    // Device B: anonymous browser asks for the reset link.
    const { context: contextB, violations: violationsB } =
      await newCollectedContext(browser);
    const pageB = await contextB.newPage();
    const offset = await mailLogOffset();
    await pageB.goto("/lupa-password");
    await pageB.getByLabel("Email").fill(account.email);
    const submitB = pageB.getByRole("button", { name: "Kirim tautan reset" });
    await expect(submitB).toBeEnabled();
    await submitB.click();
    await expect(pageB.getByText("Periksa email Anda.")).toBeVisible();

    const link = await waitForMailLink({
      sinceLine: offset,
      email: account.email,
      linkPathIncludes: "/reset-password",
    });
    await pageB.goto(link);
    await expect(pageB).toHaveURL(/\/reset-password\?token=/);
    const newPassword = randomPassword();
    await pageB
      .getByLabel("Password baru", { exact: true })
      .fill(newPassword);
    await pageB.getByLabel("Ulangi password baru").fill(newPassword);
    const save = pageB.getByRole("button", { name: "Simpan password baru" });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(pageB.getByText("Password baru disimpan.")).toBeVisible();
    expectNoCspViolations(violationsB); // CSP watcher covers this context too
    await contextB.close();

    // Old password rejected, new password accepted (fresh client).
    const oldAttempt = await request.post("/api/auth/sign-in/email", {
      headers: authHeaders(),
      data: { email: account.email, password: account.password },
    });
    expect(oldAttempt.status()).toBe(401);
    const newAttempt = await request.post("/api/auth/sign-in/email", {
      headers: authHeaders(),
      data: { email: account.email, password: newPassword },
    });
    expect(newAttempt.status()).toBe(200);

    // AUTH-06: device A's session was revoked by the reset.
    await page.goto("/belajar");
    await expect(page).toHaveURL(/\/masuk\?next=%2Fbelajar$/);
  });

  test("reopening the same reset link → expired (single use)", async ({
    page,
    request,
  }) => {
    const account = {
      name: "E2E Reuse",
      email: uniqueEmail("reuse"),
      password: randomPassword(),
    };
    await signUpViaApi(request, account);
    await markVerifiedInE2eDb(account.email);

    const offset = await mailLogOffset();
    const response = await request.post("/api/auth/request-password-reset", {
      headers: authHeaders(),
      data: { email: account.email, redirectTo: "/reset-password" },
    });
    expect(response.status()).toBe(200);
    const link = await waitForMailLink({
      sinceLine: offset,
      email: account.email,
      linkPathIncludes: "/reset-password",
    });

    // First open validates the token and shows the form (the GET does NOT
    // consume it — the token dies when the new password is saved).
    await page.goto(link);
    await expect(page).toHaveURL(/\/reset-password\?token=/);
    const newPassword = randomPassword();
    await page
      .getByLabel("Password baru", { exact: true })
      .fill(newPassword);
    await page.getByLabel("Ulangi password baru").fill(newPassword);
    const save = page.getByRole("button", { name: "Simpan password baru" });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByText("Password baru disimpan.")).toBeVisible();

    // Single use: after the reset, the same link is dead.
    await page.goto(link);
    await expect(page).toHaveURL(/\/reset-password\?error=/);
    await expect(
      page.getByRole("heading", { name: "Tautan ini sudah tidak berlaku" }),
    ).toBeVisible();
  });
});
