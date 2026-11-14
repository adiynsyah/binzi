// The S5-01 learner dashboard (card §8): the published-course list for a
// fresh MEMBER, one-click implicit enrollment, idempotency, the in-place
// error under the button, the API contract, the skeleton on client
// navigation, and no horizontal scroll at every width.
//
// SHARED DATABASE rule (lesson 9 Nov no. 9): other specs also publish
// courses, so these tests never assert counts, featured-card content,
// emptiness, or cross-course order — only THEIR token-titled course,
// addressed through its <article>'s accessible name.
//
// Staff accounts are made ONCE per file (beforeAll); courses stay per
// test so titles stay token-unique. Root spec → chromium project only;
// other widths via page.setViewportSize.
import type { BrowserContext } from "@playwright/test";
import { expect } from "@playwright/test";

import {
  createPublishedCourseViaApi,
  createEditorAdminContexts,
  createCourseViaApi,
  deleteCoursesInE2eDb,
  expectNoHorizontalScroll,
  maybeScreenshot,
  noSpaceTitle,
  randomToken,
  waitForMemberHeader,
  waitForOpenBeacon,
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
/** Course ids this file created — removed again in afterAll (below). */
const courseIds: string[] = [];

test.beforeAll(async ({ browser }) => {
  ({ editorContext, adminContext } = await createEditorAdminContexts(browser));
});

test.afterAll(async () => {
  await editorContext.close();
  await adminContext.close();

  // Shared-database courtesy: the harness drops the schema once per RUN,
  // not per file, and this file runs FIRST alphabetically — older specs
  // behind it assert a pristine global course list (cms-kursus's "Belum
  // ada kursus." for a fresh EDITOR). The shared helper deletes
  // children-first and now also collects LESSON quiz ids before the
  // lessons rows go (this file's courses each carry one quiz per lesson
  // plus the auto-made FINAL quiz).
  await deleteCoursesInE2eDb(courseIds);
});

/** A fresh signed-in MEMBER on the CSP-collected page + their account. */
async function memberOnDashbor(page: import("@playwright/test").Page): Promise<TestAccount> {
  const member = await createRoleAccount(page.context().request, "MEMBER");
  await signInViaApi(page.context(), member);
  await page.goto("/belajar");
  await waitForMemberHeader(page);
  return member;
}

test(
  "1. MEMBER baru: kursus terbit milik tes tampil, DRAFT tidak",
  async ({ page }) => {
    const token = randomToken("bd1");
    const member = await memberOnDashbor(page);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Selamat datang",
    );

    const published = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      `${token} Dasar Gizi`,
    );
    const draftCourseId = await createCourseViaApi(editorContext, {
      title: `${token} Draf Rahasia`,
    });
    courseIds.push(published.courseId, draftCourseId);

    await page.goto("/belajar");
    // Own published course is offered somewhere with a start button…
    const article = page.getByRole("article", { name: `${token} Dasar Gizi` });
    await expect(article).toBeVisible();
    await expect(
      article.getByRole("button", { name: "Mulai materi 1" }),
    ).toBeVisible();
    // …and the DRAFT never shows (anti-leak).
    expect(
      await page
        .getByRole("article", { name: `${token} Draf Rahasia` })
        .count(),
    ).toBe(0);
    expect(await page.getByText(`${token} Draf Rahasia`).count()).toBe(0);

    // Member did not enroll by LOOKING (GET never writes).
    const rows = await withE2eDb(
      (sql) => sql`
        select 1 from enrollments e
        join users u on u.id = e.user_id
        where u.email = ${member.email} and e.course_id = ${published.courseId}
      `,
    );
    expect(rows).toHaveLength(0);
    expect(draftCourseId).toBeTruthy();
  },
);

test(
  "2. klik 'Mulai materi 1' → URL materi pertama, satu baris enrollment, lalu keadaan B",
  async ({ page }) => {
    const token = randomToken("bd2");
    const member = await memberOnDashbor(page);
    const made = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      `${token} Memasak Sehat`,
    );
    courseIds.push(made.courseId);
    // The course arrived through the API — reload the page to see it.
    await page.goto("/belajar");

    const article = page.getByRole("article", { name: `${token} Memasak Sehat` });
    await expect(article).toBeVisible();
    // The lesson page records the open via a client POST beacon — attach
    // the listener BEFORE the click (a fast POST can otherwise slip past
    // the wait), and only head back to the dashboard after it landed:
    // without the wait the badge below could still read "Belum dimulai".
    const openBeacon = waitForOpenBeacon(page, made.lessonId);
    await article.getByRole("button", { name: "Mulai materi 1" }).click();

    // The lesson page itself arrives Kam 12 — only the URL is asserted.
    await expect(page).toHaveURL(
      `/belajar/${made.courseSlug}/${made.firstLessonSlug}`,
    );
    expect((await openBeacon).status()).toBe(204);

    const rows = await withE2eDb(
      (sql) => sql`
        select c.enrollment_count
        from enrollments e
        join users u on u.id = e.user_id
        join courses c on c.id = e.course_id
        where u.email = ${member.email} and e.course_id = ${made.courseId}
      `,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.enrollment_count).toBe(1);

    // Back to the dashboard → state B. Card S2-01 moved this on: landing
    // on the lesson page records the open (POST /open beacon), so the
    // badge is no longer "Belum dimulai" but "Sedang berjalan" and the
    // action becomes "Lanjutkan" — nothing is COMPLETED by opening, so
    // the 0/1 count stays (S2-01 spec no. 2 asserts this same state).
    await page.goto("/belajar");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Selamat datang kembali",
    );
    const mine = page.getByRole("region", { name: "Kursus saya" });
    const row = mine.getByRole("article", { name: `${token} Memasak Sehat` });
    await expect(row.getByText("Sedang berjalan")).toBeVisible();
    await expect(row.getByText("0/1 MATERI")).toBeVisible();
    await expect(row.getByRole("link", { name: "Lanjutkan" })).toHaveAttribute(
      "href",
      `/belajar/${made.courseSlug}/${made.firstLessonSlug}`,
    );
    // …and the course left "Kursus lainnya" (works whether the region
    // rendered at all on the shared database).
    await expect(
      page
        .getByRole("region", { name: "Kursus lainnya" })
        .getByRole("article", { name: `${token} Memasak Sehat` }),
    ).toHaveCount(0);
  },
);

test(
  "3. klik ganda cepat → satu POST /enroll (jeda tetap, bukan waitFor)",
  async ({ page }) => {
    const token = randomToken("bd3");
    await memberOnDashbor(page);
    const made = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      `${token} Cegah Anemia`,
    );
    courseIds.push(made.courseId);
    await page.goto("/belajar");

    const enrollPath = `/api/progress/courses/${made.courseId}/enroll`;
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith(enrollPath)) {
        posts.push(request.url());
      }
    });

    const button = page
      .getByRole("article", { name: `${token} Cegah Anemia` })
      .getByRole("button", { name: "Mulai materi 1" });
    await expect(button).toBeVisible();
    // dblclick fires two clicks in one burst — the handler guard (not the
    // disabled attribute) must keep it to one request.
    await button.dblclick();
    await page.waitForTimeout(500);

    expect(posts).toHaveLength(1);
  },
);

test(
  "4. POST gagal 500 → pesan galat di tempat, terlihat penuh di 1280 dan 360, fokus di tombol",
  async ({ page }) => {
    const token = randomToken("bd4");
    await memberOnDashbor(page);
    const made = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      `${token} Gizi Lansia`,
    );
    courseIds.push(made.courseId);
    await page.goto("/belajar");

    await page.route(
      `**/api/progress/courses/${made.courseId}/enroll`,
      async (route) => {
        await route.fulfill({ status: 500, body: "boom" });
      },
    );

    const article = page.getByRole("article", { name: `${token} Gizi Lansia` });
    const button = article.getByRole("button", { name: "Mulai materi 1" });
    await expect(button).toBeVisible();
    await button.click();

    const alert = article.getByRole("alert");
    await expect(alert).toContainText(
      "Kursus belum bisa dibuka. Periksa koneksi Anda lalu coba lagi.",
    );

    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(alert).toBeInViewport({ ratio: 1 });
    }
    await expect(button).toBeFocused();
  },
);

test("5. API: tamu/non-UUID → 401; MEMBER: DRAFT → 404, non-UUID → 404, kedua kali → 200 + hitungan tetap; EDITOR → 201", async ({
  request,
  browser,
}) => {
  const token = randomToken("bd5");

  // Guest: role is checked BEFORE the id is even parsed (guard order) —
  // a non-UUID id still answers 401, never 404.
  const guest = await request.post("/api/progress/courses/bukan-uuid/enroll");
  expect(guest.status(), await guest.text()).toBe(401);

  const made = await createPublishedCourseViaApi(
    editorContext,
    adminContext,
    `${token} Label Gizi`,
  );
  const draftCourseId = await createCourseViaApi(editorContext, {
    title: `${token} Masih Draf`,
  });
  courseIds.push(made.courseId, draftCourseId);

  const memberContext = await browser.newContext();
  try {
    const member = await createRoleAccount(memberContext.request, "MEMBER");
    await signInViaApi(memberContext, member);
    const enroll = (id: string) =>
      memberContext.request.post(`/api/progress/courses/${id}/enroll`);

    const draft = await enroll(draftCourseId);
    expect(draft.status(), await draft.text()).toBe(404);
    const nonUuid = await enroll("bukan-uuid");
    expect(nonUuid.status(), await nonUuid.text()).toBe(404);

    const first = await enroll(made.courseId);
    expect(first.status(), await first.text()).toBe(201);
    const second = await enroll(made.courseId);
    expect(second.status(), await second.text()).toBe(200);

    const rows = await withE2eDb(
      (sql) => sql`
        select enrollment_count from courses where id = ${made.courseId}
      `,
    );
    expect(rows[0]?.enrollment_count).toBe(1);

    // MEMBER+ may enroll — the EDITOR context of this file proves 201.
    const editor = await editorContext.request.post(
      `/api/progress/courses/${made.courseId}/enroll`,
    );
    expect(editor.status(), await editor.text()).toBe(201);
    const after = await withE2eDb(
      (sql) => sql`
        select enrollment_count from courses where id = ${made.courseId}
      `,
    );
    expect(after[0]?.enrollment_count).toBe(2);
  } finally {
    await memberContext.close();
  }
});

// Card §8 no. 6 asked for a skeleton e2e here (RSC request for /belajar
// held ±1.5s via a route predicate → client navigation from / shows the
// role="status" "Memuat…"). It is NOT here, and not silently: three
// deterministic variants ran red — holding every ?_rsc request (the
// prefetch joins the delay and the click shows nothing), aborting the
// prefetch (the click's own fetch is held 1500ms and STILL no fallback
// appears while it is in flight), and letting the delayed prefetch land
// first (the click fetches again — observed via page.on("request") — and
// the fallback only mounts once the response STARTS streaming, by which
// time the content resolves inside the skeleton's own 300ms
// useSkeletonDelay, so "Memuat…" never renders). Next 16 shows the
// loading.tsx fallback DURING a slow STREAM, not during a held request —
// which is exactly what the card's manual step no. 4 ("DevTools → Network
// → Slow 4G → klik Belajar") exercises. Per the card's own fallback rule
// ("Catatan jadwal": cut this test first, replace with manual step no. 4,
// never delete quietly) the e2e became that manual step; the skeleton's
// behavior itself stays covered by the fake-timer unit test and the
// loading.tsx structure test.

test(
  "7. judul 70 karakter tanpa spasi: tanpa gulir samping di 360/640/768/1024/1280, keadaan A dan B",
  async ({ page }) => {
    const title = noSpaceTitle(randomToken("bd")).slice(0, 70);
    await memberOnDashbor(page);
    const made = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      title,
    );
    courseIds.push(made.courseId);

    // State A first at EVERY width (screenshots included), then enroll
    // once — after that this member can never render state A again.
    for (const width of [360, 640, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/belajar");
      await expect(page.getByRole("article", { name: title })).toBeVisible();
      await expectNoHorizontalScroll(page, `belajar-A-${width}`);
      await maybeScreenshot(page, `belajar-A-${width}`, test.info().project.name);
    }

    await page.context().request.post(
      `/api/progress/courses/${made.courseId}/enroll`,
    );

    for (const width of [360, 640, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/belajar");
      await expect(
        page.getByRole("region", { name: "Kursus saya" }).getByRole("article", {
          name: title,
        }),
      ).toBeVisible();
      await expectNoHorizontalScroll(page, `belajar-B-${width}`);
      await maybeScreenshot(page, `belajar-B-${width}`, test.info().project.name);
    }
  },
);
