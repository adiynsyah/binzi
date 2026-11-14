// The S2-01 lesson page (card §8): the open state with its /open beacon,
// the GET-never-writes rule, the sequential gate end to end, the
// not-enrolled one-click start on the SAME URL, the 404 walls, the /open +
// /video API matrix, and no horizontal scroll at every width for the open
// and locked states (with the <details> outline open below 1024).
//
// SHARED DATABASE rule (lesson 9 Nov no. 9): other specs also publish
// courses, so these tests never assert counts or emptiness of anything
// global — only THEIR token-titled course, addressed through accessible
// names. Cleanup runs through the shared deleteCoursesInE2eDb helper
// (this file runs before cms-kursus.spec.ts alphabetically).
//
// Staff accounts are made ONCE per file (beforeAll); courses stay per
// test so titles stay token-unique. Root spec → chromium project only;
// other widths via page.setViewportSize.
import type { BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import {
  createCourseViaApi,
  createEditorAdminContexts,
  createLessonViaApi,
  createPublishedCourseViaApi,
  deleteCoursesInE2eDb,
  expectNoHorizontalScroll,
  maybeScreenshot,
  noSpaceTitle,
  randomToken,
  waitForMemberHeader,
} from "./layout/helpers";
import {
  createRoleAccount,
  newCollectedContext,
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
  // Shared-database courtesy (see belajar-dasbor.spec.ts): the helper
  // deletes children-first, lesson quizzes included.
  await deleteCoursesInE2eDb(courseIds);
});

// ---------------------------------------------------------------- helpers

function lessonUrl(courseSlug: string, lessonSlug: string): string {
  return `/belajar/${courseSlug}/${lessonSlug}`;
}

/** The token content the publish helper wrote into lesson n's document. */
function contentText(title: string, n: number): string {
  return `Isi materi netral ${title} materi ${n} untuk tes e2e.`;
}

/** A fresh signed-in MEMBER on the page's own (CSP-collected) context. */
async function memberOnPage(page: Page): Promise<TestAccount> {
  const member = await createRoleAccount(page.context().request, "MEMBER");
  await signInViaApi(page.context(), member);
  return member;
}

async function enrollViaApi(page: Page, courseId: string): Promise<void> {
  const response = await page.context().request.post(
    `/api/progress/courses/${courseId}/enroll`,
  );
  expect(response.status(), await response.text()).toBe(201);
}

/**
 * Listener for the /open beacon — ALWAYS attached BEFORE the navigation
 * (or click) that mounts the open state, so a fast POST can never slip
 * past the wait.
 */
function waitForOpenBeacon(page: Page, lessonId: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        `/api/progress/lessons/${lessonId}/open`,
  );
}

// ------------------------------------------------------------------ tests

test(
  "1. MEMBER terdaftar membuka materi 1 → h1, isi bertoken, POST /open 204, baris IN_PROGRESS",
  async ({ page }) => {
    const token = randomToken("bm1");
    const title = `${token} Dasar Gizi`;
    const member = await memberOnPage(page);
    const made = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      title,
    );
    courseIds.push(made.courseId);
    await enrollViaApi(page, made.courseId);

    const beacon = waitForOpenBeacon(page, made.lessons[0]!.id);
    await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      `Materi 1 · ${title} materi 1`,
    );
    await expect(page.getByText(contentText(title, 1))).toBeVisible();

    expect((await beacon).status()).toBe(204);

    const rows = await withE2eDb(
      (sql) => sql`
        select lp.status as status, lp.first_accessed_at as first_accessed_at,
          e.last_lesson_id as last_lesson_id
        from lesson_progress lp
        join enrollments e on e.id = lp.enrollment_id
        join users u on u.id = lp.user_id
        where u.email = ${member.email} and lp.lesson_id = ${made.lessons[0]!.id}
      `,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("IN_PROGRESS");
    expect(rows[0]?.first_accessed_at).not.toBeNull();
    expect(rows[0]?.last_lesson_id).toBe(made.lessons[0]!.id);
  },
);

test(
  "2. dasbor setelah membuka materi: badge 'Sedang berjalan' + tautan 'Lanjutkan' ke materi 1",
  async ({ page }) => {
    const token = randomToken("bm2");
    const title = `${token} Memasak Sehat`;
    await memberOnPage(page);
    const made = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      title,
    );
    courseIds.push(made.courseId);
    await enrollViaApi(page, made.courseId);

    const beacon = waitForOpenBeacon(page, made.lessons[0]!.id);
    await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
    await expect(page.getByText(contentText(title, 1))).toBeVisible();
    expect((await beacon).status()).toBe(204);

    await page.goto("/belajar");
    await waitForMemberHeader(page);
    const row = page
      .getByRole("region", { name: "Kursus saya" })
      .getByRole("article", { name: title });
    await expect(row).toBeVisible();
    await expect(row.getByText("Sedang berjalan")).toBeVisible();
    await expect(row.getByRole("link", { name: "Lanjutkan" })).toHaveAttribute(
      "href",
      lessonUrl(made.courseSlug, made.lessons[0]!.slug),
    );
  },
);

test(
  "3. GET tanpa efek tulis: request.get tidak menulis, prefetch dasbor pun tidak",
  async ({ page }) => {
    const token = randomToken("bm3");
    const title = `${token} Cegah Anemia`;
    const member = await memberOnPage(page);
    const made = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      title,
    );
    courseIds.push(made.courseId);
    await enrollViaApi(page, made.courseId);

    // No JavaScript at all: a bare GET renders the page and writes nothing.
    const response = await page
      .context()
      .request.get(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(`${title} materi 1`);

    const dbState = () =>
      withE2eDb(
        (sql) => sql`
          select
            (select count(*)::int from lesson_progress lp
              join users u on u.id = lp.user_id
              where u.email = ${member.email}) as progress_rows,
            (select count(*)::int from enrollments e
              join users u on u.id = e.user_id
              where u.email = ${member.email}
                and e.course_id = ${made.courseId}
                and e.last_lesson_id is null) as null_last
        `,
      );
    let state = await dbState();
    expect(state[0]?.progress_rows).toBe(0);
    expect(state[0]?.null_last).toBe(1);

    // Then in the browser: the dashboard shows the lesson link, its
    // prefetch fetches this very URL — a FIXED pause (not waitFor) lets
    // any would-be write land and be caught.
    await page.goto("/belajar");
    await waitForMemberHeader(page);
    const row = page
      .getByRole("region", { name: "Kursus saya" })
      .getByRole("article", { name: title });
    await expect(
      row.getByRole("link", { name: "Mulai materi 1" }),
    ).toBeVisible();
    await page.waitForTimeout(1000);

    state = await dbState();
    expect(state[0]?.progress_rows).toBe(0);
    expect(state[0]?.null_last).toBe(1);
  },
);

test(
  "4. gerbang kursus 2 materi: panel terkunci, isi tidak pernah dikirim, /open 409, quiz_attempted membuka",
  async ({ page }) => {
    const token = randomToken("bm4");
    const title = `${token} Gizi Ibu Hamil`;
    const member = await memberOnPage(page);
    const made = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      title,
      { lessons: 2 },
    );
    courseIds.push(made.courseId);
    await enrollViaApi(page, made.courseId);
    const lesson1 = made.lessons[0]!;
    const lesson2 = made.lessons[1]!;

    await page.goto(lessonUrl(made.courseSlug, lesson2.slug));
    await expect(
      page.getByRole("heading", { level: 3, name: "Materi ini belum terbuka" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Buka materi 1" }),
    ).toHaveAttribute("href", lessonUrl(made.courseSlug, lesson1.slug));

    // The material itself is absent from the served HTML — a bare GET
    // with no JavaScript, so even the beacon cannot run.
    const html = await (
      await page
        .context()
        .request.get(lessonUrl(made.courseSlug, lesson2.slug))
    ).text();
    expect(html).not.toContain(contentText(title, 2));

    // Writing through the API is refused the same way.
    const refused = await page.context().request.post(
      `/api/progress/lessons/${lesson2.id}/open`,
      { data: {} },
    );
    expect(refused.status()).toBe(409);

    // The quiz card's write (SQL here until that card lands) opens the
    // DIRECT predecessor: quiz materi 1 attempted → materi 2 unlocked.
    await withE2eDb(
      (sql) => sql`
        insert into lesson_progress (user_id, lesson_id, enrollment_id, quiz_attempted)
        select e.user_id, l.id, e.id, true
        from enrollments e
        join lessons l on l.course_id = e.course_id
        join users u on u.id = e.user_id
        where u.email = ${member.email}
          and e.course_id = ${made.courseId}
          and l.id = ${lesson1.id}
        on conflict (user_id, lesson_id) do update set quiz_attempted = true
      `,
    );

    await page.reload();
    await expect(page.getByText(contentText(title, 2))).toBeVisible();

    // And materi 1 now points forward.
    await page.goto(lessonUrl(made.courseSlug, lesson1.slug));
    await expect(page.getByText(contentText(title, 1))).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Materi berikutnya" }),
    ).toHaveAttribute("href", lessonUrl(made.courseSlug, lesson2.slug));
  },
);

test(
  "5. belum terdaftar: panel tanpa isi, klik 'Mulai materi 1' → halaman berganti ke open, satu baris enrollment",
  async ({ page }) => {
    const token = randomToken("bm5");
    const title = `${token} Piring Sehat`;
    const member = await memberOnPage(page);
    const made = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      title,
    );
    courseIds.push(made.courseId);

    await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Anda belum mengikuti kursus ini",
      }),
    ).toBeVisible();
    await expect(page.getByText(contentText(title, 1))).toHaveCount(0);

    // Card §8 no. 5: the enroll's startHref IS the URL currently open, so
    // the page must re-render into the open state. If this ever gets stuck
    // on "Membuka…", STOP and report — no router.refresh() workaround.
    const beacon = waitForOpenBeacon(page, made.lessons[0]!.id);
    await page.getByRole("button", { name: "Mulai materi 1" }).click();
    await expect(page.getByText(contentText(title, 1))).toBeVisible();
    expect((await beacon).status()).toBe(204);

    const rows = await withE2eDb(
      (sql) => sql`
        select count(*)::int as n from enrollments e
        join users u on u.id = e.user_id
        where u.email = ${member.email} and e.course_id = ${made.courseId}
      `,
    );
    expect(rows[0]?.n).toBe(1);
  },
);

test(
  "6. status 404: slug kursus tak dikenal, slug materi tak dikenal, materi kursus lain, kursus DRAFT",
  async ({ page }) => {
    const token = randomToken("bm6");
    await memberOnPage(page);
    const mine = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      `${token} Kursus Ini`,
    );
    const other = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      `${token} Kursus Lain`,
    );
    courseIds.push(mine.courseId, other.courseId);

    const draftId = await createCourseViaApi(editorContext, {
      title: `${token} Draf Rahasia`,
    });
    await createLessonViaApi(editorContext, draftId, `${token} draf materi`);
    courseIds.push(draftId);

    const draftRows = await withE2eDb(
      (sql) => sql`
        select c.slug as course_slug, l.slug as lesson_slug
        from courses c join lessons l on l.course_id = c.id
        where c.id = ${draftId}
        limit 1
      `,
    );
    const draft = draftRows[0];
    expect(draft?.course_slug).toBeTruthy();
    expect(draft?.lesson_slug).toBeTruthy();

    for (const url of [
      `/belajar/kursus-tak-ada-${token}/materi-apapun`,
      lessonUrl(mine.courseSlug, "materi-tak-ada"),
      lessonUrl(mine.courseSlug, other.lessons[0]!.slug),
      `/belajar/${draft!.course_slug}/${draft!.lesson_slug}`,
    ]) {
      const response = await page.context().request.get(url);
      expect(response.status(), url).toBe(404);
    }
  },
);

test(
  "7. matriks API: /open 401/401/404, /video 401/404/409/400, READY 50→20 monoton, terkunci 409",
  async ({ page, browser }) => {
    const token = randomToken("bm7");
    const title = `${token} Vitamin Anak`;
    const member = await memberOnPage(page);
    const made = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      title,
      { lessons: 2 },
    );
    courseIds.push(made.courseId);
    await enrollViaApi(page, made.courseId);
    const lesson1 = made.lessons[0]!;
    const lesson2 = made.lessons[1]!;

    const { context: guestContext } = await newCollectedContext(browser);
    const { context: outsiderContext } = await newCollectedContext(browser);
    try {
      // /open — role BEFORE id, id after role.
      expect(
        (
          await guestContext.request.post(
            `/api/progress/lessons/${lesson1.id}/open`,
            { data: {} },
          )
        ).status(),
      ).toBe(401);
      expect(
        (
          await guestContext.request.post(
            "/api/progress/lessons/bukan-uuid/open",
            { data: {} },
          )
        ).status(),
      ).toBe(401);
      expect(
        (
          await page.context().request.post(
            "/api/progress/lessons/bukan-uuid/open",
            { data: {} },
          )
        ).status(),
      ).toBe(404);

      // /video — role, ownership, video presence, then the body.
      const body = {
        lessonId: lesson1.id,
        positionSeconds: 10,
        durationSeconds: 100,
      };
      expect(
        (await guestContext.request.post("/api/progress/video", { data: body }))
          .status(),
      ).toBe(401);
      const outsider = await createRoleAccount(
        outsiderContext.request,
        "MEMBER",
      );
      await signInViaApi(outsiderContext, outsider);
      expect(
        (
          await outsiderContext.request.post("/api/progress/video", {
            data: body,
          })
        ).status(),
      ).toBe(404);
      expect(
        (await page.context().request.post("/api/progress/video", { data: body }))
          .status(),
      ).toBe(409); // video_status NONE
      expect(
        (
          await page.context().request.post("/api/progress/video", {
            data: { ...body, positionSeconds: -5 },
          })
        ).status(),
      ).toBe(400);

      // READY with a stored duration of 100.
      await withE2eDb(
        (sql) => sql`
          update lessons set video_status = 'READY', video_duration_seconds = 100
          where id = ${lesson1.id}
        `,
      );
      const first = await page.context().request.post("/api/progress/video", {
        data: { ...body, positionSeconds: 50 },
      });
      expect(first.status()).toBe(200);
      const firstData = ((await first.json()) as {
        data: { positionSeconds: number; watchedPercent: number };
      }).data;
      expect(firstData).toEqual({ positionSeconds: 50, watchedPercent: 50 });
      expect(typeof firstData.watchedPercent).toBe("number");

      const rows = await withE2eDb(
        (sql) => sql`
          select video_last_position_seconds as pos,
            video_watched_percent::float8 as pct
          from lesson_progress lp
          join users u on u.id = lp.user_id
          where u.email = ${member.email} and lp.lesson_id = ${lesson1.id}
        `,
      );
      expect(rows[0]?.pos).toBe(50);
      expect(rows[0]?.pct).toBe(50);

      // Seek back: the percent is monotonic, the position follows.
      const second = await page.context().request.post("/api/progress/video", {
        data: { ...body, positionSeconds: 20 },
      });
      expect(second.status()).toBe(200);
      const secondData = ((await second.json()) as {
        data: { positionSeconds: number; watchedPercent: number };
      }).data;
      expect(secondData).toEqual({ positionSeconds: 20, watchedPercent: 50 });

      // A locked lesson refuses video writes just like /open.
      expect(
        (
          await page.context().request.post("/api/progress/video", {
            data: { ...body, lessonId: lesson2.id },
          })
        ).status(),
      ).toBe(409);
    } finally {
      await guestContext.close();
      await outsiderContext.close();
    }
  },
);

test(
  "8. judul 70 karakter tanpa spasi: tanpa gulir samping di tiap lebar, open + locked, <details> terbuka di bawah 1024",
  async ({ page }) => {
    const title = noSpaceTitle(randomToken("bm8")).slice(0, 70);
    await memberOnPage(page);
    const made = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      title,
      { lessons: 2 },
    );
    courseIds.push(made.courseId);
    const lesson1 = made.lessons[0]!;
    const lesson2 = made.lessons[1]!;
    const details = page.locator("details");

    // Not-enrolled first (screenshots) — once enrolled, this member can
    // never see that state for this course again.
    for (const width of [360, 1280] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(lessonUrl(made.courseSlug, lesson1.slug));
      await expect(
        page.getByRole("heading", {
          level: 2,
          name: "Anda belum mengikuti kursus ini",
        }),
      ).toBeVisible();
      await expectNoHorizontalScroll(page, `materi-not-enrolled-${width}`);
      await maybeScreenshot(
        page,
        `materi-not-enrolled-${width}`,
        test.info().project.name,
      );
    }

    await enrollViaApi(page, made.courseId);

    // OPEN at every width; below 1024 the <details> opens too.
    for (const width of [360, 640, 768, 1024, 1280] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(lessonUrl(made.courseSlug, lesson1.slug));
      await expect(page.getByText(contentText(title, 1))).toBeVisible();
      await expectNoHorizontalScroll(page, `materi-open-${width}`);
      await maybeScreenshot(
        page,
        `materi-open-${width}`,
        test.info().project.name,
      );
      if (width < 1024) {
        await details.locator("summary").click();
        await expect(details).toHaveAttribute("open");
        await expectNoHorizontalScroll(
          page,
          `materi-open-${width}-details`,
        );
        await maybeScreenshot(
          page,
          `materi-open-${width}-details`,
          test.info().project.name,
        );
      }
    }

    // LOCKED (materi 2 before any quiz attempt) — the card's four widths.
    for (const width of [360, 640, 1024, 1280] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(lessonUrl(made.courseSlug, lesson2.slug));
      await expect(
        page.getByRole("heading", {
          level: 3,
          name: "Materi ini belum terbuka",
        }),
      ).toBeVisible();
      if (width < 1024) {
        await details.locator("summary").click();
        await expect(details).toHaveAttribute("open");
      }
      await expectNoHorizontalScroll(page, `materi-locked-${width}`);
      await maybeScreenshot(
        page,
        `materi-locked-${width}`,
        test.info().project.name,
      );
    }
  },
);
