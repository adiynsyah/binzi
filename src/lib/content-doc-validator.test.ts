// Validator tests (card S1-03a "Selesai jika"). V-08 cases assert the
// EXACT single issue (toStrictEqual) including path — the owner-approved
// path conventions. Limit tests are built from the counting rules in the
// validator's header comment.
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { EMPTY_DOC } from "./content-doc";
import { CONTENT_DOC_SHOWCASE } from "./content-doc-fixtures";
import {
  MAX_ISSUES,
  contentDocSchema,
  validateContentDoc,
} from "./content-doc-validator";

// ---- Helpers: plain JSON builders (input is always `unknown`) ----

type Json = Record<string, unknown>;

const doc = (content: unknown): Json => ({ type: "doc", content });
const para = (content?: unknown): Json =>
  content === undefined
    ? { type: "paragraph" }
    : { type: "paragraph", content };
const text = (value: string, marks?: unknown[]): Json =>
  marks === undefined
    ? { type: "text", text: value }
    : { type: "text", text: value, marks };
const heading = (level: unknown, content?: unknown): Json => ({
  type: "heading",
  attrs: { level },
  ...(content === undefined ? {} : { content }),
});
const embedInListItem = (type: string): Json =>
  doc([
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [para([text("pesan")]), { type }],
        },
      ],
    },
  ]);
const embedInBlockquote = (type: string): Json =>
  doc([
    {
      type: "blockquote",
      content: [para([text("pesan")]), { type }],
    },
  ]);

const cell = (content: unknown, attrs?: Json): Json => ({
  type: "tableCell",
  attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null, ...attrs },
  content,
});
/** Each row argument is an array of cells. */
const table = (...rows: unknown[][]): Json => ({
  type: "table",
  content: rows.map((r) => ({ type: "tableRow", content: r })),
});

const codes = (result: ReturnType<typeof validateContentDoc>): string[] =>
  result.ok ? [] : result.issues.map((issue) => issue.code);

describe("validateContentDoc · dokumen sah", () => {
  it("EMPTY_DOC, bentuk seed demo, showcase, dan paragraf content: []", () => {
    const seedShape = doc([para([text("[DEMO] Teks materi contoh")])]);
    expect(validateContentDoc(EMPTY_DOC).ok).toBe(true);
    expect(validateContentDoc(seedShape).ok).toBe(true);
    expect(validateContentDoc(CONTENT_DOC_SHOWCASE).ok).toBe(true);
    expect(validateContentDoc(doc([para([])])).ok).toBe(true);
  });

  it("keluaran deep-equal dengan input, tetapi objek baru (pola serializer)", () => {
    const input = doc([
      para([text("satu "), text("dua", [{ type: "bold" }])]),
      para(),
      heading(2, [text("judul")]),
    ]);
    const result = validateContentDoc(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc).toStrictEqual(input);
    expect(result.doc).not.toBe(input);
    const inputContent = input.content as unknown[];
    expect(result.doc.content[0]).not.toBe(inputContent[0]);
    expect(result.doc.content[0]).toStrictEqual(inputContent[0]);
  });

  it("showcase menghasilkan keluaran deep-equal dan bukan objek yang sama", () => {
    const result = validateContentDoc(CONTENT_DOC_SHOWCASE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc).toStrictEqual(CONTENT_DOC_SHOWCASE);
    expect(result.doc).not.toBe(CONTENT_DOC_SHOWCASE);
  });

  it("kehadiran key opsional dipertahankan persis (content/marks)", () => {
    const input = doc([
      para(), // tanpa content
      para([]), // content: []
      para([text("a")]), // text tanpa marks
      para([{ type: "hardBreak" }]), // hardBreak tanpa marks
    ]);
    const result = validateContentDoc(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc).toStrictEqual(input);
    expect(Object.hasOwn(result.doc.content[1] as Json, "content")).toBe(true);
    expect(Object.hasOwn(result.doc.content[0] as Json, "content")).toBe(false);
    const withText = result.doc.content[2] as {
      content?: { [key: string]: unknown }[];
    };
    expect(Object.hasOwn(withText.content?.[0] as object, "marks")).toBe(
      false,
    );
  });
});

describe("validateContentDoc · V-08 node terlarang", () => {
  const EMBEDS = [
    "video",
    "iframe",
    "embed",
    "object",
    "script",
    "audio",
    "youtube",
  ] as const;

  it.each(EMBEDS)("di tingkat atas: %s → tepat satu FORBIDDEN_EMBED", (type) => {
    const result = validateContentDoc(doc([para([text("a")]), { type }]));
    expect(result).toStrictEqual({
      ok: false,
      issues: [
        {
          path: ["content", 1, "type"],
          code: "FORBIDDEN_EMBED",
          message:
            "Video, iframe, embed, dan script tidak bisa dipasang di dalam teks.",
        },
      ],
    });
  });

  it.each(EMBEDS)("di dalam listItem: %s", (type) => {
    const result = validateContentDoc(embedInListItem(type));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toStrictEqual({
      path: ["content", 0, "content", 0, "content", 1, "type"],
      code: "FORBIDDEN_EMBED",
      message:
        "Video, iframe, embed, dan script tidak bisa dipasang di dalam teks.",
    });
  });

  it.each(EMBEDS)("di dalam blockquote: %s", (type) => {
    const result = validateContentDoc(embedInBlockquote(type));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toStrictEqual({
      path: ["content", 0, "content", 1, "type"],
      code: "FORBIDDEN_EMBED",
      message:
        "Video, iframe, embed, dan script tidak bisa dipasang di dalam teks.",
    });
  });
});

describe("validateContentDoc · node dan mark tak dikenal", () => {
  it.each(["image", "callout", "codeBlock"])("node %s → UNKNOWN_NODE", (type) => {
    const result = validateContentDoc(doc([{ type }]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe("UNKNOWN_NODE");
    expect(result.issues[0]?.path).toStrictEqual(["content", 0, "type"]);
  });

  it.each(["strike", "code"])("mark %s → UNKNOWN_MARK", (type) => {
    const result = validateContentDoc(
      doc([para([text("a", [{ type }])])]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe("UNKNOWN_MARK");
    expect(result.issues[0]?.path).toStrictEqual([
      "content",
      0,
      "content",
      0,
      "marks",
      0,
      "type",
    ]);
  });

  it("mark tak dikenal yang membawa attrs tetap UNKNOWN_MARK, bukan INVALID_ATTRS", () => {
    for (const mark of [
      { type: "textStyle", attrs: { color: "red" } },
      { type: "highlight", attrs: { color: null } },
    ]) {
      const result = validateContentDoc(doc([para([text("a", [mark])])]));
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.code).toBe("UNKNOWN_MARK");
    }
  });
});

describe("validateContentDoc · attrs", () => {
  it.each([1, 5, "2"])("heading level %s → INVALID_ATTRS", (level) => {
    const result = validateContentDoc(doc([heading(level)]));
    expect(codes(result)).toContain("INVALID_ATTRS");
  });

  it("heading tanpa attrs → INVALID_ATTRS di path attrs", () => {
    const result = validateContentDoc(doc([{ type: "heading" }]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe("INVALID_ATTRS");
    expect(result.issues[0]?.path).toStrictEqual(["content", 0, "attrs"]);
  });

  it("key tambahan di attrs heading → INVALID_ATTRS", () => {
    const baseline = validateContentDoc(doc([heading(2, [text("a")])]));
    expect(baseline.ok).toBe(true);
    const extra = validateContentDoc(
      doc([{ type: "heading", attrs: { level: 2, extra: 1 }, content: [] }]),
    );
    expect(codes(extra)).toContain("INVALID_ATTRS");
  });

  it("attrs pada paragraph → INVALID_ATTRS (node tanpa attrs)", () => {
    const result = validateContentDoc(
      doc([{ type: "paragraph", attrs: {} }]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe("INVALID_ATTRS");
    expect(result.issues[0]?.path).toStrictEqual(["content", 0, "attrs"]);
  });

  it.each([
    { start: 0, type: null },
    { start: 1.5, type: null },
    { start: 1, type: "disc" },
  ])("orderedList attrs %o → INVALID_ATTRS", (attrs) => {
    const result = validateContentDoc(
      doc([
        {
          type: "orderedList",
          attrs,
          content: [{ type: "listItem", content: [para()] }],
        },
      ]),
    );
    expect(codes(result)).toContain("INVALID_ATTRS");
  });

  const linkMark = (attrs: Json) => ({
    type: "link",
    attrs: { target: null, rel: null, class: null, title: null, ...attrs },
  });

  it("link dengan class berupa string → INVALID_ATTRS", () => {
    const result = validateContentDoc(
      doc([
        para([
          text(
            "a",
            [linkMark({ href: "https://x.example", class: "tombol" })],
          ),
        ]),
      ]),
    );
    expect(codes(result)).toContain("INVALID_ATTRS");
  });

  it("link tanpa href → INVALID_ATTRS", () => {
    const result = validateContentDoc(
      doc([
        para([
          text("a", [
            {
              type: "link",
              attrs: { target: null, rel: null, class: null, title: null },
            },
          ]),
        ]),
      ]),
    );
    expect(codes(result)).toContain("INVALID_ATTRS");
  });

  it("key tambahan di objek mark → INVALID_STRUCTURE", () => {
    const result = validateContentDoc(
      doc([para([text("a", [{ type: "bold", foo: 1 }])])]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe("INVALID_STRUCTURE");
    expect(result.issues[0]?.path).toStrictEqual([
      "content",
      0,
      "content",
      0,
      "marks",
      0,
      "foo",
    ]);
  });

  it("attrs di mark bold → INVALID_ATTRS di path marks[i].attrs", () => {
    const result = validateContentDoc(
      doc([para([text("a", [{ type: "bold", attrs: {} }])])]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe("INVALID_ATTRS");
    expect(result.issues[0]?.path).toStrictEqual([
      "content",
      0,
      "content",
      0,
      "marks",
      0,
      "attrs",
    ]);
  });

  it("__proto__ dan constructor dari JSON.parse ditolak; Object.prototype tak berubah", () => {
    const nodeInput = JSON.parse(
      '{"type":"paragraph","__proto__":{"poluted":1},"constructor":"x"}',
    );
    const nodeResult = validateContentDoc(doc([nodeInput, para([text("a")])]));
    expect(nodeResult.ok).toBe(false);
    expect(codes(nodeResult)).toContain("INVALID_STRUCTURE");

    const attrsInput = JSON.parse(
      '{"type":"heading","attrs":{"level":2,"__proto__":{"poluted":1}},"content":[]}',
    );
    const attrsResult = validateContentDoc(doc([attrsInput]));
    expect(attrsResult.ok).toBe(false);
    expect(codes(attrsResult)).toContain("INVALID_ATTRS");

    const probe: Json = {};
    expect("poluted" in probe).toBe(false);
    expect((Object.prototype as Json).poluted).toBeUndefined();
  });
});

describe("validateContentDoc · struktur", () => {
  it("doc dengan content: [] → INVALID_STRUCTURE", () => {
    const result = validateContentDoc({ type: "doc", content: [] });
    expect(codes(result)).toContain("INVALID_STRUCTURE");
  });

  it.each([
    { type: "paragraph", content: [] },
    null,
    ["bukan", "doc"],
    "teks",
  ])("root tidak sah %o → INVALID_STRUCTURE di path []", (input) => {
    const result = validateContentDoc(input);
    expect(result).toStrictEqual({
      ok: false,
      issues: [
        {
          path: [],
          code: "INVALID_STRUCTURE",
          message: "Format teks ini tidak didukung editor.",
        },
      ],
    });
  });

  it("text kosong, tanpa field text, dan text dengan content", () => {
    expect(codes(validateContentDoc(doc([para([text("")])])))).toContain(
      "INVALID_STRUCTURE",
    );
    expect(
      codes(validateContentDoc(doc([para([{ type: "text" }])]))),
    ).toContain("INVALID_STRUCTURE");
    expect(
      codes(
        validateContentDoc(
          doc([para([{ type: "text", text: "a", content: [] }])]),
        ),
      ),
    ).toContain("INVALID_STRUCTURE");
  });

  it("mark sejenis dua kali → INVALID_STRUCTURE", () => {
    const result = validateContentDoc(
      doc([para([text("a", [{ type: "bold" }, { type: "bold" }])])]),
    );
    expect(codes(result)).toContain("INVALID_STRUCTURE");
  });

  it("listItem yang diawali bulletList → INVALID_STRUCTURE", () => {
    const result = validateContentDoc(
      doc([
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "bulletList",
                  content: [{ type: "listItem", content: [para()] }],
                },
              ],
            },
          ],
        },
      ]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.code).toBe("INVALID_STRUCTURE");
    expect(result.issues[0]?.path).toStrictEqual([
      "content",
      0,
      "content",
      0,
      "content",
      0,
    ]);
  });

  it("bulletList kosong → INVALID_STRUCTURE", () => {
    const result = validateContentDoc(
      doc([{ type: "bulletList", content: [] }]),
    );
    expect(codes(result)).toContain("INVALID_STRUCTURE");
  });

  it("hardBreak di tingkat blok dan paragraph di dalam paragraph", () => {
    expect(
      codes(validateContentDoc(doc([{ type: "hardBreak" }]))),
    ).toContain("INVALID_STRUCTURE");
    expect(
      codes(
        validateContentDoc(doc([para([para([text("a")])])])),
      ),
    ).toContain("INVALID_STRUCTURE");
  });

  it("tabel: kosong, baris kosong, sel tanpa isi, tabel di dalam sel, tableRow di tingkat atas, sel di luar tableRow", () => {
    const CELL_ATTRS = { colspan: 1, rowspan: 1, colwidth: null, align: null };
    const cases: Json[] = [
      { type: "table", content: [] },
      { type: "table", content: [{ type: "tableRow", content: [] }] },
      table([{ type: "tableCell", attrs: CELL_ATTRS, content: [] }]),
      table([cell([table([cell([para()])])])]),
      { type: "tableRow", content: [cell([para()])] },
      cell([para()]),
    ];
    for (const input of cases) {
      expect(codes(validateContentDoc(doc([input])))).toContain(
        "INVALID_STRUCTURE",
      );
    }
  });
});

describe("validateContentDoc · atribut sel", () => {
  const cellWith = (attrs: Json) => table([cell([para([text("a")])], attrs)]);

  it.each([
    { colspan: 0 },
    { colspan: 21 },
    { colspan: "2" },
    { rowspan: 51 },
    { align: "justify" },
    { colwidth: [NaN] },
    { colwidth: [null] },
    { colwidth: [0] },
    { colwidth: [120, 120] }, // lebih panjang dari colspan (1)
  ])("attrs sel %o → INVALID_ATTRS", (attrs) => {
    expect(codes(validateContentDoc(doc([cellWith(attrs)])))).toContain(
      "INVALID_ATTRS",
    );
  });

  it("sel tanpa align → INVALID_ATTRS (key wajib)", () => {
    const result = validateContentDoc(
      doc([
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [para()],
                },
              ],
            },
          ],
        },
      ]),
    );
    expect(codes(result)).toContain("INVALID_ATTRS");
  });

  it("sel dengan colwidth [120] → sah", () => {
    expect(validateContentDoc(doc([cellWith({ colwidth: [120] })])).ok).toBe(
      true,
    );
  });
});

describe("validateContentDoc · tautan", () => {
  const withHref = (href: string) =>
    doc([
      para([
        text("a", [
          {
            type: "link",
            attrs: { href, target: null, rel: null, class: null, title: null },
          },
        ]),
      ]),
    ]);

  it.each([
    "https://example.com/a",
    "http://example.com/a",
    "mailto:halo@example.com",
    "/kursus/x",
  ])("diterima: %s", (href) => {
    expect(validateContentDoc(withHref(href)).ok).toBe(true);
  });

  it.each([
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html;base64,WA==",
    "vbscript:msgbox",
    "//evil.example",
    "/\\evil.example",
    "https://",
    "kursus/x",
    "",
    "https://example.com/" + "a".repeat(2048),
  ])("ditolak: %j → INVALID_LINK di path href", (href) => {
    const result = validateContentDoc(withHref(href));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toStrictEqual({
      path: ["content", 0, "content", 0, "marks", 0, "attrs", "href"],
      code: "INVALID_LINK",
      message:
        "Tautan harus diawali https://, http://, mailto:, atau / untuk halaman BINZI.",
    });
  });
});

describe("validateContentDoc · hardBreak dengan marks", () => {
  it("bold dan link → sah; mark tak dikenal → UNKNOWN_MARK", () => {
    expect(
      validateContentDoc(
        doc([para([{ type: "hardBreak", marks: [{ type: "bold" }] }])]),
      ).ok,
    ).toBe(true);
    expect(
      validateContentDoc(
        doc([
          para([
            {
              type: "hardBreak",
              marks: [
                {
                  type: "link",
                  attrs: {
                    href: "https://example.com",
                    target: null,
                    rel: null,
                    class: null,
                    title: null,
                  },
                },
              ],
            },
          ]),
        ]),
      ).ok,
    ).toBe(true);
    expect(
      codes(
        validateContentDoc(
          doc([para([{ type: "hardBreak", marks: [{ type: "strike" }] }])]),
        ),
      ),
    ).toContain("UNKNOWN_MARK");
  });
});

describe("validateContentDoc · batas", () => {
  const deepBlocks = (levels: number, leaf: Json): Json => {
    let node: Json = leaf;
    for (let i = 0; i < levels; i += 1) {
      node = { type: "blockquote", content: [node] };
    }
    return doc([node]);
  };

  it("kedalaman tepat 16 → sah", () => {
    // doc(0) + blockquote×15 (1..15) + paragraph(16)
    expect(validateContentDoc(deepBlocks(15, para())).ok).toBe(true);
  });

  it("kedalaman 17 → TOO_DEEP", () => {
    const result = validateContentDoc(deepBlocks(16, para()));
    expect(codes(result)).toContain("TOO_DEEP");
  });

  it("10.000 tingkat → TOO_DEEP tanpa melempar", () => {
    let node: Json = para();
    for (let i = 0; i < 9_999; i += 1) {
      node = { type: "blockquote", content: [node] };
    }
    expect(() => validateContentDoc(doc([node]))).not.toThrow();
    expect(codes(validateContentDoc(doc([node])))).toContain("TOO_DEEP");
  });

  it("tepat 5.000 node → sah; 5.001 → TOO_LARGE", () => {
    // 1 doc + 2.499 (paragraf+teks) + 1 paragraf kosong = 5.000 node
    const content: unknown[] = [];
    for (let i = 0; i < 2_499; i += 1) content.push(para([text("a")]));
    content.push(para());
    expect(validateContentDoc(doc(content)).ok).toBe(true);

    content.push(para([text("b")]));
    expect(codes(validateContentDoc(doc(content)))).toContain("TOO_LARGE");
  });

  it("total teks tepat 100.000 karakter → sah; 100.001 → TOO_LARGE", () => {
    const exact = doc([para([text("a".repeat(100_000))])]);
    expect(validateContentDoc(exact).ok).toBe(true);
    const over = doc([para([text("a".repeat(100_001))])]);
    expect(codes(validateContentDoc(over))).toContain("TOO_LARGE");
  });

  it("30 node terlarang → tepat 20 issue", () => {
    const content = Array.from({ length: 30 }, () => ({ type: "iframe" }));
    const result = validateContentDoc(doc(content));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(MAX_ISSUES);
    expect(result.issues.every((i) => i.code === "FORBIDDEN_EMBED")).toBe(true);
  });
});

describe("contentDocSchema (adapter Zod)", () => {
  it("path issue otomatis berawalan nama field; params.code terisi", () => {
    const schema = z.strictObject({ content: contentDocSchema });
    const result = schema.safeParse({
      content: { type: "doc", content: [{ type: "iframe" }] },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues[0] as {
      path: PropertyKey[];
      params?: unknown;
    };
    expect(issue.path).toStrictEqual(["content", "content", 0, "type"]);
    expect(issue.params).toStrictEqual({ code: "FORBIDDEN_EMBED" });
  });

  it("sukses mengembalikan doc hasil validasi", () => {
    const schema = z.strictObject({ content: contentDocSchema });
    const input = { content: doc([para([text("a")])]) };
    const result = schema.parse(input);
    expect(result.content).toStrictEqual(input.content);
    expect(result.content).not.toBe(input.content);
  });
});
