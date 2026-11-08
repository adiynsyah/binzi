// isDocEmpty (cards S1-02 + S1-03a "Selesai jika"): null, EMPTY_DOC,
// whitespace-only text, text nested in a list, hardBreak/horizontalRule-only
// documents, tables whose every cell is empty, and malformed shapes. One
// look at a TipTap document must decide "empty" without ever leaking the
// doc to the client.
import { describe, expect, it } from "vitest";

import {
  EMPTY_DOC,
  docToPlainText,
  isDocEmpty,
  plainTextToDoc,
} from "./content-doc";
import { CONTENT_DOC_SHOWCASE } from "./content-doc-fixtures";

const docWithText = (text: string) => ({
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text }] },
  ],
});

describe("isDocEmpty", () => {
  it("null → true", () => {
    expect(isDocEmpty(null)).toBe(true);
  });

  it("EMPTY_DOC → true", () => {
    expect(isDocEmpty(EMPTY_DOC)).toBe(true);
  });

  it("text with only spaces → true", () => {
    expect(isDocEmpty(docWithText("     \t"))).toBe(true);
  });

  it("empty paragraph among paragraphs with no text anywhere → true", () => {
    expect(
      isDocEmpty({
        type: "doc",
        content: [
          { type: "paragraph" },
          { type: "paragraph", content: [{ type: "text", text: " " }] },
        ],
      }),
    ).toBe(true);
  });

  it("text nested in a list → false (recursion reaches it)", () => {
    expect(
      isDocEmpty({
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "satu kata" }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it("plain paragraph with text → false", () => {
    expect(isDocEmpty(docWithText("Teks materi."))).toBe(false);
  });

  it("malformed shapes → true (never throws)", () => {
    expect(isDocEmpty(undefined)).toBe(true);
    expect(isDocEmpty("teks")).toBe(true);
    expect(isDocEmpty(42)).toBe(true);
    expect(isDocEmpty({ type: "doc" })).toBe(true);
    expect(isDocEmpty({ type: "doc", content: "bukan array" })).toBe(true);
    // Not a doc at all — some other JSONB shape.
    expect(isDocEmpty({ type: "paragraph" })).toBe(true);
  });

  it("hardBreak without any text → true", () => {
    expect(
      isDocEmpty({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "hardBreak" }] }],
      }),
    ).toBe(true);
  });

  it("horizontalRule without any text → true", () => {
    expect(
      isDocEmpty({ type: "doc", content: [{ type: "horizontalRule" }] }),
    ).toBe(true);
  });

  it("table whose every cell is empty → true", () => {
    const emptyCell = {
      type: "tableCell",
      attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
      content: [{ type: "paragraph" }],
    };
    expect(
      isDocEmpty({
        type: "doc",
        content: [
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [emptyCell, { ...emptyCell }],
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it("table with text in one cell → false", () => {
    const emptyCell = {
      type: "tableCell",
      attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
      content: [{ type: "paragraph" }],
    };
    expect(
      isDocEmpty({
        type: "doc",
        content: [
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  emptyCell,
                  {
                    type: "tableCell",
                    attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "satu kata" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it("CONTENT_DOC_SHOWCASE → false (consistency: any non-space text)", () => {
    // Every valid fixture with text anywhere must be non-empty.
    expect(isDocEmpty(CONTENT_DOC_SHOWCASE)).toBe(false);
  });
});

// ------------------------------- plain text conversion (card S1-09 §1)

describe("plainTextToDoc", () => {
  it("one paragraph with one text node per line", () => {
    expect(plainTextToDoc("a\nb")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "a" }] },
        { type: "paragraph", content: [{ type: "text", text: "b" }] },
      ],
    });
  });

  it("CRLF and lone CR become LF first", () => {
    expect(plainTextToDoc("a\r\nb\rc")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "a" }] },
        { type: "paragraph", content: [{ type: "text", text: "b" }] },
        { type: "paragraph", content: [{ type: "text", text: "c" }] },
      ],
    });
  });

  it("empty lines are dropped — the roundtrip normalizes gaps", () => {
    expect(plainTextToDoc("a\n\n\nb")).toEqual(plainTextToDoc("a\nb"));
  });

  it("whitespace-only lines are dropped too", () => {
    expect(plainTextToDoc("a\n   \nb")).toEqual(plainTextToDoc("a\nb"));
  });

  it("blank lines around the text are trimmed away", () => {
    expect(plainTextToDoc("\n a \n")).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }],
    });
  });

  it("zero remaining lines throws (the caller contract)", () => {
    expect(() => plainTextToDoc(" \n \n")).toThrow(/teks kosong/);
  });
});

describe("docToPlainText", () => {
  it("paragraphs join with \\n", () => {
    expect(
      docToPlainText({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "a" }] },
          { type: "paragraph", content: [{ type: "text", text: "b" }] },
        ],
      }),
    ).toBe("a\nb");
  });

  it("hardBreak reads back as a newline inside the paragraph", () => {
    expect(
      docToPlainText({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "a" },
              { type: "hardBreak" },
              { type: "text", text: "b" },
            ],
          },
        ],
      }),
    ).toBe("a\nb");
  });

  it("null / non-doc / not-an-object → empty string", () => {
    expect(docToPlainText(null)).toBe("");
    expect(docToPlainText(undefined)).toBe("");
    expect(docToPlainText("teks")).toBe("");
    expect(docToPlainText({ type: "paragraph" })).toBe("");
  });

  it("roundtrip: docToPlainText ∘ plainTextToDoc keeps the lines", () => {
    expect(docToPlainText(plainTextToDoc("a\nb\nc"))).toBe("a\nb\nc");
  });
});
