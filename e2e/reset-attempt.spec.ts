// The S3-03 recovery path end to end (card §"E2E", max 3 tests — the CI
// budget): (1) report → approve → redo (participant + ADMIN UI, Nilai Saya
// loses the old score); (2) report → reject (the reason reaches the
// participant verbatim, the quiz page stays on the result screen);
// (3) reset without a report from /cms/reset-attempt/baru. Widths 360 and
// 1280 for the participant pages (form, menunggu, disetujui) and the three
// CMS pages: no horizontal scroll, and at 360 the category radios, "Kirim
// laporan", and the decision controls are ≥ 44 × 44. Screenshots: 12 files
// when E2E_SCREENSHOT_DIR is set.
//
// Root spec → chromium project only. Shared-database rule: token-titled
// courses only. Cleanup removes THIS file's reports first (they reference
// quiz_attempts, which deleteCoursesInE2eDb deletes). The answer helpers
// are local copies of the belajar-nilai.spec.ts pattern.
import type { BrowserContext, Locator, Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";

import {
  createEditorAdminContexts,
  createPublishedCourseViaApi,
  deleteCoursesInE2eDb,
  expectNoHorizontalScroll,
  expectTouchTarget,
  maybeScreenshot,
  randomToken,
  waitStableForMeasure,
} from "./layout/helpers";
import { createRoleAccount, signInViaApi, test, withE2eDb } from "./fixtures";

let editorContext: BrowserContext;
let adminContext: BrowserContext;

const courseIds: string[] = [];

test.beforeAll(async ({ browser }) => {
  ({ editorContext, adminContext } = await createEditorAdminContexts(browser));
});

test.afterAll(async () => {
  await editorContext.close();
  await adminContext.close();
  if (courseIds.length > 0) {
    await withE2eDb(
      (sql) => sql`
        delete from quiz_attempt_reports where attempt_id in (
          select qa.id from quiz_attempts qa
          join lessons l on l.quiz_id = qa.quiz_id
          where l.course_id = any(${courseIds}::uuid[])
        )
      `,
    );
  }
  await deleteCoursesInE2eDb(courseIds);
});

const WIDTHS = [360, 1280] as const;
const REASON =
  "Catatan sistem mendukung laporan ini.\nKesempatan dikembalikan satu kali.";
const STORY = "Setelah menekan kumpulkan, halaman berubah putih dan kembali.";

// ---------------------------------------------------------------- helpers

type DbOption = { question_id: string; option_id: string; is_correct: boolean };

async function optionsFromDb(quizId: string): Promise<DbOption[]> {
  return withE2eDb(
    (sql) => sql`
      select q.id as question_id, qo.id as option_id, qo.is_correct as is_correct
      from questions q
      join question_options qo on qo.question_id = q.id
      where q.quiz_id = ${quizId}
      order by q.order_index asc, qo.order_index asc
    `,
  );
}

async function answerViaApi(
  context: BrowserContext,
  attemptId: string,
  quizId: string,
  correct: number,
): Promise<void> {
  const byQuestion = new Map<string, DbOption[]>();
  for (const row of await optionsFromDb(quizId)) {
    byQuestion.set(row.question_id, [...(byQuestion.get(row.question_id) ?? []), row]);
  }
  for (const [index, [questionId, options]] of [...byQuestion.entries()].entries()) {
    if (index >= correct) break;
    const option = options.find((row) => row.is_correct);
    expect(option, `question ${index + 1} has a key`).toBeTruthy();
    const response = await context.request.put(
      `/api/quiz/attempts/${attemptId}/answers/${questionId}`,
      { data: { optionId: option!.option_id } },
    );
    expect(response.status(), await response.text()).toBe(200);
  }
}

/** Start → answer → submit the lesson quiz; returns the attempt id. */
async function completeLessonViaApi(
  context: BrowserContext,
  lessonId: string,
  quizId: string,
  correct: number,
): Promise<string> {
  const started = await context.request.post(`/api/quiz/lessons/${lessonId}/attempt`, {
    data: {},
  });
  expect(started.status(), await started.text()).toBe(201);
  const attemptId = ((await started.json()) as { data: { attemptId: string } }).data
    .attemptId;
  await answerViaApi(context, attemptId, quizId, correct);
  const submitted = await context.request.post(`/api/quiz/attempts/${attemptId}/submit`, {
    data: {},
  });
  expect(submitted.status(), await submitted.text()).toBe(200);
  return attemptId;
}

/** A published 2-lesson course, the member enrolled, lesson 1's quiz done
 *  with 3 of 10 correct (Nilai 30). */
async function memberWithLessonResult(page: Page, label: string) {
  const member = await createRoleAccount(page.context().request, "MEMBER");
  await signInViaApi(page.context(), member);
  const title = `${randomToken("rst")} ${label}`;
  const course = await createPublishedCourseViaApi(editorContext, adminContext, title, {
    lessons: 2,
  });
  courseIds.push(course.courseId);
  const enroll = await page
    .context()
    .request.post(`/api/progress/courses/${course.courseId}/enroll`);
  expect(enroll.status(), await enroll.text()).toBe(201);
  const lesson = course.lessons[0]!;
  const attemptId = await completeLessonViaApi(page.context(), lesson.id, lesson.quizId, 3);
  return {
    member,
    title,
    course,
    attemptId,
    quizPath: `/belajar/${course.courseSlug}/${lesson.slug}/quiz`,
    reportPath: `/belajar/${course.courseSlug}/${lesson.slug}/quiz/laporan`,
  };
}

/** The box fits: scrollWidth <= clientWidth (the S6-02 pattern). */
async function expectBoxFits(page: Page, box: Locator, label: string): Promise<void> {
  await waitStableForMeasure(page);
  const metrics = await box.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(metrics.scrollWidth, `${label}: kotak scrollWidth <= clientWidth`).toBeLessThanOrEqual(
    metrics.clientWidth,
  );
}

/** Both widths: no sideways scroll, the main box fits, optional 360-only
 *  touch checks, and the screenshot `{name}-{width}`. */
async function sweepWidths(
  page: Page,
  testInfo: TestInfo,
  name: string,
  touchAt360: (page: Page) => Promise<void> = async () => {},
): Promise<void> {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalScroll(page, `${name}-${width}`);
    await expectBoxFits(page, page.locator("main"), `${name}-${width}`);
    if (width === 360) await touchAt360(page);
    await maybeScreenshot(page, `${name}-${width}`, testInfo.project.name);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

// ------------------------------------------------------------------ tests

test("1. lapor → setujui → kerjakan ulang", async ({ page }, testInfo) => {
  test.slow();
  const made = await memberWithLessonResult(page, "kursus lapor setujui");

  // Before: Nilai Saya lists the course with the 30.
  await page.goto("/belajar/nilai");
  await expect(page.getByRole("heading", { level: 2, name: made.title, exact: true })).toBeVisible();

  // Result screen → "Laporkan gangguan".
  await page.goto(made.quizPath);
  await page.getByRole("link", { name: "Laporkan gangguan", exact: true }).click();
  await expect(page).toHaveURL(made.reportPath);
  await expect(
    page.getByRole("heading", { level: 1, name: "Quiz terputus di tengah jalan?", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Jawaban tersimpan: 3 dari 10", { exact: true })).toBeVisible();
  await sweepWidths(page, testInfo, "laporan-form", async (p) => {
    const group = p.getByRole("group", { name: "Apa yang terjadi?" });
    for (const label of await group.locator("label").all()) {
      await expectTouchTarget(label, "radio kategori 360");
    }
    await expectTouchTarget(
      p.getByRole("button", { name: "Kirim laporan", exact: true }),
      "Kirim laporan 360",
    );
  });

  await page.getByLabel("Halaman error saat mengirim jawaban", { exact: true }).check();
  await page.getByLabel(/Ceritakan singkat/).fill(STORY);
  await page.getByRole("button", { name: "Kirim laporan", exact: true }).click();
  await expect(page.getByText("Menunggu ditinjau", { exact: true })).toBeVisible();
  const numberText = await page.getByText(/^Laporan #R-\d+ · /).textContent();
  const reportNumber = Number(/#R-(\d+)/.exec(numberText ?? "")![1]);
  await sweepWidths(page, testInfo, "laporan-menunggu");

  // ADMIN: queue → the row (by number) → review → approve.
  const admin = await adminContext.newPage();
  try {
    await admin.goto("/cms/reset-attempt");
    const row = admin.getByRole("link", { name: new RegExp(`R-${reportNumber} `) });
    await expect(row).toBeVisible();
    await sweepWidths(admin, testInfo, "cms-antrean");
    await row.click();
    await expect(admin).toHaveURL(`/cms/reset-attempt/${reportNumber}`);
    await expect(
      admin.getByRole("heading", { level: 1, name: `Laporan R-${reportNumber}`, exact: true }),
    ).toBeVisible();
    await sweepWidths(admin, testInfo, "cms-tinjau", async (p) => {
      for (const name of [/Setujui reset/, /^Tolak/]) {
        await expectTouchTarget(
          p.getByRole("group", { name: "Keputusan" }).locator("label").filter({ hasText: name }),
          `keputusan ${name} 360`,
        );
      }
      await expectTouchTarget(
        p.getByRole("button", { name: "Simpan keputusan", exact: true }),
        "tombol keputusan 360",
      );
    });
    await admin.getByLabel(/Setujui reset/).check();
    await admin.getByLabel(/Alasan untuk user/).fill(REASON);
    await admin.getByRole("button", { name: "Setujui & reset attempt", exact: true }).click();
    const decision = admin.getByRole("complementary", { name: "Keputusan" });
    await expect(decision.getByText(/^Diputuskan oleh /)).toBeVisible();
    await expect(decision.getByText("Disetujui", { exact: true })).toBeVisible();
  } finally {
    await admin.close();
  }

  // Participant: the approval with the reason verbatim → redo.
  await page.goto(made.reportPath);
  await expect(
    page.getByRole("heading", { level: 1, name: "Kesempatan Anda dikembalikan", exact: true }),
  ).toBeVisible();
  const approved = page.locator("section", {
    has: page.getByRole("heading", { level: 1, name: "Kesempatan Anda dikembalikan" }),
  });
  await expect(approved.getByText(REASON.split("\n")[0]!, { exact: false })).toHaveText(REASON);
  await sweepWidths(page, testInfo, "laporan-disetujui");
  await approved.getByRole("link", { name: "Kerjakan ulang quiz materi 1", exact: true }).click();
  await expect(page).toHaveURL(made.quizPath);
  await expect(
    page.getByRole("heading", { level: 1, name: "Aturan quiz sebelum timer jalan", exact: true }),
  ).toBeVisible();

  // Nilai Saya no longer lists the old score (the course had no other).
  await page.goto("/belajar/nilai");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: made.title, exact: true })).toHaveCount(0);
});

test("2. lapor → tolak", async ({ page }) => {
  const made = await memberWithLessonResult(page, "kursus lapor tolak");
  const report = await page.context().request.post(
    `/api/quiz/attempts/${made.attemptId}/report`,
    { data: { category: "OTHER", description: STORY } },
  );
  expect(report.status(), await report.text()).toBe(201);
  const reportNumber = ((await report.json()) as { data: { number: number } }).data.number;

  const admin = await adminContext.newPage();
  const rejectReason = "Catatan sistem menunjukkan jawaban terkirim normal.";
  try {
    await admin.goto(`/cms/reset-attempt/${reportNumber}`);
    await admin.getByLabel(/^Tolak/).check();
    await admin.getByLabel(/Alasan untuk user/).fill(rejectReason);
    await admin.getByRole("button", { name: "Tolak laporan", exact: true }).click();
    await expect(
      admin.getByRole("complementary", { name: "Keputusan" }).getByText("Ditolak", { exact: true }),
    ).toBeVisible();
  } finally {
    await admin.close();
  }

  await page.goto(made.reportPath);
  await expect(
    page.getByRole("heading", { level: 1, name: "Nilai 30 tetap berlaku", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main").getByText(rejectReason, { exact: true })).toBeVisible();
  await page.goto(made.quizPath);
  await expect(
    page.getByRole("heading", { level: 1, name: "Materi 1 · Hasil Quiz", exact: true }),
  ).toBeVisible();
});

test("3. reset tanpa laporan", async ({ page }, testInfo) => {
  const made = await memberWithLessonResult(page, "kursus reset manual");

  const admin = await adminContext.newPage();
  try {
    await admin.goto("/cms/reset-attempt/baru");
    await admin.getByLabel("Email pengguna", { exact: true }).fill(made.member.email.toUpperCase());
    await admin.getByRole("button", { name: "Cari", exact: true }).click();
    await expect(admin.getByText(made.member.email, { exact: true })).toBeVisible();
    const target = admin.getByRole("radio", { name: new RegExp(`^${made.title} · Materi 1`) });
    await expect(target).toBeEnabled();
    await sweepWidths(admin, testInfo, "cms-baru");
    await target.check();
    await admin.getByLabel(/Alasan untuk user/).fill(REASON);
    await admin.getByRole("button", { name: "Reset attempt", exact: true }).click();
    await expect(admin.getByText("Attempt direset.", { exact: true })).toBeVisible();
    await expect(target).toBeDisabled();
  } finally {
    await admin.close();
  }

  await page.goto(made.quizPath);
  await expect(
    page.getByRole("heading", { level: 1, name: "Aturan quiz sebelum timer jalan", exact: true }),
  ).toBeVisible();
});
