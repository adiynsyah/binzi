// No horizontal scroll at any tested width (card A-19b §2, PRD §14.1).
// Defined ONCE; every width project derives its context from
// widthSpecOf(testInfo.project.name) and runs it against its own viewport.
// Inside a test every page runs in its own test.step with expect.soft so
// one failure does not mask the next page. Measurements wait for
// document.fonts.ready; MEMBER on "/" additionally waits for the member
// header (SessionHeader renders the guest header first). Open-menu states
// (incl. the open account dropdown at 640+) are part of this card section,
// so they are measured here too.
import { createRoleAccount, expect, signInViaApi, test } from "../fixtures";
import {
  GUEST_PAGES,
  LONG_NAME,
  expectNoHorizontalScroll,
  maybeScreenshot,
  openAccountDrawer,
  openAccountDropdown,
  openCmsDrawer,
  openGuestMenu,
  waitForMemberHeader,
  widthSpecOf,
} from "./helpers";

test.describe("tanpa scroll horizontal", () => {
  test("tamu: 6 halaman publik + menu ponsel terbuka", async (
    { page },
    testInfo,
  ) => {
    const spec = widthSpecOf(testInfo.project.name);
    for (const path of GUEST_PAGES) {
      await test.step(path, async () => {
        await page.goto(path);
        await expectNoHorizontalScroll(
          page,
          `tamu ${path} @${testInfo.project.name}`,
          true,
        );
        await maybeScreenshot(page, `tamu${path}`, testInfo.project.name);
      });
    }

    if (spec.header.bukaMenu) {
      await test.step("/ menu ponsel terbuka", async () => {
        await page.goto("/");
        await openGuestMenu(page);
        await expectNoHorizontalScroll(page, "tamu / menu terbuka", true);
        await maybeScreenshot(
          page,
          "tamu-menu-terbuka",
          testInfo.project.name,
        );
      });
    }
  });

  test("MEMBER: / (header member) dan /belajar", async (
    { page, request },
    testInfo,
  ) => {
    const spec = widthSpecOf(testInfo.project.name);
    const account = await createRoleAccount(request, "MEMBER");
    await signInViaApi(page.context(), account);

    await test.step("/ (header member)", async () => {
      await page.goto("/");
      await waitForMemberHeader(page);
      await expectNoHorizontalScroll(page, "MEMBER /", true);
      await maybeScreenshot(page, "member-root", testInfo.project.name);
    });

    await test.step("/belajar", async () => {
      await page.goto("/belajar");
      await expectNoHorizontalScroll(page, "MEMBER /belajar", true);
      await maybeScreenshot(page, "member-belajar", testInfo.project.name);
    });

    if (spec.account === "drawer") {
      await test.step("/belajar drawer akun terbuka", async () => {
        await openAccountDrawer(page);
        await expectNoHorizontalScroll(
          page,
          "MEMBER drawer akun terbuka",
          true,
        );
        await maybeScreenshot(
          page,
          "member-drawer-terbuka",
          testInfo.project.name,
        );
      });
    } else {
      await test.step("/belajar dropdown akun terbuka", async () => {
        await openAccountDropdown(page);
        await expectNoHorizontalScroll(
          page,
          "MEMBER dropdown akun terbuka",
          true,
        );
      });
    }
  });

  test("EDITOR & SUPER_ADMIN: /cms dan /cms/kursus", async (
    { page, request },
    testInfo,
  ) => {
    const spec = widthSpecOf(testInfo.project.name);
    const editor = await createRoleAccount(request, "EDITOR");
    await signInViaApi(page.context(), editor);
    for (const path of ["/cms", "/cms/kursus"]) {
      await test.step(`EDITOR ${path}`, async () => {
        await page.goto(path);
        await expectNoHorizontalScroll(
          page,
          `EDITOR ${path} @${testInfo.project.name}`,
          true,
        );
        await maybeScreenshot(page, `editor${path}`, testInfo.project.name);
      });
    }

    if (spec.cms === "bar") {
      await test.step("EDITOR /cms drawer CMS terbuka", async () => {
        await page.goto("/cms");
        await openCmsDrawer(page);
        await expectNoHorizontalScroll(page, "EDITOR drawer CMS terbuka", true);
        await maybeScreenshot(
          page,
          "editor-drawer-cms-terbuka",
          testInfo.project.name,
        );
      });
    }

    // Fresh cookies between roles: the second sign-in must not inherit
    // the first role's session.
    await page.context().clearCookies();
    const superAdmin = await createRoleAccount(request, "SUPER_ADMIN");
    await signInViaApi(page.context(), superAdmin);
    for (const path of ["/cms", "/cms/kursus"]) {
      await test.step(`SUPER_ADMIN ${path}`, async () => {
        await page.goto(path);
        await expectNoHorizontalScroll(
          page,
          `SUPER_ADMIN ${path} @${testInfo.project.name}`,
          true,
        );
      });
    }
  });

  test("halaman 403 (MEMBER membuka /cms)", async (
    { page, request },
    testInfo,
  ) => {
    const account = await createRoleAccount(request, "MEMBER");
    await signInViaApi(page.context(), account);
    await page.goto("/cms");
    await expect(
      page.getByRole("heading", { name: "Akses ditolak" }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page, "403", true);
    await maybeScreenshot(page, "403", testInfo.project.name);
  });

  test("nama 40 karakter tanpa spasi: /belajar dan /cms", async (
    { page, request },
    testInfo,
  ) => {
    const member = await createRoleAccount(request, "MEMBER", {
      name: LONG_NAME,
    });
    await signInViaApi(page.context(), member);
    await page.goto("/belajar");
    await expectNoHorizontalScroll(page, "nama panjang /belajar", true);
    await maybeScreenshot(page, "nama-panjang-belajar", testInfo.project.name);

    await page.context().clearCookies();
    const editor = await createRoleAccount(request, "EDITOR", {
      name: LONG_NAME,
    });
    await signInViaApi(page.context(), editor);
    await page.goto("/cms");
    await expectNoHorizontalScroll(page, "nama panjang /cms", true);
    await maybeScreenshot(page, "nama-panjang-cms", testInfo.project.name);
  });
});
