import type { JSONContent } from "@tiptap/core";

/**
 * Public Tiptap JSON → HTML renderer (TASK 020, Blueprint §34,
 * CMS Spec §16 "render content as closely as possible to the public
 * experience").
 *
 * Why hand-rolled instead of `generateHTML` from @tiptap/core: the
 * ProseMirror DOMSerializer requires a `window.document` (verified
 * against @tiptap/core 3.30.2 — it throws `window is not defined` in
 * Node), and the official server package (@tiptap/html) would add a
 * DOM implementation dependency. This serializer covers exactly the
 * approved V1 extension set (Blueprint §22: StarterKit incl. Link +
 * Underline, Image, Placeholder) with ZERO new dependencies.
 *
 * Safety model — the output of this function is injected via
 * `dangerouslySetInnerHTML` on the public article page, so it is
 * built like a serializer, not a template:
 * - Every text node and attribute value is HTML-escaped at the
 *   boundary (`escapeHtml`).
 * - Node and mark types are a strict allowlist; anything unknown
 *   renders only its nested text content (or nothing), never raw
 *   markup from the JSON.
 * - href/src accept only http/https URLs (`safeUrl`) — a persisted
 *   `javascript:` link/image can never reach the page.
 * - heading levels, list order etc. come from validated attributes
 *   with sane fallbacks.
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** http/https URLs only; anything else yields null (node dropped). */
function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? value
      : null;
  } catch {
    return null;
  }
}

type Mark = JSONContent;

function renderMarks(inner: string, marks: Mark[] | undefined): string {
  if (!marks || marks.length === 0) {
    return inner;
  }
  let html = inner;
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        html = `<strong>${html}</strong>`;
        break;
      case "italic":
        html = `<em>${html}</em>`;
        break;
      case "underline":
        html = `<u>${html}</u>`;
        break;
      case "strike":
        html = `<s>${html}</s>`;
        break;
      case "code":
        html = `<code>${html}</code>`;
        break;
      case "link": {
        const href = safeUrl(mark.attrs?.href);
        // Non-http(s) links degrade to plain text, never an <a>.
        if (href === null) continue;
        const rel = ' rel="noopener noreferrer nofollow"';
        html = `<a href="${escapeHtml(href)}"${rel}>${html}</a>`;
        break;
      }
      default:
        break;
    }
  }
  return html;
}

function headingLevel(attrs: JSONContent["attrs"]): number {
  const level = typeof attrs?.level === "number" ? attrs.level : 2;
  return Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2;
}

function renderNode(node: JSONContent): string {
  const children = renderNodes(node.content, node.marks);

  switch (node.type) {
    case "doc":
      return children;
    case "paragraph":
      return `<p>${children}</p>`;
    case "heading": {
      const level = headingLevel(node.attrs);
      return `<h${level}>${children}</h${level}>`;
    }
    case "text":
      // Text nodes carry their own marks in Tiptap JSON.
      return renderMarks(escapeHtml(node.text ?? ""), node.marks);
    case "hardBreak":
      return "<br />";
    case "bulletList":
      return `<ul>${children}</ul>`;
    case "orderedList": {
      const start =
        typeof node.attrs?.start === "number" && node.attrs.start > 1
          ? ` start="${node.attrs.start}"`
          : "";
      return `<ol${start}>${children}</ol>`;
    }
    case "listItem":
      return `<li>${children}</li>`;
    case "blockquote":
      return `<blockquote>${children}</blockquote>`;
    case "horizontalRule":
      return "<hr />";
    case "image": {
      const src = safeUrl(node.attrs?.src);
      if (src === null) {
        return "";
      }
      const alt =
        typeof node.attrs?.alt === "string" && node.attrs.alt.length > 0
          ? ` alt="${escapeHtml(node.attrs.alt)}"`
          : "";
      return `<img src="${escapeHtml(src)}"${alt} loading="lazy" />`;
    }
    case "codeBlock":
      return `<pre><code>${escapeHtml(node.text ?? "")}</code></pre>`;
    default:
      // Unknown nodes degrade to their nested content — never raw
      // markup. A node with no content renders nothing.
      return children;
  }
}

function renderNodes(
  nodes: JSONContent["content"],
  marks?: Mark[],
): string {
  if (!nodes || nodes.length === 0) {
    return "";
  }
  // Parent-level marks (rare in Tiptap output, which puts marks on
  // text nodes) are applied defensively around inline content.
  const inner = nodes.map((node) => renderNode(node)).join("");
  return marks && marks.length > 0 ? renderMarks(inner, marks) : inner;
}

/** Serialize a Tiptap document to safe public HTML. */
export function renderTiptapHtml(document: JSONContent): string {
  return renderNode(document);
}
