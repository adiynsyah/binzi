// The S1-08 submit & publish flow: the builder's "Kirim untuk
// persetujuan" / "Setujui & terbitkan" dialogs and their status banners,
// the /cms/konten approval queue from both sides (EDITOR sidebar "Menunggu
// persetujuan", ADMIN "Persetujuan"), the API guards (role 403s, status
// 409s, non-UUID 404), the 409-from-another-tab repairs for Simpan and
// "Tambah materi" (STATUS 4 Nov), and the width checks (§8: builder at
// 360 and 1024 with an 80-char no-space title, /cms/konten at 360).
//
// Uniqueness rule: every course title carries a random token (shared e2e
// database). The ADMIN queue always carries rows left by other tests
// (card §8) — never assert row counts, the "{n} menunggu" pill, or the
// empty state for ADMIN; only the presence of THIS test's tokened row.
// The empty state is covered by a fresh EDITOR and component tests.
import type { BrowserContext, Locator, Page } from "@playwright/test";

import {
  createRoleAccount,
  expect,
  signInViaApi,
  test,
  withE2eDb,
} from "./fixtures";
import {
  createCourseViaApi,
  createPublishableCourseViaApi,
  expectNoHorizontalScroll,
  maybeScreenshot,
  noSpaceTitle,
  randomToken,
} from "./layout/helpers";

// ---------------------------------------------------------------- helpers

/** POSTs /submit with the signed-in context's cookies; expects 200. */
async function submitCourseViaApi(
  context: BrowserContext,
  courseId: string,
): Promise<void> {
  const response = await context.request.post(
    `/api/cms/courses/${courseId}/submit`,
  );
  expect(response.status(), await response.text()).toBe(200);
}

/**
 * The builder status badge next to the h1 — scoped to the heading row
 * because the sidebar labels share the badge texts ("Menunggu
 * persetujuan", …).
 */
function builderBadge(page: Page, title: string, badge: string): Locator {
  return page
    .getByRole("heading", { name: title })
    .locator("..")
    .getByText(badge, { exact: true });
}

/** The builder status banner (success banners are role="status"). */
function statusBanner(page: Page, text: string): Locator {
  return page.getByRole("status").filter({ hasText: text });
}

/** The builder status banner on error (role="alert"). */
function alertBanner(page: Page, text: string): Locator {
  return page.getByRole("alert").filter({ hasText: text });
}

// ------------------------------------------------------------------- tests

test("1. EDITOR kirim kursus lengkap → IN_REVIEW: banner, badge, tombol hilang, fokus h1", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("k1");
  const title = `${t} Kursus Kirim Utama`;
  const created = await createPublishableCourseViaApi(page.context(), title);

  await page.goto(`/cms/kursus/${created.courseId}`);
  await expect(builderBadge(page, title, "Draf")).toBeVisible();
  await page.getByRole("button", { name: "Kirim untuk persetujuan" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Semua syarat terpenuhi")).toBeVisible();
  await dialog.getByRole("button", { name: "Kirim", exact: true }).click();

  // The success banner auto-dismisses after 4s — assert it fully in view
  // at BOTH widths first (card "Selesai jika" no. 1), then the rest.
  const banner = statusBanner(
    page,
    "Kursus terkirim — menunggu persetujuan admin.",
  );
  await expect(banner).toBeInViewport({ ratio: 1 });
  await page.setViewportSize({ width: 360, height: 740 });
  await expect(banner).toBeInViewport({ ratio: 1 });

  await expect(builderBadge(page, title, "Menunggu persetujuan")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Simpan", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Kirim untuk persetujuan" }),
  ).toHaveCount(0);
  // The opener button is gone with the refresh — focus falls back to h1.
  await expect(page.getByRole("heading", { name: title })).toBeFocused();
});

test("2. EDITOR → sidebar Menunggu persetujuan → antrean memuat kursus + nama pengirim", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR", {
    name: "Editor Pengirim Antre",
  });
  await signInViaApi(page.context(), editor);
  const t = randomToken("k2");
  const title = `${t} Kursus Antrean Editor`;
  const created = await createPublishableCourseViaApi(page.context(), title);
  await submitCourseViaApi(page.context(), created.courseId);

  await page.goto("/cms");
  await page.getByRole("link", { name: "Menunggu persetujuan" }).click();

  await expect(page).toHaveURL(/\/cms\/konten\?status=menunggu$/);
  await expect(
    page.getByRole("heading", { name: "Menunggu persetujuan" }),
  ).toBeVisible();
  // Only THIS test's row is asserted (shared e2e database, card §8).
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await expect(
    page.getByText(/^KURSUS · Editor Pengirim Antre · \d+ .+ WIB$/),
  ).toBeVisible();
});

test("3. ADMIN → Persetujuan → klik kursus → Setujui & terbitkan → PUBLISHED + audit", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR", {
    name: "Editor Pengirim Terbit",
  });
  const admin = await createRoleAccount(request, "ADMIN");
  await signInViaApi(page.context(), editor);
  const t = randomToken("k3");
  const title = `${t} Kursus Terbit Admin`;
  const created = await createPublishableCourseViaApi(page.context(), title);
  await submitCourseViaApi(page.context(), created.courseId);

  await signInViaApi(page.context(), admin);
  await page.goto("/cms");
  await page.getByRole("link", { name: "Persetujuan" }).click();
  await expect(
    page.getByRole("heading", { name: "Persetujuan" }),
  ).toBeVisible();
  await page.getByRole("link", { name: title }).click();
  await expect(page).toHaveURL(new RegExp(`/cms/kursus/${created.courseId}$`));

  // Read-only builder with the single admin action (no Simpan, no add).
  await expect(
    page.getByRole("button", { name: "Setujui & terbitkan" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Simpan", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "+ Tambah materi" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Setujui & terbitkan" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Terbitkan kursus ini?")).toBeVisible();
  await expect(
    dialog.getByText("Penggarap tercatat: Editor Pengirim Terbit"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Setujui & terbitkan" }).click();

  // ratio 1 like tests 1 and 7: in every width the whole banner must sit
  // next to the h1 that receives focus.
  await expect(statusBanner(page, "Kursus terbit.")).toBeInViewport({
    ratio: 1,
  });
  await expect(builderBadge(page, title, "Terbit")).toBeVisible();

  // DB: published + timestamped, reviewer = the submitting EDITOR, and
  // both audit rows for the course (card "Selesai jika" no. 3).
  const editorRows = await withE2eDb(
    (sql) => sql`select id from users where email = ${editor.email}`,
  );
  const courseRows = await withE2eDb(
    (sql) => sql`select status, published_at, reviewer_id
      from courses where id = ${created.courseId}`,
  );
  expect(courseRows[0]?.status).toBe("PUBLISHED");
  expect(courseRows[0]?.published_at).toBeTruthy();
  expect(courseRows[0]?.reviewer_id).toBe(editorRows[0]?.id);
  const audits = await withE2eDb(
    (sql) => sql`select action from audit_logs
      where entity_id = ${created.courseId}
        and action in ('course.submit', 'course.publish')
      order by created_at`,
  );
  expect(audits.map((row) => row.action)).toEqual([
    "course.submit",
    "course.publish",
  ]);

  // Tambahan 6: ADMIN on ?status=perlu-revisi still gets the "Persetujuan"
  // queue (the page branches on the active nav item, not the status param —
  // "perlu-revisi" is an EDITOR-only item), so the revisi empty state must
  // not render here.
  await page.goto("/cms/konten?status=perlu-revisi");
  await expect(
    page.getByRole("heading", { name: "Persetujuan", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Belum ada konten yang perlu direvisi."),
  ).toHaveCount(0);
});

test("4. kursus belum lengkap → dialog daftar kekurangan; Kirim tidak mengirim request", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("k4");
  const title = `${t} Kursus Belum Lengkap`;
  const courseId = await createCourseViaApi(page.context(), { title });

  const submitUrls: string[] = [];
  page.on("request", (incoming) => {
    const url = new URL(incoming.url());
    if (incoming.method() === "POST" && url.pathname.endsWith("/submit")) {
      submitUrls.push(incoming.url());
    }
  });

  await page.goto(`/cms/kursus/${courseId}`);
  await page.getByRole("button", { name: "Kirim untuk persetujuan" }).click();
  const dialog = page.getByRole("dialog");
  // Fresh course: description, lesson material, and FINAL quiz questions.
  await expect(dialog.getByText("3 hal belum lengkap")).toBeVisible();
  await expect(dialog.getByText("Deskripsi lengkap")).toBeVisible();
  await expect(
    dialog.getByText("Semua materi lengkap (teks + quiz)"),
  ).toBeVisible();
  await expect(dialog.getByText("Final Quiz ≥ 10 soal")).toBeVisible();

  const kirim = dialog.getByRole("button", { name: "Kirim", exact: true });
  await expect(kirim).toHaveAttribute("aria-disabled", "true");
  // The locked button carries pointer-events-none — a real pointer click
  // can never reach it. A DOM .click() bypasses the hit test and still
  // dispatches the submit, proving the HANDLER guard (not just the CSS)
  // keeps the request from firing.
  await kirim.evaluate((button) => (button as HTMLElement).click());
  // Fixed pause, not waitFor (Nov 4 lesson): a waitFor could pass before a
  // stray request even started — only a still-quiet buffer proves none
  // fired.
  await page.waitForTimeout(500);
  expect(submitUrls).toEqual([]);
  await expect(dialog.getByText("3 hal belum lengkap")).toBeVisible();
});

test("5. judul diubah tanpa Simpan → baris belum-disimpan; Kirim terkunci", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("k5");
  const title = `${t} Kursus Belum Simpan`;
  const created = await createPublishableCourseViaApi(page.context(), title);

  await page.goto(`/cms/kursus/${created.courseId}`);
  await page
    .getByLabel("Judul kursus", { exact: true })
    .fill(`${title} diubah`);
  await page.getByRole("button", { name: "Kirim untuk persetujuan" }).click();

  const dialog = page.getByRole("dialog");
  // The checklist itself is complete — the unsaved settings are the ONE
  // pending item.
  await expect(dialog.getByText("Satu hal belum lengkap")).toBeVisible();
  await expect(
    dialog.getByText(
      "Pengaturan kursus belum disimpan — simpan dulu, lalu kirim.",
    ),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Kirim", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
});

test("6. API: lapis peran 403, status 409, id bukan UUID 404", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  const admin = await createRoleAccount(request, "ADMIN");
  const member = await createRoleAccount(request, "MEMBER");
  await signInViaApi(page.context(), editor);
  const t = randomToken("k6");
  const draft = await createPublishableCourseViaApi(
    page.context(),
    `${t} API Draf`,
  );
  const review = await createPublishableCourseViaApi(
    page.context(),
    `${t} API Antre`,
  );
  const base = `/api/cms/courses`;

  // EDITOR: submit once, then the second submit conflicts.
  await submitCourseViaApi(page.context(), review.courseId);
  const second = await page
    .context()
    .request.post(`${base}/${review.courseId}/submit`);
  expect(second.status(), await second.text()).toBe(409);
  expect(await second.text()).toContain("hanya draf yang bisa dikirim");
  // EDITOR cannot publish (role check, whatever the status).
  const editorPublish = await page
    .context()
    .request.post(`${base}/${review.courseId}/publish`);
  expect(editorPublish.status(), await editorPublish.text()).toBe(403);

  // ADMIN cannot submit; publishing a DRAFT course conflicts.
  await signInViaApi(page.context(), admin);
  const adminSubmit = await page
    .context()
    .request.post(`${base}/${review.courseId}/submit`);
  expect(adminSubmit.status(), await adminSubmit.text()).toBe(403);
  const publishDraft = await page
    .context()
    .request.post(`${base}/${draft.courseId}/publish`);
  expect(publishDraft.status(), await publishDraft.text()).toBe(409);
  expect(await publishDraft.text()).toContain(
    "Kursus tidak sedang menunggu persetujuan.",
  );
  // Non-UUID ids never reach the database.
  for (const action of ["submit", "publish"]) {
    const notFound = await page
      .context()
      .request.post(`${base}/bukan-uuid/${action}`);
    expect(notFound.status(), `POST /${action} non-UUID`).toBe(404);
  }

  // MEMBER is rejected on both, before anything else.
  await signInViaApi(page.context(), member);
  for (const action of ["submit", "publish"]) {
    const forbidden = await page
      .context()
      .request.post(`${base}/${review.courseId}/${action}`);
    expect(forbidden.status(), `MEMBER POST /${action}`).toBe(403);
  }
});

test("7. 409 dari tab lain: Simpan dan Tambah materi setelah kursus dikirim di tab B", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("k7");
  const courseA = await createPublishableCourseViaApi(
    page.context(),
    `${t} Kursus Tab Simpan`,
  );
  const courseB = await createPublishableCourseViaApi(
    page.context(),
    `${t} Kursus Tab Materi`,
  );
  const tabB = await page.context().newPage();

  // --- Simpan: tab A edits the title, tab B submits, tab A saves → the
  // 409 lands in the STATUS banner and focus falls back to h1 (Simpan is
  // gone with the refresh).
  await page.goto(`/cms/kursus/${courseA.courseId}`);
  await page
    .getByLabel("Judul kursus", { exact: true })
    .fill(`${t} judul diubah tab A`);
  await tabB.goto(`/cms/kursus/${courseA.courseId}`);
  await tabB.getByRole("button", { name: "Kirim untuk persetujuan" }).click();
  await tabB
    .getByRole("dialog")
    .getByRole("button", { name: "Kirim", exact: true })
    .click();
  await expect(
    statusBanner(tabB, "Kursus terkirim — menunggu persetujuan admin."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(
    alertBanner(page, "Kursus sudah bukan draf — hanya draf yang bisa diubah."),
  ).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole("button", { name: "Simpan", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: `${t} Kursus Tab Simpan` }),
  ).toBeFocused();

  // --- Tambah materi: tab A's dialog POSTs after tab B submitted → the
  // dialog closes into the status banner, NO navigation to the editor.
  await page.goto(`/cms/kursus/${courseB.courseId}`);
  await page.getByRole("button", { name: "+ Tambah materi" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Judul materi", { exact: true })
    .fill(`${t} Materi Tab`);
  await tabB.goto(`/cms/kursus/${courseB.courseId}`);
  await tabB.getByRole("button", { name: "Kirim untuk persetujuan" }).click();
  await tabB
    .getByRole("dialog")
    .getByRole("button", { name: "Kirim", exact: true })
    .click();
  await expect(
    statusBanner(tabB, "Kursus terkirim — menunggu persetujuan admin."),
  ).toBeVisible();

  await dialog.getByRole("button", { name: "Buat & buka editor →" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    alertBanner(page, "Kursus sudah bukan draf — hanya draf yang bisa diubah."),
  ).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole("heading", { name: `${t} Kursus Tab Materi` }),
  ).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/cms/kursus/${courseB.courseId}$`));

  await tabB.close();
});

test("8. lebar: tanpa gulir samping — builder 360/1024 (80 karakter), /cms/konten ADMIN 360", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  const admin = await createRoleAccount(request, "ADMIN");
  await signInViaApi(page.context(), editor);
  const t = randomToken("k8");
  // DRAFT builder probe: exactly 80 no-space chars — the heading row now
  // holds TWO buttons (Simpan + Kirim untuk persetujuan).
  const draftTitle = noSpaceTitle(`${t}d`);
  const draftId = await createCourseViaApi(page.context(), {
    title: draftTitle,
  });
  // Queue probe: a 60-char no-space title (the helper appends " materi 1"
  // to the lesson title, capped at 80 — LESSON_TITLE_MAX).
  const queueTitle = noSpaceTitle(`${t}q`).slice(0, 60);
  const queued = await createPublishableCourseViaApi(
    page.context(),
    queueTitle,
  );
  await submitCourseViaApi(page.context(), queued.courseId);

  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(`/cms/kursus/${draftId}`);
  await expect(page.getByRole("heading", { name: draftTitle })).toBeVisible();
  await expectNoHorizontalScroll(page, "builder DRAFT (80 karakter) @w360");

  await signInViaApi(page.context(), admin);
  await page.goto("/cms/konten");
  await expect(page.getByRole("link", { name: queueTitle })).toBeVisible();
  await expectNoHorizontalScroll(page, "/cms/konten ADMIN @w360");

  // 1024 is the builder's lg: two-column start — not a width project
  // (Nov 4 lesson), measured here.
  await signInViaApi(page.context(), editor);
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto(`/cms/kursus/${draftId}`);
  await expect(page.getByRole("heading", { name: draftTitle })).toBeVisible();
  await expectNoHorizontalScroll(page, "builder DRAFT (80 karakter) @w1024");
});

// Owner review (card "Sebelum membuka PR"): every new state at w1280 and
// w360, plus the DRAFT builder at w1024. Saved only when
// E2E_SCREENSHOT_DIR is set (maybeScreenshot). The success banners
// self-dismiss after 4s — each is captured the moment it is visible.
test("screenshot builder, dialog kirim/terbitkan, banner, /cms/konten (w1280/w360; builder w1024)", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR", {
    name: "Editor Tangkapan",
  });
  const freshEditor = await createRoleAccount(request, "EDITOR");
  const admin = await createRoleAccount(request, "ADMIN");
  await signInViaApi(page.context(), editor);
  const t = randomToken("sc");
  const incompleteTitle = `${t} Kursus Polos Screenshot`;
  const incompleteId = await createCourseViaApi(page.context(), {
    title: incompleteTitle,
  });

  for (const [index, viewport] of [
    { label: "w1280", width: 1280, height: 800 },
    { label: "w360", width: 360, height: 740 },
  ].entries()) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await signInViaApi(page.context(), editor);
    const title = `${t} Kursus Lengkap Screenshot ${index + 1}`;
    const created = await createPublishableCourseViaApi(page.context(), title);

    // Builder DRAFT with BOTH buttons.
    await page.goto(`/cms/kursus/${created.courseId}`);
    await expect(
      page.getByRole("button", { name: "Kirim untuk persetujuan" }),
    ).toBeVisible();
    await maybeScreenshot(page, "s1-08-builder-draf", viewport.label);

    // Dialog kirim: complete…
    await page.getByRole("button", { name: "Kirim untuk persetujuan" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Semua syarat terpenuhi")).toBeVisible();
    await maybeScreenshot(page, "s1-08-dialog-kirim-lengkap", viewport.label);
    await dialog.getByRole("button", { name: "Kembali menyunting" }).click();
    await expect(dialog).toHaveCount(0);

    // …unsaved settings…
    await page
      .getByLabel("Judul kursus", { exact: true })
      .fill(`${title} diubah`);
    await page.getByRole("button", { name: "Kirim untuk persetujuan" }).click();
    await expect(dialog.getByText("Satu hal belum lengkap")).toBeVisible();
    await maybeScreenshot(
      page,
      "s1-08-dialog-kirim-belum-disimpan",
      viewport.label,
    );
    await dialog.getByRole("button", { name: "Kembali menyunting" }).click();
    await expect(dialog).toHaveCount(0);

    // …and the incomplete course's checklist.
    await page.goto(`/cms/kursus/${incompleteId}`);
    await page.getByRole("button", { name: "Kirim untuk persetujuan" }).click();
    await expect(dialog.getByText("3 hal belum lengkap")).toBeVisible();
    await maybeScreenshot(
      page,
      "s1-08-dialog-kirim-belum-lengkap",
      viewport.label,
    );
    await dialog.getByRole("button", { name: "Kembali menyunting" }).click();

    // Submit → the success banner (captured immediately).
    await page.goto(`/cms/kursus/${created.courseId}`);
    await page.getByRole("button", { name: "Kirim untuk persetujuan" }).click();
    await dialog.getByRole("button", { name: "Kirim", exact: true }).click();
    const banner = statusBanner(
      page,
      "Kursus terkirim — menunggu persetujuan admin.",
    );
    await expect(banner).toBeVisible();
    await maybeScreenshot(page, "s1-08-banner-kirim-sukses", viewport.label);

    // EDITOR queue with the one fresh row.
    await page.goto("/cms/konten");
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await maybeScreenshot(page, "s1-08-konten-editor-satu", viewport.label);

    // ADMIN: the IN_REVIEW builder, the publish dialog, "Kursus terbit.",
    // and the admin queue (other tests' rows are expected there).
    await signInViaApi(page.context(), admin);
    await page.goto(`/cms/kursus/${created.courseId}`);
    await expect(
      page.getByRole("button", { name: "Setujui & terbitkan" }),
    ).toBeVisible();
    await maybeScreenshot(
      page,
      "s1-08-builder-in-review-admin",
      viewport.label,
    );
    await page.getByRole("button", { name: "Setujui & terbitkan" }).click();
    await expect(dialog.getByText("Terbitkan kursus ini?")).toBeVisible();
    await expect(
      dialog.getByText("Penggarap tercatat: Editor Tangkapan"),
    ).toBeVisible();
    await maybeScreenshot(page, "s1-08-dialog-terbitkan", viewport.label);
    await dialog.getByRole("button", { name: "Setujui & terbitkan" }).click();
    await expect(statusBanner(page, "Kursus terbit.")).toBeVisible();
    await maybeScreenshot(page, "s1-08-banner-terbit", viewport.label);
    await page.goto("/cms/konten");
    // exact: in an isolated run the queue can be empty (this test's own
    // course was just published; other rows only exist in a full run), and
    // the empty-state h3 "Tidak ada kursus yang menunggu persetujuan."
    // would otherwise substring-match into a strict-mode violation.
    await expect(
      page.getByRole("heading", { name: "Persetujuan", exact: true }),
    ).toBeVisible();
    await maybeScreenshot(page, "s1-08-konten-admin", viewport.label);

    // A fresh EDITOR: the empty queue and the "Perlu revisi" variant.
    await signInViaApi(page.context(), freshEditor);
    await page.goto("/cms/konten");
    await expect(
      page.getByText("Tidak ada kursus yang menunggu persetujuan."),
    ).toBeVisible();
    await maybeScreenshot(page, "s1-08-konten-editor-kosong", viewport.label);
    await page.goto("/cms/konten?status=perlu-revisi");
    await expect(
      page.getByText("Belum ada konten yang perlu direvisi."),
    ).toBeVisible();
    await maybeScreenshot(page, "s1-08-konten-perlu-revisi", viewport.label);
  }

  // w1024: the DRAFT builder at the lg: two-column start (the incomplete
  // course still carries both buttons).
  await signInViaApi(page.context(), editor);
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto(`/cms/kursus/${incompleteId}`);
  await expect(
    page.getByRole("button", { name: "Kirim untuk persetujuan" }),
  ).toBeVisible();
  await maybeScreenshot(page, "s1-08-builder-draf", "w1024");
});
