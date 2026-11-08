// Touch targets >= 44px (card A-19b §4, PRD §14.1) — w360 only. Every
// interactive chrome element the phone user can tap: header buttons, menu/
// drawer rows, bottom-nav items, auth form submits, the password toggle
// (BOTH auth variants: login-form and ui/password-field on /daftar) and
// every ✕. Text links INSIDE sentences are excluded by the card — except
// "Lupa password?", which stands alone in the label row (owner decision):
// measured and REPORTED only, never asserted (an inline link in the label
// row cannot reach 44px; tracked for the a11y chore).
import {
  createRoleAccount,
  expect,
  signInViaApi,
  test,
  withE2eDb,
} from "../fixtures";
import type { Locator } from "@playwright/test";
import {
  createCourseViaApi,
  createLessonViaApi,
  expectTouchTarget,
  measureTarget,
  openAccountDrawer,
  openCmsDrawer,
  openGuestMenu,
  randomToken,
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

  test("builder kursus: Simpan, tambah materi, Sunting, toggle urutan", async ({
    page,
    request,
  }) => {
    // Card S1-02 (A-19b addition 11): every builder control at w360. One
    // course WITH a lesson (Sunting row, header add, panel, toggle) and
    // one EMPTY course (the 21g first-add button) — then the open 21h
    // dialog (submit + Batal + its ✕).
    const editor = await createRoleAccount(request, "EDITOR");
    await signInViaApi(page.context(), editor);
    const t = randomToken("tt");
    // Two NON-prefix-similar titles (the similar-title rule would 400 a
    // "… Sentuh" → "… Sentuh Kosong" pair).
    const filledId = await createCourseViaApi(page.context(), {
      title: `${t} Sentuh Berisi`,
    });
    await createLessonViaApi(page.context(), filledId, `${t} Materi Sentuh`);
    const emptyId = await createCourseViaApi(page.context(), {
      title: `${t} Sentuh Polos`,
    });

    await page.goto(`/cms/kursus/${filledId}`);
    await expectTouchTarget(
      page.getByRole("button", { name: "Simpan" }),
      "Simpan",
    );
    await expectTouchTarget(
      page.getByRole("button", { name: "+ Tambah materi" }),
      "+ Tambah materi",
    );
    await expectTouchTarget(
      page.getByRole("link", { name: `Sunting ${t} Materi Sentuh` }),
      "Sunting (baris materi)",
    );
    // The Urutan switch's 44px hit area is a ::before that expands the
    // 48×28 track (toggle.tsx) — boundingBox() cannot see pseudo-elements,
    // so the hit area is asserted from the computed insets instead.
    const sequential = page.getByRole("switch", { name: "Wajib berurutan" });
    const hitArea = await sequential.evaluate((node) => {
      const el = node instanceof HTMLElement ? node : null;
      if (!el) return { width: 0, height: 0 };
      const before = getComputedStyle(el, "::before");
      const insetX = Math.abs(parseFloat(before.left));
      const insetY = Math.abs(parseFloat(before.top));
      return {
        width: el.offsetWidth + insetX * 2,
        height: el.offsetHeight + insetY * 2,
      };
    });
    expect(
      hitArea.width,
      "toggle Wajib berurutan: hit area (incl. ::before) width >= 44",
    ).toBeGreaterThanOrEqual(44);
    expect(
      hitArea.height,
      "toggle Wajib berurutan: hit area (incl. ::before) height >= 44",
    ).toBeGreaterThanOrEqual(44);

    await page.getByRole("button", { name: "+ Tambah materi" }).click();
    const dialog = page.getByRole("dialog");
    await expectTouchTarget(
      dialog.getByRole("button", { name: "Buat & buka editor →" }),
      "Buat & buka editor → (dialog)",
    );
    await expectTouchTarget(
      dialog.getByRole("button", { name: "Batal" }),
      "Batal (dialog)",
    );
    await expectTouchTarget(
      dialog.getByRole("button", { name: "Tutup" }),
      "✕ Tutup (dialog tambah materi)",
    );

    await page.goto(`/cms/kursus/${emptyId}`);
    await expectTouchTarget(
      page.getByRole("button", { name: "+ Tambah materi pertama" }),
      "+ Tambah materi pertama",
    );
  });

  test("editor quiz: Sunting Final Quiz, tambah/sunting soal, Isi quiz →, dialog", async ({
    page,
    request,
  }) => {
    // Card S1-09 §6: every quiz-editor control at w360. The FINAL quiz of
    // a fresh course carries one question ("Sunting soal 01"); the lesson
    // editor page carries the quiz block ("Isi quiz →" at count 0).
    const editor = await createRoleAccount(request, "EDITOR");
    await signInViaApi(page.context(), editor);
    const t = randomToken("qz");
    const courseId = await createCourseViaApi(page.context(), {
      title: `${t} Sentuh Quiz`,
    });
    const lessonId = await createLessonViaApi(
      page.context(),
      courseId,
      `${t} Materi Quiz`,
    );

    // The FINAL quiz id never appears in an API answer — read it from the
    // E2E database (same helper shape as cms-quiz-editor.spec.ts).
    const quizRows = await withE2eDb(
      (sql) => sql`select final_quiz_id as id from courses where id = ${courseId}`,
    );
    const finalQuizId = quizRows[0]?.id as string;
    expect(finalQuizId, "kursus punya quiz FINAL").toBeTruthy();
    const question = await page.context().request.post(
      `/api/cms/quizzes/${finalQuizId}/questions`,
      {
        data: {
          type: "SINGLE_CHOICE",
          text: "Pertanyaan sentuh untuk tes e2e.",
          explanation: "Pembahasan sentuh untuk tes e2e.",
          options: [
            { text: "Opsi satu", isCorrect: false },
            { text: "Opsi dua", isCorrect: true },
            { text: "Opsi tiga", isCorrect: false },
            { text: "Opsi empat", isCorrect: false },
          ],
        },
      },
    );
    expect(question.status(), await question.text()).toBe(201);

    // The builder door (lesson-outline Final Quiz block).
    await page.goto(`/cms/kursus/${courseId}`);
    await expectTouchTarget(
      page.getByRole("link", { name: "Sunting Final Quiz" }),
      "Sunting Final Quiz (builder)",
    );

    // The quiz page + the open dialog.
    await page.goto(`/cms/quiz/${finalQuizId}`);
    await expectTouchTarget(
      page.getByRole("button", { name: "+ Tambah soal" }),
      "+ Tambah soal",
    );
    await expectTouchTarget(
      page.getByRole("button", { name: "Sunting soal 01" }),
      "Sunting soal 01",
    );
    await page.getByRole("button", { name: "+ Tambah soal" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByLabel("Pertanyaan", { exact: true }),
    ).toBeVisible();
    await expectTouchTarget(
      dialog.getByLabel("Tipe soal", { exact: true }),
      "Tipe soal (dialog)",
    );
    // The key hit area is the <label> circle wrapping the sr-only radio
    // (the 1×1 radio itself would always fail — card §6).
    for (const name of ["Kunci: opsi A", "Kunci: opsi B", "Kunci: opsi C", "Kunci: opsi D"]) {
      await expectTouchTarget(
        dialog.locator("label", { has: page.getByRole("radio", { name }) }),
        `lingkaran kunci ${name}`,
      );
    }
    await expectTouchTarget(
      dialog.getByRole("button", { name: "Simpan soal", exact: true }),
      "Simpan soal (dialog)",
    );
    await expectTouchTarget(
      dialog.getByRole("button", { name: "Simpan & tambah soal" }),
      "Simpan & tambah soal (dialog)",
    );
    await expectTouchTarget(
      dialog.getByRole("button", { name: "Tutup" }),
      "✕ Tutup (dialog soal)",
    );

    // The materi editor's quiz-block door.
    await page.goto(`/cms/kursus/${courseId}/materi/${lessonId}`);
    await expectTouchTarget(
      page.getByRole("link", { name: "Isi quiz →" }),
      "Isi quiz → (blok quiz editor materi)",
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
