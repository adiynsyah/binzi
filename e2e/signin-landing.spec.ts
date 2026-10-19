// Sign-in & landing (Q44, A-13) — card A-19 §4c. Every test signs in through
// the REAL /masuk form (Turnstile arms the button; expect(…).toBeEnabled()
// waits for the token). Landing expectations are literals, derived from the
// PRD — never imported from landingPathForRole.
import { createRoleAccount, expect, test } from "./fixtures";

/** Fills /masuk and submits, waiting for the Turnstile token first. */
export async function signInViaUi(
  page: import("@playwright/test").Page,
  account: { email: string; password: string },
): Promise<void> {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(account.email);
  await page.locator("#login-password").fill(account.password);
  const submit = page.getByRole("button", { name: "Masuk", exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();
}

test.describe("pendaratan setelah masuk (Q44)", () => {
  for (const role of ["MEMBER", "EDITOR", "ADMIN", "SUPER_ADMIN"] as const) {
    test(`no ?next= → ${role} lands on ${role === "MEMBER" ? "/belajar" : "/cms"}`, async ({
      page,
      request,
    }) => {
      const account = await createRoleAccount(request, role);
      await signInViaUi(page, account);
      await expect(page).toHaveURL(
        role === "MEMBER" ? /\/belajar$/ : /\/cms$/,
      );
    });
  }

  test("EDITOR with a valid ?next=/belajar → /belajar (valid next wins)", async ({
    page,
    request,
  }) => {
    const account = await createRoleAccount(request, "EDITOR");
    await page.goto("/masuk?next=%2Fbelajar");
    await page.getByLabel("Email").fill(account.email);
    await page.locator("#login-password").fill(account.password);
    const submit = page.getByRole("button", { name: "Masuk", exact: true });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page).toHaveURL(/\/belajar$/);
  });

  for (const evil of ["https%3A%2F%2Fevil.example.com", "%2F%2Fevil.example.com"]) {
    test(`?next=${decodeURIComponent(evil)} → role default, never an external host`, async ({
      page,
      request,
    }) => {
      const account = await createRoleAccount(request, "EDITOR");
      await page.goto(`/masuk?next=${evil}`);
      await page.getByLabel("Email").fill(account.email);
      await page.locator("#login-password").fill(account.password);
      const submit = page.getByRole("button", { name: "Masuk", exact: true });
      await expect(submit).toBeEnabled();
      await submit.click();
      // EDITOR default landing — and still on the E2E origin.
      await expect(page).toHaveURL(new RegExp("^http://localhost:3100/cms$"));
    });
  }

  test("already signed in: MEMBER opening /masuk and /daftar → /belajar", async ({
    page,
    request,
  }) => {
    const account = await createRoleAccount(request, "MEMBER");
    await signInViaUi(page, account);
    await expect(page).toHaveURL(/\/belajar$/);

    await page.goto("/masuk");
    await expect(page).toHaveURL(/\/belajar$/);
    await page.goto("/daftar");
    await expect(page).toHaveURL(/\/belajar$/);
  });

  test("already signed in: EDITOR opening /masuk and /daftar → /cms", async ({
    page,
    request,
  }) => {
    const account = await createRoleAccount(request, "EDITOR");
    await signInViaUi(page, account);
    await expect(page).toHaveURL(/\/cms$/);

    await page.goto("/masuk");
    await expect(page).toHaveURL(/\/cms$/);
    await page.goto("/daftar");
    await expect(page).toHaveURL(/\/cms$/);
  });

  test("sign-out via the account menu → /belajar bounces to /masuk?next=", async ({
    page,
    request,
  }) => {
    const account = await createRoleAccount(request, "MEMBER");
    await signInViaUi(page, account);
    await expect(page).toHaveURL(/\/belajar$/);

    await page.getByRole("button", { name: "Menu akun" }).click();
    await page.getByRole("menuitem", { name: "Keluar" }).click();
    // useSignOut replaces to "/" + refresh — the guest Beranda.
    await expect(page).toHaveURL(new RegExp("^http://localhost:3100/$"));

    await page.goto("/belajar");
    await expect(page).toHaveURL(/\/masuk\?next=%2Fbelajar$/);
  });
});