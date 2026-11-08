// The S1-09 quiz editor: /cms/quiz/{quizId} and its dialog. Covers the
// card "Selesai if" E2E list — the builder door, the two-mode save flow
// (PG via "Simpan & tambah soal", B/S via "Simpan soal"), persistence +
// edit seeding, the materi-editor quiz block door, the API guards (3
// options → 400, cross-quiz → 404, MEMBER 403 before the body is read),
// the IN_REVIEW lock (page + API 409), the width checks (360/1024/1280:
// first-row text ≥ 240px, no horizontal scroll, dialog at 360), Enter in
// "Opsi A" (implicit submit → "Simpan soal"), and the owner-review
// screenshots (pages w1280/w1024/w768/w360, dialogs w1280/w360).
//
// Uniqueness rule: every course title carries a random token (shared e2e
// database). The FINAL quiz id never appears in an API answer — it is
// read straight from the E2E database (courses.final_quiz_id).
import type { Locator, Page } from "@playwright/test";

import { createRoleAccount, expect, signInViaApi, test, withE2eDb } from "./fixtures";
import {
  createCourseViaApi,
  expectNoHorizontalScroll,
  maybeScreenshot,
  randomToken,
} from "./layout/helpers";

// ---------------------------------------------------------------- fixtures

/** The course's auto-created FINAL quiz id (not part of the POST answer). */
async function finalQuizIdOf(courseId: string): Promise<string> {
  const rows = await withE2eDb(
    (sql) => sql`select final_quiz_id as id from courses where id = ${courseId}`,
  );
  const id = rows[0]?.id;
  if (!id) throw new Error(`course ${courseId} was created without a FINAL quiz`);
  return id;
}

/** A valid PG question body with token-distinct texts (key on B). */
function pgBody(label: string) {
  return {
    type: "SINGLE_CHOICE",
    text: `Pertanyaan PG ${label} untuk tes e2e.`,
    explanation: `Pembahasan PG ${label} untuk tes e2e.`,
    options: [
      { text: `Opsi satu ${label}`, isCorrect: false },
      { text: `Opsi dua ${label}`, isCorrect: true },
      { text: `Opsi tiga ${label}`, isCorrect: false },
      { text: `Opsi empat ${label}`, isCorrect: false },
    ],
  };
}

/** POSTs one valid PG question through the real API; answers its id. */
async function createPgQuestionViaApi(
  page: Page,
  quizId: string,
  label: string,
): Promise<string> {
  const response = await page.context().request.post(
    `/api/cms/quizzes/${quizId}/questions`,
    { data: pgBody(label) },
  );
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { data: { id: string } }).data.id;
}

/** Creates a lesson through the real API; answers id + quizId (21i). */
async function createLessonWithQuizViaApi(
  page: Page,
  courseId: string,
  title: string,
): Promise<{ id: string; quizId: string }> {
  const response = await page.context().request.post(
    `/api/cms/courses/${courseId}/lessons`,
    { data: { title } },
  );
  expect(response.status(), await response.text()).toBe(201);
  const data = (await response.json()) as { data: { id: string; quizId: string } };
  return { id: data.data.id, quizId: data.data.quizId };
}

// ------------------------------------------------------------ dialog helpers

/**
 * The 44px key circle: the <label> WRAPPING the sr-only radio (clicking
 * the circle is the designed interaction — the 1×1 radio itself is not a
 * trustworthy click target).
 */
function keyCircle(page: Page, name: string): Locator {
  return page
    .getByRole("dialog")
    .locator("label", { has: page.getByRole("radio", { name }) });
}

/** Fills the whole PG form (key on B). */
async function fillPgForm(page: Page, label: string): Promise<void> {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Pertanyaan", { exact: true }).fill(
    `Pertanyaan PG ${label} untuk tes e2e.`,
  );
  for (const letter of ["A", "B", "C", "D"]) {
    await dialog
      .getByLabel(`Opsi ${letter}`, { exact: true })
      .fill(`Opsi ${letter} ${label}`);
  }
  await keyCircle(page, "Kunci: opsi B").click();
  await expect(
    dialog.getByRole("radio", { name: "Kunci: opsi B" }),
  ).toBeChecked();
  await dialog
    .getByLabel("Pembahasan", { exact: true })
    .fill(`Pembahasan PG ${label} untuk tes e2e.`);
}

// ------------------------------------------------------------------- tests

test("1. builder → Sunting Final Quiz → halaman editor (breadcrumb, 0 dari 20 soal)", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("f1");
  const courseTitle = `${t} Kursus Final Quiz`;
  const courseId = await createCourseViaApi(page.context(), { title: courseTitle });

  await page.goto(`/cms/kursus/${courseId}`);
  await page.getByRole("link", { name: "Sunting Final Quiz" }).click();

  await expect(page).toHaveURL(/\/cms\/quiz\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: courseTitle })).toBeVisible();
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb).toContainText("Kursus");
  await expect(breadcrumb).toContainText(courseTitle);
  await expect(breadcrumb).toContainText("Final Quiz");
  await expect(page.getByText("0 dari 20 soal")).toBeVisible();
  await expect(
    page.getByText("MINIMUM PUBLISH 10 SOAL · KURANG 10"),
  ).toBeVisible();
  await expect(page.getByText("Belum ada soal.")).toBeVisible();
});

test("2. tambah PG (Simpan & tambah soal) lalu B/S (Simpan soal) → dua baris lengkap, KURANG 8", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("f2");
  const courseId = await createCourseViaApi(page.context(), {
    title: `${t} Kursus Dua Soal`,
  });
  const quizId = await finalQuizIdOf(courseId);

  await page.goto(`/cms/quiz/${quizId}`);
  await page.getByRole("button", { name: "+ Tambah soal" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Soal 01 dari 1")).toBeVisible();

  // PG with the key on B, saved with the STAY-OPEN mode.
  await fillPgForm(page, "satu");
  await dialog.getByRole("button", { name: "Simpan & tambah soal" }).click();
  await expect(dialog.getByText("Soal 02 dari 2")).toBeVisible();
  await expect(
    dialog.getByLabel("Pertanyaan", { exact: true }),
  ).toHaveValue("");
  await expect(dialog.getByLabel("Opsi A", { exact: true })).toHaveValue("");

  // B/S as the second question, saved with the CLOSING mode.
  await dialog.getByLabel("Tipe soal", { exact: true }).selectOption("TRUE_FALSE");
  await dialog
    .getByLabel("Pertanyaan", { exact: true })
    .fill("Pertanyaan B/S untuk tes e2e.");
  await keyCircle(page, "Kunci: Salah").click();
  await expect(dialog.getByRole("radio", { name: "Kunci: Salah" })).toBeChecked();
  await dialog
    .getByLabel("Pembahasan", { exact: true })
    .fill("Pembahasan B/S untuk tes e2e.");
  await dialog
    .getByRole("button", { name: "Simpan soal", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);

  await expect(page.getByText("2 dari 20 soal")).toBeVisible();
  await expect(page.getByText("MINIMUM PUBLISH 10 SOAL · KURANG 8")).toBeVisible();
  await expect(page.getByText("PG · KUNCI ✓ · PEMBAHASAN ✓")).toBeVisible();
  await expect(page.getByText("B/S · KUNCI ✓ · PEMBAHASAN ✓")).toBeVisible();
});

test("3. muat ulang → soal bertahan; Sunting soal 01 → isian terisi", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("f3");
  const courseId = await createCourseViaApi(page.context(), {
    title: `${t} Kursus Bertahan`,
  });
  const quizId = await finalQuizIdOf(courseId);
  await createPgQuestionViaApi(page, quizId, `${t}-1`);

  await page.goto(`/cms/quiz/${quizId}`);
  await page.reload();
  await expect(page.getByText("1 dari 20 soal")).toBeVisible();

  await page.getByRole("button", { name: "Sunting soal 01" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Soal 01 dari 1")).toBeVisible();
  await expect(
    dialog.getByLabel("Pertanyaan", { exact: true }),
  ).toHaveValue(`Pertanyaan PG ${t}-1 untuk tes e2e.`);
  await expect(dialog.getByLabel("Opsi B", { exact: true })).toHaveValue(
    `Opsi dua ${t}-1`,
  );
  await expect(
    dialog.getByRole("radio", { name: "Kunci: opsi B" }),
  ).toBeChecked();
  await expect(
    dialog.getByLabel("Pembahasan", { exact: true }),
  ).toHaveValue(`Pembahasan PG ${t}-1 untuk tes e2e.`);

  // A normal save closes the dialog and returns focus to the OPENER —
  // there is no DialogTrigger, so Radix alone would drop focus to <body>.
  await dialog
    .getByRole("button", { name: "Simpan soal", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Sunting soal 01" }),
  ).toBeFocused();
});

test("4. editor materi → blok Quiz materi → Isi quiz → → halaman quiz materi (← Materi 1)", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("f4");
  const courseId = await createCourseViaApi(page.context(), {
    title: `${t} Kursus Blok Quiz`,
  });
  const lessonTitle = `${t} Materi Blok Quiz`;
  const lesson = await createLessonWithQuizViaApi(page, courseId, lessonTitle);

  await page.goto(`/cms/kursus/${courseId}/materi/${lesson.id}`);
  await expect(page.getByText("Quiz materi")).toBeVisible();
  await expect(page.getByText("0 dari min. 10 soal")).toBeVisible();

  // The clean form navigates straight away (no leave dialog).
  await page.getByRole("link", { name: "Isi quiz →" }).click();
  await expect(page).toHaveURL(`/cms/quiz/${lesson.quizId}`);
  await expect(page.getByRole("heading", { name: lessonTitle })).toBeVisible();
  await expect(page.getByRole("link", { name: "← Materi 1" })).toBeVisible();
  await expect(
    page.getByText("MILIK MATERI 1 · JENIS TIDAK BISA DIUBAH"),
  ).toBeVisible();
});

test("5. API: PG 3 opsi → 400 path options; soal quiz lain → 404; MEMBER → 403 sebelum body (100 KiB pun)", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  const member = await createRoleAccount(request, "MEMBER");
  await signInViaApi(page.context(), editor);
  const t = randomToken("f5");
  const courseIdA = await createCourseViaApi(page.context(), {
    title: `${t} Kursus API A`,
  });
  const courseIdB = await createCourseViaApi(page.context(), {
    title: `${t} Kursus API B`,
  });
  const quizA = await finalQuizIdOf(courseIdA);
  const quizB = await finalQuizIdOf(courseIdB);
  const inB = await createPgQuestionViaApi(page, quizB, `${t}-x`);

  // Server contract: exactly 4 PG options → the 3-option body is a 400
  // whose first field path is "options".
  const threeOptions = await page.context().request.post(
    `/api/cms/quizzes/${quizA}/questions`,
    { data: { ...pgBody(`${t}-3opsi`), options: pgBody(`${t}-3opsi`).options.slice(0, 3) } },
  );
  expect(threeOptions.status(), await threeOptions.text()).toBe(400);
  const body = (await threeOptions.json()) as {
    error: { fields: { path: string; message: string }[] };
  };
  expect(body.error.fields[0]?.path).toBe("options");

  // Anti-IDOR: the question exists, but under the OTHER quiz's URL → 404.
  const crossQuiz = await page.context().request.patch(
    `/api/cms/quizzes/${quizA}/questions/${inB}`,
    { data: pgBody(`${t}-silang`) },
  );
  expect(crossQuiz.status(), await crossQuiz.text()).toBe(404);

  // MEMBER is rejected BEFORE the body is read: even a 100 KiB body
  // (well over the 64 KiB byte budget) answers 403, not 413.
  await signInViaApi(page.context(), member);
  const large = await page.context().request.post(
    `/api/cms/quizzes/${quizA}/questions`,
    {
      data: {
        ...pgBody(`${t}-besar`),
        text: "x".repeat(100 * 1024),
      },
    },
  );
  expect(large.status(), await large.text()).toBe(403);
});

test("6. kursus IN_REVIEW → halaman terkunci tanpa + Tambah soal; API → 409", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("f6");
  const courseId = await createCourseViaApi(page.context(), {
    title: `${t} Kursus Terkunci Quiz`,
  });
  const quizId = await finalQuizIdOf(courseId);
  await createPgQuestionViaApi(page, quizId, `${t}-1`);

  await withE2eDb(
    (sql) => sql`update courses set status = 'IN_REVIEW' where id = ${courseId}`,
  );

  await page.goto(`/cms/quiz/${quizId}`);
  await expect(page.getByText("1 dari 20 soal")).toBeVisible();
  await expect(
    page.getByText("Kursus sudah bukan draf — pengaturan dan materi terkunci."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Tambah soal" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sunting soal 01" })).toHaveCount(0);

  const conflict = await page.context().request.post(
    `/api/cms/quizzes/${quizId}/questions`,
    { data: pgBody(`${t}-terkunci`) },
  );
  expect(conflict.status(), await conflict.text()).toBe(409);
  expect(await conflict.text()).toContain("Kursus sudah bukan draf");
});

test("7. lebar: teks soal baris pertama ≥ 240px di 360/1024/1280; tanpa gulir samping; dialog @360", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("f7");
  const courseId = await createCourseViaApi(page.context(), {
    title: `${t} Kursus Lebar`,
  });
  const quizId = await finalQuizIdOf(courseId);
  await createPgQuestionViaApi(page, quizId, `${t}-1`);

  // 1024 is not in e2e/layout/widths.ts — measured here (card §6).
  for (const viewport of [
    { label: "w360", width: 360, height: 740 },
    { label: "w1024", width: 1024, height: 768 },
    { label: "w1280", width: 1280, height: 800 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`/cms/quiz/${quizId}`);
    const firstRowText = page
      .locator('section[aria-labelledby="quiz-questions-heading"] ol > li p[title]')
      .first();
    await expect(firstRowText).toBeVisible();
    const box = await firstRowText.boundingBox();
    expect(box, `teks soal baris pertama @${viewport.label}`).toBeTruthy();
    expect(
      box!.width,
      `teks soal baris pertama @${viewport.label} ≥ 240px`,
    ).toBeGreaterThanOrEqual(240);
    await expectNoHorizontalScroll(page, `halaman quiz @${viewport.label}`);
  }

  // The open dialog at the narrowest width.
  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByRole("button", { name: "+ Tambah soal" }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Pertanyaan", { exact: true }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page, "dialog soal @w360");
});

test("8. Enter di Opsi A (PG lengkap) → Simpan soal: dialog tertutup, jumlah +1", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("f8");
  const courseId = await createCourseViaApi(page.context(), {
    title: `${t} Kursus Enter`,
  });
  const quizId = await finalQuizIdOf(courseId);

  await page.goto(`/cms/quiz/${quizId}`);
  await page.getByRole("button", { name: "+ Tambah soal" }).click();
  await fillPgForm(page, "enter");

  // Implicit submission from a text input: the submitter is the FIRST
  // submit button in the DOM ("Simpan soal"), never the add-mode one.
  await page.getByRole("dialog").getByLabel("Opsi A", { exact: true }).click();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("1 dari 20 soal")).toBeVisible();
  await expect(page.getByText("PG · KUNCI ✓ · PEMBAHASAN ✓")).toBeVisible();
});

// Owner review (card "Sebelum membuka PR"): both pages at four widths and
// the four dialog states at two widths — saved only when
// E2E_SCREENSHOT_DIR is set (maybeScreenshot).
test("screenshot halaman quiz & dialog (w1280/w1024/w768/w360; dialog w1280/w360)", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("sc");
  const courseTitle = `${t} Kursus Screenshot Quiz`;
  const courseId = await createCourseViaApi(page.context(), { title: courseTitle });
  const finalQuizId = await finalQuizIdOf(courseId);
  await createPgQuestionViaApi(page, finalQuizId, `${t}-1`);
  const lessonTitle = `${t} Materi Screenshot Quiz`;
  const lesson = await createLessonWithQuizViaApi(page, courseId, lessonTitle);
  await page.context().request.post(`/api/cms/quizzes/${lesson.quizId}/questions`, {
    data: pgBody(`${t}-les`),
  });

  for (const viewport of [
    { label: "w1280", width: 1280, height: 800 },
    { label: "w1024", width: 1024, height: 768 },
    { label: "w768", width: 768, height: 1024 },
    { label: "w360", width: 360, height: 740 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`/cms/quiz/${finalQuizId}`);
    await expect(page.getByText("1 dari 20 soal")).toBeVisible();
    await maybeScreenshot(page, "s1-09-quiz-final", viewport.label);

    await page.goto(`/cms/quiz/${lesson.quizId}`);
    await expect(page.getByRole("heading", { name: lessonTitle })).toBeVisible();
    await maybeScreenshot(page, "s1-09-quiz-lesson", viewport.label);
  }

  const dialog = page.getByRole("dialog");
  for (const viewport of [
    { label: "w1280", width: 1280, height: 800 },
    { label: "w360", width: 360, height: 740 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`/cms/quiz/${finalQuizId}`);

    // PG baru (empty, key on none yet).
    await page.getByRole("button", { name: "+ Tambah soal" }).click();
    await expect(dialog.getByText("Soal 02 dari 2")).toBeVisible();
    await maybeScreenshot(page, "s1-09-dialog-pg-baru", viewport.label);
    await dialog.getByRole("button", { name: "Tutup" }).click();

    // PG sunting — the saved key marks the B row (KUNCI rides along).
    await page.getByRole("button", { name: "Sunting soal 01" }).click();
    await expect(
      dialog.getByRole("radio", { name: "Kunci: opsi B" }),
    ).toBeChecked();
    await maybeScreenshot(page, "s1-09-dialog-pg-sunting", viewport.label);
    await dialog.getByRole("button", { name: "Tutup" }).click();

    // B/S baru with a key picked.
    await page.getByRole("button", { name: "+ Tambah soal" }).click();
    await dialog.getByLabel("Tipe soal", { exact: true }).selectOption("TRUE_FALSE");
    await dialog
      .getByLabel("Pertanyaan", { exact: true })
      .fill("Pertanyaan B/S untuk tangkapan layar.");
    await keyCircle(page, "Kunci: Benar").click();
    await dialog
      .getByLabel("Pembahasan", { exact: true })
      .fill("Pembahasan B/S untuk tangkapan layar.");
    await maybeScreenshot(page, "s1-09-dialog-bs", viewport.label);
    await dialog.getByRole("button", { name: "Tutup" }).click();

    // Galat: the request is aborted → the generic failure banner.
    await page.route("**/api/cms/quizzes/*/questions*", (route) => route.abort());
    await page.getByRole("button", { name: "+ Tambah soal" }).click();
    await fillPgForm(page, "galat");
    await dialog
      .getByRole("button", { name: "Simpan soal", exact: true })
      .click();
    await expect(
      dialog.getByText("Soal belum tersimpan — periksa koneksi lalu coba lagi."),
    ).toBeVisible();
    await maybeScreenshot(page, "s1-09-dialog-galat", viewport.label);
    await page.unroute("**/api/cms/quizzes/*/questions*");
    await dialog.getByRole("button", { name: "Tutup" }).click();
  }
});
