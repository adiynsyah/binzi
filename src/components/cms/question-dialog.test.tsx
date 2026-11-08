// @vitest-environment jsdom
import "../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RefObject } from "react";

import { QuestionDialog } from "./question-dialog";
import { QUESTION_LIMITS } from "@/modules/quiz/schema";
import type { QuizEditorQuestionDTO } from "@/modules/quiz/service";

// Card S1-09 §4 (design 22b): the dialog's copy and state machine — title
// numbering, the PG↔B/S switch rules (key cleared / restored, PG texts
// kept), client validation mapping + first-wrong-field focus order, the
// two save modes (submitter-driven), 400/409/network responses, and the
// double-submit guard.

const refreshMock = vi.fn();

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

function editedQuestion(
  overrides: Partial<QuizEditorQuestionDTO> = {},
): QuizEditorQuestionDTO {
  return {
    id: "qq-1",
    orderIndex: 1,
    type: "SINGLE_CHOICE",
    text: "Pertanyaan lama",
    explanation: "Pembahasan lama",
    options: [
      { text: "Opsi A lama", isCorrect: true },
      { text: "Opsi B lama", isCorrect: false },
      { text: "Opsi C lama", isCorrect: false },
      { text: "Opsi D lama", isCorrect: false },
    ],
    hasKey: true,
    hasExplanation: true,
    ...overrides,
  };
}

function headingRef(): RefObject<HTMLHeadingElement | null> {
  return { current: document.createElement("h1") };
}

function renderDialog(props: {
  question?: QuizEditorQuestionDTO | null;
  total?: number;
} = {}) {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  render(
    <QuestionDialog
      open
      onOpenChange={onOpenChange}
      quizId="quiz-1"
      question={props.question ?? null}
      total={props.total ?? 11}
      headingRef={headingRef()}
      onSaved={onSaved}
    />,
  );
  return { onOpenChange, onSaved };
}

function saveButton() {
  // exact: the plain name must not match "Simpan & tambah soal" (C.12).
  return screen.getByRole("button", { name: "Simpan soal" });
}

function addButton() {
  return screen.getByRole("button", { name: "Simpan & tambah soal" });
}

/** A resolved 201/200 answer. */
function okResponse(status = 201) {
  return {
    status,
    ok: status < 400,
    json: async () => ({ data: { id: "qq-new", orderIndex: 1, type: "SINGLE_CHOICE", updatedAt: "2026-11-08T00:00:00.000Z" } }),
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  refreshMock.mockReset();
});

describe("QuestionDialog (card S1-09 §4)", () => {
  it("new question: title is count+1 of count+1; edit: the row number of count", () => {
    const a = renderDialog({ question: null, total: 11 });
    expect(screen.getByText("Soal 12 dari 12")).toBeTruthy();
    a.onOpenChange.mockClear();
    const { unmount } = render(
      <QuestionDialog
        open
        onOpenChange={vi.fn()}
        quizId="quiz-1"
        question={editedQuestion()}
        total={11}
        headingRef={headingRef()}
        onSaved={vi.fn()}
      />,
    );
    unmount();
    expect(screen.queryByText("Soal 01 dari 11")).toBeNull();
  });

  it("edit seeds every field: type, texts, options, key circle", () => {
    renderDialog({ question: editedQuestion(), total: 11 });
    expect(
      (screen.getByLabelText("Pertanyaan") as HTMLTextAreaElement).value,
    ).toBe("Pertanyaan lama");
    expect(
      (screen.getByLabelText("Opsi B") as HTMLInputElement).value,
    ).toBe("Opsi B lama");
    expect(
      (screen.getByRole("radio", { name: "Kunci: opsi A" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(screen.getByText("Kunci")).toBeTruthy(); // the KUNCI marker
  });

  it("PG → B/S clears the key and shows fixed rows; B/S → PG restores texts AND the last PG key", () => {
    renderDialog({ question: editedQuestion(), total: 11 });
    const typeSelect = screen.getByLabelText("Tipe soal") as HTMLSelectElement;

    fireEvent.change(typeSelect, { target: { value: "TRUE_FALSE" } });
    // Fixed texts, NO key carried over (decision 10).
    expect(screen.getByText("Benar")).toBeTruthy();
    expect(screen.getByText("Salah")).toBeTruthy();
    expect(
      (screen.getByRole("radio", { name: "Kunci: Benar" }) as HTMLInputElement)
        .checked,
    ).toBe(false);

    fireEvent.change(typeSelect, { target: { value: "SINGLE_CHOICE" } });
    // PG texts AND the pre-switch key survive the roundtrip.
    expect(
      (screen.getByLabelText("Opsi C") as HTMLInputElement).value,
    ).toBe("Opsi C lama");
    expect(
      (screen.getByRole("radio", { name: "Kunci: opsi A" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });

  it("editing an option's TEXT never picks its key", () => {
    renderDialog({ question: editedQuestion(), total: 11 });
    fireEvent.change(screen.getByLabelText("Opsi D"), {
      target: { value: "Opsi D baru" },
    });
    expect(
      (screen.getByRole("radio", { name: "Kunci: opsi D" }) as HTMLInputElement)
        .checked,
    ).toBe(false);
  });

  it("maxLength on every input comes from QUESTION_LIMITS", () => {
    renderDialog({ question: editedQuestion(), total: 11 });
    expect(screen.getByLabelText("Pertanyaan").getAttribute("maxlength")).toBe(
      String(QUESTION_LIMITS.textMax),
    );
    expect(
      screen.getByLabelText("Pembahasan").getAttribute("maxlength"),
    ).toBe(String(QUESTION_LIMITS.explanationMax));
    expect(screen.getByLabelText("Opsi A").getAttribute("maxlength")).toBe(
      String(QUESTION_LIMITS.optionMax),
    );
  });

  it("✕ closes without any confirmation and reports onOpenChange(false)", () => {
    const { onOpenChange } = renderDialog({ question: editedQuestion() });
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Enter inside a textarea is a newline, never a submit", () => {
    renderDialog({ question: editedQuestion() });
    const textarea = screen.getByLabelText("Pertanyaan");
    fireEvent.keyDown(textarea, { key: "Enter" });
    fireEvent.change(textarea, { target: { value: "a\nb" } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect((textarea as HTMLTextAreaElement).value).toBe("a\nb");
  });

  it("client validation: an empty form focuses Pertanyaan first", async () => {
    renderDialog({ question: null, total: 3 });
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Pertanyaan")),
    );
    expect(screen.getByText("Pertanyaan wajib diisi.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("client validation: one empty option focuses that option's input", async () => {
    renderDialog({ question: null, total: 3 });
    fireEvent.change(screen.getByLabelText("Pertanyaan"), {
      target: { value: "Pertanyaan valid" },
    });
    // B left empty on purpose.
    for (const label of ["Opsi A", "Opsi C", "Opsi D"]) {
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: `Teks ${label}` },
      });
    }
    fireEvent.change(screen.getByLabelText("Pembahasan"), {
      target: { value: "Pembahasan valid" },
    });
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Opsi B")),
    );
    expect(screen.getByText("Opsi B wajib diisi.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("client validation: valid texts but NO key focus the first key radio", async () => {
    renderDialog({ question: null, total: 3 });
    fireEvent.change(screen.getByLabelText("Pertanyaan"), {
      target: { value: "Pertanyaan valid" },
    });
    for (const label of ["Opsi A", "Opsi B", "Opsi C", "Opsi D"]) {
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: `Teks ${label}` },
      });
    }
    fireEvent.change(screen.getByLabelText("Pembahasan"), {
      target: { value: "Pembahasan valid" },
    });
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("radio", { name: "Kunci: opsi A" }),
      ),
    );
    expect(
      screen.getByText("Tandai tepat satu kunci jawaban."),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("201 + 'Simpan soal': one POST, onSaved('save'), router.refresh", async () => {
    fetchMock.mockResolvedValue(okResponse(201));
    const { onSaved } = renderDialog({ question: null, total: 3 });
    fireEvent.change(screen.getByLabelText("Pertanyaan"), {
      target: { value: "Pertanyaan valid" },
    });
    for (const label of ["Opsi A", "Opsi B", "Opsi C", "Opsi D"]) {
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: `Teks ${label}` },
      });
    }
    fireEvent.click(screen.getByRole("radio", { name: "Kunci: opsi B" }));
    fireEvent.change(screen.getByLabelText("Pembahasan"), {
      target: { value: "Pembahasan valid" },
    });
    fireEvent.click(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("save"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/cms/quizzes/quiz-1/questions");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("200 + 'Simpan & tambah soal': PATCH, dialog stays open, title +1, fields cleared, type kept, focus Pertanyaan", async () => {
    fetchMock.mockResolvedValue(okResponse(200));
    renderDialog({ question: editedQuestion(), total: 3 });
    expect(screen.getByText("Soal 01 dari 3")).toBeTruthy();

    fireEvent.click(addButton());

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/cms/quizzes/quiz-1/questions/qq-1",
    );
    expect(screen.getByText("Soal 02 dari 4")).toBeTruthy();
    expect(
      (screen.getByLabelText("Pertanyaan") as HTMLTextAreaElement).value,
    ).toBe("");
    expect(
      (screen.getByLabelText("Opsi A") as HTMLInputElement).value,
    ).toBe("");
    // The type stays (22b: only isian clears).
    expect(
      (screen.getByLabelText("Tipe soal") as HTMLSelectElement).value,
    ).toBe("SINGLE_CHOICE");
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Pertanyaan")),
    );
  });

  it("double submit: later activations while in flight never fetch twice", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    renderDialog({ question: null, total: 3 });
    fillValid();
    // Hold the element: once loading starts, the button's accessible name
    // becomes its loadingLabel, so it cannot be re-queried by name.
    const button = saveButton();
    fireEvent.click(button);
    // The in-flight guard must also cover the paths the loading Button's
    // real `disabled` cannot block: a direct form submit (submitter null)
    // and the softDisabled "Simpan & tambah soal" (activatable by design).
    fireEvent.submit(button.closest("form")!);
    fireEvent.click(addButton());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch(okResponse(201));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("400 maps server fields onto the form (path → field) and focuses the first", async () => {
    fetchMock.mockResolvedValue({
      status: 400,
      ok: false,
      json: async () => ({
        error: {
          message: "Input tidak valid",
          fields: [
            { path: "text", message: "Pertanyaan maksimal 2.000 karakter." },
            { path: "options.2.text", message: "Opsi C maksimal 500 karakter." },
          ],
        },
      }),
    } as unknown as Response);
    renderDialog({ question: null, total: 3 });
    fillValid();
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(
        screen.getByText("Pertanyaan maksimal 2.000 karakter."),
      ).toBeTruthy(),
    );
    expect(screen.getByText("Opsi C maksimal 500 karakter.")).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Pertanyaan")),
    );
  });

  it("409: server message banner, inputs intact, BOTH save buttons hidden, refresh; stays open", async () => {
    fetchMock.mockResolvedValue({
      status: 409,
      ok: false,
      json: async () => ({
        error: { message: "Kursus sudah bukan draf — soal quiz terkunci." },
      }),
    } as unknown as Response);
    const { onSaved, onOpenChange } = renderDialog({
      question: editedQuestion(),
      total: 3,
    });
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(
        screen.getByText("Kursus sudah bukan draf — soal quiz terkunci."),
      ).toBeTruthy(),
    );
    expect(screen.queryByRole("button", { name: "Simpan soal" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Simpan & tambah soal" })).toBeNull();
    // Inputs intact, dialog still open, page refreshed.
    expect(
      (screen.getByLabelText("Pertanyaan") as HTMLTextAreaElement).value,
    ).toBe("Pertanyaan lama");
    expect(refreshMock).toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("network failure → the generic banner, values kept", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderDialog({ question: editedQuestion(), total: 3 });
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(
        screen.getByText(
          "Soal belum tersimpan — periksa koneksi lalu coba lagi.",
        ),
      ).toBeTruthy(),
    );
    expect(
      (screen.getByLabelText("Pertanyaan") as HTMLTextAreaElement).value,
    ).toBe("Pertanyaan lama");
  });

  it("'Simpan soal' is FIRST in the DOM (implicit Enter submits it)", () => {
    renderDialog({ question: null, total: 3 });
    const buttons = screen
      .getAllByRole("button")
      .filter((button) => /^Simpan/.test(button.textContent ?? ""));
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Simpan soal",
      "Simpan & tambah soal",
    ]);
  });

  it("key circles are ≥44px labels wrapping their sr-only radios", () => {
    renderDialog({ question: null, total: 3 });
    const radio = screen.getByRole("radio", {
      name: "Kunci: opsi A",
    }) as HTMLInputElement;
    const label = radio.closest("label");
    expect(label?.className).toContain("size-11");
    expect(radio.className).toContain("sr-only");
  });
});

/** Fills every field validly (PG, key on B). */
function fillValid(): void {
  fireEvent.change(screen.getByLabelText("Pertanyaan"), {
    target: { value: "Pertanyaan valid" },
  });
  for (const label of ["Opsi A", "Opsi B", "Opsi C", "Opsi D"]) {
    fireEvent.change(screen.getByLabelText(label), {
      target: { value: `Teks ${label}` },
    });
  }
  fireEvent.click(screen.getByRole("radio", { name: "Kunci: opsi B" }));
  fireEvent.change(screen.getByLabelText("Pembahasan"), {
    target: { value: "Pembahasan valid" },
  });
}
