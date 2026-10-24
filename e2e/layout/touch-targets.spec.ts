// Touch targets >= 44px (card A-19b §4, PRD §14.1) — w360 only. Every
// interactive chrome element the phone user can tap: header buttons, menu/
// drawer rows, bottom-nav items, auth form submits, the password toggle
// (BOTH auth variants: login-form and ui/password-field on /daftar) and
// every ✕. Text links INSIDE sentences are excluded by the card — except
// "Lupa password?", which stands alone in the label row (owner decision):
// measured and REPORTED only, never asserted (an inline link in the label
// row cannot reach 44px; tracked for the a11y chore).
import { createRoleAccount, expect, signInViaApi, test } from "../fixtures";
import type { Locator } from "@playwright/test";
import {
  expectTouchTarget,
  measureTarget,
  openAccountDrawer,
  openCmsDrawer,
  openGuestMenu,
} from "./helpers";

/** Asserts every element of `locator` (must resolve to >= 1). */
async function expectAllTouchTargets(
  locator: Locator,
  labelPrefix: string,
): Promise<void> {
  const count = await locator.count();
  expect(count, `${labelPrefix}: ada elemen`).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const text =
      (await locator.nth(i).innerText()).trim().replace(/\s+/g, " ") ||
      ((await locator.nth(i).getAttribute("aria-label")) ?? `#${i}`);
    await expectTouchTarget(locator.nth(i), `${labelPrefix} "${text}"`);
  }
}

test.describe("target sentuh >= 44px @w360", () => {
  test("header tamu & menu ponsel", async ({ page }) => {
    await page.goto("/");
    await expectTouchTarget(
      page.getByRole("button", { name: "Buka menu" }),
      "Buka menu",
    );
    await expectTouchTarget(
      page.locator("header").getByRole("link", { name: "Cari" }),
      "Cari (header)",
    );

    await openGuestMenu(page);
    await expectTouchTarget(
      page.getByRole("button", { name: "Tutup menu" }),
      "Tutup menu",
    );
    // The 1d panel rows: 5 main-nav links + Masuk + Daftar Gratis.
    await expectAllTouchTargets(
      page.getByRole("navigation", { name: "Utama" }).getByRole("link"),
      "menu ponsel",
    );
    await expectTouchTarget(
      page.getByRole("dialog", { name: "Menu" }).getByRole("link", {
        name: "Cari",
      }),
      "Cari (cover row)",
    );
  });

  test("header member, drawer akun & bottom nav", async ({ page, request }) => {
    const account = await createRoleAccount(request, "MEMBER");
    await signInViaApi(page.context(), account);
    await page.goto("/belajar");

    await expectTouchTarget(
      page.getByRole("button", { name: "Menu akun" }),
      "Menu akun",
    );
    await expectAllTouchTargets(
      page.getByRole("navigation", { name: "Navigasi belajar" }).getByRole(
        "link",
      ),
      "bottom nav",
    );

    await openAccountDrawer(page);
    await expectTouchTarget(
      page.getByRole("button", { name: "Tutup menu akun" }),
      "Tutup menu akun",
    );
    const drawer = page.getByRole("dialog", { name: "Menu akun" });
    // All dialog links EXCEPT the cover-row wordmark (a brand link, not a
    // card §4 "item menu dan drawer"; the guest-menu test skips the same
    // logo by scoping to the nav + an explicit Cari row).
    await expectAllTouchTargets(
      drawer.getByRole("link").filter({ hasNot: page.getByAltText("BINZI") }),
      "drawer akun",
    );
    // "Cari" has NO header button below 640 (member-header.tsx keeps it
    // `hidden … sm:grid`; at w360 it lives as a drawer row) — so the w360
    // touch target IS this row, asserted explicitly (owner review item).
    await expectTouchTarget(
      drawer.getByRole("link", { name: "Cari" }),
      "Cari (baris drawer akun, < 640)",
    );
    test.info().annotations.push({
      type: "note",
      description:
        "Cari @w360: header link hidden < 640 (by design) — target diukur di baris drawer akun",
    });
    await expectTouchTarget(drawer.getByRole("button", { name: "Keluar" }), "Keluar (drawer akun)");
  });

  test("CMS: bar, drawer & isinya", async ({ page, request }) => {
    const account = await createRoleAccount(request, "EDITOR");
    await signInViaApi(page.context(), account);
    await page.goto("/cms");

    await expectTouchTarget(
      page.getByRole("button", { name: "Buka menu CMS" }),
      "Buka menu CMS",
    );

    await openCmsDrawer(page);
    await expectTouchTarget(
      page.getByRole("button", { name: "Tutup menu CMS" }),
      "Tutup menu CMS",
    );
    const drawer = page.getByRole("dialog", { name: "Menu CMS" });
    await expectAllTouchTargets(
      drawer.getByRole("navigation", { name: "Menu CMS" }).getByRole("link"),
      "drawer CMS",
    );
    await expectTouchTarget(
      drawer.getByRole("link", { name: "Lihat situs" }),
      "Lihat situs",
    );
    await expectTouchTarget(
      drawer.getByRole("button", { name: "Keluar" }),
      "Keluar (drawer CMS)",
    );
  });

  test("form auth: tombol kirim, toggle password, ✕ Tutup", async ({ page }) => {
    await page.goto("/masuk");
    await expectTouchTarget(
      page.getByRole("button", { name: "Masuk", exact: true }),
      "tombol kirim Masuk",
    );
    await expectTouchTarget(
      page.getByRole("button", { name: "Tampilkan kata sandi" }),
      "toggle Tampilkan kata sandi",
    );
    await expectTouchTarget(
      page.getByRole("link", { name: "Tutup" }),
      "✕ Tutup (/masuk)",
    );

    // Measured & reported only (owner decision): the conditional assert
    // could never fail while the link stays inline in the label row.
    const lupa = await measureTarget(
      page.getByRole("link", { name: "Lupa password?" }),
      "Lupa password? (baris label)",
    );
    test.info().annotations.push({
      type: "note",
      description: `Lupa password? measured ${lupa}`,
    });

    await page.goto("/daftar");
    await expectTouchTarget(
      page.getByRole("button", { name: "Buat Akun Gratis" }),
      "tombol kirim Buat Akun Gratis",
    );
    // /daftar uses ui/password-field.tsx (NOT the login form's toggle
    // above) — same 44px rule, different component (owner review).
    await expectTouchTarget(
      page.getByRole("button", { name: "Tampilkan kata sandi" }),
      "toggle Tampilkan kata sandi (/daftar, password-field)",
    );
    await expectTouchTarget(
      page.getByRole("link", { name: "Tutup" }),
      "✕ Tutup (/daftar)",
    );

    await page.goto("/lupa-password");
    await expectTouchTarget(
      page.getByRole("button", { name: "Kirim tautan reset" }),
      "tombol kirim Kirim tautan reset",
    );
  });
});
