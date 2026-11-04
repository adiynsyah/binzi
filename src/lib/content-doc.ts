/*
 * TipTap document helpers shared by the course and lesson modules (card
 * S1-02). Pure on purpose: imported from client-safe contracts and server
 * queries alike. S1-03 widens emptiness to images/tables (and may move this
 * file) — keep every consumer going through isDocEmpty, never the raw doc.
 */

/** The content of a freshly created lesson (card §1): one empty paragraph. */
export const EMPTY_DOC = {
  type: "doc",
  content: [{ type: "paragraph" }],
} as const;

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
 * with content besides whitespace (searched recursively — e.g. text nested
 * in a list counts). Used for BOTH lesson content and the course
 * description (CMS-06 items 4 and 6).
 */
export function isDocEmpty(doc: unknown): boolean {
  if (!isTipTapDoc(doc)) return true;
  return !hasVisibleText(doc);
}
