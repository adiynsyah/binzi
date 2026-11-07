// @vitest-environment jsdom
import "../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CourseBuilder } from "./course-builder";
import type {
  CmsCourseBuilderDTO,
  CourseBuilderDTO,
  PublishChecklist,
} from "@/modules/course/service";
import type { LessonOutlineItemDTO } from "@/modules/lesson/service";

// Card S1-02: the DRAFT builder (heading row + Simpan outside the form,
// empty outline, checklist "m / 6"), the save flow (PATCH → reset to the
// SAVED values, success banner, router.refresh, and focus RETURNING to
// "Simpan" — review item 9), server field errors with the form-order
// focus pass, the 409 lock message, generic failures, and the §6
// read-only shape outside DRAFT. The slug must NOT follow the title
// (review item 10).

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
    refresh: refreshMock,
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// The settings panel's Toggle (radix Switch) measures itself with
// ResizeObserver — not implemented in jsdom (same stub as
// register-form.test.tsx).
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (!("ResizeObserver" in globalThis)) {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
}

function lessonFixture(
  overrides: Partial<LessonOutlineItemDTO> = {},
): LessonOutlineItemDTO {
  return {
    id: "l-1",
    title: "Materi pertama",
    orderIndex: 1,
    isContentEmpty: true,
    videoReady: false,
    videoDurationSeconds: null,
    quizQuestionCount: 0,
    isFreePreview: true,
    ...overrides,
  };
}

function courseFixture(
  overrides: Partial<CmsCourseBuilderDTO> = {},
): CmsCourseBuilderDTO {
  return {
    id: "c-1",
    title: "Dasar Gizi Ibu Hamil",
    slug: "dasar-gizi-ibu-hamil",
    summary: "Ringkasan netral untuk tes.",
    level: "BEGINNER",
    status: "DRAFT",
    isSequential: true,
    isDescriptionEmpty: true,
    ownerName: "Editor Toka",
    updatedAt: "2026-11-04T00:00:00.000Z",
    finalQuiz: { id: "fq-1", questionCount: 0, durationMinutes: 0 },
    ...overrides,
  };
}

/** A fresh-dialog course: the three creation fields met, the rest not. */
function checklistFixture(): PublishChecklist {
  return {
    items: [
      { key: "title-level", label: "Judul & level", met: true },
      { key: "summary", label: "Ringkasan", met: true },
      { key: "slug", label: "Slug unik", met: true },
      { key: "description", label: "Deskripsi lengkap", met: false },
      {
        key: "lessons",
        label: "Semua materi lengkap (teks + quiz)",
        met: false,
      },
      { key: "final-quiz", label: "Final Quiz ≥ 3 soal", met: false },
    ],
    met: 3,
    total: 6,
    missing: [
      "Deskripsi lengkap",
      "Semua materi lengkap (teks + quiz)",
      "Final Quiz ≥ 3 soal",
    ],
  };
}

function builderFixture(
  overrides: Partial<CourseBuilderDTO> = {},
): CourseBuilderDTO {
  return {
    course: courseFixture(),
    outline: [],
    checklist: checklistFixture(),
    minQuestions: 3,
    ...overrides,
  };
}

function renderBuilder(builder: CourseBuilderDTO = builderFixture()) {
  return render(<CourseBuilder builder={builder} />);
}

function settingsForm(): HTMLFormElement {
  return document.getElementById("course-settings-form") as HTMLFormElement;
}

beforeEach(() => {
  fetchMock.mockReset();
  pushMock.mockReset();
  refreshMock.mockReset();
});

describe("CourseBuilder", () => {
  describe("DRAFT rendering", () => {
    it("renders heading row, empty outline, and the checklist", () => {
      renderBuilder();

      expect(
        screen.getByRole("heading", { name: "Dasar Gizi Ibu Hamil" }),
      ).toBeTruthy();
      expect(screen.getByText("Draf")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Simpan" })).toBeTruthy();
      expect(screen.getByText("Pengaturan kursus")).toBeTruthy();

      // Empty outline: 21g copy, and the FIRST add lives here (review
      // item 8) — the header "+ Tambah materi" must not exist yet.
      expect(screen.getByText("0 materi · wajib berurutan")).toBeTruthy();
      expect(screen.getByText("Belum ada materi")).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "+ Tambah materi pertama" }),
      ).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "+ Tambah materi" }),
      ).toBeNull();

      // Regex, not string: the sentence continues past "soal".
      expect(
        screen.getByText(/Sudah disiapkan kosong — minimum 3 soal/),
      ).toBeTruthy();
      expect(screen.getByText("3 / 6")).toBeTruthy();
      expect(screen.getByText("3 hal perlu dilengkapi")).toBeTruthy();
    });

    it("keeps the slug when the title is edited (no auto-follow)", () => {
      renderBuilder();
      const slugInput = screen.getByLabelText("Slug") as HTMLInputElement;

      fireEvent.change(screen.getByLabelText("Judul kursus"), {
        target: { value: "Judul Revisi Toka" },
      });

      expect(slugInput.value).toBe("dasar-gizi-ibu-hamil");
    });

    it("shows the header add button and marker variants once lessons exist", () => {
      renderBuilder(
        builderFixture({
          outline: [
            lessonFixture({
              id: "l-video",
              title: "Energi dan porsi",
              orderIndex: 1,
              isContentEmpty: false,
              videoReady: true,
              videoDurationSeconds: 252,
              quizQuestionCount: 3,
            }),
            lessonFixture({
              id: "l-empty",
              title: "Materi kosong",
              orderIndex: 2,
            }),
            lessonFixture({
              id: "l-quiz",
              title: "Protein",
              orderIndex: 3,
              isContentEmpty: false,
              quizQuestionCount: 2,
            }),
          ],
        }),
      );

      expect(
        screen.getByRole("button", { name: "+ Tambah materi" }),
      ).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "+ Tambah materi pertama" }),
      ).toBeNull();
      expect(screen.getByText("3 materi · wajib berurutan")).toBeTruthy();

      // Complete row: success-colored line, duration chip, sr-only-titled
      // "Sunting" link (unique per lesson for screen readers).
      expect(screen.getByText("VIDEO ✓ · QUIZ 3 SOAL ✓")).toBeTruthy();
      expect(screen.getByText("04:12")).toBeTruthy();
      expect(
        screen.getByRole("link", { name: "Sunting Energi dan porsi" }),
      ).toBeTruthy();

      // Fresh row and a below-minimum quiz row.
      expect(
        screen.getByText(
          "BELUM ADA VIDEO · TEKS BELUM DIISI · QUIZ BELUM DIBUAT",
        ),
      ).toBeTruthy();
      expect(screen.getByText("BELUM ADA VIDEO · QUIZ 2 SOAL")).toBeTruthy();
    });
  });

  describe("saving (DRAFT)", () => {
    it("PATCHes, resets to the saved values, shows the banner, refreshes, and returns focus to Simpan", async () => {
      // The server echoes a NORMALIZED title: reset() must land on the
      // server's value, not the typed one.
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({ data: courseFixture({ title: "Gizi Hamil Revisi" }) }),
          { status: 200 },
        ),
      );
      renderBuilder();
      const titleInput = screen.getByLabelText("Judul kursus");
      fireEvent.change(titleInput, { target: { value: "  Gizi Hamil Revisi  " } });
      fireEvent.submit(settingsForm());

      await waitFor(() => {
        expect(screen.getByText("Pengaturan tersimpan.")).toBeTruthy();
      });
      expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/cms/courses/c-1");
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "PATCH" });
      expect((titleInput as HTMLInputElement).value).toBe("Gizi Hamil Revisi");
      expect(refreshMock).toHaveBeenCalled();

      // Review item 9: after a successful save (focus did not move to a
      // field), focus RETURNS to the Simpan button.
      const save = screen.getByRole("button", { name: "Simpan" });
      await waitFor(() => {
        expect(save).toBe(document.activeElement);
      });
    });

    it("sends exactly one PATCH for two rapid submissions", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ data: courseFixture() }), {
          status: 200,
        }),
      );
      renderBuilder();
      fireEvent.submit(settingsForm());
      fireEvent.submit(settingsForm());

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
      // Fixed pause, never waitFor: the first poll would pass even if the
      // guard were broken.
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("keeps focus on the first invalid field while a banner is showing (mutation 11)", async () => {
      // One successful save first: the banner shows and focus returned
      // to Simpan. RHF also toggles isSubmitting for submits that FAIL
      // client validation, so an effect gated on the banner alone would
      // fire on the next submit below and steal focus from the field.
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ data: courseFixture() }), {
          status: 200,
        }),
      );
      renderBuilder();
      fireEvent.submit(settingsForm());
      await waitFor(() => {
        expect(screen.getByText("Pengaturan tersimpan.")).toBeTruthy();
      });
      const save = screen.getByRole("button", { name: "Simpan" });
      await waitFor(() => {
        expect(save).toBe(document.activeElement);
      });

      // Clear the summary, then submit: client validation fails while
      // the banner is still up. requestAnimationFrame runs SYNCHRONOUSLY
      // here, so the focus pass lands on the field DURING the submit and
      // any effect focus provably comes after it — the last writer is
      // unambiguous (in real browsers the two orderings race, which is
      // exactly why the effect must not ask for focus on this path).
      const realRaf = globalThis.requestAnimationFrame.bind(globalThis);
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        cb(performance.now());
        return 0;
      });
      try {
        fireEvent.change(screen.getByLabelText("Ringkasan"), {
          target: { value: "" },
        });
        fireEvent.submit(settingsForm());
        await new Promise((resolve) => setTimeout(resolve, 200));

        expect(screen.getByLabelText("Ringkasan")).toBe(
          document.activeElement,
        );
        expect(save).not.toBe(document.activeElement);
        // Client-invalid submits never reach the server.
        expect(fetchMock).toHaveBeenCalledTimes(1);
      } finally {
        vi.stubGlobal("requestAnimationFrame", realRaf);
      }
    });

    it("attaches server field errors and focuses the first invalid field in form order", async () => {
      // Both summary and slug are invalid; the pass order is judul →
      // ringkasan → slug → level, so Ringkasan takes focus even though
      // the slug error is listed first.
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: "Validasi input gagal",
              fields: [
                {
                  path: "slug",
                  message: "Slug “dasar-gizi-ibu-hamil” sudah dipakai kursus lain — ketik slug yang berbeda.",
                },
                { path: "summary", message: "Ringkasan wajib diisi." },
              ],
            },
          }),
          { status: 400 },
        ),
      );
      renderBuilder();
      fireEvent.submit(settingsForm());

      expect(
        await screen.findByText(/sudah dipakai kursus lain/),
      ).toBeTruthy();
      expect(screen.getByText("Ringkasan wajib diisi.")).toBeTruthy();
      await waitFor(() => {
        expect(screen.getByLabelText("Ringkasan")).toBe(
          document.activeElement,
        );
      });
      expect(refreshMock).not.toHaveBeenCalled();
    });

    it("shows the 409 lock message, refreshes, and returns focus to Simpan", async () => {
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "NOT_DRAFT",
              message: "Kursus sudah bukan draf — hanya draf yang bisa diubah.",
            },
          }),
          { status: 409 },
        ),
      );
      renderBuilder();
      fireEvent.submit(settingsForm());

      expect(
        await screen.findByText("Kursus sudah bukan draf — hanya draf yang bisa diubah."),
      ).toBeTruthy();
      expect(refreshMock).toHaveBeenCalled();
      const save = screen.getByRole("button", { name: "Simpan" });
      await waitFor(() => {
        expect(save).toBe(document.activeElement);
      });
    });

    it("shows a generic banner on failure and keeps the typed values", async () => {
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
      renderBuilder();
      const titleInput = screen.getByLabelText("Judul kursus");
      fireEvent.change(titleInput, { target: { value: "Judul Offline Toka" } });
      fireEvent.submit(settingsForm());

      expect(await screen.findByText("Pengaturan belum tersimpan.")).toBeTruthy();
      expect(
        screen.getByText(
          "Periksa koneksi Anda lalu coba lagi. Isian Anda masih ada di formulir ini.",
        ),
      ).toBeTruthy();
      expect((titleInput as HTMLInputElement).value).toBe("Judul Offline Toka");
      const save = screen.getByRole("button", { name: "Simpan" });
      await waitFor(() => {
        expect(save).toBe(document.activeElement);
      });
    });

    it("focuses the first invalid field on client-side validation and sends nothing", async () => {
      renderBuilder();
      fireEvent.change(screen.getByLabelText("Judul kursus"), {
        target: { value: "" },
      });
      fireEvent.submit(settingsForm());

      await waitFor(() => {
        expect(screen.getByLabelText("Judul kursus")).toBe(
          document.activeElement,
        );
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("Deskripsi row (card S1-04 §6)", () => {
    it("DRAFT + empty: the '+ Tulis deskripsi lengkap' link to the description page", () => {
      renderBuilder(builderFixture({ course: courseFixture() }));

      const link = screen.getByRole("link", {
        name: "+ Tulis deskripsi lengkap",
      });
      expect(link.getAttribute("href")).toBe("/cms/kursus/c-1/deskripsi");
    });

    it("DRAFT + filled: 'Sudah diisi · Ubah' with the same destination", () => {
      renderBuilder(
        builderFixture({
          course: courseFixture({ isDescriptionEmpty: false }),
        }),
      );

      // RTL does not match across child elements: the text run and the
      // link are asserted separately (same as the S1-02 dialog note).
      expect(screen.getByText("Sudah diisi ·")).toBeTruthy();
      expect(
        screen.getByRole("link", { name: "Ubah" }).getAttribute("href"),
      ).toBe("/cms/kursus/c-1/deskripsi");
    });

    it("outside DRAFT: plain text both ways, never a link", () => {
      const empty = renderBuilder(
        builderFixture({ course: courseFixture({ status: "IN_REVIEW" }) }),
      );
      expect(screen.getByText("Belum diisi")).toBeTruthy();
      expect(screen.queryByRole("link", { name: /deskripsi lengkap|Ubah/ })).toBeNull();
      empty.unmount();

      renderBuilder(
        builderFixture({
          course: courseFixture({ status: "IN_REVIEW", isDescriptionEmpty: false }),
        }),
      );
      expect(screen.getByText("Sudah diisi")).toBeTruthy();
      expect(screen.queryByRole("link", { name: /deskripsi lengkap|Ubah/ })).toBeNull();
    });
  });

  describe("outside DRAFT (card §6)", () => {
    it("renders read-only: no Simpan, no add, no Sunting — but the outline and checklist stay", () => {
      renderBuilder(
        builderFixture({
          course: courseFixture({ status: "IN_REVIEW" }),
          outline: [lessonFixture()],
        }),
      );

      expect(screen.getByText("Menunggu persetujuan")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Simpan" })).toBeNull();
      expect(
        screen.queryByRole("button", { name: "+ Tambah materi" }),
      ).toBeNull();
      expect(screen.queryByRole("link", { name: /Sunting/ })).toBeNull();
      expect(
        screen.queryByRole("button", { name: /Tambah materi/ }),
      ).toBeNull();

      expect(
        screen.getByText("Kursus sudah bukan draf — pengaturan dan materi terkunci."),
      ).toBeTruthy();
      // The read-only value list replaces the form.
      expect(
        screen.getByText("/kursus/dasar-gizi-ibu-hamil"),
      ).toBeTruthy();
      expect(screen.queryByLabelText("Judul kursus")).toBeNull();
      // Outline rows and the checklist are still shown.
      expect(screen.getByText("1 · Materi pertama")).toBeTruthy();
      expect(screen.getByText("3 / 6")).toBeTruthy();
    });
  });
});
