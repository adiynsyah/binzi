import type { JSONContent } from "@tiptap/core";

/**
 * Tiptap JSON → plain text (TASK 041, UI/UX §44 SEO; Task Plan
 * 041 "SEO metadata").
 *
 * contents has NO description/excerpt column (Drizzle Spec §8) —
 * the only grounded source for an article meta description is the
 * body itself, so this walks the same validated document that
 * renderTiptapHtml serializes and concatenates text nodes with
 * single spaces. Output is plain text with all whitespace runs
 * collapsed; it never reaches the DOM as markup, so no escaping is
 * needed here (React/metadata API handle the rest).
 */

function collectText(node: JSONContent, parts: string[]): void {
  if (typeof node.text === "string" && node.text.length > 0) {
    parts.push(node.text);
  }
  for (const child of node.content ?? []) {
    collectText(child, parts);
  }
}

/** Plain-text extraction, whitespace-run collapsed. */
export function extractTiptapText(body: JSONContent): string {
  const parts: string[] = [];
  collectText(body, parts);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Meta description built from the body text, cut at the last word
 * boundary that fits `maxLength` characters. Returns undefined
 * for an effectively empty body (the caller then omits the
 * description key entirely rather than emitting an empty one).
 */
export function buildMetaDescription(
  body: JSONContent,
  maxLength: number = 160,
): string | undefined {
  const text = extractTiptapText(body);
  if (text.length === 0) {
    return undefined;
  }
  if (text.length <= maxLength) {
    return text;
  }
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}
