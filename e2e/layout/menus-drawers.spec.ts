// Menus & drawers per breakpoint (card A-19b §3). Each test derives its
// expectations from the PROJECT it runs in (widthSpecOf(testInfo.project.
// name) — unknown names throw), so a file is defined ONCE and every width
// project runs it against its own viewport. All presence checks go through
// ROLE locators: Playwright skips display:none elements there, so "visible"
// assertions are true visibility checks while hidden variants stay in the
// DOM (the two "Masuk" links, two "Menu akun" triggers, two "Menu CMS"
// navs). Exactly ONE visible "Menu CMS" nav is asserted per width; the DOM
// duplication count is an implementation detail (owner decision) and is
// NOT asserted.
import { createRoleAccount, expect, signInViaApi, test } from "../fixtures";
import {
  openAccountDrawer,
  openAccountDropdown,
  openCmsDrawer,
  openGuestMenu,
  rectDelta,
  visibleCmsNav,
  waitForMemberHeader,
  widthSpecOf,
} from "./helpers";

test.describe("menu & drawer", () => {
  test("isi header tamu per lebar (Q41, D-08)", async ({ page }, testInfo) => {
    const spec = widthSpecOf(testInfo.project.name);
    await page.goto("/");

    // Scoped to <header>: the mobile menu's Masuk/Daftar links (when
    // portaled open) must not affect the header composition check.
    const header = page.locator("header");
    await expect(
      header.getByRole("link", { name: "Cari" }),
      "Cari ada di semua lebar",
    ).toBeVisible();

    const bukaMenu = header.getByRole("button", { name: "Buka menu" });
    await expect(bukaMenu, "Buka menu (hanya < 640)").toBeVisible({
      visible: spec.header.bukaMenu,
    });
    await expect(
      header.getByRole("link", { name: "Masuk", exact: true }),
      "Masuk (mulai 640)",
    ).toBeVisible({ visible: spec.header.masuk });
    await expect(
      header.getByRole("link", { name: "Daftar Gratis" }),
      "Daftar Gratis (hanya >= 1024)",
    ).toBeVisible({ visible: spec.header.daftarGratis });
  });

  test("menu ponsel tamu: ✕ di posisi ☰, Esc menutup & fokus kembali", async (
    { page },
    testInfo,
  ) => {
    const spec = widthSpecOf(testInfo.project.name);
    test.skip(!spec.header.bukaMenu, "hanya < 640 (project w360)");
    await page.goto("/");

    const buka = page.getByRole("button", { name: "Buka menu" });
    const bukaBox = await buka.boundingBox();
    await openGuestMenu(page);

    const tutup = page.getByRole("button", { name: "Tutup menu" });
    const tutupBox = await tutup.boundingBox();
    const delta = rectDelta(bukaBox!, tutupBox!);
    expect
      .soft(delta.dx, "Tutup menu di posisi Buka menu (dx <= 2)")
      .toBeLessThanOrEqual(2);
    expect
      .soft(delta.dy, "Tutup menu di posisi Buka menu (dy <= 2)")
      .toBeLessThanOrEqual(2);

    // 1d panel: the five main-nav rows + Masuk + Daftar Gratis.
    const nav = page.getByRole("navigation", { name: "Utama" });
    await expect(nav.getByRole("link")).toHaveCount(7);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
    await expect(buka, "fokus kembali ke Buka menu").toBeFocused();
  });

  test("bottom nav 'Navigasi belajar' hanya < 768", async (
    { page, request },
    testInfo,
  ) => {
    const spec = widthSpecOf(testInfo.project.name);
    const account = await createRoleAccount(request, "MEMBER");
    await signInViaApi(page.context(), account);
    await page.goto("/belajar");

    const bottomNav = page.getByRole("navigation", {
      name: "Navigasi belajar",
    });
    await expect(
      bottomNav,
      `bottom nav ${spec.bottomNav ? "ada" : "tidak ada"} @${testInfo.project.name}`,
    ).toBeVisible({ visible: spec.bottomNav });
    if (spec.bottomNav) {
      await expect(
        bottomNav.getByRole("link"),
        "Materi · Quiz · Progress",
      ).toHaveCount(3);
    }
  });

  test("MEMBER: tepat satu tombol 'Menu akun' terlihat", async (
    { page, request },
  ) => {
    const account = await createRoleAccount(request, "MEMBER");
    await signInViaApi(page.context(), account);
    await page.goto("/belajar");
    await waitForMemberHeader(page);

    // Two triggers live in the DOM (dropdown `hidden sm:grid`, drawer
    // `sm:hidden`) — exactly one may be VISIBLE per width (PR #53).
    await expect(
      page.getByRole("button", { name: "Menu akun" }),
    ).toHaveCount(1);
  });

  test("MEMBER: bentuk & perilaku menu akun", async ({ page, request }, testInfo) => {
    const spec = widthSpecOf(testInfo.project.name);
    const account = await createRoleAccount(request, "MEMBER");
    await signInViaApi(page.context(), account);
    await page.goto("/belajar");
    const trigger = page.getByRole("button", { name: "Menu akun" });
    await expect(trigger).toBeVisible();

    if (spec.account === "drawer") {
      // < 640: full-width drawer below the header; ✕ in the avatar slot.
      const triggerBox = await trigger.boundingBox();
      await openAccountDrawer(page);
      const close = page.getByRole("button", { name: "Tutup menu akun" });
      const closeBox = await close.boundingBox();
      const delta = rectDelta(triggerBox!, closeBox!);
      expect
        .soft(delta.dx, "Tutup menu akun di posisi avatar (dx <= 2)")
        .toBeLessThanOrEqual(2);
      expect
        .soft(delta.dy, "Tutup menu akun di posisi avatar (dy <= 2)")
        .toBeLessThanOrEqual(2);

      const viewport = page.viewportSize()!;
      const panel = page.getByRole("dialog", { name: "Menu akun" });
      const panelBox = await panel.boundingBox();
      expect
        .soft(Math.round(panelBox!.width), "drawer selebar viewport")
        .toBe(viewport.width);
      expect.soft(Math.round(panelBox!.x)).toBe(0);

      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
      await expect(trigger, "fokus kembali ke pemicu").toBeFocused();
    } else {
      if (spec.account === "dropdown-pill") {
        // >= 1024: the trigger is a pill carrying the display name.
        const triggerText = (await trigger.innerText()).trim();
        expect(triggerText, "pil nama berisi nama tampilan").toContain(
          account.name,
        );
      }

      // 640–1023 AND >= 1024: dropdown right-aligned under its trigger
      // (align="end", sideOffset 6; tolerance <= 2px — owner decision).
      // The A-14b bug (panel parked at x=0) violates both.
      const triggerBox = await trigger.boundingBox();
      await openAccountDropdown(page);
      const panel = page.getByRole("menu");
      await expect(panel).toBeVisible();
      // "Keluar" visible does NOT imply positioned: the Radix popper keeps
      // the panel at translate(0, -200%) ("keep off the page when
      // measuring") until floating-ui's first update lands — a boundingBox()
      // taken in that same layout pass sees the parked panel. Poll for the
      // settled position instead; the <= 2px tolerance itself is unchanged.
      await expect
        .poll(
          async () => {
            const panelBox = await panel.boundingBox();
            return Math.abs(
              panelBox!.x + panelBox!.width - (triggerBox!.x + triggerBox!.width),
            );
          },
          { message: "panel rata kanan dengan pemicu (<= 2px)" },
        )
        .toBeLessThanOrEqual(2);
      const panelBox = await panel.boundingBox();
      expect
        .soft(
          Math.abs(panelBox!.y - (triggerBox!.y + triggerBox!.height + 6)),
          "panel 6px di bawah pemicu (<= 2px)",
        )
        .toBeLessThanOrEqual(2);

      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
      await expect(trigger, "fokus kembali ke pemicu").toBeFocused();
    }
  });

  test("CMS: satu nav 'Menu CMS' terlihat, bentuk sesuai lebar", async ({
    page,
    request,
  }, testInfo) => {
    const spec = widthSpecOf(testInfo.project.name);
    const account = await createRoleAccount(request, "EDITOR");
    await signInViaApi(page.context(), account);
    await page.goto("/cms");

    if (spec.cms === "bar") {
      // Closed: zero visible "Menu CMS" navs (sidebar & rail hidden,
      // drawer closed). The bar trigger is visible.
      await expect(visibleCmsNav(page)).toHaveCount(0);
      const buka = page.getByRole("button", { name: "Buka menu CMS" });
      await expect(buka).toBeVisible();

      const bukaBox = await buka.boundingBox();
      await openCmsDrawer(page);
      const tutup = page.getByRole("button", { name: "Tutup menu CMS" });
      const tutupBox = await tutup.boundingBox();
      const delta = rectDelta(bukaBox!, tutupBox!);
      expect
        .soft(delta.dx, "Tutup menu CMS di posisi Buka menu CMS (dx <= 2)")
        .toBeLessThanOrEqual(2);
      expect
        .soft(delta.dy, "Tutup menu CMS di posisi Buka menu CMS (dy <= 2)")
        .toBeLessThanOrEqual(2);
      await expect(visibleCmsNav(page), "nav drawer terlihat").toHaveCount(1);

      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("dialog", { name: "Menu CMS" }),
      ).toBeHidden();
      await expect(buka, "fokus kembali ke pemicu").toBeFocused();
    } else {
      // Rail (640–1023) / sidebar (>= 1024): exactly one visible nav.
      await expect(visibleCmsNav(page)).toHaveCount(1);

      // Exact widths (owner decision): getBoundingClientRect includes the
      // 1px right border — 73 (rail = 72 + border) / 249 (sidebar = 248 +
      // border). No tolerance.
      const aside = visibleCmsNav(page).locator("xpath=ancestor::aside[1]");
      const box = await aside.boundingBox();
      const expected = spec.cms === "rail" ? 73 : 249;
      expect(Math.round(box!.width), `${spec.cms} width`).toBe(expected);

      if (spec.cms === "rail") {
        // Labels live in tooltips, shown on focus (hover AND keyboard).
        const firstLink = visibleCmsNav(page).getByRole("link").first();
        await firstLink.focus();
        const label = await firstLink.getAttribute("aria-label");
        await expect(
          page.getByRole("tooltip", { name: label ?? "" }),
          `tooltip "${label}" saat fokus`,
        ).toBeVisible();
      }
    }
  });
});

// Drawer taller than the screen (card §3, viewport 360×640): the pinned ✕
// cover row must stay fully visible after the drawer content is scrolled
// to the bottom. Runs in the w360 project only.
test.describe("drawer lebih tinggi dari layar (360×640)", () => {
  for (const [label, role, open] of [
    ["drawer akun", "MEMBER", openAccountDrawer],
    ["drawer CMS", "EDITOR", openCmsDrawer],
  ] as const) {
    test(`${label}: baris ✕ tetap terlihat setelah gulir`, async ({
      page,
      request,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "w360", "viewport khusus 360×640 (kartu §3)");
      test.info().annotations.push({
        type: "note",
        description: "viewport khusus 360×640 (kartu §3)",
      });
      await page.setViewportSize({ width: 360, height: 640 });
      const account = await createRoleAccount(request, role);
      await signInViaApi(page.context(), account);
      await page.goto(role === "MEMBER" ? "/belajar" : "/cms");
      await open(page);

      const keluar = page.getByRole("button", { name: "Keluar" });
      await keluar.scrollIntoViewIfNeeded();
      const close = page.getByRole("button", {
        name: label === "drawer akun" ? "Tutup menu akun" : "Tutup menu CMS",
      });
      const box = await close.boundingBox();
      expect.soft(box!.y, "✕ tetap di atas (y >= 0)").toBeGreaterThanOrEqual(0);
      expect
        .soft(box!.y + box!.height, "✕ tetap terlihat (bottom <= 640)")
        .toBeLessThanOrEqual(640);
    });
  }
});
