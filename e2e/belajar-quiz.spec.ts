// The S3-01 lesson quiz (card §7 "E2E"): the dialog → rules → start flow,
// the no-key-leak rule on the wire, auto-save + QZ-08 persistence, the
// summary gate, the result + review, the lesson page's selesai state, the
// video-gated button that comes alive WITHOUT a reload (keputusan 9), the
// EXPIRED finalization, the API matrix (404/409 walls, idempotent submit,
// anti-IDOR), the 28c save-failure stages under page.clock, and the width
// sweep with touch targets.
//
// Root spec → chromium project only; widths via page.setViewportSize (same
// as belajar-materi.spec.ts). Shared-database rule: only token-titled
// courses, cleaned up through deleteCoursesInE2eDb. The publish helper
// gives every lesson quiz 10 PG questions whose key text starts "Opsi
// satu" and whose wrong options start "Opsi dua" — the whole answer
// distribution keys off those two prefixes.
import type { BrowserContext, Page } from "@playwright/test";
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
  stubYouTube,
  waitForOpenBeacon,
  waitForYouTubeStub,
  waitStableForMeasure,
} from "./layout/helpers";
import {
  createRoleAccount,
  newCollectedContext,
  signInViaApi,
  test,
  withE2eDb,
  type TestAccount,
} from "./fixtures";

const DURATION = 100; // the stub video's length (seconds)

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

/** A fresh signed-in MEMBER on the page's own (CSP-collected) context. */
async function memberOnPage(page: Page): Promise<TestAccount> {
  const member = await createRoleAccount(page.context().request, "MEMBER");
  await signInViaApi(page.context(), member);
  return member;
}

/** Published 2-lesson course + a signed-in, enrolled MEMBER on the page. */
async function quizCourseOnPage(page: Page, prefix: string) {
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

/** Lesson 1 → dialog → rules → "Saya paham" → question 1 on screen. */
async function startQuizViaUi(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Tandai selesai & mulai quiz" }).click();
  await page.getByRole("link", { name: "Lanjut ke aturan quiz" }).click();
  await expect(
    page.getByRole("heading", { name: "Aturan quiz sebelum timer jalan" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Saya paham, mulai quiz" }).click();
  await expect(page.getByText("Soal 1 dari 10 · Satu kesempatan")).toBeVisible();
}

/** Picks an option, awaits its PUT 200 (listener BEFORE the click), moves
 *  on with Berikutnya. The publish helper's key/wrong text prefixes pick
 *  correct vs wrong answers. The click targets the option CARD (the radio
 *  input itself is sr-only — its 1px box sits under the letter badge, so
 *  Playwright's actionability check refuses the direct hit). The eyebrow
 *  wait after Berikutnya paces the loop: clicking the NEXT radio while the
 *  previous advance is still committing races the option-list re-render
 *  (a layout-shift click landed a stray same-URL navigation once — answers
 *  survived, but the runner remounted). */
async function answerAndNext(
  page: Page,
  pattern: RegExp,
  nextNumber: number,
): Promise<void> {
  const put = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.url().includes("/api/quiz/attempts/"),
  );
  await page.getByRole("radio", { name: pattern }).locator("..").click();
  expect((await put).status(), await (await put).text()).toBe(200);
  await page.getByRole("button", { name: "Berikutnya" }).click();
  await expect(
    page.getByText(new RegExp(`Soal ${nextNumber} dari \\d+`)),
  ).toBeVisible();
}

/** The 7-correct / 2-wrong / 1-empty distribution over questions 1–10. */
async function answerDistributionViaUi(page: Page): Promise<void> {
  for (let n = 1; n <= 9; n += 1) {
    await answerAndNext(page, n <= 7 ? /Opsi satu/ : /Opsi dua/, n + 1);
  }
}

/** Starts the attempt through the API and returns its id (the UI flow is
 *  covered by tests 1–4; later tests only need the state). */
async function attemptViaApi(
  page: Page,
  lessonId: string,
): Promise<string> {
  const response = await page
    .context()
    .request.post(`/api/quiz/lessons/${lessonId}/attempt`, { data: {} });
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { data: { attemptId: string } }).data
    .attemptId;
}

type DbOption = {
  question_id: string;
  option_id: string;
  is_correct: boolean;
};

/** This quiz's (question, option) pairs from the E2E database. */
async function optionsFromDb(quizId: string): Promise<DbOption[]> {
  return withE2eDb((sql) => sql`
      select q.id as question_id, qo.id as option_id, qo.is_correct as is_correct
      from questions q
      join question_options qo on qo.question_id = q.id
      where q.quiz_id = ${quizId}
      order by q.order_index asc, qo.order_index asc
    `);
}

/** Answers `correct + wrong` questions through the API (7/2 → 70). */
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
    expect(option, `question ${index + 1} has an ${wanted} option`).toBeTruthy();
    const response = await page
      .context()
      .request.put(
        `/api/quiz/attempts/${attemptId}/answers/${questionId}`,
        { data: { optionId: option!.option_id } },
      );
    expect(response.status(), await response.text()).toBe(200);
  }
}

// ------------------------------------------------------------------ tests

test("1. tanpa video: dialog → Nanti saja (tanpa attempt) → aturan → mulai → soal 1 + timer", async ({
  page,
}) => {
  const made = await quizCourseOnPage(page, "bq1");

  const beacon = waitForOpenBeacon(page, made.lessons[0]!.id);
  await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
  expect((await beacon).status()).toBe(204);

  // The dialog (QZ-18) from the lesson page's bottom bar.
  await page.getByRole("button", { name: "Tandai selesai & mulai quiz" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading")).toContainText("Quiz: ");
  await expect(dialog.getByText("10 soal")).toBeVisible();
  await expect(dialog.getByText("Waktu 10 menit")).toBeVisible();
  await expect(
    dialog.getByText("Hanya dapat dikerjakan SATU KALI"),
  ).toBeVisible();
  await expect(dialog.getByText("Pastikan koneksi stabil dan Anda siap.")).toBeVisible();
  await maybeScreenshot(page, "quiz-dialog-1280", test.info().project.name);

  // "Nanti saja" leaves no attempt behind.
  await dialog.getByRole("button", { name: "Nanti saja" }).click();
  await expect(dialog).toHaveCount(0);
  const none = await withE2eDb(
    (sql) => sql`
        select count(*)::int as n from quiz_attempts qa
        join users u on u.id = qa.user_id
        where u.email = ${made.member.email}
      `,
  );
  expect(none[0]?.n).toBe(0);

  // The same dialog at 360, then through to the rules page.
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("button", { name: "Tandai selesai & mulai quiz" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await maybeScreenshot(page, "quiz-dialog-360", test.info().project.name);
  await page.getByRole("link", { name: "Lanjut ke aturan quiz" }).click();
  await expect(
    page.getByRole("heading", { name: "Aturan quiz sebelum timer jalan" }),
  ).toBeVisible();
  await expect(
    page.getByText("10 soal pilihan ganda · waktu 10 menit"),
  ).toBeVisible();
  await maybeScreenshot(page, "quiz-aturan-360", test.info().project.name);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Aturan quiz sebelum timer jalan" }),
  ).toBeVisible();
  await maybeScreenshot(page, "quiz-aturan-1280", test.info().project.name);

  // Start: one attempt, IN_PROGRESS, and the server timer runs.
  await page.getByRole("button", { name: "Saya paham, mulai quiz" }).click();
  await expect(page.getByText("Soal 1 dari 10 · Satu kesempatan")).toBeVisible();
  const timer = page.getByRole("timer");
  await expect(timer).toHaveAttribute("aria-label", "Sisa waktu");
  await expect(timer).toHaveText(/^\d{2}:\d{2}$/);
  await page.waitForTimeout(1500);
  await expect(timer).not.toHaveText("10:00");

  const rows = await withE2eDb(
    (sql) => sql`
        select qa.status::text as status from quiz_attempts qa
        join users u on u.id = qa.user_id
        where u.email = ${made.member.email}
      `,
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]?.status).toBe("IN_PROGRESS");
});

test("2. kunci tidak bocor: HTML keadaan berjalan tanpa 'Pembahasan PG'/isCorrect", async ({
  page,
}) => {
  const made = await quizCourseOnPage(page, "bq2");
  await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
  await startQuizViaUi(page);

  // The served HTML of the RUNNING page (member cookies, no JavaScript).
  const response = await page
    .context()
    .request.get(quizUrlOf(made.courseSlug, made.lessons[0]!.slug));
  expect(response.status()).toBe(200);
  const html = await response.text();
  // …and it really is the running state, not an error page.
  expect(html).toContain("Soal 1 dari 10");
  expect(html).toContain("materi 1 soal 1");
  expect(html).not.toContain("Pembahasan PG");
  expect(html).not.toContain("isCorrect");
  expect(html).not.toContain("is_correct");
});

test("3. auto-save per jawaban (PUT 200) + muat ulang: jawaban dan soal tetap (QZ-08)", async ({
  page,
}) => {
  const made = await quizCourseOnPage(page, "bq3");
  await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
  await startQuizViaUi(page);

  // 7 correct + 2 wrong; every pick awaits its own PUT 200 first.
  await answerDistributionViaUi(page);
  await expect(page.getByText("Soal 10 dari 10 · Satu kesempatan")).toBeVisible();
  await expect(page.getByText("tersimpan otomatis")).toBeVisible();

  // Reload mid-attempt: the persisted answers come back (QZ-08). The
  // current POSITION is client-only, so the remounted runner starts back
  // at soal 1 — the answers are what must survive.
  await page.reload();
  await expect(page.getByText("Soal 1 dari 10 · Satu kesempatan")).toBeVisible();
  await page.getByRole("button", { name: "Soal 1, sudah dijawab" }).click();
  await expect(page.getByRole("radio", { name: /Opsi satu/ })).toBeChecked();
  await page.getByRole("button", { name: "Soal 8, sudah dijawab" }).click();
  await expect(page.getByRole("radio", { name: /Opsi dua/ })).toBeChecked();
});

test("4. ringkasan 9/1 → kumpulkan → hasil 70 Lulus, 10 pembahasan, Kunci di soal salah, materi 2 terbuka", async ({
  page,
}) => {
  const made = await quizCourseOnPage(page, "bq4");
  await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
  await startQuizViaUi(page);
  await answerDistributionViaUi(page);

  await page.getByRole("button", { name: "Lihat ringkasan" }).click();
  await expect(
    page.getByRole("heading", { name: "Ringkasan sebelum dikumpulkan" }),
  ).toBeVisible();
  await expect(page.getByText("9 dijawab · 1 belum dijawab · 0 ragu-ragu")).toBeVisible();
  await expect(page.getByText("1 soal belum dijawab dan akan dinilai salah.")).toBeVisible();

  const submitted = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().endsWith("/submit"),
  );
  await page.getByRole("button", { name: "Kumpulkan sekarang" }).click();
  expect((await submitted).status()).toBe(200);

  // The result: 7/10 → 70 → Lulus (passing 70), full review.
  await expect(page.getByText("Lulus")).toBeVisible();
  await expect(page.getByText("70", { exact: true })).toBeVisible();
  await expect(page.getByText("7/10")).toBeVisible();
  expect(await page.getByRole("article").count()).toBe(10);
  expect(await page.getByText(/Pembahasan PG/).count()).toBe(10);
  // Two wrong + one unanswered carry the key; correct ones never do.
  expect(await page.getByText("Kunci:").count()).toBe(3);
  await maybeScreenshot(page, "quiz-hasil-1280", test.info().project.name);

  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await expect(page.getByText("Terkunci permanen")).toBeVisible();
  await maybeScreenshot(page, "quiz-hasil-360", test.info().project.name);

  await page.getByRole("link", { name: "Lanjut ke Materi 2" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: `Materi 2 · ${made.title} materi 2` }),
  ).toBeVisible();
});

test("5. halaman materi setelah quiz: tautan hasil, skor 70 di Daftar materi, tombol mulai hilang", async ({
  page,
}) => {
  const made = await quizCourseOnPage(page, "bq5");
  const lesson1 = made.lessons[0]!;
  const attemptId = await attemptViaApi(page, lesson1.id);
  await answerViaApi(page, attemptId, made.lessonQuizId, 7, 2);
  const submitted = await page
    .context()
    .request.post(`/api/quiz/attempts/${attemptId}/submit`, { data: {} });
  expect(submitted.status(), await submitted.text()).toBe(200);

  await page.goto(lessonUrl(made.courseSlug, lesson1.slug));
  await expect(
    page.getByRole("link", { name: "Lihat Hasil & Pembahasan" }),
  ).toHaveAttribute("href", quizUrlOf(made.courseSlug, lesson1.slug));
  await expect(
    page.getByRole("button", { name: "Tandai selesai & mulai quiz" }),
  ).toHaveCount(0);
  // The outline is rendered twice (side card + <details>); the visible
  // copy is the one carrying the score at THIS width.
  await expect(
    page.getByText("70", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await maybeScreenshot(page, "materi-setelah-quiz-1280", test.info().project.name);

  await page.setViewportSize({ width: 360, height: 800 });
  const details = page.locator("details");
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open");
  await expect(
    page.getByText("70", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page, "materi-setelah-quiz-360");
  await maybeScreenshot(page, "materi-setelah-quiz-360", test.info().project.name);
});

test("6. gerbang video: softDisabled + kalimat 90 % → stub 91 % → tombol aktif TANPA muat ulang, iframe sama", async ({
  page,
}) => {
  await stubYouTube(page);
  const made = await quizCourseOnPage(page, "bq6");
  await attachVideoInE2eDb(made.lessons[0]!.id, "e2eVideo001", DURATION);

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
  const start = page.getByRole("button", { name: "Tandai selesai & mulai quiz" });
  await expect(start).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByText("Tonton video sampai minimal 90 % untuk membuka quiz."),
  ).toBeVisible();
  await maybeScreenshot(page, "materi-quiz-terkunci-video-360", test.info().project.name);

  // The same iframe must survive the refresh: a property planted on the
  // DOM node itself can only survive if React kept that exact node.
  await waitForYouTubeStub(page);
  const frame = page.locator('iframe[title^="Video: "]');
  await expect(frame).toBeVisible();
  await frame.evaluate((node) => {
    (node as HTMLElement & { __binziSameFrame?: string }).__binziSameFrame = "ya";
  });
  await page.evaluate(() => {
    const stub = (window as unknown as {
      __ytStub: { setDuration(n: number): void; setTime(n: number): void };
    }).__ytStub;
    stub.setDuration(100);
    stub.setTime(91);
  });
  const posted = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/progress/video",
  );
  await page.evaluate(() => {
    (window as unknown as { __ytStub: { emit(code: number): void } }).__ytStub.emit(2);
  });
  const response = await posted;
  expect(response.status()).toBe(200);
  expect(JSON.parse(response.request().postData()!)).toEqual({
    lessonId: made.lessons[0]!.id,
    positionSeconds: 91,
    durationSeconds: DURATION,
  });

  // 91 ≥ 90 → ONE router.refresh() → the button is alive, no reload.
  await expect(start).not.toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByText("Tonton video sampai minimal 90 % untuk membuka quiz."),
  ).toHaveCount(0);
  await expect(frame).toBeVisible();
  expect(
    await frame.evaluate(
      (node) =>
        (node as HTMLElement & { __binziSameFrame?: string }).__binziSameFrame ??
        null,
    ),
  ).toBe("ya");
});

test("7. waktu habis: expires_at dimundurkan → /quiz → hasil EXPIRED dengan jawaban tersimpan", async ({
  page,
}) => {
  const made = await quizCourseOnPage(page, "bq7");
  const lesson1 = made.lessons[0]!;
  const attemptId = await attemptViaApi(page, lesson1.id);
  await answerViaApi(page, attemptId, made.lessonQuizId, 3, 0);

  await withE2eDb(
    (sql) => sql`
        update quiz_attempts set expires_at = now() - interval '1 minute'
        where id = ${attemptId}
      `,
  );

  // The kedaluwarsa beacon submits on mount; the refresh lands on hasil.
  const submitted = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().endsWith("/submit"),
  );
  await page.goto(quizUrlOf(made.courseSlug, lesson1.slug));
  expect((await submitted).status()).toBe(200);
  await expect(
    page.getByText(
      "Waktu habis — jawaban yang sudah tersimpan dikumpulkan otomatis.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Belum lulus")).toBeVisible();
  await expect(page.getByText("30", { exact: true })).toBeVisible();

  const rows = await withE2eDb(
    (sql) => sql`
        select status::text as status from quiz_attempts where id = ${attemptId}
      `,
  );
  expect(rows[0]?.status).toBe("EXPIRED");
});

test("8. matriks API: 404/409 walls, anti-IDOR, kumpulkan idempoten, PUT setelah selesai 409", async ({
  page,
  browser,
}) => {
  const made = await quizCourseOnPage(page, "bq8");
  const lesson1 = made.lessons[0]!;
  const lesson2 = made.lessons[1]!;

  const { context: outsiderContext } = await newCollectedContext(browser);
  try {
    const outsider = await createRoleAccount(outsiderContext.request, "MEMBER");
    await signInViaApi(outsiderContext, outsider);

    // Not enrolled → 404 (ids cannot be probed).
    const beforeEnroll = await outsiderContext.request.post(
      `/api/quiz/lessons/${lesson1.id}/attempt`,
      { data: {} },
    );
    expect(beforeEnroll.status()).toBe(404);

    // Locked successor → 409.
    const locked = await page
      .context()
      .request.post(`/api/quiz/lessons/${lesson2.id}/attempt`, { data: {} });
    expect(locked.status()).toBe(409);

    // The member's attempt; the outsider writes into it → 404 (anti-IDOR).
    const attemptId = await attemptViaApi(page, lesson1.id);
    const options = await optionsFromDb(made.lessonQuizId);
    const questionId = options[0]!.question_id;
    const foreign = await outsiderContext.request.put(
      `/api/quiz/attempts/${attemptId}/answers/${questionId}`,
      { data: { optionId: options[0]!.option_id } },
    );
    expect(foreign.status()).toBe(404);

    // Submit is idempotent: 200 twice, the score never moves.
    await answerViaApi(page, attemptId, made.lessonQuizId, 7, 2);
    const scoreOf = () =>
      withE2eDb(
        (sql) => sql`
            select (score::float8 / max_score::float8 * 100)::int as score
            from quiz_attempts where id = ${attemptId}
          `,
      );
    const first = await page
      .context()
      .request.post(`/api/quiz/attempts/${attemptId}/submit`, { data: {} });
    expect(first.status(), await first.text()).toBe(200);
    expect((await scoreOf())[0]?.score).toBe(70);
    const second = await page
      .context()
      .request.post(`/api/quiz/attempts/${attemptId}/submit`, { data: {} });
    expect(second.status(), await second.text()).toBe(200);
    expect((await scoreOf())[0]?.score).toBe(70);

    // Saving after the finalization → 409.
    const afterSubmit = await page
      .context()
      .request.put(
        `/api/quiz/attempts/${attemptId}/answers/${options[1]!.question_id}`,
        { data: { optionId: options[1]!.option_id } },
      );
    expect(afterSubmit.status()).toBe(409);
  } finally {
    await outsiderContext.close();
  }
});

test("9. gagal simpan (page.clock): indikator → banner 28c → Kumpulkan terkunci → pulih → aktif", async ({
  page,
}) => {
  await page.clock.install(); // before any page script: the app runs on it
  const made = await quizCourseOnPage(page, "bq9");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
  await startQuizViaUi(page);

  // Every answer PUT dies on the network. (Aborted requests fire no
  // response event, so the queue's move to "pending" is awaited via the
  // indicator itself.)
  const putGlob = "**/api/quiz/attempts/*/answers/*";
  await page.route(putGlob, (route) => route.abort());
  await page
    .getByRole("radio", { name: /Opsi satu/ })
    .locator("..")
    .click();

  // Stage 1 (< 10 s): the indicator only.
  await expect(page.getByText("belum terkirim")).toBeVisible();
  await expect(
    page.getByText(/jawaban belum tersimpan di server/),
  ).toHaveCount(0);

  // Stage 2 (> 10 s): the banner, and collect is gated by the pending save.
  await page.clock.fastForward(11_000);
  await expect(
    page.getByText("1 jawaban belum tersimpan di server"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Soal 10, belum dijawab" }).click();
  await page.getByRole("button", { name: "Lihat ringkasan" }).click();
  const collect = page.getByRole("button", { name: "Kumpulkan sekarang" });
  await expect(collect).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Tunggu, jawaban sedang disimpan…")).toBeVisible();
  await maybeScreenshot(page, "quiz-galat-simpan-360", test.info().project.name);

  // Stage 3: the connection heals → "Coba kirim sekarang" → recovered.
  await page.unroute(putGlob);
  await page.getByRole("button", { name: "Coba kirim sekarang" }).click();
  await expect(
    page.getByText("Tersambung. Jawaban soal 1 sudah tersimpan."),
  ).toBeVisible();
  await expect(collect).not.toHaveAttribute("aria-disabled", "true");
});

test("10. lebar 360/768/1024/1280 tanpa gulir samping; target sentuh chip & opsi ≥ 44 di 360", async ({
  page,
}) => {
  // The heaviest test of the spec (a full 2-lesson course with 3 quizzes,
  // 4 resizes, 5 screenshots) passes standalone in ~2 s but runs slower
  // under the full-suite load; 3× is the honest budget for work that is
  // real, not a hang to hide. (The two mid-sweep timeouts this test once
  // showed were NOT load, though — the chip it died waiting for never
  // existed: the per-attempt shuffle bug fixed below.)
  test.slow();
  const made = await quizCourseOnPage(page, "bq10");
  const lesson1 = made.lessons[0]!;
  const attemptId = await attemptViaApi(page, lesson1.id);

  // Answer the question this attempt shows at POSITION 1, not
  // options[0] (DB order): the runner shuffles the display order per
  // attempt, so a DB-order answer lands on a random chip number — when
  // it landed on 2 or 10 the "belum dijawab" locators below waited for
  // a chip that never exists (~1 run in 5; same shape as 6f083a8).
  // question_order[1] (PG arrays are 1-indexed) is exactly the chip
  // the runner labels "Soal 1, sudah dijawab", so positions 2 and 10
  // stay "belum dijawab" under every shuffle.
  const first = await withE2eDb(
    (sql) => sql`
        select question_order[1] as question_id
        from quiz_attempts where id = ${attemptId}
      `,
  );
  const option = (await optionsFromDb(made.lessonQuizId)).find(
    (row) => row.question_id === first[0]?.question_id,
  );
  expect(option, "the position-1 question has an option").toBeTruthy();
  const saved = await page
    .context()
    .request.put(
      `/api/quiz/attempts/${attemptId}/answers/${first[0]!.question_id}`,
      { data: { optionId: option!.option_id } },
    );
  expect(saved.status(), await saved.text()).toBe(200);

  // ONE load, then resize per width — the responsive sweep reflows the
  // same DOM (reloading at every width would blow the 60 s test budget).
  // The ringkasan pass comes AFTER the loop: entering it mid-loop would
  // change the eyebrow the next width asserts against.
  await page.goto(quizUrlOf(made.courseSlug, lesson1.slug));
  for (const width of [360, 768, 1024, 1280] as const) {
    await page.setViewportSize({ width, height: 800 });
    await expect(page.getByText("Soal 1 dari 10 · Satu kesempatan")).toBeVisible();
    await expectNoHorizontalScroll(page, `quiz-soal-${width}`);
    await maybeScreenshot(page, `quiz-soal-${width}`, test.info().project.name);
  }

  // Touch targets at 360: a navigator chip and an option card.
  await page.setViewportSize({ width: 360, height: 800 });
  await expectTouchTarget(
    page.getByRole("button", { name: "Soal 2, belum dijawab" }),
    "chip soal 2 @360",
  );
  await expectTouchTarget(
    page.getByRole("radio", { name: /Opsi satu/ }).locator(".."),
    "kartu opsi @360",
  );

  // Owner review of PR #138: the document-level sweep above stayed green
  // while the nav row's "Sebelumnya" + "Berikutnya" pair overflowed the
  // runner CARD by ~17 px (flex-wrap kept the page width clean; the pair
  // pressed against the card's right border). So the check targets the
  // card itself: its scrollWidth must fit its clientWidth, and the right
  // edge of "Berikutnya" must sit inside the card's CONTENT box (the
  // p-4 right padding excluded).
  const runnerCard = page
    .getByRole("button", { name: "Berikutnya" })
    .locator("xpath=ancestor::div[contains(@class, 'rounded-card')][1]");
  await waitStableForMeasure(page);
  const cardMetrics = await runnerCard.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      contentRight: box.right - parseFloat(getComputedStyle(el).paddingRight),
    };
  });
  expect(
    cardMetrics.scrollWidth,
    "kartu runner @360: scrollWidth <= clientWidth",
  ).toBeLessThanOrEqual(cardMetrics.clientWidth);
  const nextBox = await page
    .getByRole("button", { name: "Berikutnya" })
    .boundingBox();
  expect(nextBox, "tombol Berikutnya @360: rendered").toBeTruthy();
  expect(
    nextBox!.x + nextBox!.width,
    "tombol Berikutnya @360: right <= kanan isi kartu",
  ).toBeLessThanOrEqual(cardMetrics.contentRight);

  // The summary joins the sweep at 360 (9 unanswered → the warning line).
  await page.getByRole("button", { name: "Soal 10, belum dijawab" }).click();
  await page.getByRole("button", { name: "Lihat ringkasan" }).click();
  await expect(page.getByText("1 dijawab · 9 belum dijawab · 0 ragu-ragu")).toBeVisible();
  await expectNoHorizontalScroll(page, "quiz-ringkasan-360");
  await maybeScreenshot(page, "quiz-ringkasan-360", test.info().project.name);
});
