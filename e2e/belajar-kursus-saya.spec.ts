// The S5-04 Kursus Saya + course progress pages (card §"E2E", max 2 tests
// — the CI budget): (1) the filled list — explicit updated_at stamps as the
// LAST write decide the order (Y, X, Z), the badge/action/meta shapes per
// card, then the progress pages of Y (the running arc: selesai, the video
// clock, quiz-belum, locked Final), X (the finished arc: Belum lulus,
// Sudah dikerjakan, ringkasan 68), and Z (the untouched arc: open first
// lesson, locked second) — then the width sweep 360–1280 for the list and
// Y's progress; (2) the 13c empty state, the not-enrolled redirect to the
// PUBLIC course detail (card S6-02 keputusan 11), the signed-out redirect,
// and the 404.
//
// Root spec → chromium project only. Shared-database rule: token-titled
// courses only, cleaned up through deleteCoursesInE2eDb. The quiz/video
// helpers are local copies of the belajar-nilai.spec.ts pattern.
import type { BrowserContext, Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import {
  attachVideoInE2eDb,
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

/** The course card on Kursus Saya (article scoped to its exact h2). */
function courseCard(page: Page, title: string) {
  return page.locator("article", {
    has: page.getByRole("heading", { level: 2, name: title, exact: true }),
  });
}

/** The box fits: scrollWidth <= clientWidth (the PR 148 kartu rule). */
async function expectBoxFits(
  page: Page,
  box: Locator,
  label: string,
): Promise<void> {
  await waitStableForMeasure(page);
  const metrics = await box.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(
    metrics.scrollWidth,
    `${label}: kotak scrollWidth <= clientWidth`,
  ).toBeLessThanOrEqual(metrics.clientWidth);
}

/**
 * The explicit activity stamp — RAW SQL, always the LAST write before the
 * page is read (the API arcs re-stamp updated_at). The exact per-day gaps
 * keep the expected order unambiguous.
 */
async function stampUpdatedAt(
  courseId: string,
  email: string,
  daysAgo: number,
): Promise<void> {
  await withE2eDb(
    (sql) => sql`
      update enrollments set updated_at = now() - (${daysAgo} * interval '1 day')
      where course_id = ${courseId}
        and user_id = (select id from users where email = ${email})
    `,
  );
}

// ------------------------------------------------------------------ tests

test("1. terisi: urutan updated_at, badge/aksi/meta, progres Y/X/Z, lebar 360–1280", async ({
  page,
}) => {
  const memberA = await createRoleAccount(page.context().request, "MEMBER");
  await signInViaApi(page.context(), memberA);

  const titleX = `${randomToken("ksx")} Gizi Anak`;
  const titleY = `${randomToken("ksy")} Gizi Ibu`;
  const titleZ = `${randomToken("ksz")} Gizi Lansia`;
  const x = await createPublishedCourseViaApi(editorContext, adminContext, titleX, {
    lessons: 2,
  });
  const y = await createPublishedCourseViaApi(editorContext, adminContext, titleY, {
    lessons: 3,
  });
  const z = await createPublishedCourseViaApi(editorContext, adminContext, titleZ, {
    lessons: 2,
  });
  courseIds.push(x.courseId, y.courseId, z.courseId);
  for (const courseId of [x.courseId, y.courseId, z.courseId]) {
    const enroll = await page
      .context()
      .request.post(`/api/progress/courses/${courseId}/enroll`);
    expect(enroll.status(), await enroll.text()).toBe(201);
  }

  // X: the finished arc — 70/50 + Final 80 → PASSED, Nilai Akhir 68.
  await completeLessonViaApi(page.context(), x.lessons[0]!.id, x.lessons[0]!.quizId, 7);
  await completeLessonViaApi(page.context(), x.lessons[1]!.id, x.lessons[1]!.quizId, 5);
  await completeFinalViaApi(page.context(), x.courseId, x.finalQuizId, 8);

  // Y: the running arc — non-sequential, lesson 1 done (90), lesson 2 a
  // READY video paused at 40/100, lesson 3 opened without a video.
  await withE2eDb(
    (sql) => sql`update courses set is_sequential = false where id = ${y.courseId}`,
  );
  await completeLessonViaApi(page.context(), y.lessons[0]!.id, y.lessons[0]!.quizId, 9);
  await attachVideoInE2eDb(y.lessons[1]!.id, "dQw4w9WgXcQ", 100);
  for (const lesson of [y.lessons[1]!, y.lessons[2]!]) {
    // The open beacon answers 204 No Content (the dasbor spec's contract).
    const opened = await page
      .context()
      .request.post(`/api/progress/lessons/${lesson.id}/open`);
    expect(opened.status(), await opened.text()).toBe(204);
  }
  const video = await page.context().request.post("/api/progress/video", {
    data: {
      lessonId: y.lessons[1]!.id,
      positionSeconds: 40,
      durationSeconds: 100,
    },
  });
  expect(video.status(), await video.text()).toBe(200);

  // Z: untouched. The stamps are the LAST write — Y newest, then X, then Z.
  await stampUpdatedAt(y.courseId, memberA.email, 1);
  await stampUpdatedAt(x.courseId, memberA.email, 2);
  await stampUpdatedAt(z.courseId, memberA.email, 3);

  // --- Kursus Saya: order, badges, actions, meta.
  await page.goto("/belajar/kursus-saya");
  await expect(
    page.getByRole("heading", { level: 1, name: "Kursus Saya" }),
  ).toBeVisible();
  const h2s = page.getByRole("heading", { level: 2 });
  await expect(h2s.nth(0)).toHaveText(titleY);
  await expect(h2s.nth(1)).toHaveText(titleX);
  await expect(h2s.nth(2)).toHaveText(titleZ);

  const yCard = courseCard(page, titleY);
  const xCard = courseCard(page, titleX);
  const zCard = courseCard(page, titleZ);
  await expect(yCard.getByText("Sedang berjalan", { exact: true }))
    .toBeVisible();
  await expect(xCard.getByText("Lulus", { exact: true })).toBeVisible();
  await expect(zCard.getByText("Belum dimulai", { exact: true }))
    .toBeVisible();
  await expect(
    yCard.getByRole("link", { name: "Lanjutkan", exact: true }),
  ).toBeVisible();
  await expect(
    zCard.getByRole("link", { name: "Mulai materi 1", exact: true }),
  ).toBeVisible();
  await expect(
    xCard.getByText(/materi · selesai .+ · Nilai Akhir 68$/),
  ).toBeVisible();

  await yCard
    .getByRole("link", { name: "Lihat progress", exact: true })
    .click();
  await expect(page).toHaveURL(`/belajar/${y.courseSlug}`);

  // --- Progres Y: the running arc.
  await expect(
    page.getByRole("heading", { level: 1, name: titleY }),
  ).toBeVisible();
  const yRows = page.getByRole("listitem");
  await expect(yRows).toHaveCount(3);
  await expect(
    yRows.nth(0).getByText("Selesai · Nilai 90", { exact: true }),
  ).toBeVisible();
  await expect(
    yRows.nth(1).getByText("Sedang dipelajari · 00:40 / 01:40", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    yRows.nth(1).getByRole("link", { name: "Lanjutkan", exact: true }),
  ).toBeVisible();
  await expect(
    yRows.nth(2).getByText("Quiz belum dikerjakan", { exact: true }),
  ).toBeVisible();
  // Decision 5: to the LESSON page, never straight to the quiz.
  await expect(
    yRows.nth(2).getByRole("link", { name: "Kerjakan quiz", exact: true }),
  ).toHaveAttribute("href", `/belajar/${y.courseSlug}/${y.lessons[2]!.slug}`);
  await expect(
    page.getByText("Terbuka setelah 3 materi selesai · 20 menit · bobot 40%"),
  ).toBeVisible();
  await expect(
    page.getByText("Nilai Akhir = 90 × 60% + Final Quiz × 40%."),
  ).toBeVisible();

  // --- Progres X: the finished arc.
  await page.goto(`/belajar/${x.courseSlug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: titleX }),
  ).toBeVisible();
  const xRows = page.getByRole("listitem");
  await expect(
    xRows.nth(1).getByText(/Selesai · Nilai 50 · Belum lulus/),
  ).toBeVisible();
  await expect(page.getByText("Sudah dikerjakan", { exact: true }))
    .toBeVisible();
  await expect(page.getByText("Nilai Akhir 68 · Lulus")).toBeVisible();
  await page
    .getByRole("link", { name: "Lihat hasil", exact: true })
    .click();
  await expect(page).toHaveURL(`/belajar/${x.courseSlug}/final-quiz`);
  await expect(page.getByText("Lulus kursus")).toBeVisible();
  await page.goBack();

  // --- Progres Z: the untouched arc — first lesson open, second locked.
  await page.goto(`/belajar/${z.courseSlug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: titleZ }),
  ).toBeVisible();
  const zRows = page.getByRole("listitem");
  await expect(zRows.nth(0).getByText("Belum mulai", { exact: true }))
    .toBeVisible();
  await expect(zRows.nth(0).getByRole("link").first()).toBeVisible();
  await expect(zRows.nth(1).getByText("Terkunci", { exact: true }))
    .toBeVisible();
  await expect(zRows.nth(1).getByRole("link")).toHaveCount(0);

  // --- The width sweep + screenshots: the list first, then Y's progress.
  for (const width of [360, 768, 1024, 1280] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/belajar/kursus-saya");
    await expect(
      page.getByRole("heading", { level: 1, name: "Kursus Saya" }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page, `kursus-saya-terisi-${width}`);
    for (const [card, label] of [
      [yCard, "Y"],
      [xCard, "X"],
      [zCard, "Z"],
    ] as const) {
      await expectBoxFits(page, card, `kursus-saya-terisi-${width} ${label}`);
    }
    if (width === 360) {
      await expectTouchTarget(
        yCard.getByRole("link", { name: "Lanjutkan", exact: true }),
        "aksi pertama kartu Y",
      );
    }
    await maybeScreenshot(
      page,
      `kursus-saya-terisi-${width}`,
      test.info().project.name,
    );

    await page.goto(`/belajar/${y.courseSlug}`);
    await expect(
      page.getByRole("heading", { level: 1, name: titleY }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page, `progres-berjalan-${width}`);
    const rowCount = await page.getByRole("listitem").count();
    for (let index = 0; index < rowCount; index += 1) {
      await expectBoxFits(
        page,
        page.getByRole("listitem").nth(index),
        `progres-berjalan-${width} baris ${index + 1}`,
      );
    }
    if (width === 360) {
      // PR 150 review item 6: the TEXT links also carry a ≥ 44 px band.
      await expectTouchTarget(
        page
          .getByRole("listitem")
          .nth(0)
          .getByRole("link", { name: "Buka materi", exact: true }),
        "progres Y baris 1 Buka materi",
      );
      await expectTouchTarget(
        page
          .getByRole("listitem")
          .nth(2)
          .getByRole("link", { name: "Kerjakan quiz", exact: true }),
        "progres Y baris 3 Kerjakan quiz",
      );
    }
    await maybeScreenshot(
      page,
      `progres-berjalan-${width}`,
      test.info().project.name,
    );
  }
});

test("2. kosong 360/1280, kembali ke detail kursus, tamu, 404", async ({
  page,
  browser,
}) => {
  const member = await createRoleAccount(page.context().request, "MEMBER");
  await signInViaApi(page.context(), member);

  for (const width of [360, 1280] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/belajar/kursus-saya");
    await expect(
      page.getByRole("heading", { level: 1, name: "Kursus Saya" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Anda belum mengikuti kursus apa pun",
      }),
    ).toBeVisible();
    // At least one "Lihat →" link WHEN the shared DB has published courses
    // — never an exact count (lesson 9 Nov no. 9). Card S6-02 keputusan 11:
    // the rows link to the public detail, no start buttons here anymore.
    const lihat = page.getByRole("link", { name: "Lihat →" });
    expect(await lihat.count()).toBeGreaterThan(0);
    await maybeScreenshot(
      page,
      `kursus-saya-kosong-${width}`,
      test.info().project.name,
    );
  }

  // Not enrolled → /belajar/{slug} bounces to the PUBLIC course detail
  // (card S6-02 keputusan 11): URL /kursus/{slug}, h1 = the course title.
  const titleSmall = `${randomToken("kss")} Kursus Kecil`;
  const small = await createPublishedCourseViaApi(
    editorContext,
    adminContext,
    titleSmall,
    { lessons: 1 },
  );
  courseIds.push(small.courseId);
  await page.goto(`/belajar/${small.courseSlug}`);
  await expect(page).toHaveURL(`/kursus/${small.courseSlug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: titleSmall }),
  ).toBeVisible();

  // No session → the (learn) guard bounces to /masuk with the next param.
  const guest = await browser.newContext();
  try {
    const landed = await guest.request.get("/belajar/kursus-saya");
    expect(landed.url()).toContain(
      "/masuk?next=%2Fbelajar%2Fkursus-saya",
    );
  } finally {
    await guest.close();
  }

  // Unknown slug → the anti-IDOR 404.
  const missing = await page.goto(`/belajar/${randomToken("tak-ada")}`);
  expect(missing?.status()).toBe(404);
});
