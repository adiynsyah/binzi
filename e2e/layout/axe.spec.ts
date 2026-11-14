// axe-core WCAG 2.1 A/AA (card A-19b §6) — runs in w360 and w1280 (config
// testIgnore). The nine card pages (6 guest + /belajar + /cms + the 403)
// are scanned per width, plus the open menu/drawer states at w360, with
// ALL rules active (no disableRules; the only `exclude` is the Turnstile
// container — cross-origin Cloudflare iframe). Everything serious/critical
// fails the suite: the color-contrast findings A-19b had to excuse (small
// `text-primary`/white-on-primary ≈ 3.8:1 and `text-text-subtle` micro
// text ≈ 3.6–3.8:1, both under the 4.5:1 AA bar) were fixed by the C-07
// token change, so KNOWN_CONTRAST_FINDINGS below is empty. The exception
// mechanism stays for the future: every entry is asserted to still fire,
// and any NEW serious/critical violation (contrast included, on any
// element) fails immediately.
import AxeBuilder from "@axe-core/playwright";
import type { BrowserContext, Page } from "@playwright/test";
import type { TestInfo } from "@playwright/test";

import {
  createRoleAccount,
  expect,
  signInViaApi,
  test,
  withE2eDb,
} from "../fixtures";
import {
  GUEST_PAGES,
  TURNSTILE_CONTAINER,
  createCourseViaApi,
  createEditorAdminContexts,
  createPublishableCourseViaApi,
  createPublishedCourseViaApi,
  openAccountDrawer,
  openCmsDrawer,
  openGuestMenu,
  widthSpecOf,
} from "./helpers";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

/** One known finding: the axe target selector (verbatim from analyze()). */
type KnownFinding = readonly [target: string, note: string];

/**
 * Exception list for KNOWN serious color-contrast findings, keyed
 * `"${axeLabel} @${projectName}"` — empty since C-07 closed every A-19b
 * finding. To add an entry, capture its axe target verbatim from
 * analyze(); the stale-entry assertion below then keeps the list honest:
 * an entry whose finding no longer fires fails the suite until it is
 * pruned.
 */
const KNOWN_CONTRAST_FINDINGS: Readonly<
  Record<string, readonly KnownFinding[]>
> = {};

/** Violation digest for logs/attachments (id, impact, targets count). */
function digest(
  violations: Awaited<ReturnType<typeof runAxe>>,
): string {
  return violations
    .map((v) => `${v.impact} ${v.id} (${v.nodes.length} node)`)
    .join(", ");
}

async function runAxe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags([...AXE_TAGS])
    .exclude(TURNSTILE_CONTAINER)
    .analyze();
  return results.violations;
}

/**
 * Asserts: (a) every known color-contrast finding still fires (stale
 * entries fail — prune the table when the token chore lands), and (b) no
 * serious/critical violation exists OUTSIDE the known list (new findings,
 * including contrast on other elements, stay red). Moderate/minor are
 * attached to the report and logged for the PR listing.
 */
async function expectAxeClean(
  page: Page,
  label: string,
  testInfo: TestInfo,
): Promise<void> {
  const violations = await runAxe(page);
  const key = `${label} @${testInfo.project.name}`;
  const known = KNOWN_CONTRAST_FINDINGS[key] ?? [];
  const knownTargets = new Set(known.map(([target]) => target));

  const contrastNodes =
    violations.find((v) => v.id === "color-contrast")?.nodes ?? [];
  const seenTargets = new Set(contrastNodes.map((n) => n.target.join(" > ")));

  // (a) self-pruning guard.
  const stale = known.filter(([target]) => !seenTargets.has(target));
  expect
    .soft(
      stale.map(([target, note]) => `${target} (${note})`),
      `${key}: entri KNOWN_CONTRAST_FINDINGS yang tidak muncul lagi — pangkas daftar (token sudah diperbaiki?)`,
    )
    .toEqual([]);

  // (b) everything serious/critical outside the list must be empty.
  const rest = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .flatMap((v) =>
      v.nodes
        .filter(
          (n) =>
            !(
              v.id === "color-contrast" &&
              knownTargets.has(n.target.join(" > "))
            ),
        )
        .map((n) => `${v.impact} ${v.id}: ${n.target.join(" > ")}`),
    );
  expect
    .soft(rest, `${label}: serious/critical di luar daftar known`)
    .toEqual([]);

  if (violations.length > 0) {
    console.log(`[axe] ${key}: ${digest(violations)}`);
    await testInfo.attach(`axe-${label}`, {
      body: JSON.stringify(violations, null, 2),
      contentType: "application/json",
    });
  }
}

test.describe("axe WCAG 2.1 A/AA", () => {
  // Card S5-01: staff contexts once per file (the publish flow is
  // expensive); courses stay per-test with token titles.
  let editorContext: BrowserContext;
  let adminContext: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    ({ editorContext, adminContext } = await createEditorAdminContexts(browser));
  });

  test.afterAll(async () => {
    await editorContext.close();
    await adminContext.close();
  });

  test(`halaman tamu (${GUEST_PAGES.length})`, async ({ page }, testInfo) => {
    for (const path of GUEST_PAGES) {
      await test.step(path, async () => {
        await page.goto(path);
        await expectAxeClean(page, `tamu ${path}`, testInfo);
      });
    }
  });

  test("MEMBER: /belajar keadaan A lalu B, 403, dan (w360) drawer akun terbuka", async (
    { page, request },
    testInfo,
  ) => {
    const spec = widthSpecOf(testInfo.project.name);
    const account = await createRoleAccount(request, "MEMBER");
    await signInViaApi(page.context(), account);

    // Card S5-01: state A is scanned with THIS test's own published course
    // on screen — the shared database decides nothing here.
    const token = `ax${Date.now().toString(36)}${testInfo.project.name}`;
    const made = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      `${token} kursus belajar axe`,
    );

    await test.step("/belajar keadaan A (peserta baru)", async () => {
      await page.goto("/belajar");
      await expect(
        page.getByRole("article", { name: `${token} kursus belajar axe` }),
      ).toBeVisible();
      await expectAxeClean(page, "MEMBER /belajar A", testInfo);
    });

    await test.step("/belajar keadaan B (setelah mendaftar via API)", async () => {
      const enroll = await page.context().request.post(
        `/api/progress/courses/${made.courseId}/enroll`,
      );
      expect(enroll.status(), await enroll.text()).toBe(201);
      await page.goto("/belajar");
      await expect(
        page
          .getByRole("region", { name: "Kursus saya" })
          .getByRole("article", { name: `${token} kursus belajar axe` }),
      ).toBeVisible();
      await expectAxeClean(page, "MEMBER /belajar B", testInfo);
    });

    if (spec.account === "drawer") {
      await test.step("/belajar drawer akun terbuka", async () => {
        await openAccountDrawer(page);
        await expectAxeClean(page, "drawer akun terbuka", testInfo);
      });
    }

    await test.step("403 (/cms sebagai MEMBER)", async () => {
      await page.goto("/cms");
      await expect(
        page.getByRole("heading", { name: "Akses ditolak" }),
      ).toBeVisible();
      await expectAxeClean(page, "403", testInfo);
    });
  });

  test("EDITOR: /cms dan (w360) drawer CMS terbuka", async (
    { page, request },
    testInfo,
  ) => {
    const spec = widthSpecOf(testInfo.project.name);
    const account = await createRoleAccount(request, "EDITOR");
    await signInViaApi(page.context(), account);
    await page.goto("/cms");

    await expectAxeClean(page, "EDITOR /cms", testInfo);

    if (spec.cms === "bar") {
      await openCmsDrawer(page);
      await expectAxeClean(page, "drawer CMS terbuka", testInfo);
    }

    // Card S1-01: the course list WITH a row (table + badge states) and the
    // empty builder. A tokenized title/slug keeps width projects sharing
    // the e2e database from colliding.
    const token = `a${Date.now().toString(36)}${testInfo.project.name}`;
    const response = await page.context().request.post("/api/cms/courses", {
      data: {
        title: `${token} kursus uji axe`,
        slug: `${token}-kursus-uji-axe`,
        level: "BEGINNER",
        summary: "Ringkasan netral untuk tes e2e.",
      },
    });
    expect(response.status(), await response.text()).toBe(201);
    const courseId = ((await response.json()) as { data: { id: string } }).data.id;

    await page.goto("/cms/kursus");
    // Scope to the title cell paragraph: the course title now also sits in
    // an sr-only span inside the row's "Buka" link (unique accessible
    // names), which a bare getByText would match twice.
    await expect(
      page.getByRole("paragraph").filter({ hasText: `${token} kursus uji axe` }),
    ).toBeVisible();
    await expectAxeClean(page, "EDITOR /cms/kursus berisi", testInfo);

    await page.goto(`/cms/kursus/${courseId}`);
    await expect(
      page.locator('section[aria-labelledby="builder-materi-heading"]')
        .getByText("Belum ada materi")
    ).toBeVisible();
    await expectAxeClean(page, "EDITOR /cms/kursus/{id} builder", testInfo);

    // Card S1-02: the builder with two lessons — one 80-char no-space
    // title — plus the open 21h dialog (A-19b additions).
    const filledToken = `a${Date.now().toString(36)}${testInfo.project.name}b`;
    const filledResponse = await page.context().request.post(
      "/api/cms/courses",
      {
        data: {
          title: `${filledToken} kursus uji axe berisi`,
          slug: `${filledToken}-kursus-uji-axe-berisi`,
          level: "BEGINNER",
          summary: "Ringkasan netral untuk tes e2e.",
        },
      },
    );
    expect(filledResponse.status(), await filledResponse.text()).toBe(201);
    const filledId = ((await filledResponse.json()) as { data: { id: string } })
      .data.id;
    let firstLessonId = "";
    for (const title of [
      `${filledToken}${"x".padEnd(80, "x")}`.slice(0, 80),
      `${filledToken} protein`,
    ]) {
      const lessonResponse = await page.context().request.post(
        `/api/cms/courses/${filledId}/lessons`,
        { data: { title } },
      );
      expect(lessonResponse.status(), await lessonResponse.text()).toBe(201);
      const lessonId = (
        (await lessonResponse.json()) as { data: { id: string } }
      ).data.id;
      if (firstLessonId === "") firstLessonId = lessonId;
    }

    await page.goto(`/cms/kursus/${filledId}`);
    await expect(page.getByText("2 materi · wajib berurutan")).toBeVisible();
    await expectAxeClean(page, "EDITOR builder dua materi", testInfo);

    await page.getByRole("button", { name: "+ Tambah materi" }).click();
    await expect(
      page.getByRole("dialog").getByLabel("Judul materi"),
    ).toBeVisible();
    await expectAxeClean(page, "EDITOR builder dialog tambah materi", testInfo);

    // Card S1-04: the two content-editing pages — the lesson editor and
    // the course description editor (same pattern as the builder above).
    await page.goto(`/cms/kursus/${filledId}/materi/${firstLessonId}`);
    await expect(
      page.getByRole("textbox", { name: "Teks materi" }),
    ).toBeVisible();
    await expectAxeClean(page, "EDITOR editor materi", testInfo);

    await page.goto(`/cms/kursus/${filledId}/deskripsi`);
    await expect(page.getByRole("textbox", { name: "Deskripsi" })).toBeVisible();
    await expectAxeClean(page, "EDITOR deskripsi kursus", testInfo);
  });

  test("EDITOR: editor quiz + dialog sunting soal (S1-09)", async (
    { page, request },
    testInfo,
  ) => {
    // Card S1-09 §6: the quiz editor page (FINAL quiz with two questions,
    // so both marker shapes render) and the EDIT dialog of soal 1 — it has
    // a key, so the "Kunci" row rides along (a brand-new dialog has no key
    // row). A question POST needs the page's signed-in context.
    const editor = await createRoleAccount(request, "EDITOR");
    await signInViaApi(page.context(), editor);
    const token = `q${Date.now().toString(36)}${testInfo.project.name}`;
    const created = await page.context().request.post("/api/cms/courses", {
      data: {
        title: `${token} kursus uji axe quiz`,
        slug: `${token}-kursus-uji-axe-quiz`,
        level: "BEGINNER",
        summary: "Ringkasan netral untuk tes e2e.",
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const courseId = ((await created.json()) as { data: { id: string } }).data
      .id;

    // The FINAL quiz id is not part of the course answer — E2E database.
    const rows = await withE2eDb(
      (sql) => sql`select final_quiz_id as id from courses where id = ${courseId}`,
    );
    const quizId = rows[0]?.id as string;
    expect(quizId, "kursus punya quiz FINAL").toBeTruthy();

    for (const [index, type] of ["SINGLE_CHOICE", "TRUE_FALSE"].entries()) {
      const options =
        type === "SINGLE_CHOICE"
          ? [
              { text: "Opsi satu", isCorrect: false },
              { text: "Opsi dua", isCorrect: true },
              { text: "Opsi tiga", isCorrect: false },
              { text: "Opsi empat", isCorrect: false },
            ]
          : [
              { text: "Benar", isCorrect: true },
              { text: "Salah", isCorrect: false },
            ];
      const question = await page.context().request.post(
        `/api/cms/quizzes/${quizId}/questions`,
        {
          data: {
            type,
            text: `Pertanyaan axe ke ${index + 1} untuk tes e2e.`,
            explanation: "Pembahasan axe untuk tes e2e.",
            options,
          },
        },
      );
      expect(question.status(), await question.text()).toBe(201);
    }

    await page.goto(`/cms/quiz/${quizId}`);
    await expect(page.getByText("2 dari 20 soal")).toBeVisible();
    await expectAxeClean(page, "EDITOR editor quiz", testInfo);

    await page.getByRole("button", { name: "Sunting soal 01" }).click();
    await expect(
      page.getByRole("dialog").getByText("Soal 01 dari 2"),
    ).toBeVisible();
    await expectAxeClean(page, "EDITOR dialog sunting soal", testInfo);
  });

  test("tamu: menu ponsel terbuka (w360 saja)", async ({ page }, testInfo) => {
    const spec = widthSpecOf(testInfo.project.name);
    test.skip(!spec.header.bukaMenu, "state terbuka hanya di w360");
    await page.goto("/");
    await openGuestMenu(page);
    await expectAxeClean(page, "menu ponsel terbuka", testInfo);
  });

  // Card S2-01 §8: the lesson page's three states — open (at w360 with
  // the <details> outline OPEN), locked, and not-enrolled — scanned with
  // this test's OWN courses (shared database). The locked panel's h1→h3
  // heading skip lands as a KNOWN moderate (same deviation family as
  // S5-01 state C; owner decision 11 Nov — empty-state.tsx stays as is).
  test("MEMBER: halaman materi open/locked/not-enrolled (S2-01)", async (
    { page, request },
    testInfo,
  ) => {
    const spec = widthSpecOf(testInfo.project.name);
    const account = await createRoleAccount(request, "MEMBER");
    await signInViaApi(page.context(), account);

    const token = `axm${Date.now().toString(36)}${testInfo.project.name}`;
    const made = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      `${token} kursus materi axe`,
      { lessons: 2 },
    );
    const other = await createPublishedCourseViaApi(
      editorContext,
      adminContext,
      `${token} kursus lain axe`,
    );

    // not-enrolled (course `other` — this member never enrolls into it).
    await page.goto(`/belajar/${other.courseSlug}/${other.lessons[0]!.slug}`);
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Anda belum mengikuti kursus ini",
      }),
    ).toBeVisible();
    await expectAxeClean(page, "materi not-enrolled", testInfo);

    const enroll = await page.context().request.post(
      `/api/progress/courses/${made.courseId}/enroll`,
    );
    expect(enroll.status(), await enroll.text()).toBe(201);

    // open (materi 1) — on the phone layout the outline <details> opens
    // before the scan so the nav rows ride along.
    await page.goto(`/belajar/${made.courseSlug}/${made.lessons[0]!.slug}`);
    await expect(
      page.getByText(
        `Isi materi netral ${token} kursus materi axe materi 1 untuk tes e2e.`,
      ),
    ).toBeVisible();
    if (spec.bottomNav) {
      await page.locator("details").locator("summary").click();
      await expect(page.locator("details")).toHaveAttribute("open");
    }
    await expectAxeClean(page, "materi open", testInfo);

    // locked (materi 2 before any quiz attempt).
    await page.goto(`/belajar/${made.courseSlug}/${made.lessons[1]!.slug}`);
    await expect(
      page.getByRole("heading", { level: 3, name: "Materi ini belum terbuka" }),
    ).toBeVisible();
    await expectAxeClean(page, "materi locked", testInfo);
  });

  // Card S1-08 §8: both submit dialogs (complete + 3-pending checklist),
  // the publish dialog, the ADMIN queue (with a row — never count-
  // asserted, shared e2e database), and the fresh-EDITOR empty queue +
  // "Perlu revisi" variant.
  test("kirim & terbitkan: dialog kirim/terbitkan + /cms/konten (S1-08)", async (
    { page, request },
    testInfo,
  ) => {
    const editor = await createRoleAccount(request, "EDITOR");
    const freshEditor = await createRoleAccount(request, "EDITOR");
    const admin = await createRoleAccount(request, "ADMIN");
    await signInViaApi(page.context(), editor);
    const token = `p${Date.now().toString(36)}${testInfo.project.name}`;
    const complete = await createPublishableCourseViaApi(
      page.context(),
      `${token} kursus axe lengkap`,
    );
    const bareId = await createCourseViaApi(page.context(), {
      title: `${token} kursus axe polos`,
    });

    await page.goto(`/cms/kursus/${complete.courseId}`);
    await page.getByRole("button", { name: "Kirim untuk persetujuan" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Semua syarat terpenuhi")).toBeVisible();
    await expectAxeClean(page, "dialog kirim lengkap", testInfo);
    await dialog.getByRole("button", { name: "Kembali menyunting" }).click();
    await expect(dialog).toHaveCount(0);

    await page.goto(`/cms/kursus/${bareId}`);
    await page.getByRole("button", { name: "Kirim untuk persetujuan" }).click();
    await expect(dialog.getByText("3 hal belum lengkap")).toBeVisible();
    await expectAxeClean(page, "dialog kirim belum lengkap", testInfo);
    await dialog.getByRole("button", { name: "Kembali menyunting" }).click();

    // The publish side needs an IN_REVIEW course: submit as the EDITOR,
    // then hand the same context to the ADMIN.
    const submitted = await page.context().request.post(
      `/api/cms/courses/${complete.courseId}/submit`,
    );
    expect(submitted.status(), await submitted.text()).toBe(200);
    await signInViaApi(page.context(), admin);

    await page.goto("/cms/konten");
    await expect(
      page.getByRole("link", { name: `${token} kursus axe lengkap` }),
    ).toBeVisible();
    await expectAxeClean(page, "ADMIN /cms/konten berisi", testInfo);

    await page.goto(`/cms/kursus/${complete.courseId}`);
    await page.getByRole("button", { name: "Setujui & terbitkan" }).click();
    await expect(dialog.getByText("Terbitkan kursus ini?")).toBeVisible();
    await expectAxeClean(page, "dialog terbitkan", testInfo);
    await dialog.getByRole("button", { name: "Batal" }).click();
    await expect(dialog).toHaveCount(0);

    await signInViaApi(page.context(), freshEditor);
    await page.goto("/cms/konten");
    await expect(
      page.getByText("Tidak ada kursus yang menunggu persetujuan."),
    ).toBeVisible();
    await expectAxeClean(page, "EDITOR baru /cms/konten kosong", testInfo);

    await page.goto("/cms/konten?status=perlu-revisi");
    await expect(
      page.getByText("Belum ada konten yang perlu direvisi."),
    ).toBeVisible();
    await expectAxeClean(page, "EDITOR perlu revisi", testInfo);
  });
});
