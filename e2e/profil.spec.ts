// The S5-05 profile page (card §"E2E", max 3 tests — the CI budget):
// (1) MEMBER rename through the real PATCH + the static rows (verified
//     email, no Google row, the session count), then the width sweep
//     360–1280 with the screenshots and the three ≥ 44px targets at 360;
// (2) the password change revokes every OTHER device — the second
//     context's cookie dies on its next request, A reloads to exactly
//     "1 perangkat" scoped to the Sesi aktif row (owner adjustment 2),
//     and the NEW runtime-generated password signs the other device back
//     in. The open-form screenshots (360/1280) ride along before submit;
// (3) "Keluar dari semua perangkat" ends BOTH sessions and lands A on
//     /masuk.
//
// Root spec → chromium project only. No courses are created; each test
// signs its own fresh MEMBER (unique @example.com address, password
// generated at runtime), so the shared e2e database decides nothing here.
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import {
  authHeaders,
  createRoleAccount,
  randomPassword,
  signInViaApi,
  test,
} from "./fixtures";
import {
  expectNoHorizontalScroll,
  expectTouchTarget,
  maybeScreenshot,
  randomToken,
} from "./layout/helpers";

/** The "Sesi aktif" row card — the nearest rounded-card ancestor of its
 *  EXACT h3 (the S6-02 CTA-card scoping rule: exact match, never a loose
 *  substring, on the shared database). */
function sessionRow(page: Page) {
  return page
    .getByRole("heading", { level: 3, name: "Sesi aktif", exact: true })
    .locator(
      "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' rounded-card ')][1]",
    );
}

/** The Data akun section, scoped by its exact h2 (same rule). */
function dataSection(page: Page) {
  return page.locator("section", {
    has: page.getByRole("heading", { level: 2, name: "Data akun", exact: true }),
  });
}

test("1. ubah nama + tata letak 360–1280", async ({ page }) => {
  const member = await createRoleAccount(page.context().request, "MEMBER");
  await signInViaApi(page.context(), member);

  await page.goto("/profil");
  await expect(
    page.getByRole("heading", { level: 1, name: "Profil & pengaturan" }),
  ).toBeVisible();
  await expect(page.getByText("Belajar / Profil")).toBeVisible();
  await expect(
    dataSection(page).getByText("E2E MEMBER", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Anggota sejak \d{1,2} \S{3} \d{4}/),
  ).toBeVisible();
  await expect(page.getByText("Email terverifikasi")).toBeVisible();
  await expect(page.getByText("Akun Google tertaut")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ubah password" }),
  ).toBeVisible();
  await expect(
    sessionRow(page).getByText("1 perangkat", { exact: true }),
  ).toBeVisible();

  // The rename round trip: banner, then the identity row picks the new
  // name up through router.refresh().
  const newName = `Nama Baru ${randomToken("pr")}`;
  await page.getByLabel("Nama lengkap").fill(newName);
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByText("Nama disimpan.")).toBeVisible();
  await expect(
    dataSection(page).getByText(newName, { exact: true }),
  ).toBeVisible();

  // Width sweep: the document stays clean; the screenshots show the
  // renamed identity row at every breakpoint.
  for (const width of [360, 768, 1024, 1280] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/profil");
    await expect(
      page.getByRole("heading", { level: 1, name: "Profil & pengaturan" }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page, `profil w${width}`);
    await maybeScreenshot(page, `profil-${width}`, test.info().project.name);
  }

  // Touch targets at 360: all three w-full actions.
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/profil");
  await expectTouchTarget(
    page.getByRole("button", { name: "Simpan perubahan" }),
    "Simpan perubahan",
  );
  await expectTouchTarget(
    page.getByRole("button", { name: "Ubah password" }),
    "Ubah password",
  );
  await expectTouchTarget(
    page.getByRole("button", { name: "Keluar dari semua perangkat" }),
    "Keluar dari semua perangkat",
  );
});

test("2. ubah password mengeluarkan perangkat lain", async ({
  page,
  browser,
}) => {
  const member = await createRoleAccount(page.context().request, "MEMBER");
  await signInViaApi(page.context(), member);
  const contextB = await browser.newContext();
  try {
    await signInViaApi(contextB, member);

    await page.goto("/profil");
    await expect(
      sessionRow(page).getByText("2 perangkat", { exact: true }),
    ).toBeVisible();

    // The open password form at both extremes, BEFORE the submit — the
    // form opens once; only the viewport changes between the shots.
    await page.getByRole("button", { name: "Ubah password" }).click();
    await expect(page.getByLabel("Password saat ini")).toBeVisible();
    for (const width of [360, 1280] as const) {
      await page.setViewportSize({ width, height: 800 });
      await maybeScreenshot(
        page,
        `profil-password-${width}`,
        test.info().project.name,
      );
    }

    const newPassword = randomPassword();
    await page.getByLabel("Password saat ini").fill(member.password);
    // exact: "Password baru" is a substring of "Ulangi password baru".
    await page.getByLabel("Password baru", { exact: true }).fill(newPassword);
    await page.getByLabel("Ulangi password baru").fill(newPassword);
    await page.getByRole("button", { name: "Simpan password" }).click();
    await expect(page.getByText("Password baru disimpan.")).toBeVisible();

    // B's cookie died with the revoke — the guard bounces it to /masuk.
    const landed = await contextB.request.get("/profil");
    expect(landed.url()).toContain("/masuk?next=%2Fprofil");

    // A reloads: only THIS device is left, scoped to the Sesi aktif row.
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Profil & pengaturan" }),
    ).toBeVisible();
    await expect(
      sessionRow(page).getByText("1 perangkat", { exact: true }),
    ).toBeVisible();

    // The stored password really changed: the NEW one signs B back in.
    const backIn = await contextB.request.post("/api/auth/sign-in/email", {
      headers: authHeaders(),
      data: { email: member.email, password: newPassword },
    });
    expect(backIn.status(), await backIn.text()).toBe(200);
  } finally {
    await contextB.close();
  }
});

test("3. keluar dari semua perangkat", async ({ page, browser }) => {
  const member = await createRoleAccount(page.context().request, "MEMBER");
  await signInViaApi(page.context(), member);
  const contextB = await browser.newContext();
  try {
    await signInViaApi(contextB, member);

    await page.goto("/profil");
    await expect(
      sessionRow(page).getByText("2 perangkat", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Keluar dari semua perangkat" })
      .click();
    await expect(page).toHaveURL("/masuk");

    // Both cookies are dead — each side bounces to /masuk?next=.
    const a = await page.context().request.get("/profil");
    expect(a.url()).toContain("/masuk?next=%2Fprofil");
    const b = await contextB.request.get("/belajar");
    expect(b.url()).toContain("/masuk?next=%2Fbelajar");
  } finally {
    await contextB.close();
  }
});
