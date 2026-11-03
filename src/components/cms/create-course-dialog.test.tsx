// @vitest-environment jsdom
import "../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateCourseDialog } from "./create-course-dialog";

// Card S1-01 (screen 21f): 21f states — errors appear after submit and
// focus moves to the first invalid control; a slug error first OPENS slug
// edit mode; the network/5xx path shows a generic banner while the fields
// keep their values; and the submit fires exactly one POST even when
// double-clicked (the button is softDisabled, never silently disabled).

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function renderDialog() {
  render(<CreateCourseDialog open onOpenChange={vi.fn()} />);
}

function fillValidForm(title: string) {
  fireEvent.change(screen.getByLabelText("Judul kursus"), {
    target: { value: title },
  });
  fireEvent.change(screen.getByLabelText("Ringkasan"), {
    target: { value: "Ringkasan netral untuk tes." },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  pushMock.mockReset();
});

describe("CreateCourseDialog", () => {
  it("renders the 21f copy: eyebrow, intro, three levels, counters, buttons", () => {
    renderDialog();

    expect(screen.getByText("Kursus baru · Langkah 1 dari 1")).toBeTruthy();
    expect(screen.getByText("Mulai kursus baru")).toBeTruthy();
    expect(
      screen.getByText(
        "Cukup tiga hal ini dulu. Materi, sampul, dan Final Quiz diisi di halaman kursus setelahnya.",
      ),
    ).toBeTruthy();
    // Title and slug counters both read "0 / 80" while empty.
    expect(screen.getAllByText("0 / 80")).toHaveLength(2);
    expect(screen.getByText("0 / 160")).toBeTruthy();
    expect(screen.getByLabelText("Pemula")).toBeTruthy();
    expect(screen.getByLabelText("Menengah")).toBeTruthy();
    expect(screen.getByLabelText("Lanjutan")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Batal" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Buat & lanjut isi materi →" }),
    ).toBeTruthy();
  });

  it("auto-slugs the title in preview mode and edits it after “Ubah”", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Judul kursus"), {
      target: { value: "Gizi Seimbang: Trimester Ketiga" },
    });

    expect(screen.getByText("/kursus/gizi-seimbang-trimester-ketiga")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ubah" }));
    const slugInput = screen.getByLabelText("Alamat kursus");
    expect((slugInput as HTMLInputElement).value).toBe(
      "gizi-seimbang-trimester-ketiga",
    );
    fireEvent.change(slugInput, { target: { value: "slug-manual" } });
    // After "Ubah" the slug is manual: retyping the title must not clobber it.
    fireEvent.change(screen.getByLabelText("Judul kursus"), {
      target: { value: "Gizi Seimbang: Trimester Ketiga!" },
    });
    expect((slugInput as HTMLInputElement).value).toBe("slug-manual");
  });

  it("sends exactly one POST for two rapid clicks on the submit button", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "c-new" } }), { status: 201 }),
    );
    renderDialog();
    fillValidForm("Kursu Unik Toka");

    const submit = screen.getByRole("button", { name: "Buat & lanjut isi materi →" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
    });
  });

  it("routes into the builder on 201", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "c-new" } }), { status: 201 }),
    );
    renderDialog();
    fillValidForm("Kursu Unik Toka");
    fireEvent.click(screen.getByRole("button", { name: "Buat & lanjut isi materi →" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/cms/kursus/c-new");
    });
  });

  it("attaches server field errors, opens slug edit mode, and focuses the slug", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Validasi input gagal",
            fields: [
              {
                path: "slug",
                message: "Slug “kursu-unik-toka” sudah dipakai kursus lain — ketik slug yang berbeda.",
              },
            ],
          },
        }),
        { status: 400 },
      ),
    );
    renderDialog();
    fillValidForm("Kursu Unik Toka");
    fireEvent.click(screen.getByRole("button", { name: "Buat & lanjut isi materi →" }));

    // Slug edit mode opened (the input exists) and took focus.
    const slugInput = await waitFor(() => {
      const input = screen.getByLabelText("Alamat kursus");
      expect(input).toBeTruthy();
      return input;
    });
    await waitFor(() => {
      expect(slugInput).toBe(document.activeElement);
    });
    expect(
      screen.getByText(/sudah dipakai kursus lain/),
    ).toBeTruthy();
  });

  it("shows a generic banner on a 5xx, restores the button, keeps the values", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR" } }), {
        status: 500,
      }),
    );
    renderDialog();
    fillValidForm("Kursu Gagal Toka");
    const titleInput = screen.getByLabelText("Judul kursus");
    fireEvent.click(screen.getByRole("button", { name: "Buat & lanjut isi materi →" }));

    expect(await screen.findByText("Kursus belum bisa dibuat.")).toBeTruthy();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Buat & lanjut isi materi →" }),
      ).toBeTruthy();
    });
    expect((titleInput as HTMLInputElement).value).toBe("Kursu Gagal Toka");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a generic banner when the network itself fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderDialog();
    fillValidForm("Kursu Offline Toka");
    fireEvent.click(screen.getByRole("button", { name: "Buat & lanjut isi materi →" }));

    expect(await screen.findByText("Kursus belum bisa dibuat.")).toBeTruthy();
    expect((screen.getByLabelText("Judul kursus") as HTMLInputElement).value).toBe(
      "Kursu Offline Toka",
    );
  });
});
