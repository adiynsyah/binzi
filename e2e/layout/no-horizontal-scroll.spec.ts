// No horizontal scroll at any tested width (card A-19b §2, PRD §14.1).
// Defined ONCE; every width project derives its context from
// widthSpecOf(testInfo.project.name) and runs it against its own viewport.
// Inside a test every page runs in its own test.step with expect.soft so
// one failure does not mask the next page. Measurements wait for
// document.fonts.ready; MEMBER on "/" additionally waits for the member
// header (SessionHeader renders the guest header first). Open-menu states
// (incl. the open account dropdown at 640+) are part of this card section,
// so they are measured here too.
import { randomBytes } from "node:crypto";

import { createRoleAccount, expect, signInViaApi, test } from "../fixtures";
import {
  GUEST_PAGES,
  LONG_NAME,
  createCourseViaApi,
  createLessonViaApi,
  expectNoHorizontalScroll,
  maybeScreenshot,
  noSpaceTitle,
  openAccountDrawer,
  openAccountDropdown,
  openCmsAccountMenu,
  openCmsDrawer,
  openGuestMenu,
  randomToken,
  visibleCmsAccountTrigger,
  waitForMemberHeader,
  widthSpecOf,
} from "./helpers";

/**
 * Card S1-01 layout data: one course whose title is EXACTLY 80 characters
 * with no spaces — the worst case for the KURSUS column. The leading token
 * (also in the slug) keeps width projects sharing the e2e database in one
 * run from colliding on the unique slug or the similar-title rule.
 */
async function createNoSpaceTitleCourse(context: import("@playwright/test").BrowserContext): Promise<string> {
  const token = `l${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const title = `${token}x`.padEnd(80, "x").slice(0, 80);
  const response = await context.request.post("/api/cms/courses", {
    data: {
      title,
      slug: title,
      level: "BEGINNER",
      summary: "Ringkasan netral untuk tes e2e.",
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const json = (await response.json()) as { data: { id: string } };
  return json.data.id;
}

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
      // /belajar streams behind loading.tsx (blank for its first 300ms) —
      // wait for the dashboard before measuring (keyboard.spec pattern).
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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
        await maybeScreenshot(
          page,
          "member-dropdown-terbuka",
          testInfo.project.name,
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

    // Card S1-01: the LIST with rows and the BUILDER — at every width. One
    // created course carries an 80-character no-space title (the worst case
    // for the KURSUS column: wrap-anywhere + the always-on overflow-x-auto
    // wrapper must keep the PAGE from scrolling sideways).
    const courseId = await createNoSpaceTitleCourse(page.context());
    await test.step("EDITOR /cms/kursus berisi", async () => {
      await page.goto("/cms/kursus");
      await expect(
        page.getByRole("link", { name: "Buka" }).first(),
      ).toBeVisible();
      await expectNoHorizontalScroll(
        page,
        `EDITOR /cms/kursus berisi @${testInfo.project.name}`,
        true,
      );
      await maybeScreenshot(
        page,
        "editor-cms-kursus-berisi",
        testInfo.project.name,
      );
    });
    await test.step(`EDITOR /cms/kursus/{id} builder`, async () => {
      await page.goto(`/cms/kursus/${courseId}`);
      await expect(
        page.locator('section[aria-labelledby="builder-materi-heading"]')
          .getByText("Belum ada materi")
      ).toBeVisible();
      await expectNoHorizontalScroll(
        page,
        `EDITOR builder @${testInfo.project.name}`,
        true,
      );
      await maybeScreenshot(
        page,
        "editor-cms-kursus-builder",
        testInfo.project.name,
      );
    });

    // Card S1-02 A-19b: the builder WITH two lessons — one carrying an
    // 80-char no-space title (the worst case for the outline row) — plus
    // the open 21h dialog, at every width.
    const filledId = await createCourseViaApi(page.context(), {
      title: `${randomToken("l")} Builder Dua Materi`,
    });
    await createLessonViaApi(
      page.context(),
      filledId,
      noSpaceTitle(randomToken("l")),
    );
    await createLessonViaApi(
      page.context(),
      filledId,
      `${randomToken("l")} Protein`,
    );
    await test.step("EDITOR builder dua materi", async () => {
      await page.goto(`/cms/kursus/${filledId}`);
      await expect(page.getByText("2 materi · wajib berurutan")).toBeVisible();
      await expectNoHorizontalScroll(
        page,
        `EDITOR builder dua materi @${testInfo.project.name}`,
        true,
      );
      await maybeScreenshot(
        page,
        "editor-cms-kursus-builder-dua-materi",
        testInfo.project.name,
      );
    });
    await test.step("EDITOR builder dialog tambah materi", async () => {
      await page.getByRole("button", { name: "+ Tambah materi" }).click();
      await expect(page.getByRole("dialog").getByLabel("Judul materi")).toBeVisible();
      await expectNoHorizontalScroll(
        page,
        `EDITOR builder dialog @${testInfo.project.name}`,
        true,
      );
      // Card S1-02 screenshot review: at w360 the eyebrow used to underlap
      // the ✕ and clip to "…· MATE". The eyebrow hugs its text (w-fit), so
      // boundingBox proves the layout: the "· Materi baru" suffix ends
      // inside the eyebrow, and the eyebrow ends before the ✕'s 44px hit
      // area begins.
      if (spec.viewport.width === 360) {
        const eyebrowBox = await page
          .locator("#add-lesson-eyebrow")
          .boundingBox();
        const suffixBox = await page
          .locator("#add-lesson-eyebrow-suffix")
          .boundingBox();
        const closeBox = await page
          .getByRole("dialog")
          .getByRole("button", { name: "Tutup" })
          .boundingBox();
        expect(
          suffixBox!.x + suffixBox!.width,
          "w360 eyebrow: sisi kanan suffix ≤ sisi kanan eyebrow",
        ).toBeLessThanOrEqual(eyebrowBox!.x + eyebrowBox!.width + 0.5);
        expect(
          eyebrowBox!.x + eyebrowBox!.width,
          "w360 eyebrow: sisi kanan eyebrow ≤ sisi kiri tombol tutup",
        ).toBeLessThanOrEqual(closeBox!.x + 0.5);
      }
      // Close it: the dialog's scrim would intercept the account-menu
      // click in the next step.
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

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
    } else {
      // Rail (640–1023) / sidebar (>= 1024): the CMS account menu opens as
      // a dropdown ABOVE the trigger. Screenshot only after the popper has
      // settled — Radix parks the panel at translate(0, -200%) until
      // floating-ui positions it, and a screenshot in that frame would
      // show no menu at all.
      await test.step("EDITOR /cms menu akun CMS terbuka", async () => {
        const trigger = visibleCmsAccountTrigger(page);
        const triggerBox = await trigger.boundingBox();
        await openCmsAccountMenu(page);
        const panel = page.getByRole("menu");
        await expect
          .poll(
            async () => {
              const panelBox = await panel.boundingBox();
              // Settled = on screen AND at/above the bottom-anchored
              // trigger (side="top"); the parked position is far negative.
              return (
                panelBox !== null &&
                panelBox.y >= 0 &&
                panelBox.y <= triggerBox!.y
              );
            },
            { message: "menu akun CMS terposisi di atas pemicu" },
          )
          .toBe(true);
        await expectNoHorizontalScroll(page, "EDITOR menu akun CMS terbuka", true);
        await maybeScreenshot(
          page,
          "editor-menu-akun-cms-terbuka",
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

  test("w1280: daftar dengan judul 80 karakter — tautan Buka terlihat", async ({
    page,
    request,
  }, testInfo) => {
    const spec = widthSpecOf(testInfo.project.name);
    test.skip(spec.viewport.width !== 1280, "kartu S1-02 meminta w1280");
    const editor = await createRoleAccount(request, "EDITOR");
    await signInViaApi(page.context(), editor);

    // The long-title course is created LAST: "Terakhir diubah" must put
    // its row FIRST, so its "Buka" link being in the viewport proves the
    // PESERTA/AKSI columns were not pushed out of the wrapper (the S1-01
    // screenshot finding that motivated wrap-anywhere).
    await createCourseViaApi(page.context(), {
      title: `${randomToken("w")} Kursus Pengisi Baris`,
    });
    const longTitle = noSpaceTitle(randomToken("w"));
    await createCourseViaApi(page.context(), { title: longTitle });

    await page.goto("/cms/kursus");
    // No scrollIntoViewIfNeeded anywhere: the assertion must hold as the
    // page lands.
    const buka = page.getByRole("link", { name: `Buka ${longTitle}` });
    await expect(buka).toBeVisible();
    await expect(buka).toBeInViewport();

    // The table wrapper must not be internally overflowing either.
    const wrapper = page.locator("div.overflow-x-auto:has(table)");
    const { scrollWidth, clientWidth } = await wrapper.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect
      .soft(
        scrollWidth,
        `w1280 tabel /cms/kursus: scrollWidth ${scrollWidth} <= clientWidth ${clientWidth}`,
      )
      .toBeLessThanOrEqual(clientWidth);
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
    // Same streaming caveat as the MEMBER test above: wait for the h1 the
    // long name renders in before measuring the page it lives on.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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
