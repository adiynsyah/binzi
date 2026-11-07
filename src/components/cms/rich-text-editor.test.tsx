// @vitest-environment jsdom
/*
 * RichTextEditor component tests (card S1-03b "Tes komponen").
 *
 * The Range polyfill MUST live here, not in test-env.ts: ProseMirror's
 * scrollToSelection calls Range.prototype.getClientRects and
 * getBoundingClientRect on every chain().focus() against a DOM-attached
 * editor, jsdom 29 does not implement them, and the unhandled TypeError
 * makes Vitest exit 1 even with every test green (verified 7 Nov).
 *
 * jsdom input facts used below (verified 7 Nov): keyPress inserts
 * nothing — text is entered by mutating a canvas text node and moving
 * the DOM selection, which ProseMirror's DOMObserver reads as one edit;
 * DOM selection is mapped to a ProseMirror selection via a
 * "selectionchange" event; DropdownMenu opens on pointerDown.
 */

Range.prototype.getClientRects = function (): DOMRectList {
  return [] as unknown as DOMRectList;
};
Range.prototype.getBoundingClientRect = function (): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  } as DOMRect;
};

import "../ui/test-env";

import { renderToString } from "react-dom/server";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { JSONContent } from "@tiptap/react";

// Stub the CSS Module: vitest would otherwise run it through PostCSS
// (the project config is Tailwind-based, unresolvable in the test
// runtime). Tests assert semantics, never class names.
vi.mock("./rich-text-editor.module.css", () => ({
  default: { frame: "frame", canvas: "canvas", canvasPlaceholder: "canvasPlaceholder" },
}));

import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "./rich-text-editor";
import { EMPTY_DOC, type ContentDoc } from "@/lib/content-doc";
import { CONTENT_DOC_MESSAGES, validateContentDoc } from "@/lib/content-doc-validator";

const TEXT_DOC: ContentDoc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "kata contoh" }] },
  ],
};

/** Ends with a table — the editing-rule test's trigger. */
const TABLE_DOC: ContentDoc = {
  type: "doc",
  content: [
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableHeader",
              attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Isi sel" }] },
              ],
            },
            {
              type: "tableCell",
              attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
              content: [
                { type: "paragraph", content: [{ type: "text", text: "sel dua" }] },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const LINKED_DOC: ContentDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "tautan contoh",
          marks: [
            {
              type: "link",
              attrs: {
                href: "https://contoh.id/laman",
                target: "_blank",
                rel: "noopener noreferrer",
                class: null,
                title: null,
              },
            },
          ],
        },
      ],
    },
  ],
};

function renderEditor(overrides: Partial<RichTextEditorProps> = {}) {
  const onChange = vi.fn();
  const props: RichTextEditorProps = {
    defaultValue: TEXT_DOC,
    onChange,
    "aria-labelledby": "judul-isian",
    ...overrides,
  };
  const utils = render(<RichTextEditor {...props} />);
  return { onChange, ...utils };
}

function getCanvas(): HTMLElement {
  const canvas = document.querySelector<HTMLElement>(".ProseMirror");
  if (!canvas) throw new Error("kanvas belum siap");
  return canvas;
}

function findText(root: HTMLElement, needle: string): Text {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if ((node as Text).data.includes(needle)) return node as Text;
    node = walker.nextNode();
  }
  throw new Error(`teks "${needle}" tidak ditemukan di kanvas`);
}

/** DOM selection → ProseMirror selection (card: setBaseAndExtent + event). */
function selectInCanvas(canvas: HTMLElement, needle: string, collapsed = false): void {
  canvas.focus();
  const target = findText(canvas, needle);
  const start = target.data.indexOf(needle);
  const end = collapsed ? start : start + needle.length;
  document.getSelection()?.setBaseAndExtent(target, start, target, end);
  document.dispatchEvent(new Event("selectionchange"));
}

/** One "keystroke": append to the last text node, then move the DOM
 *  selection to its end — DOMObserver reads it as a single edit. */
async function typeInCanvas(append: string): Promise<void> {
  const canvas = getCanvas();
  canvas.focus();
  const walker = document.createTreeWalker(canvas, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let last: Text | null = null;
  while (node) {
    last = node as Text;
    node = walker.nextNode();
  }
  if (!last) throw new Error("tidak ada node teks untuk diketik");
  const original = last.data;
  await act(async () => {
    last!.data = original + append;
    const offset = last!.data.length;
    document.getSelection()?.setBaseAndExtent(last!, offset, last!, offset);
    document.dispatchEvent(new Event("selectionchange"));
  });
}

function walkDoc(node: JSONContent | undefined, visit: (node: JSONContent) => void): void {
  if (!node) return;
  visit(node);
  for (const child of node.content ?? []) walkDoc(child, visit);
}

function linkHrefs(doc: JSONContent | undefined): string[] {
  const hrefs: string[] = [];
  walkDoc(doc, (node) => {
    for (const mark of node.marks ?? []) {
      if (mark.type !== "link") continue;
      const href = mark.attrs?.href;
      if (typeof href === "string") hrefs.push(href);
    }
  });
  return hrefs;
}

function nodeCount(doc: JSONContent | undefined, type: string): number {
  let count = 0;
  walkDoc(doc, (node) => {
    if (node.type === type) count += 1;
  });
  return count;
}

async function openTableMenu(): Promise<HTMLElement> {
  // Focusing the canvas first is REQUIRED in jsdom: without a focused
  // ProseMirror, Radix defers the item select forever and the click is a
  // no-op (verified — calls stay 0). In a real browser the pointer event
  // itself carries focus, so this only mirrors reality.
  getCanvas().focus();
  fireEvent.pointerDown(screen.getByRole("button", { name: "Tabel" }), {
    button: 0,
  });
  return screen.findByRole("menu");
}

async function tableItem(name: string): Promise<HTMLElement> {
  const menu = await openTableMenu();
  return within(menu).getByRole("menuitem", { name });
}

/** Open the menu, click one item, and wait for the menu to close. */
async function clickTableItem(name: string): Promise<void> {
  fireEvent.click(await tableItem(name));
  await waitFor(() => {
    expect(screen.queryByRole("menu")).toBeNull();
  });
}

async function closeTableMenu(menu: HTMLElement): Promise<void> {
  fireEvent.keyDown(menu, { key: "Escape" });
  await waitFor(() => {
    expect(screen.queryByRole("menu")).toBeNull();
  });
}

describe("toolbar", () => {
  it("bernama Format teks dan aria-controls menunjuk kanvas", () => {
    renderEditor();
    const toolbar = screen.getByRole("toolbar", { name: "Format teks" });
    const canvas = getCanvas();
    expect(canvas.id).not.toBe("");
    expect(toolbar.getAttribute("aria-controls")).toBe(canvas.id);
  });

  it("ketujuh tombol bernama sesuai tabel bagian 4 kartu", () => {
    renderEditor();
    for (const name of [
      "Tebal",
      "Miring",
      "Judul bagian (H2)",
      "Daftar berpoin",
      "Daftar bernomor",
      "Tautan",
      "Tabel",
    ]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("klik Tebal → aria-pressed true dan seleksi menjadi strong di kanvas", () => {
    renderEditor();
    const canvas = getCanvas();
    selectInCanvas(canvas, "kata");
    fireEvent.click(screen.getByRole("button", { name: "Tebal" }));
    expect(screen.getByRole("button", { name: "Tebal" }).getAttribute("aria-pressed")).toBe("true");
    expect(canvas.querySelector("strong")?.textContent).toBe("kata");
  });

  it("roving tabindex: satu tombol di urutan Tab; panah berputar; Home/End ke ujung", () => {
    renderEditor();
    const toolbar = screen.getByRole("toolbar", { name: "Format teks" });
    const buttons = () =>
      Array.from(toolbar.querySelectorAll<HTMLButtonElement>("[data-toolbar-button]"));
    const focusedIndex = () => buttons().findIndex((button) => button === document.activeElement);
    // Browsers dispatch keydown from the FOCUSED button; the handler
    // ignores keys from anything else (see the menu test below).
    const keyOnFocused = (key: string) => {
      const active = document.activeElement;
      if (!active) throw new Error("tidak ada elemen terfokus");
      fireEvent.keyDown(active, { key });
    };

    expect(buttons().filter((button) => button.tabIndex === 0)).toHaveLength(1);
    const first = buttons()[0];
    if (!first) throw new Error("tombol pertama tidak ditemukan");
    expect(first.tabIndex).toBe(0);

    first.focus();
    keyOnFocused("ArrowRight");
    expect(focusedIndex()).toBe(1);
    keyOnFocused("End");
    expect(focusedIndex()).toBe(6);
    keyOnFocused("ArrowRight");
    expect(focusedIndex()).toBe(0);
    keyOnFocused("Home");
    expect(focusedIndex()).toBe(0);
    keyOnFocused("ArrowLeft");
    expect(focusedIndex()).toBe(6);
  });

  it("panah dari dalam menu Tabel tidak menggerakkan roving tabindex", async () => {
    // The menu renders in a portal, but its React keydown events bubble
    // into the toolbar handler — they must be ignored there (review
    // item 4). The toolbar is grabbed BEFORE opening: Radix aria-hides
    // the rest of the page while the menu is open.
    renderEditor();
    const toolbar = screen.getByRole("toolbar", { name: "Format teks" });
    const menu = await openTableMenu();
    const firstItem = within(menu).getAllByRole("menuitem")[0];
    if (!firstItem) throw new Error("item menu tidak ditemukan");
    fireEvent.keyDown(firstItem, { key: "ArrowRight" });
    const tabbable = Array.from(
      toolbar.querySelectorAll<HTMLButtonElement>("[data-toolbar-button]"),
    ).filter((button) => button.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]?.getAttribute("aria-label")).toBe("Tebal");
    await closeTableMenu(menu);
  });
});

describe("aturan suntingan", () => {
  it("fokus pada dokumen berakhir tabel tidak memanggil onChange; satu ketikan → sekali, dokumen sah", async () => {
    const { onChange } = renderEditor({ defaultValue: TABLE_DOC });
    const canvas = getCanvas();
    await act(async () => {
      canvas.focus();
    });
    expect(onChange).not.toHaveBeenCalled();
    await typeInCanvas("x");
    expect(onChange).toHaveBeenCalledTimes(1);
    const typedDoc = onChange.mock.calls[0]?.[0];
    expect(typedDoc).toBeTruthy();
    expect(validateContentDoc(typedDoc).ok).toBe(true);
  });
});

describe("atribut kanvas", () => {
  it("role, aria-multiline, aria-labelledby ada; describedby/invalid absen bila tidak diberikan", () => {
    renderEditor();
    const canvas = getCanvas();
    expect(canvas.getAttribute("role")).toBe("textbox");
    expect(canvas.getAttribute("aria-multiline")).toBe("true");
    expect(canvas.getAttribute("aria-labelledby")).toBe("judul-isian");
    expect(canvas.hasAttribute("aria-describedby")).toBe(false);
    expect(canvas.hasAttribute("aria-invalid")).toBe(false);
  });

  it("aria-invalid dari prop bertahan setelah re-render karena prop lain", () => {
    const { rerender } = renderEditor({ "aria-invalid": true });
    const canvas = getCanvas();
    expect(canvas.getAttribute("aria-invalid")).toBe("true");
    rerender(
      <RichTextEditor
        defaultValue={TEXT_DOC}
        onChange={() => {}}
        aria-labelledby="judul-isian"
        aria-invalid
        className="lebih-lebar"
      />,
    );
    expect(canvas.getAttribute("aria-invalid")).toBe("true");
    rerender(
      <RichTextEditor
        defaultValue={TEXT_DOC}
        onChange={() => {}}
        aria-labelledby="judul-isian"
        aria-describedby="bantuan"
        aria-invalid
      />,
    );
    expect(canvas.getAttribute("aria-invalid")).toBe("true");
    expect(canvas.getAttribute("aria-describedby")).toBe("bantuan");
  });

  it("ref.focus() memfokuskan kanvas", async () => {
    const handle: { current: RichTextEditorHandle | null } = { current: null };
    render(
      <RichTextEditor
        ref={handle}
        defaultValue={TEXT_DOC}
        onChange={() => {}}
        aria-labelledby="judul-isian"
      />,
    );
    act(() => {
      handle.current?.focus();
    });
    // TipTap's focus command runs view.focus() in a requestAnimationFrame.
    await waitFor(() => {
      expect(document.activeElement).toBe(getCanvas());
    });
  });
});

describe("di dalam formulir", () => {
  it("tombol toolbar, kirim dialog tautan, dan item menu tabel tidak memicu submit formulir induk", async () => {
    const onSubmit = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <RichTextEditor
          defaultValue={TEXT_DOC}
          onChange={() => {}}
          aria-labelledby="judul-isian"
        />
      </form>,
    );
    const canvas = getCanvas();
    selectInCanvas(canvas, "kata");
    for (const name of ["Tebal", "Miring", "Judul bagian (H2)", "Daftar berpoin", "Daftar bernomor"]) {
      fireEvent.click(screen.getByRole("button", { name }));
    }

    fireEvent.click(screen.getByRole("button", { name: "Tautan" }));
    const dialog = await screen.findByRole("dialog", { name: "Pasang tautan" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Alamat tautan" }), {
      target: { value: "https://contoh.id" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Pasang" }));

    fireEvent.click(await tableItem("Sisipkan tabel 3 × 3"));
    // Leave no menu open: an unmounted-mid-close portal leaks into the
    // next tests' role queries.
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("dialog tautan", () => {
  it("javascript:x → pesan INVALID_LINK, isian aria-invalid, fokus tetap di isian, dokumen tidak berubah", async () => {
    const { onChange } = renderEditor();
    selectInCanvas(getCanvas(), "kata");
    fireEvent.click(screen.getByRole("button", { name: "Tautan" }));
    const dialog = await screen.findByRole("dialog", { name: "Pasang tautan" });
    const input = within(dialog).getByRole("textbox", { name: "Alamat tautan" });
    fireEvent.change(input, { target: { value: "javascript:x" } });
    // Chrome moves focus to the button on mousedown, before the click
    // handlers run — simulate that, then expect the error path to put
    // focus back in the field (review item 2).
    const submit = within(dialog).getByRole("button", { name: "Pasang" });
    submit.focus();
    fireEvent.click(submit);
    expect(screen.getByText(CONTENT_DOC_MESSAGES.INVALID_LINK)).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByRole("dialog")).toBeTruthy(); // dialog stays open
    expect(document.activeElement).toBe(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("spasi di tepi dipangkas:  https://contoh.id  terpasang bersih, fokus kembali ke kanvas", async () => {
    const { onChange } = renderEditor();
    selectInCanvas(getCanvas(), "kata");
    fireEvent.click(screen.getByRole("button", { name: "Tautan" }));
    const dialog = await screen.findByRole("dialog", { name: "Pasang tautan" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Alamat tautan" }), {
      target: { value: "  https://contoh.id  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Pasang" }));
    expect(linkHrefs(onChange.mock.lastCall?.[0])).toEqual(["https://contoh.id"]);
    await waitFor(() => {
      expect(document.activeElement).toBe(getCanvas());
    });
  });

  it("seleksi kosong di luar tautan: alamat disisipkan sebagai teks bertautan", async () => {
    const { onChange } = renderEditor({ defaultValue: EMPTY_DOC });
    fireEvent.click(screen.getByRole("button", { name: "Tautan" }));
    const dialog = await screen.findByRole("dialog", { name: "Pasang tautan" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Alamat tautan" }), {
      target: { value: "https://contoh.id" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Pasang" }));
    const doc = onChange.mock.lastCall?.[0];
    expect(linkHrefs(doc)).toEqual(["https://contoh.id"]);
    expect(validateContentDoc(doc).ok).toBe(true);
  });

  it("mode ubah: isian terisi href, Hapus tautan melepasnya, fokus kembali ke kanvas", async () => {
    const { onChange } = renderEditor({ defaultValue: LINKED_DOC });
    const canvas = getCanvas();
    selectInCanvas(canvas, "contoh", true);
    fireEvent.click(screen.getByRole("button", { name: "Tautan" }));
    const dialog = await screen.findByRole("dialog", { name: "Ubah tautan" });
    const input = within(dialog).getByRole("textbox", { name: "Alamat tautan" }) as HTMLInputElement;
    expect(input.value).toBe("https://contoh.id/laman");
    fireEvent.click(within(dialog).getByRole("button", { name: "Hapus tautan" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(linkHrefs(onChange.mock.lastCall?.[0])).toEqual([]);
    await waitFor(() => {
      expect(document.activeElement).toBe(canvas);
    });
  });

  it("Batal menutup dialog tanpa mengubah dokumen, fokus kembali ke kanvas", async () => {
    const { onChange } = renderEditor();
    selectInCanvas(getCanvas(), "kata");
    fireEvent.click(screen.getByRole("button", { name: "Tautan" }));
    const dialog = await screen.findByRole("dialog", { name: "Pasang tautan" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Batal" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(document.activeElement).toBe(getCanvas());
    });
  });
});

describe("menu tabel", () => {
  it("di paragraf: Sisipkan aktif dan lima perintah lain nonaktif; di sel kebalikannya", async () => {
    renderEditor();
    getCanvas().focus();
    const menu = await openTableMenu();
    expect(
      within(menu).getByRole("menuitem", { name: "Sisipkan tabel 3 × 3" }).hasAttribute("data-disabled"),
    ).toBe(false);
    for (const name of [
      "Tambah baris di bawah",
      "Tambah kolom di kanan",
      "Hapus baris",
      "Hapus kolom",
      "Hapus tabel",
    ]) {
      expect(within(menu).getByRole("menuitem", { name }).hasAttribute("data-disabled")).toBe(true);
    }
    await closeTableMenu(menu);

    // Inserting puts the cursor inside a header cell.
    await clickTableItem("Sisipkan tabel 3 × 3");
    const inCellMenu = await openTableMenu();
    expect(
      within(inCellMenu).getByRole("menuitem", { name: "Sisipkan tabel 3 × 3" }).hasAttribute("data-disabled"),
    ).toBe(true);
    for (const name of [
      "Tambah baris di bawah",
      "Tambah kolom di kanan",
      "Hapus baris",
      "Hapus kolom",
      "Hapus tabel",
    ]) {
      expect(
        within(inCellMenu).getByRole("menuitem", { name }).hasAttribute("data-disabled"),
      ).toBe(false);
    }
    await closeTableMenu(inCellMenu);
  });

  it("setiap item mengubah dokumen sesuai perintahnya", async () => {
    const { onChange } = renderEditor();
    const lastDoc = () => onChange.mock.lastCall?.[0];

    await clickTableItem("Sisipkan tabel 3 × 3");
    expect(nodeCount(lastDoc(), "tableRow")).toBe(3);
    expect(validateContentDoc(lastDoc()).ok).toBe(true);

    await clickTableItem("Tambah baris di bawah");
    expect(nodeCount(lastDoc(), "tableRow")).toBe(4);
    await clickTableItem("Tambah kolom di kanan");
    // 4 rows × 4 columns (the header row included in both counts).
    expect(nodeCount(lastDoc(), "tableCell") + nodeCount(lastDoc(), "tableHeader")).toBe(16);
    await clickTableItem("Hapus baris");
    expect(nodeCount(lastDoc(), "tableRow")).toBe(3);
    await clickTableItem("Hapus kolom");
    expect(nodeCount(lastDoc(), "tableCell") + nodeCount(lastDoc(), "tableHeader")).toBe(9);
    await clickTableItem("Hapus tabel");
    expect(nodeCount(lastDoc(), "table")).toBe(0);
    expect(validateContentDoc(lastDoc()).ok).toBe(true);
  });
});

describe("penolakan tempel 20b", () => {
  const YOUTUBE_URL = "https://www.youtube.com/watch?v=abc123";

  /** Synthetic clipboard for fireEvent.paste — the canvas takes the paste
   *  like a real one would, focused (card "Ketahui"). */
  function pasteClipboard(data: Record<string, string>): void {
    const canvas = getCanvas();
    canvas.focus();
    fireEvent.paste(canvas, {
      clipboardData: {
        getData: (type: string) => data[type] ?? "",
      },
    });
  }

  function docText(doc: JSONContent | undefined): string {
    let text = "";
    walkDoc(doc, (node) => {
      if (typeof node.text === "string") text += node.text;
    });
    return text;
  }

  it("URL YouTube: panel video-link tampil, fokus di tombol utama, dokumen belum berubah; Batal membiarkannya", async () => {
    const { onChange } = renderEditor();
    pasteClipboard({ "text/plain": YOUTUBE_URL });
    const panel = screen.getByRole("group", {
      name: "Video tidak bisa dipasang di dalam teks",
    });
    expect(document.activeElement).toBe(
      within(panel).getByRole("button", { name: "Sisipkan sebagai tautan teks" }),
    );
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole("button", { name: "Batal" }));
    await waitFor(() => {
      expect(screen.queryByRole("group")).toBeNull();
    });
    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(document.activeElement).toBe(getCanvas());
    });
  });

  it("Sisipkan sebagai tautan teks → URL menjadi teks bertautan yang sah, fokus ke kanvas", async () => {
    const { onChange } = renderEditor({ defaultValue: EMPTY_DOC });
    pasteClipboard({ "text/plain": YOUTUBE_URL });
    fireEvent.click(screen.getByRole("button", { name: "Sisipkan sebagai tautan teks" }));
    await waitFor(() => {
      expect(screen.queryByRole("group")).toBeNull();
    });
    const doc = onChange.mock.lastCall?.[0];
    expect(linkHrefs(doc)).toEqual([YOUTUBE_URL]);
    expect(validateContentDoc(doc).ok).toBe(true);
    await waitFor(() => {
      expect(document.activeElement).toBe(getCanvas());
    });
  });

  it("HTML berisi iframe: Tempel tanpa bagian itu menempel teks di sekitarnya tanpa iframe", async () => {
    const { onChange } = renderEditor();
    pasteClipboard({
      "text/html":
        'sebelum<iframe src="https://example.com/e"></iframe>di tengah',
    });
    const panel = screen.getByRole("group", {
      name: "Sebagian isi tempelan tidak bisa dipasang",
    });
    expect(document.activeElement).toBe(
      within(panel).getByRole("button", { name: "Tempel tanpa bagian itu" }),
    );
    fireEvent.click(within(panel).getByRole("button", { name: "Tempel tanpa bagian itu" }));
    await waitFor(() => {
      expect(screen.queryByRole("group")).toBeNull();
    });
    const doc = onChange.mock.lastCall?.[0];
    expect(validateContentDoc(doc).ok).toBe(true);
    const text = docText(doc);
    expect(text).toContain("sebelum");
    expect(text).toContain("di tengah");
  });

  it("kode sematan sebagai teks: hanya tombol Tutup, dokumen tidak berubah", async () => {
    const { onChange } = renderEditor();
    pasteClipboard({
      "text/plain": '<iframe src="https://www.youtube.com/embed/abc123"></iframe>',
    });
    const panel = screen.getByRole("group", {
      name: "Kode sematan tidak bisa dipasang di dalam teks",
    });
    expect(within(panel).getAllByRole("button")).toHaveLength(1);
    fireEvent.click(within(panel).getByRole("button", { name: "Tutup" }));
    await waitFor(() => {
      expect(screen.queryByRole("group")).toBeNull();
    });
    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(document.activeElement).toBe(getCanvas());
    });
  });

  it("Esc di panel sama dengan Batal", async () => {
    const { onChange } = renderEditor();
    pasteClipboard({ "text/plain": YOUTUBE_URL });
    fireEvent.keyDown(screen.getByRole("group", { name: "Video tidak bisa dipasang di dalam teks" }), {
      key: "Escape",
    });
    await waitFor(() => {
      expect(screen.queryByRole("group")).toBeNull();
    });
    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(document.activeElement).toBe(getCanvas());
    });
  });
});

describe("render server", () => {
  it("renderToString tidak melempar dan memuat toolbar yang tombolnya nonaktif", () => {
    const html = renderToString(
      <RichTextEditor
        defaultValue={TEXT_DOC}
        onChange={() => {}}
        aria-labelledby="judul-isian"
      />,
    );
    expect(html).toContain("Format teks");
    expect(html).toContain("Tebal");
    expect(html).toContain("disabled");
  });
});
