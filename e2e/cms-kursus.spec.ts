// /cms/kursus end-to-end (card S1-01): the 21f dialog → builder flow, the
// 21f error states with focus movement, and the role/id guards.
//
// Uniqueness rule: the e2e database is shared by every test and project in
// one run, so each test prefixes its course titles AND slugs with a random
// token — the similar-title (prefix) rule can never cross-fire between
// tests. Only the deliberate similar-title test builds a prefix pair.
import { randomBytes } from "node:crypto";

import type { BrowserContext } from "@playwright/test";

import { expect, test } from "./fixtures";
import { createRoleAccount, signInViaApi } from "./fixtures";
import { maybeScreenshot } from "./layout/helpers";

/** Random lowercase token; shared by title and slug so they pair up. */
function token(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
}

/** POST /api/cms/courses with the signed-in context's cookies. */
async function createCourseViaApi(
  context: BrowserContext,
  course: { title: string; summary: string },
): Promise<string> {
  const response = await context.request.post("/api/cms/courses", {
    data: {
      title: course.title,
      // slugify(title): lowercase token keeps title and slug in sync.
      slug: course.title
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
      level: "BEGINNER",
      summary: course.summary,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const json = (await response.json()) as { data: { id: string } };
  return json.data.id;
}

test("EDITOR: kursus baru lewat dialog → builder kosong", async ({
  page,
  request,
}, testInfo) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);

  await page.goto("/cms/kursus");
  await expect(page.getByRole("heading", { name: "Kursus" })).toBeVisible();
  await expect(page.getByText("Belum ada kursus.")).toBeVisible();
  await maybeScreenshot(page, "cms-kursus-daftar-kosong", testInfo.project.name);

  await page.getByRole("button", { name: "+ Kursus baru" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Mulai kursus baru");
  await maybeScreenshot(page, "cms-kursus-dialog-normal", testInfo.project.name);

  const t = token("tk");
  await page.getByLabel("Judul kursus").fill(`${t} Gizi Seimbang Dasar`);
  await expect(dialog.getByText(`/kursus/${t}-gizi-seimbang-dasar`)).toBeVisible();
  await page.getByLabel("Menengah", { exact: true }).check();
  await page.getByLabel("Ringkasan").fill("Ringkasan netral untuk tes e2e.");
  await page
    .getByRole("button", { name: "Buat & lanjut isi materi →" })
    .click();

  await page.waitForURL(/\/cms\/kursus\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: `${t} Gizi Seimbang Dasar` }),
  ).toBeVisible();
  await expect(page.getByText("Belum ada materi")).toBeVisible();
  await expect(
    page.getByText(/Sudah disiapkan kosong — minimum 10 soal/),
  ).toBeVisible();
  await expect(page.getByText("Dihitung otomatis dari video")).toBeVisible();
  // The "Penggarap" row of the settings panel shows the creator (the CMS
  // shell also renders the account name — scope to the panel to stay unique).
  await expect(page.locator("dl").getByText(editor.name)).toBeVisible();
  await maybeScreenshot(page, "cms-kursus-builder-kosong", testInfo.project.name);
});

test("dialog: ringkasan kosong → pesan 21f + fokus di Ringkasan", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);

  await page.goto("/cms/kursus");
  await page.getByRole("button", { name: "+ Kursus baru" }).first().click();
  await page.getByLabel("Judul kursus").fill(`${token("tk")} Judul Lengkap`);
  await page
    .getByRole("button", { name: "Buat & lanjut isi materi →" })
    .click();

  await expect(
    page.getByText("Ringkasan wajib diisi — tanpa ini kartu katalog kosong."),
  ).toBeVisible();
  await expect(page.getByLabel("Ringkasan")).toBeFocused();
});

test("dialog: judul mirip kursus lain → pesan 21f dari server + fokus di Judul", async ({
  page,
  request,
}, testInfo) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);

  const t = token("tk");
  await createCourseViaApi(page.context(), {
    title: `${t} Gizi Seimbang untuk Ibu Hamil`,
    summary: "Ringkasan netral untuk tes e2e.",
  });

  await page.goto("/cms/kursus");
  await page.getByRole("button", { name: "+ Kursus baru" }).first().click();
  // The EXISTING title is a prefix of the new one (only this test pairs).
  await page
    .getByLabel("Judul kursus")
    .fill(`${t} Gizi Seimbang untuk Ibu Hamil Trimester Pertama`);
  await page.getByLabel("Ringkasan").fill("Ringkasan netral untuk tes e2e.");
  await page
    .getByRole("button", { name: "Buat & lanjut isi materi →" })
    .click();

  await expect(
    page.getByText(/Judul terlalu mirip dengan kursus/),
  ).toBeVisible();
  await expect(page.getByLabel("Judul kursus")).toBeFocused();
  await maybeScreenshot(page, "cms-kursus-dialog-galat", testInfo.project.name);
});

test("dialog: slug otomatis bertabrakan tanpa “Ubah” → galat slug + fokus di isian slug", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);

  const t = token("tk");
  // "Gizi: Dasar" and "Gizi - Dasar" are NOT prefixes of each other…
  await createCourseViaApi(page.context(), {
    title: `${t} Gizi: Dasar`,
    summary: "Ringkasan netral untuk tes e2e.",
  });

  await page.goto("/cms/kursus");
  await page.getByRole("button", { name: "+ Kursus baru" }).first().click();
  // …but their auto-slugs are identical — no "Ubah" click anywhere.
  await page.getByLabel("Judul kursus").fill(`${t} Gizi - Dasar`);
  await page.getByLabel("Ringkasan").fill("Ringkasan netral untuk tes e2e.");
  await page
    .getByRole("button", { name: "Buat & lanjut isi materi →" })
    .click();

  await expect(page.getByText(/sudah dipakai kursus lain/)).toBeVisible();
  // Edit mode opened automatically and the now-visible slug input took focus.
  const slugInput = page.getByLabel("Slug kursus");
  await expect(slugInput).toBeVisible();
  await expect(slugInput).toBeFocused();
  await expect(slugInput).toHaveValue(`${t}-gizi-dasar`);
});

test("MEMBER: /cms/kursus 403 halaman; GET/POST API 403 JSON", async ({
  page,
  request,
}) => {
  const member = await createRoleAccount(request, "MEMBER");
  await signInViaApi(page.context(), member);

  await page.goto("/cms/kursus");
  await expect(
    page.getByRole("heading", { name: "Akses ditolak" }),
  ).toBeVisible();

  // POST carries a garbage body on purpose: a ZodError would mean parsing
  // ran — the role check must fire BEFORE the contract is even read.
  const post = await page.context().request.post("/api/cms/courses", {
    data: { bukan: "kontrak" },
  });
  expect(post.status()).toBe(403);
  expect((await post.json()).error.code).toBe("FORBIDDEN");

  const get = await page.context().request.get("/api/cms/courses");
  expect(get.status()).toBe(403);
  expect((await get.json()).error.code).toBe("FORBIDDEN");
});

test("builder: id bukan UUID / tidak dikenal → 404; kursus orang lain bagi MEMBER → 403", async ({
  page,
  request,
}) => {
  const editor = await createRoleAccount(request, "EDITOR");
  await signInViaApi(page.context(), editor);
  const courseId = await createCourseViaApi(page.context(), {
    title: `${token("tk")} Kursu Untuk 404`,
    summary: "Ringkasan netral untuk tes e2e.",
  });
  for (const bad of ["bukan-uuid", "8f38a3b3-9999-4999-8999-999999999999"]) {
    const response = await page.goto(`/cms/kursus/${bad}`);
    expect(response?.status()).toBe(404);
  }
  await page.goto(`/cms/kursus/${courseId}`);
  await expect(page.getByText("Belum ada materi")).toBeVisible();

  await page.context().clearCookies();
  const member = await createRoleAccount(request, "MEMBER");
  await signInViaApi(page.context(), member);
  const response = await page.goto(`/cms/kursus/${courseId}`);
  expect(response?.status()).toBe(403);
});
