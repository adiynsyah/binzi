// The five S1-02 screenshot states for the owner's visual review (card
// "Sebelum membuka PR"): empty builder, builder with two lessons and an
// incomplete checklist, the settings panel with a SERVER slug error, the
// 21h add-lesson dialog, and the lesson editor — each at
// w360/w768/w1280 (the card's width table; w700/w1440 are out of the
// card and skipped here).
//
// This spec only frames screenshots; layout measurements live in
// no-horizontal-scroll.spec.ts and axe in axe.spec.ts.
import { createRoleAccount, expect, signInViaApi, test } from "../fixtures";
import {
  createCourseViaApi,
  createLessonViaApi,
  maybeScreenshot,
  noSpaceTitle,
  randomToken,
} from "./helpers";

test.describe("S1-02 builder: 5 state screenshot", () => {
  test("lima state builder", async ({ page, request }, testInfo) => {
    test.skip(
      !["w360", "w768", "w1280"].includes(testInfo.project.name),
      "kartu S1-02 meminta w360/w768/w1280 saja",
    );
    const editor = await createRoleAccount(request, "EDITOR");
    await signInViaApi(page.context(), editor);
    // The token carries the project name: width projects share one e2e
    // database, and this spec's courses must never collide across them.
    const t = randomToken(`s${testInfo.project.name.slice(1)}`);
    const emptyTitle = `${t} Builder Kosong`;
    const emptyCourseId = await createCourseViaApi(page.context(), {
      title: emptyTitle,
    });
    const filledCourseId = await createCourseViaApi(page.context(), {
      title: `${t} Builder Berisi`,
    });
    const firstLessonId = await createLessonViaApi(
      page.context(),
      filledCourseId,
      // One lesson with an 80-char no-space title (A-19b worst case).
      noSpaceTitle(`${t}m`),
    );
    await createLessonViaApi(page.context(), filledCourseId, `${t} Protein`);
    const emptyCourseSlug = `${t}-builder-kosong`;

    await test.step("builder kosong", async () => {
      await page.goto(`/cms/kursus/${emptyCourseId}`);
      await expect(
        page.getByRole("button", { name: "+ Tambah materi pertama" }),
      ).toBeVisible();
      await maybeScreenshot(page, "s1-02-builder-kosong", testInfo.project.name);
    });

    await test.step("builder dua materi, syarat belum lengkap", async () => {
      await page.goto(`/cms/kursus/${filledCourseId}`);
      await expect(page.getByText("2 materi · wajib berurutan")).toBeVisible();
      await expect(page.getByText("3 / 6")).toBeVisible();
      await maybeScreenshot(
        page,
        "s1-02-builder-dua-materi",
        testInfo.project.name,
      );
    });

    await test.step("panel dengan galat slug dari server", async () => {
      await page.goto(`/cms/kursus/${filledCourseId}`);
      await page.getByLabel("Slug").fill(emptyCourseSlug);
      await page.getByRole("button", { name: "Simpan" }).click();
      await expect(page.getByText(/sudah dipakai kursus lain/)).toBeVisible();
      await maybeScreenshot(
        page,
        "s1-02-panel-galat-slug",
        testInfo.project.name,
      );
    });

    await test.step("dialog tambah materi", async () => {
      await page.goto(`/cms/kursus/${filledCourseId}`);
      await page.getByRole("button", { name: "+ Tambah materi" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByLabel("Judul materi")).toBeVisible();
      await dialog.getByLabel("Judul materi").fill(`${t} Materi Baru`);
      await maybeScreenshot(
        page,
        "s1-02-dialog-tambah-materi",
        testInfo.project.name,
      );
    });

    await test.step("editor materi", async () => {
      await page.goto(`/cms/kursus/${filledCourseId}/materi/${firstLessonId}`);
      await expect(
        page.getByRole("textbox", { name: "Teks materi" }),
      ).toBeVisible();
      await maybeScreenshot(
        page,
        "s1-04-materi-editor",
        testInfo.project.name,
      );
    });
  });
});
