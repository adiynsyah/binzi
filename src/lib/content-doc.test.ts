// isDocEmpty (card S1-02 "Selesai jika"): null, EMPTY_DOC, whitespace-only
// text, text nested in a list, and malformed shapes. One look at a TipTap
// document must decide "empty" without ever leaking the doc to the client.
import { describe, expect, it } from "vitest";

import { EMPTY_DOC, isDocEmpty } from "./content-doc";

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
});
