// /cms/kursus/{id} builder flows (card S1-02): saving settings (reload
// persists), the empty-summary save error with focus movement, adding the
// first and second lesson through the 21h dialog into the placeholder
// editor, and the placeholder's id guards.
//
// Uniqueness rule: same as cms-kursus.spec.ts — every course title and
// slug carries a random token so tests sharing the e2e database (and the
// similar-title prefix rule) never cross-fire.
import { expect, test } from "./fixtures";
import { createRoleAccount, signInViaApi } from "./fixtures";
import {
  createCourseViaApi,
  createLessonViaApi,
  randomToken,
} from "./layout/helpers";

test("EDITOR: simpan pengaturan → banner sukses, fokus kembali, reload bertahan", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("sv");
  const courseId = await createCourseViaApi(page.context(), {
    title: `${t} Gizi Ibu Hamil`,
  });

  await page.goto(`/cms/kursus/${courseId}`);
  await expect(
    page.getByRole("heading", { name: `${t} Gizi Ibu Hamil` }),
  ).toBeVisible();

  // Change every editable field: judul, ringkasan, slug, level, urutan.
  await page.getByLabel("Judul kursus").fill(`${t} Gizi Ibu Hamil Diperbarui`);
  await page.getByRole("textbox", { name: "Ringkasan" }).fill("Ringkasan revisi untuk tes e2e.");
  await page.getByLabel("Slug").fill(`${t}-gizi-hamil-revisi`);
  // Level: the same segmented control as the 21f dialog — click the pill.
  await page.getByText("Lanjutan", { exact: true }).click();
  // is_sequential defaults ON; the builder turns it off here.
  const sequential = page.getByRole("switch", { name: "Wajib berurutan" });
  await expect(sequential).toBeChecked();
  await sequential.click();

  const save = page.getByRole("button", { name: "Simpan" });
  await save.click();

  await expect(page.getByText("Pengaturan tersimpan.")).toBeVisible();
  // Card §2: focus RETURNS to "Simpan" (loading dropped it while disabled).
  await expect(save).toBeFocused();

  // Reload: everything persisted server-side.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: `${t} Gizi Ibu Hamil Diperbarui` }),
  ).toBeVisible();
  await expect(page.getByLabel("Judul kursus")).toHaveValue(
    `${t} Gizi Ibu Hamil Diperbarui`,
  );
  await expect(page.getByRole("textbox", { name: "Ringkasan" })).toHaveValue(
    "Ringkasan revisi untuk tes e2e.",
  );
  await expect(page.getByLabel("Slug")).toHaveValue(`${t}-gizi-hamil-revisi`);
  await expect(page.getByLabel("Lanjutan", { exact: true })).toBeChecked();
  await expect(sequential).not.toBeChecked();
});

test("simpan: ringkasan dikosongkan → pesan + fokus di Ringkasan", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const courseId = await createCourseViaApi(page.context(), {
    title: `${randomToken("sv")} Ringkasan Kosong`,
  });

  await page.goto(`/cms/kursus/${courseId}`);
  await page.getByRole("textbox", { name: "Ringkasan" }).fill("");
  await page.getByRole("button", { name: "Simpan" }).click();

  await expect(
    page.getByText("Ringkasan wajib diisi — tanpa ini kartu katalog kosong."),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Ringkasan" }),
  ).toBeFocused();
});

test("tambah materi pertama & kedua → placeholder editor → outline 21a", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("mt");
  const courseTitle = `${t} Kursu Tambah Materi`;
  const courseId = await createCourseViaApi(page.context(), {
    title: courseTitle,
  });

  await page.goto(`/cms/kursus/${courseId}`);
  // Fresh course checklist: the three creation fields met (card §5).
  await expect(page.getByText("3 / 6")).toBeVisible();
  await expect(page.getByText("3 hal perlu dilengkapi")).toBeVisible();

  // First lesson: only the empty state offers it (review item 8).
  await page.getByRole("button", { name: "+ Tambah materi pertama" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Tambah materi");
  await expect(dialog.getByText(`${courseTitle} · Materi baru`)).toBeVisible();
  await expect(dialog.getByText("Di akhir — jadi materi 1")).toBeVisible();
  await dialog.getByLabel("Judul materi").fill(`${t} Energi dan Porsi`);
  await dialog.getByRole("button", { name: "Buat & buka editor →" }).click();

  // Lands in the S1-04 lesson editor named after the lesson.
  await page.waitForURL(/\/cms\/kursus\/[0-9a-f-]{36}\/materi\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: `${t} Energi dan Porsi` }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Teks materi" }),
  ).toBeVisible();

  // Back to the builder (fresh load — the outline must reflect the DB).
  await page.goto(`/cms/kursus/${courseId}`);
  await expect(
    page.getByText(`1 · ${t} Energi dan Porsi`),
  ).toBeVisible();
  // 21a markers of a fresh lesson (card §3): empty video slot, empty
  // text, no quiz questions yet.
  await expect(page.getByText("KOSONG", { exact: true })).toBeVisible();
  await expect(
    page.getByText("BELUM ADA VIDEO · TEKS BELUM DIISI · QUIZ BELUM DIBUAT"),
  ).toBeVisible();
  // The header add button replaced the empty state's (review item 8).
  await expect(
    page.getByRole("button", { name: "+ Tambah materi" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "+ Tambah materi pertama" }),
  ).toHaveCount(0);

  // Second lesson via the header button.
  await page.getByRole("button", { name: "+ Tambah materi" }).click();
  await expect(dialog.getByText("Di akhir — jadi materi 2")).toBeVisible();
  await dialog.getByLabel("Judul materi").fill(`${t} Protein Harian`);
  await dialog.getByRole("button", { name: "Buat & buka editor →" }).click();
  await page.waitForURL(/\/cms\/kursus\/[0-9a-f-]{36}\/materi\/[0-9a-f-]{36}$/);

  await page.goto(`/cms/kursus/${courseId}`);
  await expect(page.getByText(`2 · ${t} Protein Harian`)).toBeVisible();
  await expect(page.getByText("2 materi · wajib berurutan")).toBeVisible();
});

test("placeholder editor: materi kursus lain → 404; ID bukan UUID → 404", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("mt");
  const courseIdA = await createCourseViaApi(page.context(), {
    title: `${t} Kursu A`,
  });
  const courseIdB = await createCourseViaApi(page.context(), {
    title: `${t} Kursu B`,
  });
  const lessonA = await createLessonViaApi(
    page.context(),
    courseIdA,
    `${t} Materi Kursu A`,
  );

  // The lesson exists, but does not belong to course B: existence is not
  // confirmed (anti-IDOR shape, card §4).
  const cross = await page.goto(
    `/cms/kursus/${courseIdB}/materi/${lessonA}`,
  );
  expect(cross?.status()).toBe(404);

  const badId = await page.goto(`/cms/kursus/${courseIdA}/materi/bukan-uuid`);
  expect(badId?.status()).toBe(404);
});
