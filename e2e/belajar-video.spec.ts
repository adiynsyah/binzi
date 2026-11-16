// The S2-02 lesson video (card "E2E"): the nocookie iframe and its src
// contract, the reporter flow through the stubbed IFrame API (pause flush,
// resume row, ended = 100 %), the network-failure banner, the no-video and
// locked walls, and no horizontal scroll at 360/1024/1280 with the player
// present. The YouTube stub comes from e2e/layout/helpers.ts and is served
// from the REAL youtube.com / youtube-nocookie.com URLs — the page CSP
// still checks it (mutation 9), and the CSP-collecting test fixture
// asserts zero main-document violations on every load here.
//
// Root spec → chromium project only; other widths via page.setViewportSize
// (same as belajar-materi.spec.ts). Shared-database rule: only
// token-titled courses, cleaned up through deleteCoursesInE2eDb.
import type { BrowserContext } from "@playwright/test";
import { expect } from "@playwright/test";

import {
  attachVideoInE2eDb,
  createEditorAdminContexts,
  createPublishedCourseViaApi,
  deleteCoursesInE2eDb,
  expectNoHorizontalScroll,
  maybeScreenshot,
  randomToken,
  stubYouTube,
  waitForOpenBeacon,
  waitForYouTubeStub,
} from "./layout/helpers";
import {
  createRoleAccount,
  signInViaApi,
  test,
  withE2eDb,
  type TestAccount,
} from "./fixtures";

const VIDEO_ID = "e2eVideo001"; // 11 chars, clearly fake (card §2)
const LOCKED_VIDEO_ID = "e2eLockd001"; // own id so the wall assertion is exact
const DURATION = 100;

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

/** A fresh signed-in MEMBER on the page's own (CSP-collected) context. */
async function memberOnPage(page: import("@playwright/test").Page) {
  const member = await createRoleAccount(page.context().request, "MEMBER");
  await signInViaApi(page.context(), member);
  return member;
}

async function enrollViaApi(
  page: import("@playwright/test").Page,
  courseId: string,
): Promise<void> {
  const response = await page
    .context()
    .request.post(`/api/progress/courses/${courseId}/enroll`);
  expect(response.status(), await response.text()).toBe(201);
}

/** Signs a fresh MEMBER in on the page's context, publishes a 1-lesson
 *  course, attaches e2eVideo001 (duration 100), and enrolls them.
 *  Registers the course for cleanup. */
async function videoCourseOnPage(
  page: import("@playwright/test").Page,
  prefix: string,
  options: { lessons?: number } = {},
) {
  const member = await memberOnPage(page);
  const title = `${randomToken(prefix)} Dasar Gizi`;
  const made = await createPublishedCourseViaApi(
    editorContext,
    adminContext,
    title,
    options,
  );
  courseIds.push(made.courseId);
  await attachVideoInE2eDb(made.lessons[0]!.id, VIDEO_ID, DURATION);
  await enrollViaApi(page, made.courseId);
  return { ...made, title, member };
}

/** The video iframe locator (the only iframe on the lesson page). */
function videoFrame(page: import("@playwright/test").Page) {
  return page.locator('iframe[title^="Video: "]');
}

/** Parsed src of the video iframe (mounted client-side, hence the wait). */
async function videoFrameSrc(
  page: import("@playwright/test").Page,
): Promise<URL> {
  const src = await videoFrame(page).getAttribute("src");
  expect(src).not.toBeNull();
  return new URL(src!);
}

/** Waits for the next /api/progress/video POST — attached BEFORE the stub
 *  event that triggers it (the waitForOpenBeacon pattern). */
function waitForVideoPost(page: import("@playwright/test").Page) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/progress/video",
  );
}

/** Drives the stub: set the engine clock, then fire YT states. */
async function stubEvent(
  page: import("@playwright/test").Page,
  action: "setTime" | "setDuration",
  value: number,
): Promise<void>;
async function stubEvent(
  page: import("@playwright/test").Page,
  action: "emit" | "error",
  code: number,
): Promise<void>;
async function stubEvent(
  page: import("@playwright/test").Page,
  action: "setTime" | "setDuration" | "emit" | "error",
  value: number,
): Promise<void> {
  await page.evaluate(
    ([action, value]) => {
      const stub = (
        window as unknown as {
          __ytStub: Record<string, (n: number) => void>;
        }
      ).__ytStub;
      stub[action]!(value);
    },
    [action, value] as const,
  );
}

/** This member's stored video position/percent for the lesson. */
async function videoProgressRows(
  member: TestAccount,
  lessonId: string,
): Promise<Array<{ position: number | null; percent: number | null }>> {
  return withE2eDb(
    (sql) => sql`
      select lp.video_last_position_seconds as position,
        lp.video_watched_percent::float8 as percent
      from lesson_progress lp
      join users u on u.id = lp.user_id
      where u.email = ${member.email} and lp.lesson_id = ${lessonId}
    `,
  );
}

// ------------------------------------------------------------------ tests

test("1. materi dengan video → iframe nocookie + src contract, tanpa pelanggaran CSP", async ({
  page,
}) => {
  await stubYouTube(page);
  const made = await videoCourseOnPage(page, "bv1");

  const beacon = waitForOpenBeacon(page, made.lessons[0]!.id);
  await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
  expect((await beacon).status()).toBe(204);

  const url = await videoFrameSrc(page);
  expect(url.host).toBe("www.youtube-nocookie.com");
  expect(url.pathname).toBe(`/embed/${VIDEO_ID}`);
  expect(url.searchParams.get("enablejsapi")).toBe("1");
  expect(url.searchParams.get("origin")).toBe(
    new URL(page.url()).origin, // never from env — preview origins differ
  );
  expect(url.searchParams.get("rel")).toBe("0");
  expect(url.searchParams.has("start")).toBe(false); // fresh start

  // The engine attaches through the stub (script-src youtube.com works).
  await waitForYouTubeStub(page);
  // Zero CSP violations on the main document is asserted by the fixture's
  // after-each collector — including the stubbed iframe_api script.
  // The /open beacon wrote the progress ROW; without any play event the
  // video columns stay untouched (position 0, percent 0).
  const rows = await videoProgressRows(made.member, made.lessons[0]!.id);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.position).toBe(0);
  expect(rows[0]?.percent).toBe(0);
});

test("2. setTime(37) + emit(1) lalu emit(2) → POST /video 200 {37, 100}; DB posisi 37 persen 37", async ({
  page,
}) => {
  await stubYouTube(page);
  const made = await videoCourseOnPage(page, "bv2");

  await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
  await waitForYouTubeStub(page);

  await stubEvent(page, "setDuration", DURATION);
  await stubEvent(page, "setTime", 37);
  await stubEvent(page, "emit", 1); // playing → 10 s ticks
  const posted = waitForVideoPost(page);
  await stubEvent(page, "emit", 2); // paused → immediate flush

  const response = await posted;
  expect(response.status()).toBe(200);
  expect(JSON.parse(response.request().postData()!)).toEqual({
    lessonId: made.lessons[0]!.id,
    positionSeconds: 37,
    durationSeconds: DURATION,
  });

  const rows = await videoProgressRows(made.member, made.lessons[0]!.id);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.position).toBe(37);
  expect(rows[0]?.percent).toBe(37);
});

test("3. muat ulang → 'Melanjutkan dari 00:37' dan src start=37", async ({
  page,
}) => {
  await stubYouTube(page);
  const made = await videoCourseOnPage(page, "bv3");

  await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
  await waitForYouTubeStub(page);
  await stubEvent(page, "setDuration", DURATION);
  await stubEvent(page, "setTime", 37);
  await stubEvent(page, "emit", 1);
  const posted = waitForVideoPost(page);
  await stubEvent(page, "emit", 2);
  expect((await posted).status()).toBe(200);

  await page.reload();
  await expect(page.getByText("Melanjutkan dari 00:37")).toBeVisible();
  const url = await videoFrameSrc(page);
  expect(url.searchParams.get("start")).toBe("37");
});

test("4. emit(0) → POST dengan posisi 100; DB persen 100", async ({ page }) => {
  await stubYouTube(page);
  const made = await videoCourseOnPage(page, "bv4");

  await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
  await waitForYouTubeStub(page);
  await stubEvent(page, "setDuration", DURATION);
  await stubEvent(page, "setTime", 63);
  await stubEvent(page, "emit", 1);
  const posted = waitForVideoPost(page);
  await stubEvent(page, "emit", 0); // ended → position = duration

  const response = await posted;
  expect(response.status()).toBe(200);
  expect(JSON.parse(response.request().postData()!)).toEqual({
    lessonId: made.lessons[0]!.id,
    positionSeconds: 100,
    durationSeconds: DURATION,
  });

  const rows = await videoProgressRows(made.member, made.lessons[0]!.id);
  expect(rows[0]?.percent).toBe(100);
});

test("5. error(150) → banner 'Video gagal dimuat' (w360 + screenshot)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await stubYouTube(page);
  const made = await videoCourseOnPage(page, "bv5");

  await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
  await waitForYouTubeStub(page);
  await stubEvent(page, "error", 150);

  await expect(
    page.getByText("Video gagal dimuat di jaringan ini."),
  ).toBeVisible();
  await expect(
    page.getByText("Teks materi & quiz tetap bisa dikerjakan."),
  ).toBeVisible();
  await maybeScreenshot(page, "video-galat-360", test.info().project.name);
});

test("6. materi tanpa video → tanpa iframe; materi terkunci ber-video → HTML tanpa id video", async ({
  page,
}) => {
  await stubYouTube(page);
  await memberOnPage(page);
  const title = `${randomToken("bv6")} Dasar Gizi`;
  const made = await createPublishedCourseViaApi(
    editorContext,
    adminContext,
    title,
    {
      lessons: 2,
    },
  );
  courseIds.push(made.courseId);
  // Lesson 1: NO video (open). Lesson 2: locked, carries its OWN id.
  await attachVideoInE2eDb(made.lessons[1]!.id, LOCKED_VIDEO_ID, DURATION);
  await enrollViaApi(page, made.courseId);

  await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.locator("iframe").count()).toBe(0);

  // The locked page answers 200 for the MEMBER, but neither the body nor
  // any attribute ever carries the video id (V-06 — no read, no render).
  const locked = await page
    .context()
    .request.get(lessonUrl(made.courseSlug, made.lessons[1]!.slug));
  expect(locked.status()).toBe(200);
  const html = await locked.text();
  expect(html).not.toContain(LOCKED_VIDEO_ID);
  expect(html).not.toContain("youtube-nocookie");

  await page.goto(lessonUrl(made.courseSlug, made.lessons[1]!.slug));
  await expect(
    page.getByRole("heading", { level: 3, name: "Materi ini belum terbuka" }),
  ).toBeVisible();
  expect(await page.locator("iframe").count()).toBe(0);
});

test("7. lebar 360/1024/1280 tanpa gulir samping + screenshot; resume di 360", async ({
  page,
}) => {
  await stubYouTube(page);
  const made = await videoCourseOnPage(page, "bv7");

  // 1024 is the start of the lg: two-column grid (owner review item 6) —
  // the side outline card joins at exactly this width.
  for (const width of [360, 1024, 1280] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(lessonUrl(made.courseSlug, made.lessons[0]!.slug));
    await expect(videoFrame(page)).toBeVisible();
    await expectNoHorizontalScroll(page, `video-open-${width}`);
    await maybeScreenshot(
      page,
      `video-open-${width}`,
      test.info().project.name,
    );
  }

  // The resume state at 360: position 37 stored, reloaded, row + iframe.
  await waitForYouTubeStub(page);
  await stubEvent(page, "setDuration", DURATION);
  await stubEvent(page, "setTime", 37);
  await stubEvent(page, "emit", 1);
  const posted = waitForVideoPost(page);
  await stubEvent(page, "emit", 2);
  expect((await posted).status()).toBe(200);

  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await expect(page.getByText("Melanjutkan dari 00:37")).toBeVisible();
  await expect(videoFrame(page)).toBeVisible();
  await expectNoHorizontalScroll(page, "video-resume-360");
  await maybeScreenshot(page, "video-resume-360", test.info().project.name);
});
