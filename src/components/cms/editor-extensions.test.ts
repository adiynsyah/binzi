// @vitest-environment jsdom
/*
 * Headless editor tests (card S1-03b "Selesai jika"). An Editor without an
 * attached element never needs the Range polyfill the component tests use.
 */

import { afterAll, describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/react";

import { canInsertTable, createEditorExtensions } from "./editor-extensions";
import { EMPTY_DOC } from "@/lib/content-doc";
import { CONTENT_DOC_SHOWCASE } from "@/lib/content-doc-fixtures";
import { validateContentDoc } from "@/lib/content-doc-validator";

// Destroyed in afterAll: an editor left alive keeps a DOMObserver flush
// timer that fires after jsdom is torn down ("document is not defined").
const editors: Editor[] = [];

function makeEditor(content?: unknown): Editor {
  const editor = new Editor({
    extensions: createEditorExtensions(),
    // structuredClone also strips the fixtures' readonly arrays, which
    // JSONContent's mutable types do not accept.
    content: content === undefined ? undefined : (structuredClone(content) as JSONContent),
  });
  editors.push(editor);
  return editor;
}

afterAll(() => {
  for (const editor of editors) editor.destroy();
});

function expectValid(doc: unknown): void {
  const result = validateContentDoc(doc);
  if (!result.ok) {
    throw new Error(
      "dokumen tidak lolos validator: " + JSON.stringify(result.issues),
    );
  }
}

function walk(
  node: JSONContent | undefined,
  visit: (node: JSONContent) => void,
): void {
  if (!node) return;
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

function nodeTypes(doc: JSONContent): Set<string> {
  const types = new Set<string>();
  walk(doc, (node) => {
    if (typeof node.type === "string") types.add(node.type);
  });
  return types;
}

function linkHrefs(doc: JSONContent): string[] {
  const hrefs: string[] = [];
  walk(doc, (node) => {
    for (const mark of node.marks ?? []) {
      if (mark.type !== "link") continue;
      const href = mark.attrs?.href;
      if (typeof href === "string") hrefs.push(href);
    }
  });
  return hrefs;
}

function tableCount(doc: JSONContent): number {
  let count = 0;
  walk(doc, (node) => {
    if (node.type === "table") count += 1;
  });
  return count;
}

/** Put the cursor right before `needle`'s first text node. */
function cursorInText(editor: Editor, needle: string): void {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found === -1 && node.isText && node.text === needle) found = pos;
    return found === -1;
  });
  if (found === -1) throw new Error(`teks "${needle}" tidak ditemukan`);
  editor.commands.setTextSelection(found + 1);
}

function selectText(editor: Editor, needle: string): void {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found === -1 && node.isText && node.text === needle) found = pos;
    return found === -1;
  });
  if (found === -1) throw new Error(`teks "${needle}" tidak ditemukan`);
  editor.commands.setTextSelection({ from: found + 1, to: found + 1 + needle.length });
}

const textDoc = (value: string): JSONContent => ({
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: value }] },
  ],
});

// jsdom 29 has no ClipboardEvent constructor; view.pasteHTML/pasteText take
// a plain Event, with clipboardData defined on when a paste-as-text run
// needs it (card "Selesai jika", paste tests).
function pasteEvent(clipboard?: Record<string, string>): ClipboardEvent {
  const event = new Event("paste") as unknown as ClipboardEvent;
  if (clipboard) {
    Object.defineProperty(event, "clipboardData", {
      value: { getData: (type: string) => clipboard[type] ?? "" },
    });
  }
  return event;
}

describe("createEditorExtensions — skema", () => {
  it("berisi tepat 14 node dan 4 mark daftar putih S1-03a", () => {
    const editor = makeEditor();
    expect(Object.keys(editor.schema.nodes).sort()).toEqual([
      "blockquote",
      "bulletList",
      "doc",
      "hardBreak",
      "heading",
      "horizontalRule",
      "listItem",
      "orderedList",
      "paragraph",
      "table",
      "tableCell",
      "tableHeader",
      "tableRow",
      "text",
    ]);
    expect(Object.keys(editor.schema.marks).sort()).toEqual([
      "bold",
      "italic",
      "link",
      "underline",
    ]);
  });
});

describe("bolak-balik fitur — setiap perintah menghasilkan dokumen sah", () => {
  it("B, I, dan garis bawah pada seleksi", () => {
    for (const command of ["toggleBold", "toggleItalic", "toggleUnderline"] as const) {
      const editor = makeEditor(textDoc("kata"));
      selectText(editor, "kata");
      expect(editor.commands[command]()).toBe(true);
      expectValid(editor.getJSON());
    }
  });

  it("H2, H3, dan H4", () => {
    for (const level of [2, 3, 4] as const) {
      const editor = makeEditor(textDoc("Judul"));
      selectText(editor, "Judul");
      expect(editor.commands.toggleHeading({ level })).toBe(true);
      expectValid(editor.getJSON());
    }
  });

  it("list berpoin, list bernomor, dan list bersarang", () => {
    const bullet = makeEditor(textDoc("butir"));
    selectText(bullet, "butir");
    expect(bullet.commands.toggleBulletList()).toBe(true);
    expectValid(bullet.getJSON());

    const ordered = makeEditor(textDoc("nomor"));
    selectText(ordered, "nomor");
    expect(ordered.commands.toggleOrderedList()).toBe(true);
    expectValid(ordered.getJSON());

    const nested: JSONContent = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "luar" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "dalam" }] }] },
          ],
        },
      ],
    };
    const editor = makeEditor(nested);
    cursorInText(editor, "dalam");
    expect(editor.commands.sinkListItem("listItem")).toBe(true);
    expectValid(editor.getJSON());
  });

  it("setLink untuk https, mailto, dan halaman internal, lalu unsetLink", () => {
    for (const href of [
      "https://contoh.id/laman",
      "mailto:halo@contoh.id",
      "/kursus/x",
    ]) {
      const editor = makeEditor(textDoc("tautan"));
      selectText(editor, "tautan");
      expect(editor.commands.setLink({ href })).toBe(true);
      expectValid(editor.getJSON());
      expect(linkHrefs(editor.getJSON())).toEqual([href]);
      expect(editor.commands.unsetLink()).toBe(true);
      expectValid(editor.getJSON());
      expect(linkHrefs(editor.getJSON())).toEqual([]);
    }
  });

  it("pemisah baris di dalam teks tebal dan di dalam tautan", () => {
    const bold: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "satu dua", marks: [{ type: "bold" }] },
          ],
        },
      ],
    };
    const boldEditor = makeEditor(bold);
    cursorInText(boldEditor, "satu dua");
    expect(boldEditor.commands.setHardBreak()).toBe(true);
    expectValid(boldEditor.getJSON());

    const linked: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "a b",
              marks: [
                { type: "link", attrs: { href: "https://contoh.id" } },
              ],
            },
          ],
        },
      ],
    };
    const linkEditor = makeEditor(linked);
    cursorInText(linkEditor, "a b");
    expect(linkEditor.commands.setHardBreak()).toBe(true);
    expectValid(linkEditor.getJSON());
    // setHardBreak in 3.32.0 creates the break WITHOUT marks; the
    // validator accepts both shapes and the showcase roundtrip above
    // covers loading hardBreaks that DO carry marks.
    let breaks = 0;
    for (const editor of [boldEditor, linkEditor]) {
      walk(editor.getJSON(), (node) => {
        if (node.type === "hardBreak") breaks += 1;
      });
    }
    expect(breaks).toBe(2);
  });

  it("kutipan dan garis pemisah", () => {
    const quote = makeEditor(textDoc("kutipan"));
    selectText(quote, "kutipan");
    expect(quote.commands.toggleBlockquote()).toBe(true);
    expectValid(quote.getJSON());

    const rule = makeEditor(textDoc("kata"));
    cursorInText(rule, "kata");
    expect(rule.commands.setHorizontalRule()).toBe(true);
    expectValid(rule.getJSON());
  });

  it("siklus tabel: sisip → tambah baris → tambah kolom → hapus baris → hapus kolom → hapus tabel", () => {
    const editor = makeEditor();
    expect(editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true })).toBe(true);
    expectValid(editor.getJSON());
    expect(editor.commands.addRowAfter()).toBe(true);
    expectValid(editor.getJSON());
    expect(editor.commands.addColumnAfter()).toBe(true);
    expectValid(editor.getJSON());
    expect(editor.commands.deleteRow()).toBe(true);
    expectValid(editor.getJSON());
    expect(editor.commands.deleteColumn()).toBe(true);
    expectValid(editor.getJSON());
    expect(editor.commands.deleteTable()).toBe(true);
    expectValid(editor.getJSON());
    expect(tableCount(editor.getJSON())).toBe(0);
  });

  it("undo dan redo atas suntingan", () => {
    const editor = makeEditor(textDoc("kata"));
    selectText(editor, "kata");
    editor.commands.toggleHeading({ level: 2 });
    editor.commands.toggleBold();
    expectValid(editor.getJSON());
    expect(editor.commands.undo()).toBe(true);
    expectValid(editor.getJSON());
    expect(editor.commands.redo()).toBe(true);
    expectValid(editor.getJSON());
  });
});

describe("bolak-balik muat — dokumen dimuat lalu keluar idempoten", () => {
  // Card: the demo seed shape is written inline — importing seed-demo.ts
  // would run its main() DB connection.
  const SEED_DEMO_DOC: JSONContent = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "[CONTOH] Teks materi demo netral." }],
      },
    ],
  };

  it.each([
    ["showcase", CONTENT_DOC_SHOWCASE],
    ["EMPTY_DOC", EMPTY_DOC],
    ["bentuk seed demo", SEED_DEMO_DOC],
  ])("%s", (_name, doc) => {
    const first = makeEditor(doc as JSONContent).getJSON();
    expectValid(first);
    const second = makeEditor(first).getJSON();
    expect(second).toStrictEqual(first);
  });

  it("showcase tidak kembali identik dengan fixture (mark diurut ulang, content [] dibuang)", () => {
    const roundtrip = makeEditor(CONTENT_DOC_SHOWCASE).getJSON();
    expect(roundtrip).not.toStrictEqual(
      structuredClone(CONTENT_DOC_SHOWCASE) as unknown,
    );
  });
});

describe("tempel — semua hasil lolos validator", () => {
  it("HTML ala Google Docs dinormalkan ke daftar putih", () => {
    const editor = makeEditor();
    editor.view.pasteHTML(
      '<b style="font-weight:normal">tebal</b><h1>Judul besar</h1>' +
        "<h5>Judul kecil</h5><s>coret</s><code>kodo</code><pre>blok</pre>" +
        '<mark>tandai</mark><span style="color:red">merah</span>' +
        '<img src="https://example.com/g.png" alt="g">',
      pasteEvent(),
    );
    const doc = editor.getJSON();
    expectValid(doc);
    const types = nodeTypes(doc);
    for (const forbidden of ["strike", "code", "codeBlock", "image"]) {
      expect(types.has(forbidden)).toBe(false);
    }
    // h1/h5 fall outside levels 2–4, so they land as plain paragraphs.
    expect(types.has("heading")).toBe(false);
  });

  it("tautan #x dan javascript: ditempel sebagai teks biasa", () => {
    for (const href of ["#x", "javascript:alert(1)"]) {
      const editor = makeEditor();
      editor.view.pasteHTML(`<a href="${href}">tautan</a>`, pasteEvent());
      const doc = editor.getJSON();
      expectValid(doc);
      expect(linkHrefs(doc)).toEqual([]);
    }
  });

  it("strong berisi br menjadi hardBreak yang membawa mark", () => {
    const editor = makeEditor();
    editor.view.pasteHTML("<strong>a<br>b</strong>", pasteEvent());
    const doc = editor.getJSON();
    expectValid(doc);
    let marked = false;
    walk(doc, (node) => {
      if (node.type === "hardBreak" && node.marks?.some((m) => m.type === "bold")) {
        marked = true;
      }
    });
    expect(marked).toBe(true);
  });

  it("colgroup dengan width auto dan 120 menjadi colwidth null semua", () => {
    const editor = makeEditor();
    editor.view.pasteHTML(
      '<table><colgroup><col width="auto"><col width="120"></colgroup>' +
        "<tr><th>H1</th><th>H2</th></tr><tr><td>a</td><td>b</td></tr></table>",
      pasteEvent(),
    );
    const doc = editor.getJSON();
    expectValid(doc);
    walk(doc, (node) => {
      if (node.type === "tableCell" || node.type === "tableHeader") {
        expect(node.attrs?.colwidth).toBeNull();
      }
    });
  });

  it("iframe, video, dan script dibuang dengan teks di sekitarnya tetap utuh", () => {
    const editor = makeEditor();
    editor.view.pasteHTML(
      'sebelum<iframe src="https://example.com/e"></iframe>di tengah' +
        '<video src="https://example.com/v.mp4"></video>' +
        "<script>alert(1)</script>sesudah",
      pasteEvent(),
    );
    const doc = editor.getJSON();
    expectValid(doc);
    let text = "";
    walk(doc, (node) => {
      if (typeof node.text === "string") text += node.text + " ";
    });
    expect(text).toContain("sebelum");
    expect(text).toContain("sesudah");
  });
});

describe("setLink di luar daftar putih ditolak", () => {
  it("javascript:, ftp:, dan tel: mengembalikan false tanpa mengubah dokumen", () => {
    const editor = makeEditor(textDoc("tautan"));
    selectText(editor, "tautan");
    const before = editor.getJSON();
    expect(editor.commands.setLink({ href: "javascript:alert(1)" })).toBe(false);
    expect(editor.commands.setLink({ href: "ftp://contoh.id/x" })).toBe(false);
    expect(editor.commands.setLink({ href: "tel:0812" })).toBe(false);
    expect(editor.getJSON()).toStrictEqual(before);
  });
});

describe("tautan otomatis", () => {
  const type = (editor: Editor, value: string): void => {
    for (const char of value) editor.commands.insertContent(char);
  };

  it("https:// yang diketik per huruf lalu spasi menjadi tautan", () => {
    const editor = makeEditor(textDoc(""));
    type(editor, "https://contoh.id ");
    const doc = editor.getJSON();
    expectValid(doc);
    expect(linkHrefs(doc)).toEqual(["https://contoh.id"]);
  });

  it("https:// yang ditempel sebagai teks menjadi tautan", () => {
    const editor = makeEditor();
    editor.view.pasteText(
      "https://contoh.id",
      pasteEvent({ "text/plain": "https://contoh.id" }),
    );
    const doc = editor.getJSON();
    expectValid(doc);
    expect(linkHrefs(doc)).toEqual(["https://contoh.id"]);
  });

  it("ftp://, domain tanpa skema, dan email tetap teks biasa", () => {
    for (const value of [
      "ftp://contoh.id/berkas ",
      "contoh.id ",
      "ahli@contoh.id ",
    ]) {
      const editor = makeEditor(textDoc(""));
      type(editor, value);
      const doc = editor.getJSON();
      expectValid(doc);
      expect(linkHrefs(doc)).toEqual([]);
    }
  });
});

describe("sisip teks bertautan pada seleksi kosong", () => {
  it("ketikan berikutnya tidak membawa mark link dan dokumen tetap sah", () => {
    const editor = makeEditor(textDoc("awal "));
    // Collapsed cursor right after "awal " (end of the paragraph).
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    expect(
      editor
        .chain()
        .insertContent({
          type: "text",
          text: "https://contoh.id",
          marks: [{ type: "link", attrs: { href: "https://contoh.id" } }],
        })
        .unsetMark("link")
        .run(),
    ).toBe(true);
    expect(linkHrefs(editor.getJSON())).toEqual(["https://contoh.id"]);
    // insertContent at the collapsed cursor goes through storedMarks,
    // exactly like typed input — the unsetMark above left the link mark
    // out of them.
    expect(editor.commands.insertContent("x")).toBe(true);
    const doc = editor.getJSON();
    expectValid(doc);
    let tailPlain = false;
    walk(doc, (node) => {
      if (node.type === "text" && node.text === "x") {
        tailPlain = !(node.marks ?? []).some((mark) => mark.type === "link");
      }
    });
    expect(tailPlain).toBe(true);
  });
});

describe("tabel", () => {
  const tableDoc: JSONContent = {
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
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "Kolom satu" }] },
                ],
              },
              {
                type: "tableCell",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "Isi sel" }] },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  it("canInsertTable false di dalam sel dan true di paragraf", () => {
    const inCell = makeEditor(tableDoc);
    cursorInText(inCell, "Isi sel");
    expect(inCell.isActive("table")).toBe(true);
    expect(canInsertTable(inCell)).toBe(false);

    const inParagraph = makeEditor(textDoc("kata"));
    cursorInText(inParagraph, "kata");
    expect(canInsertTable(inParagraph)).toBe(true);
  });

  it("menempel tabel saat kursor di sel tetap menghasilkan satu tabel", () => {
    const editor = makeEditor(tableDoc);
    cursorInText(editor, "Isi sel");
    editor.view.pasteHTML(
      "<table><tr><td>x</td></tr></table>",
      pasteEvent(),
    );
    const doc = editor.getJSON();
    expectValid(doc);
    expect(tableCount(doc)).toBe(1);
  });
});
