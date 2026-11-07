// @vitest-environment jsdom
import "../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContentDocForm, type ContentDocFormProps } from "./content-doc-form";
import { EMPTY_DOC, type ContentDoc } from "@/lib/content-doc";

/*
 * Card S1-04 §4 component tests. RichTextEditor is stubbed with two
 * buttons — one fires onChange with a VALID document, one with an iframe
 * document — plus the focus spy the real editor exposes through
 * useImperativeHandle. The double-submit probe uses Ctrl+S (review K2):
 * the loading Simpan button is natively disabled, so a second CLICK never
 * reaches the handler; the shortcut is the realistic in-flight path. The
 * revision test (K3) edits while the request is pending. The clock test
 * (D5) fakes only Date, so RTL's async waits keep real timers.
 */

const {
  editorFocusSpy,
  VALID_DOC,
  IFRAME_DOC,
} = vi.hoisted(() => ({
  editorFocusSpy: vi.fn(),
  // Passes the S1-03a validator (one paragraph, one text node).
  VALID_DOC: Object.freeze({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Teks materi pertama." }],
      },
    ],
  }),
  // First issue: FORBIDDEN_EMBED — the message the client check must show.
  IFRAME_DOC: Object.freeze({ type: "doc", content: [{ type: "iframe" }] }),
}));

vi.mock("./rich-text-editor", () => ({
  RichTextEditor: function RichTextEditorStub({
    onChange,
    "aria-invalid": ariaInvalid,
    "aria-describedby": describedBy,
    ref,
  }: {
    onChange: (doc: unknown) => void;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
    ref?: { current: { focus: () => void } | null };
  }) {
    // Same contract as the real editor's useImperativeHandle — the form's
    // focus-to-editor calls become observable.
    if (ref) ref.current = { focus: editorFocusSpy };
    return (
      <div
        data-testid="editor-stub"
        aria-invalid={ariaInvalid ? "true" : undefined}
        aria-describedby={describedBy}
      >
        <button type="button" onClick={() => onChange(VALID_DOC)}>
          stub: edit valid
        </button>
        <button type="button" onClick={() => onChange(IFRAME_DOC)}>
          stub: edit invalid
        </button>
      </div>
    );
  },
}));

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

const FORBIDDEN_EMBED_MESSAGE =
  "Video, iframe, embed, dan script tidak bisa dipasang di dalam teks.";

function okResponse(): Response {
  return new Response(
    JSON.stringify({
      data: { id: "l-1", updatedAt: "2026-11-07T02:04:00.000Z", isContentEmpty: false },
    }),
    { status: 200 },
  );
}

/** fetchMock answers via the returned handle; the promise stays pending
 *  until then — the in-flight window the K2/K3 tests edit inside. */
function pendingFetch(): (response: Response) => void {
  let resolveFetch!: (response: Response) => void;
  fetchMock.mockImplementation(
    () => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }),
  );
  return (response: Response) => resolveFetch(response);
}

function renderForm(overrides: Partial<ContentDocFormProps> = {}) {
  render(
    <ContentDocForm
      initialDoc={EMPTY_DOC as ContentDoc}
      saveUrl="/api/cms/courses/c-1/lessons/l-1"
      method="PATCH"
      bodyKey="content"
      labelId="lesson-content-label"
      breadcrumb={[
        { label: "Kursus", href: "/cms/kursus" },
        { label: "Judul Kursus", href: "/cms/kursus/c-1" },
        { label: "Materi 1", href: null },
      ]}
      heading="Judul materi"
      {...overrides}
    />,
  );
}

function editValid(): void {
  fireEvent.click(screen.getByText("stub: edit valid"));
}

function save(): void {
  fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
}

beforeEach(() => {
  fetchMock.mockReset();
  pushMock.mockReset();
  refreshMock.mockReset();
  editorFocusSpy.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ContentDocForm chrome", () => {
  it("renders the 21i header, heading, label + WAJIB, Simpan, and an empty indicator", () => {
    renderForm();

    expect(screen.getByRole("heading", { level: 1, name: "Judul materi" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Kursus" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Judul Kursus" })).toBeTruthy();
    // The last segment (href null) is not a link.
    expect(screen.getByText("Materi 1")).toBeTruthy();
    expect(screen.getByText("Teks materi")).toBeTruthy();
    expect(screen.getByText("WAJIB")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan" })).toBeTruthy();
    // The status region exists from load and is EMPTY before the first
    // edit — a stable live region for screen readers (review item).
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("labels the description variant 'Deskripsi'", () => {
    renderForm({
      saveUrl: "/api/cms/courses/c-1/description",
      method: "PUT",
      bodyKey: "description",
      labelId: "course-description-label",
    });

    expect(screen.getByText("Deskripsi")).toBeTruthy();
    expect(screen.queryByText("Teks materi")).toBeNull();
  });
});

describe("ContentDocForm save indicator", () => {
  it("lights BELUM DISIMPAN on the first edit only", () => {
    renderForm();
    editValid();

    expect(screen.getByRole("status").textContent).toBe("BELUM DISIMPAN");
  });

  it("shows ⟳ MENYIMPAN… while the request runs, then ✓ TERSIMPAN", async () => {
    const resolveFetch = pendingFetch();
    renderForm();
    editValid();
    save();

    expect(screen.getByRole("status").textContent).toBe("⟳ MENYIMPAN…");
    resolveFetch(okResponse());

    expect(await screen.findByText(/^✓ TERSIMPAN \d{2}:\d{2}$/)).toBeTruthy();
    expect(screen.queryByText("BELUM DISIMPAN")).toBeNull();
  });

  it("shows ⚠ GAGAL MENYIMPAN when the network fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderForm();
    editValid();
    save();

    expect(await screen.findByText("⚠ GAGAL MENYIMPAN")).toBeTruthy();
  });

  it("formats the saved clock as 24-hour HH:MM (09:05)", async () => {
    // Fake only Date (D5): RTL's findByText keeps real timers.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 7, 9, 5, 0));
    fetchMock.mockResolvedValue(okResponse());
    renderForm();
    editValid();
    save();

    expect(await screen.findByText("✓ TERSIMPAN 09:05")).toBeTruthy();
  });

  it("keeps BELUM DISIMPAN when an edit lands while the request is in flight (K3)", async () => {
    const resolveFetch = pendingFetch();
    renderForm();
    editValid();
    save();
    // A second edit while the request is pending: revision moved on.
    editValid();

    resolveFetch(okResponse());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // Fixed pause (not waitFor on the negation) so the 200 handling
    // settles before the assertion.
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(screen.getByRole("status").textContent).toBe("BELUM DISIMPAN");
    expect(screen.queryByText(/^✓ TERSIMPAN/)).toBeNull();
  });
});

describe("ContentDocForm save request", () => {
  it("sends exactly one PATCH with { content: doc }", async () => {
    fetchMock.mockResolvedValue(okResponse());
    renderForm();
    editValid();
    save();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/cms/courses/c-1/lessons/l-1");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "PATCH",
      headers: { "content-type": "application/json" },
    });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      content: VALID_DOC,
    });
  });

  it("sends the description form as PUT with { description: doc }", async () => {
    fetchMock.mockResolvedValue(okResponse());
    renderForm({
      saveUrl: "/api/cms/courses/c-1/description",
      method: "PUT",
      bodyKey: "description",
      labelId: "course-description-label",
    });
    editValid();
    save();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/cms/courses/c-1/description");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "PUT" });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      description: VALID_DOC,
    });
  });

  it("sends exactly one fetch when Ctrl+S fires while a save is in flight (K2)", async () => {
    const resolveFetch = pendingFetch();
    renderForm();
    editValid();
    save();
    expect(screen.getByRole("button", { name: "Menyimpan…" })).toBeTruthy();

    // The natively-disabled Simpan button cannot receive the second press;
    // Ctrl+S is the realistic in-flight probe. fireEvent returns false
    // when preventDefault ran (D7).
    expect(fireEvent.keyDown(window, { key: "s", ctrlKey: true })).toBe(false);
    // Fixed pause, never waitFor: waitFor(toHaveBeenCalledTimes(1)) would
    // pass on its first poll even if the guard were broken.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(okResponse());
  });

  it("returns focus to Simpan after a successful save", async () => {
    fetchMock.mockResolvedValue(okResponse());
    renderForm();
    editValid();
    save();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Simpan" })).toBe(
        document.activeElement,
      );
    });
  });
});

describe("ContentDocForm Ctrl+S / ⌘S", () => {
  it("saves through Ctrl+S and prevents the browser save dialog", async () => {
    fetchMock.mockResolvedValue(okResponse());
    renderForm();
    editValid();

    expect(fireEvent.keyDown(window, { key: "s", ctrlKey: true })).toBe(false);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("saves through Ctrl+S with a capital S (Caps Lock) as well", async () => {
    // Pin the toLowerCase() branch: deleting it must turn this red.
    fetchMock.mockResolvedValue(okResponse());
    renderForm();
    editValid();

    expect(fireEvent.keyDown(window, { key: "S", ctrlKey: true })).toBe(false);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("prevents Ctrl+S and ⌘S always — even without changes — but not Alt combos", () => {
    fetchMock.mockResolvedValue(okResponse());
    renderForm();

    expect(fireEvent.keyDown(window, { key: "s", ctrlKey: true })).toBe(false);
    expect(fireEvent.keyDown(window, { key: "s", metaKey: true })).toBe(false);
    // Alt combos belong to the OS/keyboard layout (AltGr = ctrlKey+altKey),
    // so they stay untouched (D7).
    expect(
      fireEvent.keyDown(window, { key: "s", ctrlKey: true, altKey: true }),
    ).toBe(true);
  });
});

describe("ContentDocForm validation", () => {
  it("rejects an invalid document client-side: no fetch, message, aria-invalid, editor focus", async () => {
    renderForm();
    fireEvent.click(screen.getByText("stub: edit invalid"));
    save();

    expect(await screen.findByText(FORBIDDEN_EMBED_MESSAGE)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("editor-stub").getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(editorFocusSpy).toHaveBeenCalled();
  });

  it("shows the server field message below the editor on 400 and focuses it", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Validasi input gagal",
            fields: [
              { path: "content.content.0.type", message: FORBIDDEN_EMBED_MESSAGE },
            ],
          },
        }),
        { status: 400 },
      ),
    );
    renderForm();
    editValid();
    save();

    expect(await screen.findByText(FORBIDDEN_EMBED_MESSAGE)).toBeTruthy();
    expect(editorFocusSpy).toHaveBeenCalled();
  });

  it("answers 413 with 'Teks terlalu panjang.' and focuses the editor", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "PAYLOAD_TOO_LARGE", message: "Teks terlalu panjang." },
        }),
        { status: 413 },
      ),
    );
    renderForm();
    editValid();
    save();

    expect(await screen.findByText("Teks terlalu panjang.")).toBeTruthy();
    expect(editorFocusSpy).toHaveBeenCalled();
  });

  it("shows the server banner on 409 and refreshes the page", async () => {
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
    renderForm();
    editValid();
    save();

    expect(
      await screen.findByText("Kursus sudah bukan draf — hanya draf yang bisa diubah."),
    ).toBeTruthy();
    expect(refreshMock).toHaveBeenCalled();
  });
});

describe("ContentDocForm network failure (20c)", () => {
  it("shows the red bar with Coba lagi, which re-sends and clears the bar", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetchMock.mockResolvedValueOnce(okResponse());
    renderForm();
    editValid();
    save();

    expect(await screen.findByText("Gagal menyimpan — koneksi terputus")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText("Gagal menyimpan — koneksi terputus")).toBeNull(),
    );
  });
});

describe("ContentDocForm unsaved-changes guards", () => {
  it("arms beforeunload only while there are unsaved changes", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const armed = () =>
      addSpy.mock.calls.filter(([type]) => type === "beforeunload").length;
    const disarmed = () =>
      removeSpy.mock.calls.filter(([type]) => type === "beforeunload").length;

    renderForm();
    expect(armed()).toBe(0);

    editValid();
    expect(armed()).toBe(1);

    fetchMock.mockResolvedValue(okResponse());
    save();
    await screen.findByText(/^✓ TERSIMPAN/);
    expect(disarmed()).toBe(1);
  });

  it("keeps beforeunload armed when an edit landed during the request (K3)", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const resolveFetch = pendingFetch();

    renderForm();
    editValid();
    save();
    editValid();
    resolveFetch(okResponse());
    await screen.findByText("BELUM DISIMPAN");

    const armed = addSpy.mock.calls.filter(([type]) => type === "beforeunload").length;
    const disarmed = removeSpy.mock.calls.filter(([type]) => type === "beforeunload").length;
    expect(armed).toBe(1);
    expect(disarmed).toBe(0);
  });

  it("opens the leave dialog on a plain breadcrumb click; Tetap di sini stays", async () => {
    renderForm();
    editValid();

    fireEvent.click(screen.getByRole("link", { name: "Judul Kursus" }));
    expect(await screen.findByText("Tinggalkan tanpa menyimpan?")).toBeTruthy();
    expect(
      screen.getByText("Perubahan sejak simpan terakhir akan hilang."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tetap di sini" }));
    await waitFor(() =>
      expect(screen.queryByText("Tinggalkan tanpa menyimpan?")).toBeNull(),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("navigates on Tinggalkan", async () => {
    renderForm();
    editValid();

    fireEvent.click(screen.getByRole("link", { name: "Judul Kursus" }));
    await screen.findByText("Tinggalkan tanpa menyimpan?");
    fireEvent.click(screen.getByRole("button", { name: "Tinggalkan" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/cms/kursus/c-1"));
  });

  it("lets modified-key clicks through without the dialog (D8)", () => {
    renderForm();
    editValid();

    fireEvent.click(screen.getByRole("link", { name: "Judul Kursus" }), {
      ctrlKey: true,
    });

    expect(screen.queryByText("Tinggalkan tanpa menyimpan?")).toBeNull();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("navigates freely when nothing changed", () => {
    renderForm();

    fireEvent.click(screen.getByRole("link", { name: "Judul Kursus" }));

    expect(screen.queryByText("Tinggalkan tanpa menyimpan?")).toBeNull();
  });
});
