// The S1-04 content editors: /cms/kursus/{id}/materi/{lessonId} (PATCH
// content) and /cms/kursus/{id}/deskripsi (PUT description). Covers the
// card "Selesai jika" E2E list: the builder → editor → save → reload →
// marker cycle, the description row + checklist, the unsaved-changes
// dialog, the API guards (iframe 400 with the prefixed path, 2 MB → 413,
// MEMBER 403 BEFORE the body is read), the non-DRAFT locked pages, the
// w360 no-horizontal-scroll check, and the owner-review screenshots
// (w1280/w768: BELUM DISIMPAN, TERSIMPAN, failure bar, guard dialog).
//
// Uniqueness rule: same as cms-materi-builder.spec.ts — every course
// title carries a random token so tests sharing the e2e database never
// cross-fire.
import { createRoleAccount, expect, signInViaApi, test, withE2eDb } from "./fixtures";
import {
  createCourseViaApi,
  createLessonViaApi,
  expectNoHorizontalScroll,
  maybeScreenshot,
  randomToken,
} from "./layout/helpers";
import { CONTENT_DOC_MESSAGES } from "../src/lib/content-doc-validator";

/** A minimal valid document around `text` (one paragraph). */
function paragraphDoc(text: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

/** The iframe body the validator must reject (V-08) — path is relative
 *  to the body key, so the API answer prefixes it. */
const IFRAME_DOC = { type: "doc", content: [{ type: "iframe" }] };

/** > MAX_CONTENT_BODY_BYTES (1 MiB) even after JSON escaping. */
const TWO_MIB_TEXT = "x".repeat(2 * 1024 * 1024);

const LESSON_TEXT = "Paragraf pertama isi materi untuk tes e2e.";
const DESCRIPTION_TEXT = "Kursus ini untuk calon ibu baru.";

test("EDITOR: builder → editor materi → simpan → reload bertahan, penanda kosong hilang", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("ed");
  const courseTitle = `${t} Kursus Editor Materi`;
  const lessonTitle = `${t} Energi dan Porsi`;
  const courseId = await createCourseViaApi(page.context(), {
    title: courseTitle,
  });
  const lessonId = await createLessonViaApi(
    page.context(),
    courseId,
    lessonTitle,
  );

  // Fresh lesson in the builder: the text marker is still lit (21a).
  await page.goto(`/cms/kursus/${courseId}`);
  await expect(
    page.getByText("BELUM ADA VIDEO · TEKS BELUM DIISI · QUIZ BELUM DIBUAT"),
  ).toBeVisible();

  // Card step 1: builder → click the lesson ("Sunting {title}") → the
  // editor opens with breadcrumb and heading.
  await page.getByRole("link", { name: `Sunting ${lessonTitle}` }).click();
  await expect(page.getByRole("heading", { name: lessonTitle })).toBeVisible();
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb).toContainText("Kursus");
  await expect(breadcrumb).toContainText(courseTitle);
  await expect(breadcrumb).toContainText("Materi 1");

  // Step 2: type in the labelled canvas → BELUM DISIMPAN → Simpan →
  // "TERSIMPAN".
  const canvas = page.getByRole("textbox", { name: "Teks materi" });
  await canvas.fill(LESSON_TEXT);
  await expect(page.getByText("BELUM DISIMPAN")).toBeVisible();
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("TERSIMPAN")).toBeVisible();
  await expect(page.getByText("BELUM DISIMPAN")).toHaveCount(0);

  // Step 3: reload → the text survived the server round-trip.
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Teks materi" }),
  ).toContainText(LESSON_TEXT);

  // Step 4: breadcrumb (clean now) → builder → the empty-text marker is
  // gone; only video and quiz shortages remain.
  await page.getByRole("link", { name: courseTitle }).click();
  await expect(
    page.getByRole("heading", { name: courseTitle }),
  ).toBeVisible();
  await expect(page.getByText("TEKS BELUM DIISI")).toHaveCount(0);
  await expect(
    page.getByText("BELUM ADA VIDEO · QUIZ BELUM DIBUAT"),
  ).toBeVisible();
  expect(lessonId).toBeTruthy();
});

test("deskripsi: + Tulis deskripsi lengkap → simpan → Sudah diisi · Ubah, syarat terpenuhi", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("dk");
  const courseTitle = `${t} Kursus Deskripsi`;
  const courseId = await createCourseViaApi(page.context(), {
    title: courseTitle,
  });

  await page.goto(`/cms/kursus/${courseId}`);
  // The empty state offers the entry point (card §6 table).
  await expect(page.getByText("Deskripsi kursus belum diisi")).toBeVisible();
  await page.getByRole("link", { name: "+ Tulis deskripsi lengkap" }).click();

  await expect(
    page.getByRole("heading", { name: "Deskripsi lengkap" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Tampil di halaman kursus, di bawah ringkasan. Ceritakan untuk siapa kursus ini dan apa yang akan dipelajari.",
    ),
  ).toBeVisible();

  const canvas = page.getByRole("textbox", { name: "Deskripsi" });
  await canvas.fill(DESCRIPTION_TEXT);
  await expect(page.getByText("BELUM DISIMPAN")).toBeVisible();
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("TERSIMPAN")).toBeVisible();

  // Back to the builder (breadcrumb is clean after the save): the row
  // reads "Sudah diisi · Ubah" and checklist item 4 is met.
  await page.getByRole("link", { name: courseTitle }).click();
  await expect(
    page.getByRole("heading", { name: courseTitle }),
  ).toBeVisible();
  await expect(page.getByText("Sudah diisi ·")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ubah" })).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Deskripsi lengkap" }),
  ).toContainText("terpenuhi");
  await expect(page.getByText("Deskripsi kursus belum diisi")).toHaveCount(0);
});

test("penjaga: ketik tanpa simpan → breadcrumb → dialog → Tetap di sini → teks tetap ada", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("gr");
  const courseId = await createCourseViaApi(page.context(), {
    title: `${t} Kursus Penjaga`,
  });
  const lessonId = await createLessonViaApi(
    page.context(),
    courseId,
    `${t} Materi Penjaga`,
  );

  await page.goto(`/cms/kursus/${courseId}/materi/${lessonId}`);
  const canvas = page.getByRole("textbox", { name: "Teks materi" });
  await canvas.fill(LESSON_TEXT);
  await expect(page.getByText("BELUM DISIMPAN")).toBeVisible();

  // The breadcrumb link opens the A-06 dialog instead of navigating.
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: `${t} Kursus Penjaga` })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Tinggalkan tanpa menyimpan?");
  await expect(dialog).toContainText(
    "Perubahan sejak simpan terakhir akan hilang.",
  );

  await dialog.getByRole("button", { name: "Tetap di sini" }).click();
  await expect(dialog).toHaveCount(0);
  // Still on the editor page with the unsaved text intact.
  await expect(canvas).toContainText(LESSON_TEXT);
});

test("API: iframe → 400 path terprefiks body key; body 2 MB → 413 (materi & deskripsi)", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("ap");
  const courseId = await createCourseViaApi(page.context(), {
    title: `${t} Kursus API`,
  });
  const lessonId = await createLessonViaApi(
    page.context(),
    courseId,
    `${t} Materi API`,
  );
  const lessonUrl = `/api/cms/courses/${courseId}/lessons/${lessonId}`;
  const descriptionUrl = `/api/cms/courses/${courseId}/description`;

  // V-08 through the real endpoint: toErrorResponse sends { path,
  // message } per field; the Zod prefix (body key) shows in the path.
  const iframeLesson = await page.context().request.patch(lessonUrl, {
    data: { content: IFRAME_DOC },
  });
  expect(iframeLesson.status(), await iframeLesson.text()).toBe(400);
  const lessonBody = (await iframeLesson.json()) as {
    error: { fields: { path: string; message: string }[] };
  };
  expect(lessonBody.error.fields[0]?.path).toBe("content.content.0.type");
  expect(lessonBody.error.fields[0]?.message).toBe(
    CONTENT_DOC_MESSAGES.FORBIDDEN_EMBED,
  );

  const iframeDescription = await page.context().request.put(descriptionUrl, {
    data: { description: IFRAME_DOC },
  });
  expect(iframeDescription.status(), await iframeDescription.text()).toBe(400);
  const descriptionBody = (await iframeDescription.json()) as {
    error: { fields: { path: string; message: string }[] };
  };
  expect(descriptionBody.error.fields[0]?.path).toBe(
    "description.content.0.type",
  );
  expect(descriptionBody.error.fields[0]?.message).toBe(
    CONTENT_DOC_MESSAGES.FORBIDDEN_EMBED,
  );

  // The byte budget (1 MiB) rejects a 2 MB body on both endpoints.
  const tooLargeLesson = await page.context().request.patch(lessonUrl, {
    data: { content: paragraphDoc(TWO_MIB_TEXT) },
  });
  expect(tooLargeLesson.status(), await tooLargeLesson.text()).toBe(413);

  const tooLargeDescription = await page.context().request.put(
    descriptionUrl,
    { data: { description: paragraphDoc(TWO_MIB_TEXT) } },
  );
  expect(tooLargeDescription.status(), await tooLargeDescription.text()).toBe(
    413,
  );
});

test("API: MEMBER → 403 sebelum body dibaca (termasuk body 2 MB)", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  const member = await createRoleAccount(request, "MEMBER");
  // The EDITOR session creates the fixtures; signing the MEMBER in
  // afterwards REPLACES the context's session cookie.
  await signInViaApi(page.context(), editor);
  const t = randomToken("mb");
  const courseId = await createCourseViaApi(page.context(), {
    title: `${t} Kursus Member`,
  });
  const lessonId = await createLessonViaApi(
    page.context(),
    courseId,
    `${t} Materi Member`,
  );
  await signInViaApi(page.context(), member);

  // A MEMBER is rejected before the body is read: even the 2 MB body
  // answers 403, not 413 (role guard precedes readJsonBody).
  const small = await page.context().request.patch(
    `/api/cms/courses/${courseId}/lessons/${lessonId}`,
    { data: { content: paragraphDoc("materi member") } },
  );
  expect(small.status(), await small.text()).toBe(403);

  const large = await page.context().request.patch(
    `/api/cms/courses/${courseId}/lessons/${lessonId}`,
    { data: { content: paragraphDoc(TWO_MIB_TEXT) } },
  );
  expect(large.status(), await large.text()).toBe(403);

  const largeDescription = await page.context().request.put(
    `/api/cms/courses/${courseId}/description`,
    { data: { description: paragraphDoc(TWO_MIB_TEXT) } },
  );
  expect(largeDescription.status(), await largeDescription.text()).toBe(403);
});

test("kursus bukan DRAFT → kedua halaman terkunci tanpa tombol Simpan", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("lk");
  const courseId = await createCourseViaApi(page.context(), {
    title: `${t} Kursus Terkunci`,
  });
  const lessonTitle = `${t} Materi Terkunci`;
  const lessonId = await createLessonViaApi(
    page.context(),
    courseId,
    lessonTitle,
  );
  // Give the lesson stored text so the locked page shows RichContent;
  // the description stays empty to cover the "Belum diisi." branch.
  const saved = await page.context().request.patch(
    `/api/cms/courses/${courseId}/lessons/${lessonId}`,
    { data: { content: paragraphDoc(LESSON_TEXT) } },
  );
  expect(saved.status(), await saved.text()).toBe(200);

  await withE2eDb(
    (sql) => sql`update courses set status = 'IN_REVIEW' where id = ${courseId}`,
  );

  await page.goto(`/cms/kursus/${courseId}/materi/${lessonId}`);
  await expect(page.getByRole("heading", { name: lessonTitle })).toBeVisible();
  await expect(
    page.getByText("Kursus sudah bukan draf — pengaturan dan materi terkunci."),
  ).toBeVisible();
  await expect(page.getByText(LESSON_TEXT)).toBeVisible();
  await expect(page.getByRole("button", { name: "Simpan" })).toHaveCount(0);

  await page.goto(`/cms/kursus/${courseId}/deskripsi`);
  await expect(
    page.getByRole("heading", { name: "Deskripsi lengkap" }),
  ).toBeVisible();
  await expect(
    page.getByText("Kursus sudah bukan draf — pengaturan dan materi terkunci."),
  ).toBeVisible();
  await expect(page.getByText("Belum diisi.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Simpan" })).toHaveCount(0);
});

// Owner review (card "Sebelum membuka PR"): both pages at w1280 and
// w768 in the four states. Saved only when E2E_SCREENSHOT_DIR is set
// (maybeScreenshot); full-page, animations disabled.
test("screenshot state editor materi & deskripsi (w1280 & w768)", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("sc");
  const courseId = await createCourseViaApi(page.context(), {
    title: `${t} Kursus Screenshot`,
  });
  const lessonTitle = `${t} Materi Screenshot`;
  const lessonId = await createLessonViaApi(
    page.context(),
    courseId,
    lessonTitle,
  );

  for (const viewport of [
    { label: "w1280", width: 1280, height: 800 },
    { label: "w768", width: 768, height: 1024 },
  ]) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });

    // --- lesson editor: BELUM DISIMPAN → TERSIMPAN → failure bar → guard
    await page.goto(`/cms/kursus/${courseId}/materi/${lessonId}`);
    const canvas = page.getByRole("textbox", { name: "Teks materi" });
    // Unique per pass: iteration 2 would otherwise rewrite the text saved
    // in iteration 1 — the editor's onChange only fires on real changes.
    await canvas.fill(`${LESSON_TEXT} (${viewport.label})`);
    await expect(page.getByText("BELUM DISIMPAN")).toBeVisible();
    await maybeScreenshot(
      page,
      "s1-04-materi-editor-belum-disimpan",
      viewport.label,
    );

    await page.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText("TERSIMPAN")).toBeVisible();
    await maybeScreenshot(page, "s1-04-materi-editor-tersimpan", viewport.label);

    await page.route("**/api/cms/courses/*/lessons/*", (route) =>
      route.abort(),
    );
    await canvas.fill(`${LESSON_TEXT} Suntingan kedua.`);
    await page.getByRole("button", { name: "Simpan" }).click();
    await expect(
      page.getByText("Gagal menyimpan — koneksi terputus"),
    ).toBeVisible();
    await maybeScreenshot(page, "s1-04-materi-editor-bar-gagal", viewport.label);
    await page.unroute("**/api/cms/courses/*/lessons/*");

    await canvas.fill(`${LESSON_TEXT} Suntingan ketiga.`);
    await page
      .getByRole("navigation", { name: "Breadcrumb" })
      .getByRole("link", { name: `${t} Kursus Screenshot` })
      .click();
    await expect(
      page.getByRole("dialog").getByText("Tinggalkan tanpa menyimpan?"),
    ).toBeVisible();
    await maybeScreenshot(
      page,
      "s1-04-materi-editor-dialog-penjaga",
      viewport.label,
    );
    await page.getByRole("button", { name: "Tetap di sini" }).click();

    // --- description editor: the same four states
    await page.goto(`/cms/kursus/${courseId}/deskripsi`);
    const descriptionCanvas = page.getByRole("textbox", { name: "Deskripsi" });
    // Unique per pass — same reason as the lesson canvas above.
    await descriptionCanvas.fill(`${DESCRIPTION_TEXT} (${viewport.label})`);
    await expect(page.getByText("BELUM DISIMPAN")).toBeVisible();
    await maybeScreenshot(
      page,
      "s1-04-deskripsi-editor-belum-disimpan",
      viewport.label,
    );

    await page.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText("TERSIMPAN")).toBeVisible();
    await maybeScreenshot(
      page,
      "s1-04-deskripsi-editor-tersimpan",
      viewport.label,
    );

    await page.route("**/api/cms/courses/*/description", (route) =>
      route.abort(),
    );
    await descriptionCanvas.fill(`${DESCRIPTION_TEXT} Tambahan.`);
    await page.getByRole("button", { name: "Simpan" }).click();
    await expect(
      page.getByText("Gagal menyimpan — koneksi terputus"),
    ).toBeVisible();
    await maybeScreenshot(
      page,
      "s1-04-deskripsi-editor-bar-gagal",
      viewport.label,
    );
    await page.unroute("**/api/cms/courses/*/description");

    await descriptionCanvas.fill(`${DESCRIPTION_TEXT} Tambahan dua.`);
    await page
      .getByRole("navigation", { name: "Breadcrumb" })
      .getByRole("link", { name: `${t} Kursus Screenshot` })
      .click();
    await expect(
      page.getByRole("dialog").getByText("Tinggalkan tanpa menyimpan?"),
    ).toBeVisible();
    await maybeScreenshot(
      page,
      "s1-04-deskripsi-editor-dialog-penjaga",
      viewport.label,
    );
    await page.getByRole("button", { name: "Tetap di sini" }).click();
  }
});

test("lebar 360 → kedua halaman tidak menggulir ke samping", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const t = randomToken("br");
  const courseId = await createCourseViaApi(page.context(), {
    title: `${t} Kursus 360`,
  });
  const lessonId = await createLessonViaApi(
    page.context(),
    courseId,
    `${t} Materi 360`,
  );

  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`/cms/kursus/${courseId}/materi/${lessonId}`);
  await expect(
    page.getByRole("textbox", { name: "Teks materi" }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page, "editor materi @360");

  await page.goto(`/cms/kursus/${courseId}/deskripsi`);
  await expect(page.getByRole("textbox", { name: "Deskripsi" })).toBeVisible();
  await expectNoHorizontalScroll(page, "deskripsi kursus @360");
});
