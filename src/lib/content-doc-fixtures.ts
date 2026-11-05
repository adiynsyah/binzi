/*
 * Shared content-document fixture (card S1-03a §7). Every whitelisted
 * node and mark appears at least once, so the same document drives the
 * validator tests, the renderer tests, and the /dev/ui showcase.
 *
 * All copy is "[CONTOH]" filler — never real nutrition/health content
 * (PRD §13.4).
 */

import type {
  ContentDoc,
  ContentDocCell,
  ContentDocCellBlock,
  ContentDocInline,
  ContentDocMark,
  ContentDocParagraph,
  ContentDocTableRow,
} from "./content-doc";

/** 80 characters, no spaces — exercises wrap-anywhere paths. */
const NO_SPACE_80 = `[CONTOH]${"x".repeat(72)}`;

const text = (value: string): ContentDocInline => ({ type: "text", text: value });

const marked = (
  value: string,
  marks: readonly ContentDocMark[],
): ContentDocInline =>
  marks.length === 0 ? { type: "text", text: value } : { type: "text", text: value, marks };

const link = (href: string, external: boolean): ContentDocMark => ({
  type: "link",
  attrs: {
    href,
    target: external ? "_blank" : null,
    rel: external ? "noopener noreferrer" : null,
    class: null,
    title: null,
  },
});

const paragraph = (
  content: readonly ContentDocInline[],
): ContentDocParagraph => ({ type: "paragraph", content });

const heading = (level: 2 | 3 | 4, value: string): ContentDocCellBlock => ({
  type: "heading",
  attrs: { level },
  content: [text(value)],
});

type CellOverrides = Partial<{
  colspan: number;
  rowspan: number;
  colwidth: readonly number[] | null;
  align: "left" | "center" | "right" | null;
}>;

const cell = (
  kind: "tableHeader" | "tableCell",
  content: readonly ContentDocCellBlock[],
  overrides: CellOverrides = {},
): ContentDocCell => ({
  type: kind,
  attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null, ...overrides },
  content,
});

const cellText = (value: string, overrides?: CellOverrides): ContentDocCell =>
  cell("tableCell", [paragraph([text(value)])], overrides);

const headerCell = (value: string): ContentDocCell =>
  cell("tableHeader", [paragraph([text(value)])]);

const row = (cells: readonly ContentDocCell[]): ContentDocTableRow => ({
  type: "tableRow",
  content: cells,
});

/** One href reused by three nodes (and a hardBreak) — link grouping. */
const SPLIT_LINK = link("https://example.com/tautan-terbagi", true);

export const CONTENT_DOC_SHOWCASE = {
  type: "doc",
  content: [
    heading(2, "Judul tingkat dua [CONTOH]"),
    paragraph([
      text("Paragraf pembuka dengan "),
      marked("tebal", [{ type: "bold" }]),
      text(", "),
      marked("miring", [{ type: "italic" }]),
      text(", dan "),
      marked("garis bawah", [{ type: "underline" }]),
      text("."),
    ]),
    heading(3, "Judul tingkat tiga [CONTOH]"),
    paragraph([
      text("Tautan "),
      marked("eksternal", [link("https://example.com/contoh", true)]),
      text(", "),
      marked("internal", [link("/kursus/contoh", false)]),
      text(", dan "),
      marked("surel", [link("mailto:halo@example.com", false)]),
      text(". Tautan yang terbagi tiga node teks: "),
      marked("satu ", [SPLIT_LINK]),
      marked("dua", [SPLIT_LINK, { type: "bold" }]),
      marked(" tiga", [SPLIT_LINK]),
      text("."),
    ]),
    heading(4, "Judul tingkat empat [CONTOH]"),
    paragraph([text(NO_SPACE_80)]),
    paragraph([
      text("Tautan berisi pemisah baris: "),
      marked("satu", [SPLIT_LINK]),
      { type: "hardBreak", marks: [SPLIT_LINK] },
      marked("dua.", [SPLIT_LINK]),
    ]),
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            paragraph([text("Butir pertama dengan sub-daftar bernomor [CONTOH]")]),
            {
              type: "orderedList",
              attrs: { start: 3, type: null },
              content: [
                {
                  type: "listItem",
                  content: [
                    paragraph([text("Langkah ketiga mulai dari start: 3 [CONTOH]")]),
                  ],
                },
                {
                  type: "listItem",
                  content: [
                    paragraph([text("Langkah keempat [CONTOH]")]),
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            paragraph([text("Butir kedua dengan sub-daftar butir [CONTOH]")]),
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    paragraph([
                      text("Tingkat ketiga campuran daftar, baris pertama [CONTOH]"),
                      { type: "hardBreak" },
                      text("baris kedua."),
                    ]),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "orderedList",
      attrs: { start: 1, type: "a" },
      content: [
        {
          type: "listItem",
          content: [paragraph([text("Pilihan a [CONTOH]")])],
        },
        {
          type: "listItem",
          content: [paragraph([text("Pilihan b [CONTOH]")])],
        },
      ],
    },
    {
      type: "blockquote",
      content: [
        paragraph([
          text(
            "Kutipan contoh — teks pengisi untuk tata letak, bukan isi materi sebenarnya. [CONTOH]",
          ),
        ]),
      ],
    },
    { type: "horizontalRule" },
    {
      type: "table",
      content: [
        row([headerCell("Kolom satu [CONTOH]"), headerCell("Kolom dua [CONTOH]"), headerCell("Kolom tiga [CONTOH]")]),
        row([
          cell("tableHeader", [paragraph([text("Baris satu [CONTOH]")])]),
          cellText("Sel rata tengah [CONTOH]", { align: "center" }),
          cellText("Sel biasa [CONTOH]"),
        ]),
        row([
          cellText("Sel gabungan dua kolom [CONTOH]", { colspan: 2 }),
          cellText("Sel biasa [CONTOH]"),
        ]),
        row([
          cell("tableCell", [
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [paragraph([text("Daftar di dalam sel [CONTOH]")])],
                },
              ],
            },
          ]),
          cellText(NO_SPACE_80),
          cellText("Sel ketiga baris tiga [CONTOH]"),
        ]),
      ],
    },
    {
      type: "table",
      content: [
        row([
          headerCell("Kolom 1"),
          headerCell("Kolom 2"),
          headerCell("Kolom 3"),
          headerCell("Kolom 4"),
          headerCell("Kolom 5"),
          headerCell("Kolom 6"),
        ]),
        row([
          cellText("Isi [CONTOH] 1"),
          cellText("Isi [CONTOH] 2"),
          cellText("Isi [CONTOH] 3"),
          cellText("Isi [CONTOH] 4"),
          cellText("Isi [CONTOH] 5"),
          cellText("Isi [CONTOH] 6"),
        ]),
      ],
    },
  ],
} satisfies ContentDoc;
