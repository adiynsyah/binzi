// @vitest-environment jsdom
import "../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddLessonDialog } from "./add-lesson-dialog";

// Card S1-02 (screen 21h): the dialog copy (fixed placement row, quiz
// note, eyebrow), client + server field errors with focus on the title,
// the 201 → push-into-editor path that HOLDS loading and the double-submit
// guard until the route change lands, and the generic failure banner.

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function renderDialog(nextOrderIndex = 2) {
  render(
    <AddLessonDialog
      open
      onOpenChange={vi.fn()}
      courseId="c-1"
      courseTitle="Dasar Gizi Ibu Hamil"
      nextOrderIndex={nextOrderIndex}
    />,
  );
}

function submitButton() {
  return screen.getByRole("button", { name: "Buat & buka editor →" });
}

function submitForm() {
  fireEvent.submit(submitButton().closest("form") as HTMLFormElement);
}

beforeEach(() => {
  fetchMock.mockReset();
  pushMock.mockReset();
});

describe("AddLessonDialog", () => {
  it("renders the 21h copy: eyebrow, field, fixed placement, quiz note, buttons", () => {
    renderDialog(3);

    expect(screen.getByText("Tambah materi")).toBeTruthy();
    // The eyebrow is two spans (screenshot review): only the COURSE TITLE
    // truncates; the "· Materi baru" suffix is shrink-0 so it never
    // disappears — asserted separately (RTL does not match across child
    // elements).
    expect(screen.getByText("Dasar Gizi Ibu Hamil")).toBeTruthy();
    expect(screen.getByText("· Materi baru")).toBeTruthy();
    expect(screen.getByLabelText("Judul materi")).toBeTruthy();
    expect(screen.getByText("0 / 80")).toBeTruthy();
    expect(screen.getByText("Letakkan")).toBeTruthy();
    expect(screen.getByText("Di akhir — jadi materi 3")).toBeTruthy();
    // The note's "satu quiz kosong" is a <strong> — direct-text runs are
    // matched separately (RTL does not match across child elements).
    expect(screen.getByText(/otomatis punya/)).toBeTruthy();
    expect(screen.getByText("satu quiz kosong")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Batal" })).toBeTruthy();
    expect(submitButton()).toBeTruthy();
  });

  it("rejects an empty title client-side and focuses the field", async () => {
    renderDialog();
    submitForm();

    expect(await screen.findByText("Judul materi wajib diisi.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByLabelText("Judul materi")).toBe(
        document.activeElement,
      );
    });
  });

  it("attaches a server field error and focuses the title", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Validasi input gagal",
            fields: [
              {
                path: "title",
                message: "Judul materi maksimal 80 karakter.",
              },
            ],
          },
        }),
        { status: 400 },
      ),
    );
    renderDialog();
    fireEvent.change(screen.getByLabelText("Judul materi"), {
      target: { value: "Materi Energi Toka" },
    });
    submitForm();

    expect(
      await screen.findByText("Judul materi maksimal 80 karakter."),
    ).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText("Judul materi")).toBe(
        document.activeElement,
      );
    });
  });

  it("creates the lesson on 201 and routes into its editor", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "l-9" } }), { status: 201 }),
    );
    renderDialog();
    fireEvent.change(screen.getByLabelText("Judul materi"), {
      target: { value: "Materi Energi Toka" },
    });
    submitForm();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/cms/kursus/c-1/materi/l-9");
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/cms/courses/c-1/lessons");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
    });
  });

  it("keeps loading and the double-submit guard after 201 until navigation", async () => {
    // jsdom never navigates, so this is exactly the window between 201 and
    // the route change. The loading button is natively disabled, so the
    // second submission is dispatched on the FORM to exercise the
    // handler-level guard directly (same probe as the S1-01 dialog test).
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "l-9" } }), { status: 201 }),
    );
    renderDialog();
    fireEvent.change(screen.getByLabelText("Judul materi"), {
      target: { value: "Materi Energi Toka" },
    });
    submitForm();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalled();
    });
    expect(
      screen.getByRole("button", { name: "Membuat materi…" }),
    ).toBeTruthy();

    fireEvent.submit(
      screen
        .getByRole("button", { name: "Membuat materi…" })
        .closest("form") as HTMLFormElement,
    );
    // Fixed pause, never waitFor: waitFor(toHaveBeenCalledTimes(1)) would
    // pass on its first poll even if the guard were broken.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows a generic banner on a 5xx and keeps the typed title", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR" } }), {
        status: 500,
      }),
    );
    renderDialog();
    const input = screen.getByLabelText("Judul materi");
    fireEvent.change(input, { target: { value: "Materi Gagal Toka" } });
    submitForm();

    expect(await screen.findByText("Materi belum bisa dibuat.")).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("Materi Gagal Toka");
    expect(pushMock).not.toHaveBeenCalled();
    // The guard was released: the button is back on its normal label.
    expect(submitButton()).toBeTruthy();
  });

  it("shows a generic banner when the network itself fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderDialog();
    fireEvent.change(screen.getByLabelText("Judul materi"), {
      target: { value: "Materi Offline Toka" },
    });
    submitForm();

    expect(await screen.findByText("Materi belum bisa dibuat.")).toBeTruthy();
    expect(
      (screen.getByLabelText("Judul materi") as HTMLInputElement).value,
    ).toBe("Materi Offline Toka");
  });

  it("409: reports the server message through onConflict, not the generic banner (card S1-08 §5.2)", async () => {
    // The course locked from another tab: the dialog closes itself and the
    // BUILDER owns the status banner — never "periksa koneksi" copy.
    const onConflict = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <AddLessonDialog
        open
        onOpenChange={onOpenChange}
        courseId="c-1"
        courseTitle="Dasar Gizi Ibu Hamil"
        nextOrderIndex={2}
        onConflict={onConflict}
      />,
    );
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
    fireEvent.change(screen.getByLabelText("Judul materi"), {
      target: { value: "Materi Dikunci Toka" },
    });
    submitForm();

    await waitFor(() => {
      expect(onConflict).toHaveBeenCalledWith(
        "Kursus sudah bukan draf — hanya draf yang bisa diubah.",
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Materi belum bisa dibuat.")).toBeNull();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
