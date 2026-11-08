// @vitest-environment jsdom
import "../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuizEditor } from "./quiz-editor";
import type {
  QuizEditorDTO,
  QuizEditorQuestionDTO,
} from "@/modules/quiz/service";

// Card S1-09 §3 (designs 22a + 22h): the shared page — pills and markers
// against both minimums, the unique "Sunting soal nn" names, the rules
// column, the BELUM LENGKAP block only while deficient, the locked state
// (no doors, list stays), and the 409 close → h1 focus handoff.

const refreshMock = vi.fn();

// The breadcrumb/heading exports come from the form module, which also
// pulls the TipTap editor and its CSS — stubbed out like in the form's
// own test file.
vi.mock("./rich-text-editor", () => ({
  RichTextEditor: function RichTextEditorStub() {
    return <div />;
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    refresh: refreshMock,
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

type FixtureOverrides = Partial<QuizEditorDTO>;

function question(
  overrides: Partial<QuizEditorQuestionDTO> = {},
): QuizEditorQuestionDTO {
  return {
    id: `qq-${Math.random().toString(36).slice(2, 8)}`,
    orderIndex: 1,
    type: "SINGLE_CHOICE",
    text: "Teks soal baris pertama",
    explanation: "Pembahasan soal",
    options: [
      { text: "Opsi A", isCorrect: true },
      { text: "Opsi B", isCorrect: false },
      { text: "Opsi C", isCorrect: false },
      { text: "Opsi D", isCorrect: false },
    ],
    hasKey: true,
    hasExplanation: true,
    ...overrides,
  };
}

function editorFixture(overrides: FixtureOverrides = {}): QuizEditorDTO {
  return {
    quiz: {
      id: "quiz-1",
      type: "FINAL",
      durationMinutes: 20,
      passingScorePercent: 70,
      shuffleQuestions: true,
      shuffleOptions: true,
    },
    owner: {
      courseId: "c-1",
      courseTitle: "Dasar Gizi Ibu Hamil",
      courseStatus: "DRAFT",
      lesson: null,
    },
    questions: [],
    minQuestions: 10,
    weights: { lessonPercent: 60, finalPercent: 40 },
    ...overrides,
  };
}

function lessonFixture(overrides: FixtureOverrides = {}): QuizEditorDTO {
  return editorFixture({
    quiz: { ...editorFixture().quiz, type: "LESSON", durationMinutes: 10 },
    owner: {
      courseId: "c-1",
      courseTitle: "Dasar Gizi Ibu Hamil",
      courseStatus: "DRAFT",
      lesson: { id: "l-1", orderIndex: 2, title: "Materi kedua" },
    },
    ...overrides,
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  refreshMock.mockReset();
});

describe("QuizEditor — FINAL (22a)", () => {
  it("breadcrumb ends at Final Quiz; no back link; dark type pill; MILIK KURSUS", () => {
    render(<QuizEditor editor={editorFixture()} />);
    expect(document.querySelector("nav[aria-label='Breadcrumb']")?.textContent).toBe(
      "Kursus/Dasar Gizi Ibu Hamil/Final Quiz",
    );
    expect(screen.queryByRole("link", { name: /← Materi/ })).toBeNull();
    // "Final Quiz" appears twice (breadcrumb tail + type pill); the pill
    // is the rounded one.
    const pill = screen.getByText("Final Quiz", { selector: ".rounded-pill" });
    expect(pill.className).toContain("bg-text");
    expect(
      screen.getByText("MILIK KURSUS · JENIS TIDAK BISA DIUBAH"),
    ).toBeTruthy();
  });

  it("count pill + mono line: 19 → '19 dari 20 soal' + KURANG; 21 → '21 soal' + SUDAH TERPENUHI", () => {
    const nineteen = Array.from({ length: 19 }, (_, index) =>
      question({ orderIndex: index + 1 }),
    );
    const { unmount } = render(
      <QuizEditor
        editor={editorFixture({ questions: nineteen, minQuestions: 10 })}
      />,
    );
    expect(screen.getByText("19 dari 20 soal")).toBeTruthy();
    expect(
      screen.getByText("MINIMUM PUBLISH 10 SOAL · SUDAH TERPENUHI"),
    ).toBeTruthy();
    unmount();

    const twentyOne = Array.from({ length: 21 }, (_, index) =>
      question({ orderIndex: index + 1 }),
    );
    render(
      <QuizEditor
        editor={editorFixture({ questions: twentyOne, minQuestions: 10 })}
      />,
    );
    expect(screen.getByText("21 soal")).toBeTruthy();
    expect(
      screen.getByText("MINIMUM PUBLISH 10 SOAL · SUDAH TERPENUHI"),
    ).toBeTruthy();
  });

  it("below the settings minimum the mono line says KURANG k", () => {
    render(
      <QuizEditor
        editor={editorFixture({ questions: [question()], minQuestions: 10 })}
      />,
    );
    expect(
      screen.getByText("MINIMUM PUBLISH 10 SOAL · KURANG 9"),
    ).toBeTruthy();
  });

  it("rules column: weights from props, fixed rows, and NO '(K-04)' annotation in copy", () => {
    render(<QuizEditor editor={editorFixture()} />);
    expect(screen.getByText("Aturan quiz")).toBeTruthy();
    expect(screen.getByText("20 menit")).toBeTruthy();
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.getByText("1 — terkunci")).toBeTruthy();
    expect(screen.getAllByText("Ya")).toHaveLength(2);
    expect(screen.getByText("40% Nilai Akhir")).toBeTruthy();
    // The 22a note drops the designer annotation (CLAUDE.md copy rule).
    expect(document.body.textContent).not.toMatch(/\([A-Z]{1,4}-\d+\)/);
  });

  it("markers: a complete row is one success line; a deficient row is danger-tinted with KOSONG markers", () => {
    render(
      <QuizEditor
        editor={editorFixture({
          minQuestions: 1,
          questions: [
            question({ orderIndex: 1 }),
            question({
              orderIndex: 2,
              hasKey: false,
              hasExplanation: false,
              options: [
                { text: "A", isCorrect: false },
                { text: "B", isCorrect: false },
              ],
            }),
            question({ orderIndex: 3, type: "TRUE_FALSE", hasExplanation: false }),
          ],
        })}
      />,
    );
    expect(screen.getByText("PG · KUNCI ✓ · PEMBAHASAN ✓")).toBeTruthy();
    expect(screen.getByText("· KUNCI KOSONG")).toBeTruthy();
    expect(screen.getAllByText("· PEMBAHASAN KOSONG")).toHaveLength(2);
    expect(screen.getByText("B/S")).toBeTruthy();
    // Deficient rows carry the danger tint; complete rows do not. Query
    // INSIDE the question list — the breadcrumb <li>s are listitems too.
    const list = screen
      .getByText("Daftar soal")
      .closest("section")
      ?.querySelector("ol");
    const rows = Array.from(list?.querySelectorAll(":scope > li") ?? []);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.className).not.toContain("bg-danger-tint");
    expect(rows[1]?.className).toContain("bg-danger-tint");
    expect(rows[2]?.className).toContain("bg-danger-tint");
  });

  it("every 'Sunting soal nn' name is unique (sr-only suffix)", () => {
    render(
      <QuizEditor
        editor={editorFixture({
          questions: [question({ orderIndex: 1 }), question({ orderIndex: 2 })],
        })}
      />,
    );
    expect(screen.getByRole("button", { name: "Sunting soal 01" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sunting soal 02" })).toBeTruthy();
  });

  it("BELUM LENGKAP lists per-question gaps and the shortfall — and disappears when complete", () => {
    render(
      <QuizEditor
        editor={editorFixture({
          questions: [
            question({ orderIndex: 1, hasExplanation: false }),
            question({ orderIndex: 2, hasKey: false }),
          ],
        })}
      />,
    );
    expect(screen.getByText("Belum lengkap")).toBeTruthy();
    expect(
      screen.getByText("· Soal 01 belum ada pembahasan"),
    ).toBeTruthy();
    expect(screen.getByText("· Soal 02 belum ada kunci")).toBeTruthy();
    expect(
      screen.getByText("· Kurang 8 soal dari minimum 10"),
    ).toBeTruthy();
  });

  it("a complete quiz shows no BELUM LENGKAP block", () => {
    const ten = Array.from({ length: 10 }, (_, index) =>
      question({ orderIndex: index + 1 }),
    );
    render(
      <QuizEditor editor={editorFixture({ questions: ten })} />,
    );
    expect(screen.queryByText("Belum lengkap")).toBeNull();
  });

  it("empty quiz: 'Belum ada soal.' and the add button", () => {
    render(<QuizEditor editor={editorFixture()} />);
    expect(screen.getByText("Belum ada soal.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ Tambah soal" })).toBeTruthy();
  });

  it("normal save close: focus returns to the 'Sunting soal 01' opener", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        data: {
          id: "qq-1",
          orderIndex: 1,
          type: "SINGLE_CHOICE",
          updatedAt: "2026-11-08T00:00:00.000Z",
        },
      }),
    } as unknown as Response);
    render(
      <QuizEditor
        editor={editorFixture({ questions: [question({ orderIndex: 1 })] })}
      />,
    );
    // Keyboard-style activation: the opener is FOCUSED when it opens the
    // dialog (the dialog captures document.activeElement at open time).
    const opener = screen.getByRole("button", { name: "Sunting soal 01" });
    opener.focus();
    fireEvent.click(opener);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    // The seeded question is valid — a straight save closes the dialog.
    fireEvent.click(screen.getByRole("button", { name: "Simpan soal" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });
});

describe("QuizEditor — lesson quiz (22h)", () => {
  it("back link '← Materi 2', lesson title heading, light pill, MILIK MATERI, weights row + note", () => {
    render(<QuizEditor editor={lessonFixture({ questions: [question()] })} />);
    expect(
      screen.getByRole("link", { name: "← Materi 2" }).getAttribute("href"),
    ).toBe("/cms/kursus/c-1/materi/l-1");
    expect(screen.getByRole("heading", { name: "Materi kedua" })).toBeTruthy();
    const pill = screen.getByText("Quiz materi");
    expect(pill.className).toContain("bg-fill");
    expect(
      screen.getByText("MILIK MATERI 2 · JENIS TIDAK BISA DIUBAH"),
    ).toBeTruthy();
    expect(screen.getByText("1 soal")).toBeTruthy();
    expect(screen.getByText("Bagian dari 60%")).toBeTruthy();
    expect(
      screen.getByText("Rata-rata semua quiz materi di kursus ini."),
    ).toBeTruthy();
    expect(
      screen.getByText("Hanya label — lulus atau tidak, materi tetap selesai"),
    ).toBeTruthy();
  });
});

describe("QuizEditor — locked (non-DRAFT)", () => {
  it("banner shown, no add/edit doors, list still rendered", () => {
    render(
      <QuizEditor
        editor={editorFixture({
          owner: {
            courseId: "c-1",
            courseTitle: "Dasar Gizi Ibu Hamil",
            courseStatus: "IN_REVIEW",
            lesson: null,
          },
          questions: [question()],
        })}
      />,
    );
    expect(
      screen.getByText("Kursus sudah bukan draf — pengaturan dan materi terkunci."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "+ Tambah soal" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sunting soal 01" })).toBeNull();
    expect(screen.getByText("Teks soal baris pertama")).toBeTruthy();
  });

  it("409 mid-dialog: after close, focus lands on the h1 (the opener is gone)", async () => {
    fetchMock.mockResolvedValue({
      status: 409,
      ok: false,
      json: async () => ({
        error: { message: "Kursus sudah bukan draf — soal quiz terkunci." },
      }),
    } as unknown as Response);
    const { rerender } = render(
      <QuizEditor
        editor={editorFixture({ owner: {
          courseId: "c-1",
          courseTitle: "Dasar Gizi Ibu Hamil",
          courseStatus: "DRAFT",
          lesson: null,
        } })}
      />,
    );
    // Keyboard activation: the opener is FOCUSED when it opens the dialog
    // (fireEvent.click alone does not move focus in jsdom, and the dialog
    // captures document.activeElement as its opener at open time).
    screen.getByRole("button", { name: "+ Tambah soal" }).focus();
    fireEvent.click(screen.getByRole("button", { name: "+ Tambah soal" }));
    fireEvent.change(screen.getByLabelText("Pertanyaan"), {
      target: { value: "Soal baru" },
    });
    for (const label of ["Opsi A", "Opsi B", "Opsi C", "Opsi D"]) {
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: `Teks ${label}` },
      });
    }
    fireEvent.click(screen.getByRole("radio", { name: "Kunci: opsi B" }));
    fireEvent.change(screen.getByLabelText("Pembahasan"), {
      target: { value: "Pembahasan soal baru" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan soal" }));

    await waitFor(() =>
      expect(
        screen.getByText("Kursus sudah bukan draf — soal quiz terkunci."),
      ).toBeTruthy(),
    );
    // The refresh flipped the page to its locked shape.
    rerender(
      <QuizEditor
        editor={editorFixture({
          owner: {
            courseId: "c-1",
            courseTitle: "Dasar Gizi Ibu Hamil",
            courseStatus: "IN_REVIEW",
            lesson: null,
          },
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    const h1 = screen.getByRole("heading", { name: "Dasar Gizi Ibu Hamil" });
    await waitFor(() => expect(document.activeElement).toBe(h1));
    expect(h1.tabIndex).toBe(-1);
  });
});
