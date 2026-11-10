// @vitest-environment jsdom
import "../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PublishCourseDialog,
  SubmitCourseDialog,
  type StatusBannerState,
} from "./course-publish-dialogs";
import type {
  CourseReviewDTO,
  PublishChecklist,
} from "@/modules/course/service";

// Card S1-08 §4 "Selesai jika" (jsdom): dialog titles for 0/1/3 pending
// items, the unsaved-settings row, Kirim aria-disabled + submit-without-
// fetch on both lock causes, the complete path (exactly one POST), the
// double-submit guard during a pending fetch, Esc → focus back to the
// opener, and the publish dialog's reviewer rows + lock without a reviewer.

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const LABELS = [
  "Judul & level",
  "Ringkasan",
  "Slug unik",
  "Deskripsi lengkap",
  "Semua materi lengkap (teks + quiz)",
  "Final Quiz dengan cukup soal",
];

/** checklist from met flags; missing carries the unmet labels. */
function checklistOf(met: boolean[]): PublishChecklist {
  const items = met.map((isMet, index) => ({
    key: `item-${index}`,
    label: LABELS[index] ?? `Syarat ${index + 1}`,
    met: isMet,
  }));
  return {
    items,
    met: met.filter(Boolean).length,
    total: met.length,
    missing: items.filter((item) => !item.met).map((item) => item.label),
  };
}

const COMPLETE = checklistOf([true, true, true, true, true, true]);
const THREE_PENDING = checklistOf([true, true, true, false, false, false]);
const ONE_PENDING = checklistOf([true, true, true, true, true, false]);

const REVIEW: CourseReviewDTO = {
  reviewerName: "Editor Toka",
  reviewedAt: "2026-11-09T02:00:00.000Z",
};

type Outcome = { banner: StatusBannerState; refresh: boolean };

function lastOutcome(outcomes: Outcome[]): Outcome {
  return outcomes[outcomes.length - 1] as Outcome;
}

/** Renders the dialog beside a real opener button focusReturn targets. */
function renderSubmitDialog(
  props: Partial<Parameters<typeof SubmitCourseDialog>[0]> = {},
) {
  const outcomes: Outcome[] = [];
  const openChanges: boolean[] = [];
  function Harness() {
    const openerRef = useRef<HTMLButtonElement | null>(null);
    const [open, setOpen] = useState(true);
    return (
      <>
        <button type="button" ref={openerRef}>
          Kirim untuk persetujuan
        </button>
        <SubmitCourseDialog
          open={open}
          onOpenChange={(next) => {
            openChanges.push(next);
            setOpen(next);
          }}
          courseId="c-1"
          checklist={COMPLETE}
          settingsDirty={false}
          focusReturn={() => openerRef.current?.focus()}
          onOutcome={(banner, refresh) => outcomes.push({ banner, refresh })}
          {...props}
        />
      </>
    );
  }
  const view = render(<Harness />);
  return { outcomes, openChanges, unmount: view.unmount };
}

function renderPublishDialog(
  props: Partial<Parameters<typeof PublishCourseDialog>[0]> = {},
) {
  const outcomes: Outcome[] = [];
  const openChanges: boolean[] = [];
  render(
    <PublishCourseDialog
      open
      onOpenChange={(open) => openChanges.push(open)}
      courseId="c-1"
      checklist={COMPLETE}
      review={REVIEW}
      focusReturn={() => {}}
      onOutcome={(banner, refresh) => outcomes.push({ banner, refresh })}
      {...props}
    />,
  );
  return { outcomes, openChanges };
}

function submitForm(buttonName: RegExp | string) {
  fireEvent.submit(
    screen.getByRole("button", { name: buttonName }).closest("form") as HTMLFormElement,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("SubmitCourseDialog (screen 20d)", () => {
  it("renders the copy: eyebrow, title, intro, checklist rows, footnote, buttons", () => {
    renderSubmitDialog();

    expect(screen.getByText("KIRIM UNTUK PERSETUJUAN")).toBeTruthy();
    expect(screen.getByText("Semua syarat terpenuhi")).toBeTruthy();
    expect(
      screen.getByText(
        "Validasi yang sama dijalankan server saat admin menekan Setujui & terbitkan — lebih baik ketahuan sekarang.",
      ),
    ).toBeTruthy();
    for (const label of LABELS) {
      expect(screen.getByText(label, { exact: false })).toBeTruthy();
    }
    expect(
      screen.getByText(
        "Setelah terkirim, kursus terkunci dari suntingan sampai admin menyetujuinya.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kirim" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kembali menyunting" })).toBeTruthy();
  });

  it("titles: one pending → 'Satu hal belum lengkap', three → '3 hal belum lengkap'", () => {
    const one = renderSubmitDialog({ checklist: ONE_PENDING });
    expect(screen.getByText("Satu hal belum lengkap")).toBeTruthy();
    one.unmount();

    renderSubmitDialog({ checklist: THREE_PENDING });
    expect(screen.getByText("3 hal belum lengkap")).toBeTruthy();
  });

  it("unsaved settings add the warning row and count into the title", () => {
    const { unmount } = renderSubmitDialog({ settingsDirty: true });

    expect(
      screen.getByText(
        "Pengaturan kursus belum disimpan — simpan dulu, lalu kirim.",
      ),
    ).toBeTruthy();
    // Complete checklist + unsaved = exactly one pending thing.
    expect(screen.getByText("Satu hal belum lengkap")).toBeTruthy();
    unmount();

    // Clean form: no warning row at all.
    renderSubmitDialog({ settingsDirty: false });
    expect(screen.queryByText(/belum disimpan/)).toBeNull();
  });

  it("incomplete: Kirim is aria-disabled and submitting sends no fetch", () => {
    renderSubmitDialog({ checklist: THREE_PENDING });

    const kirim = screen.getByRole("button", { name: "Kirim" });
    expect(kirim.getAttribute("aria-disabled")).toBe("true");
    submitForm("Kirim");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unsaved: Kirim is aria-disabled and submitting sends no fetch", () => {
    renderSubmitDialog({ settingsDirty: true });

    expect(
      screen.getByRole("button", { name: "Kirim" }).getAttribute("aria-disabled"),
    ).toBe("true");
    submitForm("Kirim");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("complete: one POST to the submit endpoint, success banner + refresh", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), { status: 200 }),
    );
    const { outcomes, openChanges } = renderSubmitDialog();

    submitForm("Kirim");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/cms/courses/c-1/submit");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    await waitFor(() => {
      expect(outcomes).toHaveLength(1);
    });
    expect(lastOutcome(outcomes).banner).toEqual({
      tone: "success",
      title: "Kursus terkirim — menunggu persetujuan admin.",
    });
    expect(lastOutcome(outcomes).refresh).toBe(true);
    expect(openChanges).toEqual([false]);
  });

  it("double submit while the first fetch is pending → one fetch", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), { status: 200 }),
    );
    renderSubmitDialog();

    // Dispatch on the FORM both times: the confirm button is in its loading
    // state ("Mengiring…" label) while the first fetch pends.
    const form = screen
      .getByRole("button", { name: "Kirim" })
      .closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    // Fixed pause, never waitFor: the first poll would pass even if the
    // guard were broken.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("Esc closes and focus returns to the opener button", async () => {
    renderSubmitDialog();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    // Focus return runs as the content unmounts — await the close first
    // (same pattern as ui/dialog.test.tsx).
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const opener = screen.getByRole("button", {
      name: "Kirim untuk persetujuan",
    });
    expect(opener).toBe(document.activeElement);
  });

  it("409: server message banner + refresh (gate can fail without a status change)", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "CHECKLIST_INCOMPLETE",
            message: "Syarat terbit belum lengkap — lihat daftar syarat di halaman kursus.",
          },
        }),
        { status: 409 },
      ),
    );
    const { outcomes } = renderSubmitDialog();

    submitForm("Kirim");

    await waitFor(() => {
      expect(outcomes).toHaveLength(1);
    });
    expect(lastOutcome(outcomes).banner).toEqual({
      tone: "error",
      title: "Syarat terbit belum lengkap — lihat daftar syarat di halaman kursus.",
    });
    expect(lastOutcome(outcomes).refresh).toBe(true);
  });

  it("network failure: generic banner, NO refresh", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { outcomes } = renderSubmitDialog();

    submitForm("Kirim");

    await waitFor(() => {
      expect(outcomes).toHaveLength(1);
    });
    expect(lastOutcome(outcomes).banner).toEqual({
      tone: "error",
      title: "Kursus belum terkirim.",
      description: "Periksa koneksi Anda lalu coba lagi.",
    });
    expect(lastOutcome(outcomes).refresh).toBe(false);
  });
});

describe("PublishCourseDialog (screen 19d)", () => {
  it("renders the copy and the recorded reviewer row", () => {
    renderPublishDialog();

    expect(screen.getByText("SETUJUI & TERBITKAN")).toBeTruthy();
    expect(screen.getByText("Terbitkan kursus ini?")).toBeTruthy();
    expect(screen.getByText("Penggarap tercatat: Editor Toka")).toBeTruthy();
    expect(
      screen.getByText(
        "Setelah terbit, kursus bisa diikuti peserta dan tetap terkunci dari suntingan.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Batal" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Setujui & terbitkan" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Setujui & terbitkan" }).getAttribute(
        "aria-disabled",
      ),
    ).toBeNull();
  });

  it("missing reviewer: 'Penggarap belum tercatat', locked, submit sends no fetch", () => {
    renderPublishDialog({ review: null });

    expect(screen.getByText("Penggarap belum tercatat")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Setujui & terbitkan" }).getAttribute(
        "aria-disabled",
      ),
    ).toBe("true");
    submitForm("Setujui & terbitkan");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("complete: one POST to the publish endpoint with the success banner", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), { status: 200 }),
    );
    const { outcomes } = renderPublishDialog();

    submitForm("Setujui & terbitkan");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/cms/courses/c-1/publish");
    await waitFor(() => {
      expect(outcomes).toHaveLength(1);
    });
    expect(lastOutcome(outcomes).banner).toEqual({
      tone: "success",
      title: "Kursus terbit.",
    });
    expect(lastOutcome(outcomes).refresh).toBe(true);
  });
});
