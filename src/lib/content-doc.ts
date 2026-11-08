/*
 * TipTap document helpers shared by the course and lesson modules (card
 * S1-02). S1-03a adds the ContentDoc node types — the typed form of the
 * validator whitelist in content-doc-validator.ts. Pure on purpose:
 * imported from client-safe contracts and server queries alike.
 *
 * Emptiness (isDocEmpty) searches recursively, so text inside table cells
 * counts and a table whose every cell is empty is empty. Images widen
 * emptiness in S1-07. Keep every consumer going through isDocEmpty,
 * never the raw doc.
 */

/** Marks a text/hardBreak node may carry (S1-03a whitelist, part 1). */
export type ContentDocMark =
  | { readonly type: "bold" }
  | { readonly type: "italic" }
  | { readonly type: "underline" }
  | {
      readonly type: "link";
      readonly attrs: Readonly<{
        href: string;
        target: "_blank" | null;
        rel: string | null;
        class: null;
        title: string | null;
      }>;
    };

/** Inline nodes — the only children paragraph/heading accept. */
export type ContentDocInline =
  | {
      readonly type: "text";
      readonly text: string;
      readonly marks?: readonly ContentDocMark[];
    }
  | {
      readonly type: "hardBreak";
      readonly marks?: readonly ContentDocMark[];
    };

export type ContentDocParagraph = {
  readonly type: "paragraph";
  readonly content?: readonly ContentDocInline[];
};

export type ContentDocHeading = {
  readonly type: "heading";
  readonly attrs: Readonly<{ level: 2 | 3 | 4 }>;
  readonly content?: readonly ContentDocInline[];
};

/** Blocks allowed inside a table cell — every block except table. */
export type ContentDocCellBlock =
  | ContentDocParagraph
  | ContentDocHeading
  | ContentDocList
  | ContentDocBlockquote
  | { readonly type: "horizontalRule" };

export type ContentDocBlock =
  | ContentDocCellBlock
  | {
      readonly type: "table";
      readonly content: readonly ContentDocTableRow[];
    };

export type ContentDocListItem = {
  readonly type: "listItem";
  readonly content: readonly [ContentDocParagraph, ...ContentDocBlock[]];
};

export type ContentDocList =
  | {
      readonly type: "bulletList";
      readonly content: readonly ContentDocListItem[];
    }
  | {
      readonly type: "orderedList";
      readonly attrs: Readonly<{
        start: number;
        type: null | "1" | "a" | "A" | "i" | "I";
      }>;
      readonly content: readonly ContentDocListItem[];
    };

export type ContentDocBlockquote = {
  readonly type: "blockquote";
  readonly content: readonly ContentDocBlock[];
};

export type ContentDocTableRow = {
  readonly type: "tableRow";
  readonly content: readonly ContentDocCell[];
};

export type ContentDocCellAttrs = Readonly<{
  colspan: number;
  rowspan: number;
  colwidth: readonly number[] | null;
  align: null | "left" | "center" | "right";
}>;

export type ContentDocCell =
  | {
      readonly type: "tableHeader";
      readonly attrs: ContentDocCellAttrs;
      readonly content: readonly ContentDocCellBlock[];
    }
  | {
      readonly type: "tableCell";
      readonly attrs: ContentDocCellAttrs;
      readonly content: readonly ContentDocCellBlock[];
    };

/** A whole content document — exactly TipTap's getJSON() shape. */
export type ContentDoc = {
  readonly type: "doc";
  readonly content: readonly ContentDocBlock[];
};

/** The content of a freshly created lesson (card §1): one empty paragraph. */
export const EMPTY_DOC = {
  type: "doc",
  content: [{ type: "paragraph" }],
} as const satisfies ContentDoc;

/** Loose TipTap node shape — only what emptiness needs. */
type NodeLike = {
  type?: unknown;
  text?: unknown;
  content?: unknown;
};

function isObject(value: unknown): value is NodeLike & Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Recursively: does this node subtree hold one text node with non-space? */
function hasVisibleText(node: unknown): boolean {
  if (!isObject(node)) return false;
  if (typeof node.text === "string" && node.text.trim().length > 0) {
    return true;
  }
  if (Array.isArray(node.content)) {
    return node.content.some((child) => hasVisibleText(child));
  }
  return false;
}

function isTipTapDoc(value: unknown): value is NodeLike {
  return isObject(value) && value.type === "doc";
}

/**
 * true when `doc` is null, not a TipTap document, or holds no text node
 * with content besides whitespace (searched recursively — text nested
 * in a list or a table cell counts). Used for BOTH lesson content and
 * the course description (CMS-06 items 4 and 6).
 */
export function isDocEmpty(doc: unknown): boolean {
  if (!isTipTapDoc(doc)) return true;
  return !hasVisibleText(doc);
}

// --------------------------------------------- plain-text conversion (S1-09)

/** One node's inline text: text nodes verbatim, hardBreak → "\n", other
 *  nodes contribute their children's text concatenated (no separators). */
function nodeText(node: unknown): string {
  if (!isObject(node)) return "";
  if (node.type === "hardBreak") return "\n";
  if (typeof node.text === "string") return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map((child) => nodeText(child)).join("");
  }
  return "";
}

/**
 * Plain text → the stored document shape (card S1-09 §1): CRLF/CR → LF,
 * every line trimmed, empty-after-trim lines dropped, each surviving line
 * one paragraph with one text node. Input that leaves not a single line
 * THROWS — `{ type: "doc", content: [] }` is rejected by the validator
 * (INVALID_STRUCTURE), and the only callers sit behind `questionInput`,
 * which rejects empty text first. Output always passes validateContentDoc.
 *
 * Exact round-trip holds ONLY doc → text → doc (for this function's
 * output); text → doc → text normalizes instead (see docToPlainText).
 */
export function plainTextToDoc(text: string): ContentDoc {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error(
      "plainTextToDoc: teks kosong — tidak ada baris untuk dijadikan dokumen",
    );
  }
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  };
}

/**
 * Document → plain text (card S1-09 §1): each top-level block's text on
 * its own line (joined "\n"), hardBreak → "\n" within a line, anything
 * else contributes text only. null / not a TipTap document → "" (an
 * EMPTY_DOC paragraph yields "" too — "belum diisi", never a crash).
 */
export function docToPlainText(doc: unknown): string {
  if (!isTipTapDoc(doc) || !Array.isArray(doc.content)) return "";
  return doc.content
    .map((block) => nodeText(block).trim())
    .join("\n");
}
