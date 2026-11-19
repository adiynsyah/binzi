// The S5-02 Final Quiz (card §"E2E", max 3 tests — the CI budget): the full
// flow (last lesson result → "Final Quiz sekarang terbuka" → rules with the
// 60/40 split → runner → result with Nilai Akhir → dashboard badge), the
// gate + API matrix (409 walls, 201→200 same attempt, idempotent submit,
// the stored final_score_percent), and the width sweep (document AND the
// outermost card, the S3-01 lesson). Lessons are completed through the API
// (the lesson-quiz flow itself is belajar-quiz.spec.ts's job — that file is
// not touched); the answer helpers are local copies of its pattern.
//
// Root spec → chromium project only. Shared-database rule: token-titled
// courses only, cleaned up through deleteCoursesInE2eDb. The publish helper
// gives every quiz 10 PG questions keyed "Opsi satu…" / wrong "Opsi dua…".
import type { BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import {
  createEditorAdminContexts,
  createPublishedCourseViaApi,
  deleteCoursesInE2eDb,
  expectNoHorizontalScroll,
  maybeScreenshot,
  randomToken,
  waitStableForMeasure,
} from "./layout/helpers";
import {
  createRoleAccount,
  signInViaApi,
  test,
  withE2eDb,
  type TestAccount,
} from "./fixtures";

let editorContext: BrowserContext;
let adminContext: BrowserContext;

/** Course ids this file created — removed again in afterAll. */
const courseIds: string[] = [];

test.beforeAll(async ({ browser }) => {
  ({ editorContext, adminContext } = await createEditorAdminContexts(browser));
});

test.afterAll(async () => {
  await editorContext.close();
  await adminContext.close();
  await deleteCoursesInE2eDb(courseIds);
});

// ---------------------------------------------------------------- helpers

function lessonUrl(courseSlug: string, lessonSlug: string): string {
  return `/belajar/${courseSlug}/${lessonSlug}`;
}

function quizUrlOf(courseSlug: string, lessonSlug: string): string {
  return `${lessonUrl(courseSlug, lessonSlug)}/quiz`;
}

function finalUrl(courseSlug: string): string {
  return `/belajar/${courseSlug}/final-quiz`;
}

/** A fresh signed-in MEMBER on the page's own (CSP-collected) context. */
async function memberOnPage(page: Page): Promise<TestAccount> {
  const member = await createRoleAccount(page.context().request, "MEMBER");
  await signInViaApi(page.context(), member);
  return member;
}

/** Published 2-lesson course + a signed-in, enrolled MEMBER on the page. */
async function finalCourseOnPage(page: Page, prefix: string) {
  const member = await memberOnPage(page);
  const title = `${randomToken(prefix)} Gizi Anak`;
  const made = await createPublishedCourseViaApi(
    editorContext,
    adminContext,
    title,
    { lessons: 2 },
  );
  courseIds.push(made.courseId);
  const enroll = await page
    .context()
    .request.post(`/api/progress/courses/${made.courseId}/enroll`);
  expect(enroll.status(), await enroll.text()).toBe(201);
  return { ...made, title, member };
}

type DbOption = {
  question_id: string;
  option_id: string;
  is_correct: boolean;
};

/** This quiz's (question, option) pairs from the E2E database. */
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

/** Answers `correct + wrong` questions through the API (7/0 → 70). */
async function answerViaApi(
  page: Page,
  attemptId: string,
  quizId: string,
  correct: number,
  wrong: number,
): Promise<void> {
  const byQuestion = new Map<string, DbOption[]>();
  for (const row of await optionsFromDb(quizId)) {
    byQuestion.set(row.question_id, [
      ...(byQuestion.get(row.question_id) ?? []),
      row,
    ]);
  }
  const questions = [...byQuestion.entries()];
  for (const [index, [questionId, options]] of questions.entries()) {
    const wanted =
      index < correct ? true : index < correct + wrong ? false : null;
    if (wanted === null) continue;
    const option = options.find((row) => row.is_correct === wanted);
    expect(
      option,
      `question ${index + 1} has an ${wanted} option`,
    ).toBeTruthy();
    const response = await page
      .context()
      .request.put(`/api/quiz/attempts/${attemptId}/answers/${questionId}`, {
        data: { optionId: option!.option_id },
      });
    expect(response.status(), await response.text()).toBe(200);
  }
}

/** Starts a LESSON attempt through the API and returns its id. */
async function attemptViaApi(page: Page, lessonId: string): Promise<string> {
  const response = await page
    .context()
    .request.post(`/api/quiz/lessons/${lessonId}/attempt`, { data: {} });
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { data: { attemptId: string } }).data
    .attemptId;
}

/** The full lesson-quiz arc via the API: start → answer → submit. */
async function completeLessonViaApi(
  page: Page,
  lessonId: string,
  quizId: string,
  correct: number,
  wrong: number,
): Promise<void> {
  const attemptId = await attemptViaApi(page, lessonId);
  await answerViaApi(page, attemptId, quizId, correct, wrong);
  const submitted = await page
    .context()
    .request.post(`/api/quiz/attempts/${attemptId}/submit`, { data: {} });
  expect(submitted.status(), await submitted.text()).toBe(200);
}

/** POST /final-attempt raw — the caller asserts the matrix herself. */
async function startFinalViaApi(page: Page, courseId: string) {
  return page
    .context()
    .request.post(`/api/quiz/courses/${courseId}/final-attempt`, {
      data: {},
    });
}

/** The member's attempt id for a quiz, read from the E2E database. */
async function attemptIdFromDb(email: string, quizId: string): Promise<string> {
  const rows = await withE2eDb(
    (sql) => sql`
        select qa.id as id from quiz_attempts qa
        join users u on u.id = qa.user_id
        where u.email = ${email} and qa.quiz_id = ${quizId}
      `,
  );
  expect(rows, `one attempt for ${email} on quiz ${quizId}`).toHaveLength(1);
  return rows[0]!.id as string;
}

/** Both lessons COMPLETED through the API: 70 then 50 (average 60). */
async function completeBothLessonsViaApi(
  page: Page,
  made: Awaited<ReturnType<typeof finalCourseOnPage>>,
) {
  await completeLessonViaApi(
    page,
    made.lessons[0]!.id,
    made.lessons[0]!.quizId,
    7,
    0,
  );
  await completeLessonViaApi(
    page,
    made.lessons[1]!.id,
    made.lessons[1]!.quizId,
    5,
    0,
  );
}

/**
 * The S3-01 width lesson, applied to the Final screens: the DOCUMENT stays
 * clean while an inner row overflows its card — so the outermost card (or,
 * on card-less screens like aturan, the content column) is measured too.
 */
async function expectOutermostBoxFits(
  page: Page,
  anchor: import("@playwright/test").Locator,
  label: string,
): Promise<void> {
  await waitStableForMeasure(page);
  const box = anchor.locator(
    "xpath=ancestor-or-self::*[contains(@class, 'rounded-card') or contains(@class, 'mx-auto')][last()]",
  );
  const metrics = await box.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(
    metrics.scrollWidth,
    `${label}: kartu terluar scrollWidth <= clientWidth`,
  ).toBeLessThanOrEqual(metrics.clientWidth);
}

// ------------------------------------------------------------------ tests

test("1. alur utuh: hasil materi 2 → Final terbuka → aturan 60/40 → 80 → Lulus kursus, Nilai Akhir 68 → dasbor Lulus", async ({
  page,
}) => {
  const made = await finalCourseOnPage(page, "bfq1");
  await completeBothLessonsViaApi(page, made);

  // The last lesson's result closing: the Final Quiz IS the next step now.
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(quizUrlOf(made.courseSlug, made.lessons[1]!.slug));
  await expect(
    page.getByText("Materi 2 ditandai selesai. Final Quiz sekarang terbuka."),
  ).toBeVisible();
  await maybeScreenshot(
    page,
    "materi-hasil-ke-final-360",
    test.info().project.name,
  );

  await page.getByRole("link", { name: "Lanjut ke Final Quiz" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Final Quiz menentukan 40% Nilai Akhir",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Rata-rata quiz materi Anda sekarang 60 (bobot 60%)"),
  ).toBeVisible();
  await maybeScreenshot(page, "final-aturan-360", test.info().project.name);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Final Quiz menentukan 40% Nilai Akhir",
    }),
  ).toBeVisible();
  await maybeScreenshot(page, "final-aturan-1280", test.info().project.name);

  // Start (the one attempt), then answer 8/10 through the API.
  await page
    .getByRole("button", { name: "Saya siap, mulai Final Quiz" })
    .click();
  await expect(
    page.getByText("Soal 1 dari 10 · Satu kesempatan"),
  ).toBeVisible();
  const attemptId = await attemptIdFromDb(made.member.email, made.finalQuizId);
  await answerViaApi(page, attemptId, made.finalQuizId, 8, 0);

  // Reload mid-attempt (QZ-08): the runner continues, collect through the UI.
  await page.reload();
  await expect(
    page.getByText("Soal 1 dari 10 · Satu kesempatan"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Soal 10, belum dijawab" }).click();
  await page.getByRole("button", { name: "Lihat ringkasan" }).click();
  await expect(
    page.getByText("8 dijawab · 2 belum dijawab · 0 ragu-ragu"),
  ).toBeVisible();
  const submitted = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/submit"),
  );
  await page.getByRole("button", { name: "Kumpulkan sekarang" }).click();
  expect((await submitted).status()).toBe(200);

  // The result: 80 ≥ 70 → Lulus kursus; stored Nilai Akhir 68 with its
  // formula (= 60 × 60% + 80 × 40%).
  await expect(page.getByText("Lulus kursus")).toBeVisible();
  await expect(page.getByText("80", { exact: true })).toBeVisible();
  await expect(page.getByText("68", { exact: true })).toBeVisible();
  await expect(page.getByText("= 60 × 60%")).toBeVisible();
  await expect(page.getByText("+ 80 × 40%")).toBeVisible();
  await expect(page.getByText("8 dari 10 soal benar")).toBeVisible();
  await maybeScreenshot(page, "final-hasil-1280", test.info().project.name);

  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await expect(page.getByText("Terkunci permanen")).toBeVisible();
  await maybeScreenshot(page, "final-hasil-360", test.info().project.name);

  // "Ke Belajar" → the dashboard badge flipped by the submit (S5-01).
  await page.getByRole("link", { name: "Ke Belajar" }).click();
  const article = page.getByRole("article", { name: made.title });
  await expect(article.getByText("Lulus", { exact: true })).toBeVisible();
});

test("2. gerbang + API: 409 sebelum selesai → /final-quiz dialihkan → 201/200 id sama → kumpulkan 2× tetap 68.00 → 409", async ({
  page,
}) => {
  const made = await finalCourseOnPage(page, "bfq2");
  await completeLessonViaApi(
    page,
    made.lessons[0]!.id,
    made.lessons[0]!.quizId,
    7,
    0,
  );

  // The gate: 1 of 2 lessons COMPLETED, no attempt → the page bounces to
  // materi 2 and the API answers 409.
  await page.goto(finalUrl(made.courseSlug));
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: `Materi 2 · ${made.title} materi 2`,
    }),
  ).toBeVisible();
  const gated = await startFinalViaApi(page, made.courseId);
  expect(gated.status(), await gated.text()).toBe(409);

  // The lesson bottom bar carries no Final link before the gate opens.
  await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
  await expect(
    page.getByRole("link", { name: "Lihat Hasil & Pembahasan" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Final Quiz" })).toHaveCount(0);

  // Gate open: 201, then 200 with the SAME attempt id (never a second one).
  await completeLessonViaApi(
    page,
    made.lessons[1]!.id,
    made.lessons[1]!.quizId,
    5,
    0,
  );
  const started = await startFinalViaApi(page, made.courseId);
  expect(started.status(), await started.text()).toBe(201);
  const attemptId = (
    (await started.json()) as {
      data: { attemptId: string };
    }
  ).data.attemptId;
  const resumed = await startFinalViaApi(page, made.courseId);
  expect(resumed.status(), await resumed.text()).toBe(200);
  expect(
    ((await resumed.json()) as { data: { attemptId: string } }).data.attemptId,
  ).toBe(attemptId);

  // Submit is idempotent: 200 twice, the stored Nilai Akhir never moves.
  await answerViaApi(page, attemptId, made.finalQuizId, 8, 0);
  const enrollment = () =>
    withE2eDb(
      (sql) => sql`
          select e.final_score_percent::text as score, e.status::text as status
          from enrollments e
          join users u on u.id = e.user_id
          where u.email = ${made.member.email} and e.course_id = ${made.courseId}
        `,
    );
  const first = await page
    .context()
    .request.post(`/api/quiz/attempts/${attemptId}/submit`, { data: {} });
  expect(first.status(), await first.text()).toBe(200);
  expect((await enrollment())[0]).toMatchObject({
    score: "68.00",
    status: "PASSED",
  });
  const second = await page
    .context()
    .request.post(`/api/quiz/attempts/${attemptId}/submit`, { data: {} });
  expect(second.status(), await second.text()).toBe(200);
  expect((await enrollment())[0]).toMatchObject({
    score: "68.00",
    status: "PASSED",
  });

  // One attempt forever (QZ-13), FINAL included.
  const after = await startFinalViaApi(page, made.courseId);
  expect(after.status(), await after.text()).toBe(409);
  expect(await after.text()).toContain("Final Quiz ini sudah dikerjakan.");
});

test("3. lebar 360/1280: aturan dan hasil tanpa gulir samping (dokumen dan kartu terluar)", async ({
  page,
}) => {
  const made = await finalCourseOnPage(page, "bfq3");
  await completeBothLessonsViaApi(page, made);

  // aturan — measured BEFORE any attempt exists (the GET would otherwise
  // answer berjalan).
  await page.goto(finalUrl(made.courseSlug));
  await expect(
    page.getByRole("heading", {
      name: "Final Quiz menentukan 40% Nilai Akhir",
    }),
  ).toBeVisible();
  for (const width of [360, 1280] as const) {
    await page.setViewportSize({ width, height: 800 });
    await expect(
      page.getByRole("heading", {
        name: "Final Quiz menentukan 40% Nilai Akhir",
      }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page, `final-aturan-${width}`);
    await expectOutermostBoxFits(
      page,
      page.getByRole("button", { name: "Saya siap, mulai Final Quiz" }),
      `final-aturan-${width}`,
    );
  }

  // hasil — the whole arc through the API, then the GET lands on it.
  const started = await startFinalViaApi(page, made.courseId);
  expect(started.status(), await started.text()).toBe(201);
  const attemptId = (
    (await started.json()) as {
      data: { attemptId: string };
    }
  ).data.attemptId;
  await answerViaApi(page, attemptId, made.finalQuizId, 8, 0);
  const submitted = await page
    .context()
    .request.post(`/api/quiz/attempts/${attemptId}/submit`, { data: {} });
  expect(submitted.status(), await submitted.text()).toBe(200);

  await page.goto(finalUrl(made.courseSlug));
  await expect(page.getByText("Lulus kursus")).toBeVisible();
  for (const width of [360, 1280] as const) {
    await page.setViewportSize({ width, height: 800 });
    await expect(page.getByText("Lulus kursus")).toBeVisible();
    await expectNoHorizontalScroll(page, `final-hasil-${width}`);
    await expectOutermostBoxFits(
      page,
      page.getByRole("link", { name: "Lihat pembahasan 10 soal" }),
      `final-hasil-${width}`,
    );
  }
});
