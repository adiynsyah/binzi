// The S5-03 Nilai Saya page (card §"E2E", max 2 tests — the CI budget):
// (1) the filled transcript — course order by enrolled_at, the stored
// numbers (68 / 70 / 50 / 80), another participant's data staying out,
// the NEVER link's accessible name, the review links round trip, the
// width sweep (360 date-column + touch-target rules — BEFORE the SQL
// edits, so the screenshots show the values the arc produced), then the
// stored-value edits (91.40 → 91, 69.99 → 69) last; (2) the 8f empty
// state plus the signed-out redirect.
//
// Root spec → chromium project only. Shared-database rule: token-titled
// courses only, cleaned up through deleteCoursesInE2eDb. The answer
// helpers are local copies of the belajar-final-quiz.spec.ts pattern.
import type { BrowserContext, Locator, Page } from "@playwright/test";
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
  context: BrowserContext,
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
    const response = await context.request.put(
      `/api/quiz/attempts/${attemptId}/answers/${questionId}`,
      { data: { optionId: option!.option_id } },
    );
    expect(response.status(), await response.text()).toBe(200);
  }
}

/** The full lesson-quiz arc via the API: start → answer → submit. */
async function completeLessonViaApi(
  context: BrowserContext,
  lessonId: string,
  quizId: string,
  correct: number,
): Promise<void> {
  const started = await context.request.post(
    `/api/quiz/lessons/${lessonId}/attempt`,
    { data: {} },
  );
  expect(started.status(), await started.text()).toBe(201);
  const attemptId = ((await started.json()) as { data: { attemptId: string } })
    .data.attemptId;
  await answerViaApi(context, attemptId, quizId, correct, 0);
  const submitted = await context.request.post(
    `/api/quiz/attempts/${attemptId}/submit`,
    { data: {} },
  );
  expect(submitted.status(), await submitted.text()).toBe(200);
}

/** The full Final arc via the API: start → answer → submit. */
async function completeFinalViaApi(
  context: BrowserContext,
  courseId: string,
  quizId: string,
  correct: number,
): Promise<void> {
  const started = await context.request.post(
    `/api/quiz/courses/${courseId}/final-attempt`,
    { data: {} },
  );
  expect(started.status(), await started.text()).toBe(201);
  const attemptId = ((await started.json()) as { data: { attemptId: string } })
    .data.attemptId;
  await answerViaApi(context, attemptId, quizId, correct, 0);
  const submitted = await context.request.post(
    `/api/quiz/attempts/${attemptId}/submit`,
    { data: {} },
  );
  expect(submitted.status(), await submitted.text()).toBe(200);
}

/** The section of the course card headed by this exact h2 title. */
function courseSection(page: Page, title: string) {
  return page.locator("section", {
    has: page.getByRole("heading", { level: 2, name: title, exact: true }),
  });
}

/** The course box fits: "kartu terluar" on THIS page is the course card
 *  itself (the bordered section), never the PageContainer column — the
 *  page is a stack of independent boxes (PR 148 review). */
async function expectCourseBoxFits(
  page: Page,
  section: Locator,
  label: string,
): Promise<void> {
  await waitStableForMeasure(page);
  const metrics = await section.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(
    metrics.scrollWidth,
    `${label}: kotak kursus scrollWidth <= clientWidth`,
  ).toBeLessThanOrEqual(metrics.clientWidth);
}

// ------------------------------------------------------------------ tests

test("1. terisi: urutan, angka tersimpan, peserta lain, tautan, lebar 360–1280, 91.40/69.99", async ({
  page,
  browser,
}) => {
  const memberA = await createRoleAccount(page.context().request, "MEMBER");
  await signInViaApi(page.context(), memberA);

  const titleX = `${randomToken("bnx")} Gizi Anak`;
  const titleY = `${randomToken("bny")} Gizi Ibu`;
  const x = await createPublishedCourseViaApi(
    editorContext,
    adminContext,
    titleX,
    {
      lessons: 2,
    },
  );
  const y = await createPublishedCourseViaApi(
    editorContext,
    adminContext,
    titleY,
    {
      lessons: 3,
    },
  );
  courseIds.push(x.courseId, y.courseId);
  // Enroll X FIRST — the transcript order is enrolled_at, not creation.
  for (const courseId of [x.courseId, y.courseId]) {
    const enroll = await page
      .context()
      .request.post(`/api/progress/courses/${courseId}/enroll`);
    expect(enroll.status(), await enroll.text()).toBe(201);
  }

  // Enrolled without a single grade → still the 8f empty state.
  await page.goto("/belajar/nilai");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Belum ada quiz yang dikerjakan",
    }),
  ).toBeVisible();

  // MEMBER B on a SECOND browser context: X's lesson 1 with 10/10 — its
  // grades must never leak into A's card (closed in the finally below).
  const contextB = await browser.newContext();
  try {
    const memberB = await createRoleAccount(contextB.request, "MEMBER");
    await signInViaApi(contextB, memberB);
    const enrollB = await contextB.request.post(
      `/api/progress/courses/${x.courseId}/enroll`,
    );
    expect(enrollB.status(), await enrollB.text()).toBe(201);
    await completeLessonViaApi(
      contextB,
      x.lessons[0]!.id,
      x.lessons[0]!.quizId,
      10,
    );
  } finally {
    await contextB.close();
  }

  // Y's lesson-1 quiz hides its review (drives A's link name below).
  await withE2eDb(
    (sql) => sql`
      update quizzes set explanation_policy = 'NEVER'
      where id = ${y.lessons[0]!.quizId}
    `,
  );

  // A works everything through the API: X 70/50 + Final 80, Y lesson 1 90.
  await completeLessonViaApi(
    page.context(),
    x.lessons[0]!.id,
    x.lessons[0]!.quizId,
    7,
  );
  await completeLessonViaApi(
    page.context(),
    x.lessons[1]!.id,
    x.lessons[1]!.quizId,
    5,
  );
  await completeFinalViaApi(page.context(), x.courseId, x.finalQuizId, 8);
  await completeLessonViaApi(
    page.context(),
    y.lessons[0]!.id,
    y.lessons[0]!.quizId,
    9,
  );

  await page.goto("/belajar/nilai");
  await expect(
    page.getByRole("heading", { level: 1, name: "Nilai Saya" }),
  ).toBeVisible();
  const h2s = page.getByRole("heading", { level: 2 });
  await expect(h2s.nth(0)).toHaveText(titleX);
  await expect(h2s.nth(1)).toHaveText(titleY);

  const xSection = courseSection(page, titleX);
  const ySection = courseSection(page, titleY);
  await expect(xSection.getByText("Lulus", { exact: true })).toBeVisible();
  await expect(xSection.getByText("68", { exact: true })).toBeVisible();
  const xRows = xSection.locator("tbody tr");
  // Exactly TWO lesson rows (B's work adds no third; the Final row is its
  // own "Final Quiz · …" row).
  await expect(
    xSection.locator("tbody th[scope=row]").filter({ hasText: /^\d+ ·/ }),
  ).toHaveCount(2);
  await expect(xRows.nth(0).getByText("70", { exact: true })).toBeVisible();
  await expect(xRows.nth(1).getByText("50", { exact: true })).toBeVisible();
  await expect(xSection.getByText("Final Quiz · 10 soal")).toBeVisible();
  await expect(
    xSection
      .getByRole("row")
      .filter({ hasText: "Final Quiz · 10 soal" })
      .getByText("80", { exact: true }),
  ).toBeVisible();
  await expect(
    xSection.getByText(
      "Rata-rata quiz materi 60 × 60% + Final Quiz 80 × 40% = 68",
    ),
  ).toBeVisible();

  await expect(
    ySection.getByText("Sedang berjalan", { exact: true }),
  ).toBeVisible();
  // "—" also fills the empty cells of the "belum" rows (aria-hidden) — the
  // paragraph ROLE plus exact text pins the big Nilai Akhir number itself,
  // no styling class in the locator (PR 148 review).
  await expect(
    ySection.getByRole("paragraph").filter({ hasText: /^—$/ }),
  ).toHaveText("—");
  await expect(ySection.getByText("90", { exact: true })).toBeVisible();
  // "belum" sits in BOTH the lesson-2 row and the Final row — scope this
  // one to the lesson row (the Final row has its own assertion below).
  await expect(
    ySection
      .getByRole("row")
      .filter({ hasText: "materi 2" })
      .getByText("belum", { exact: true }),
  ).toBeVisible();
  await expect(ySection.getByText("+ 1 materi terkunci")).toBeVisible();
  await expect(
    ySection
      .getByRole("row")
      .filter({ hasText: "Final Quiz · 10 soal" })
      .getByText("belum", { exact: true }),
  ).toBeVisible();
  await expect(
    ySection.getByText(
      "Rata-rata quiz materi sementara 90 · Nilai Akhir belum dihitung",
    ),
  ).toBeVisible();
  for (const section of [xSection, ySection]) {
    await expect(
      section.getByText(
        /^\d+ materi · (selesai|terakhir diakses) \d{1,2} \S{3} \d{4}$/,
      ),
    ).toBeVisible();
  }
  await expect(
    ySection.getByRole("link", {
      name: /^Lihat jawaban Anda, Quiz Materi 1 ·/,
    }),
  ).toBeVisible();

  // The review link round trip: A's own 70 (never B's 100) → the quiz
  // result screen; back; then the Final link → "Lulus kursus".
  await xRows.nth(0).getByRole("link").click();
  await expect(page).toHaveURL(/\/quiz$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Materi 1 · Hasil Quiz" }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { level: 1, name: "Nilai Saya" }),
  ).toBeVisible();
  await xSection
    .getByRole("link", { name: `Lihat pembahasan Final Quiz · ${titleX}` })
    .click();
  await expect(page.getByText("Lulus kursus")).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { level: 1, name: "Nilai Saya" }),
  ).toBeVisible();

  // The width sweep (decision 5) runs BEFORE the SQL edits: the document
  // AND each course box stay clean; at 360 the date column is visually
  // hidden and the icon link is a ≥ 44 × 44 touch target; at 1280 "Lihat"
  // is the visible content. The screenshots land here too — they show the
  // values the arc produced, not the SQL-edited ones.
  for (const width of [360, 700, 768, 1024, 1280] as const) {
    await page.setViewportSize({ width, height: 800 });
    await expect(
      page.getByRole("heading", { level: 1, name: "Nilai Saya" }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page, `nilai-terisi-${width}`);
    await expectCourseBoxFits(page, xSection, `nilai-terisi-${width} X`);
    await expectCourseBoxFits(page, ySection, `nilai-terisi-${width} Y`);
    if (width === 360) {
      const firstRow = courseSection(page, titleX).locator("tbody tr").nth(0);
      // Cells per row: [Nilai, Tanggal, Pembahasan] — the th (Materi) is not
      // a td. The DATE column is the one hidden below 640.
      await expect(firstRow.locator("td").nth(1)).toBeHidden();
      await expectTouchTarget(
        courseSection(page, titleX).locator("tbody a").first(),
        "tautan pembahasan pertama",
      );
    }
    if (width === 1280) {
      await expect(
        page.getByText("Lihat", { exact: true }).first(),
      ).toBeVisible();
    }
    await maybeScreenshot(
      page,
      `nilai-terisi-${width}`,
      test.info().project.name,
    );
  }

  // Stored values edited DIRECTLY in the database, LAST: 91.40 rounds to
  // 91 and 69.99 floors to 69 — the page never recomputes (decision 2).
  await withE2eDb(
    (sql) => sql`
      update enrollments set final_score_percent = 91.40
      where course_id = ${x.courseId}
        and user_id = (select id from users where email = ${memberA.email})
    `,
  );
  await withE2eDb(
    (sql) => sql`
      update lesson_progress set quiz_score_percent = 69.99
      where lesson_id = ${x.lessons[0]!.id}
        and user_id = (select id from users where email = ${memberA.email})
    `,
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "Nilai Saya" }),
  ).toBeVisible();
  await expect(xSection.getByText("91", { exact: true })).toBeVisible();
  await expect(
    courseSection(page, titleX)
      .locator("tbody tr")
      .nth(0)
      .getByText("69", { exact: true }),
  ).toBeVisible();
  await expect(xSection.getByText("= 91", { exact: false })).toBeVisible();
});

test("2. kosong 360/1280 + tamu dialihkan ke /masuk", async ({
  page,
  browser,
}) => {
  const member = await createRoleAccount(page.context().request, "MEMBER");
  await signInViaApi(page.context(), member);
  for (const width of [360, 1280] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/belajar/nilai");
    await expect(
      page.getByRole("heading", { level: 1, name: "Nilai Saya" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Belum ada quiz yang dikerjakan",
      }),
    ).toBeVisible();
    const link = page.getByRole("link", { name: "Lanjutkan kursus saya" });
    await expect(link).toHaveAttribute("href", "/belajar");
    await maybeScreenshot(
      page,
      `nilai-kosong-${width}`,
      test.info().project.name,
    );
  }

  // No session → the (learn) guard bounces to /masuk with the next param.
  const guest = await browser.newContext();
  try {
    const landed = await guest.request.get("/belajar/nilai");
    expect(landed.url()).toContain("/masuk?next=%2Fbelajar%2Fnilai");
  } finally {
    await guest.close();
  }
});
