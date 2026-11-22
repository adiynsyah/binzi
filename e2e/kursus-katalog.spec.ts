// The S6-02 public catalog + course detail (card §"E2E", max 2 tests — the
// CI budget): (1) tamu → member over one token-titled course K — the
// catalog card (cover meta "2 materi · 12 menit", Lihat kursus), the
// detail's outline + guest CTA pair (Masuk returns to THIS page), the
// member CTA swap to Mulai belajar, the width sweep 360–1280 (no
// horizontal scroll on the document, the K card, and the CTA box), touch
// targets at 360, and the ten screenshots; (2) the anti-IDOR answers — an
// unknown slug and a DRAFT course's slug both 404, and the DRAFT course
// never appears in the catalog.
//
// Root spec → chromium project only. Shared-database rule: token-titled
// courses only, cleaned up through deleteCoursesInE2eDb.
import type { BrowserContext, Locator, Page } from "@playwright/test";

import {
  createRoleAccount,
  signInViaApi,
  test,
  withE2eDb,
} from "./fixtures";
import {
  attachVideoInE2eDb,
  createCourseViaApi,
  createEditorAdminContexts,
  createPublishedCourseViaApi,
  deleteCoursesInE2eDb,
  expectNoHorizontalScroll,
  expectTouchTarget,
  maybeScreenshot,
  randomToken,
  waitStableForMeasure,
} from "./layout/helpers";
import { expect } from "@playwright/test";

let editorContext: BrowserContext;
let adminContext: BrowserContext;

/** Course ids this file created — removed again in afterAll. */
const courseIds: string[] = [];

test.beforeAll(async ({ browser }) => {
  ({ editorContext, adminContext } = await createEditorAdminContexts(browser));
});

test.afterAll(async () => {
  await deleteCoursesInE2eDb(courseIds);
});

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

/** Card K on the catalog — the article scoped to its EXACT h2 (STATUS 20
 *  Nov lesson 4: never a loose substring match on the shared database). */
function courseCard(page: Page, title: string): Locator {
  return page.locator("article", {
    has: page.getByRole("heading", { level: 2, name: title, exact: true }),
  });
}

/** The enroll CTA card: the nearest rounded-card ancestor of its unique
 *  control (guest link / member button) — the card itself, not any of the
 *  layout wrappers above it. */
function ctaCardOf(page: Page, member: boolean): Locator {
  const control = member
    ? page.getByRole("button", { name: "Mulai belajar" })
    : page.getByRole("link", { name: "Daftar & mulai belajar" });
  return control.locator(
    "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' rounded-card ')][1]",
  );
}

test("1. katalog + detail: tamu lalu member, lebar 360–1280", async ({
  page,
}) => {
  const titleK = `${randomToken("kk")} Kursus Katalog`;
  const made = await createPublishedCourseViaApi(editorContext, adminContext, titleK, {
    lessons: 2,
  });
  courseIds.push(made.courseId);
  // Card §"E2E": 12 minutes on the cover meta, and lesson 1 carries a
  // READY video (100 s → "01:40 · video" in the outline).
  await withE2eDb(async (sql) => {
    await sql`update courses set estimated_minutes = 12
      where id = ${made.courseId}`;
  });
  // 11-char external id — lessons_video_source_check demands
  // ^[A-Za-z0-9_-]{11}$ for YOUTUBE + READY ("e2eVideo001" length).
  await attachVideoInE2eDb(made.lessons[0]!.id, "e2eVideoK01", 100);

  const catalogCard = courseCard(page, titleK);
  const detailUrl = `/kursus/${made.courseSlug}`;

  // --- catalog, tamu -----------------------------------------------------
  await page.goto("/kursus");
  await expect(
    page.getByRole("heading", { level: 1, name: "Kursus gizi yang ditinjau ahli" }),
  ).toBeVisible();
  await expect(catalogCard).toBeVisible();
  await expect(catalogCard.getByText("Pemula · 2 materi")).toBeVisible();
  // DOM text is lowercase; CSS uppercases (component test pins the rule).
  // Exact: the level line also carries an sr-only " · 12 menit" (review
  // item 2), so its full text contains this substring.
  await expect(
    catalogCard.getByText("2 materi · 12 menit", { exact: true }),
  ).toBeVisible();
  await expect(
    catalogCard.getByRole("link", { name: "Lihat kursus" }),
  ).toHaveAttribute("href", detailUrl);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );

  // --- detail, tamu ------------------------------------------------------
  await page.goto(detailUrl);
  await expect(
    page.getByRole("heading", { level: 1, name: titleK, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Pemula · 2 materi · 12 menit · Quiz per materi"),
  ).toBeVisible();
  // Exact: the footer blurb and the CTA cover meta ("Ditinjau ahli gizi
  // ber-STR aktif") also contain this substring (STATUS 20 Nov lesson 4).
  await expect(
    page.getByText("Ditinjau ahli gizi", { exact: true }),
  ).toBeVisible();
  // The full outline, positions included — no locked/preview labels.
  await expect(
    page.getByRole("heading", { level: 3, name: `1 · ${titleK} materi 1` }),
  ).toBeVisible();
  await expect(page.getByText("01:40 · video")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: `2 · ${titleK} materi 2` }),
  ).toBeVisible();
  await expect(page.getByText("materi teks")).toBeVisible();
  await expect(
    page.getByText("Quiz di setiap materi · Final Quiz di akhir"),
  ).toBeVisible();
  // Tentang kursus this renders the stored description.
  await expect(
    page.getByText(`Deskripsi netral ${titleK} untuk tes e2e.`),
  ).toBeVisible();
  // Guest CTA pair; Masuk returns to THIS page.
  await expect(
    page.getByRole("link", { name: "Daftar & mulai belajar" }),
  ).toHaveAttribute("href", "/daftar");
  await expect(
    page.getByRole("link", { name: "Sudah punya akun? Masuk" }),
  ).toHaveAttribute(
    "href",
    `/masuk?next=${encodeURIComponent(detailUrl)}`,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );

  // --- width sweep: no horizontal scroll + the ten screenshots ----------
  for (const width of [360, 768, 1024, 1280] as const) {
    await page.setViewportSize({ width, height: 800 });

    await page.goto("/kursus");
    await expect(catalogCard).toBeVisible();
    await expectNoHorizontalScroll(page, `/kursus w${width}`);
    await expectBoxFits(page, catalogCard, `kartu K w${width}`);
    await maybeScreenshot(page, `katalog-${width}`, test.info().project.name);

    await page.goto(detailUrl);
    await expect(
      page.getByRole("heading", { level: 1, name: titleK, exact: true }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page, `/kursus/{slug} tamu w${width}`);
    await expectBoxFits(page, ctaCardOf(page, false), `kotak CTA tamu w${width}`);
    await maybeScreenshot(
      page,
      `detail-tamu-${width}`,
      test.info().project.name,
    );
  }

  // --- touch targets at 360 ---------------------------------------------
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/kursus");
  await expectTouchTarget(
    catalogCard.getByRole("link", { name: "Lihat kursus" }),
    "Lihat kursus (kartu K)",
  );
  await page.goto(detailUrl);
  await expectTouchTarget(
    page.getByRole("link", { name: "Kursus", exact: true }),
    "breadcrumb Kursus",
  );
  await expectTouchTarget(
    page.getByRole("link", { name: "Daftar & mulai belajar" }),
    "CTA daftar (tamu)",
  );
  await expectTouchTarget(
    page.getByRole("link", { name: "Sudah punya akun? Masuk" }),
    "CTA masuk (tamu)",
  );

  // --- member: the CTA swaps, nothing else moves ------------------------
  const member = await createRoleAccount(page.context().request, "MEMBER");
  await signInViaApi(page.context(), member);
  for (const width of [360, 1280] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(detailUrl);
    await expect(
      page.getByRole("button", { name: "Mulai belajar" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Daftar & mulai belajar" }),
    ).toHaveCount(0);
    await expectNoHorizontalScroll(page, `/kursus/{slug} member w${width}`);
    await expectBoxFits(page, ctaCardOf(page, true), `kotak CTA member w${width}`);
    await maybeScreenshot(
      page,
      `detail-member-${width}`,
      test.info().project.name,
    );
  }

  // --- member click-through: enroll + open, then idempotent -------------
  await page.getByRole("button", { name: "Mulai belajar" }).click();
  await expect(page).toHaveURL(
    `/belajar/${made.courseSlug}/${made.firstLessonSlug}`,
  );
  // Back to the detail and start again: already enrolled — the same
  // lesson page, no error state (the API is idempotent).
  await page.goto(detailUrl);
  await page.getByRole("button", { name: "Mulai belajar" }).click();
  await expect(page).toHaveURL(
    `/belajar/${made.courseSlug}/${made.firstLessonSlug}`,
  );
});

test("2. 404 seragam: slug tak ada dan kursus DRAFT; DRAFT tak muncul di katalog", async ({
  page,
}) => {
  const draftTitle = `${randomToken("kd")} Kursus Draf`;
  const draftId = await createCourseViaApi(editorContext, { title: draftTitle });
  courseIds.push(draftId);
  const draftSlug = (
    await withE2eDb(
      (sql) => sql`select slug from courses where id = ${draftId}`,
    )
  )[0]?.slug;

  // Unknown slug → the plain 404.
  const missing = await page.goto(`/kursus/${randomToken("tak-ada")}`);
  expect(missing?.status()).toBe(404);

  // DRAFT slug → the SAME 404 (its existence never leaks).
  const draftResponse = await page.goto(`/kursus/${draftSlug}`);
  expect(draftResponse?.status()).toBe(404);

  // And the DRAFT course is absent from the catalog.
  await page.goto("/kursus");
  await expect(
    page.getByRole("heading", { level: 1, name: "Kursus gizi yang ditinjau ahli" }),
  ).toBeVisible();
  await expect(page.getByRole("article", { name: draftTitle })).toHaveCount(0);
});
