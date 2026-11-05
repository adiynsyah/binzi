/*
 * ContentDoc validator (card S1-03a) — the server-side enforcement of
 * CRS-05/V-08: a strict whitelist over TipTap's getJSON() shape, checked
 * as an explicit walker so nothing can bypass it. Pure module: no
 * server-only, no DB. Used by the save endpoints (S1-04) and the editor
 * (S1-03b); the renderer re-validates on every render (§12.3).
 *
 * Counting rules for the limits below: every node — including doc, text,
 * and hardBreak — counts as exactly one node, and a node's depth is its
 * parent's depth + 1 (doc = 0). Marks and attrs are not nodes and are
 * never counted.
 *
 * Per-node check order (owner-approved): plain object → `type` (own
 * property, string) → FORBIDDEN_EMBED → UNKNOWN_NODE → node keys against
 * the type's allowed keys → attrs → content. A forbidden or unknown node
 * stops there: no other keys are checked and children are not visited.
 * Marks follow the same order. The walk hard-stops on TOO_DEEP,
 * TOO_LARGE, or the 20th issue, so a 10,000-level document reports
 * TOO_DEEP instead of blowing the stack.
 *
 * Output is rebuilt from literal whitelist keys (never spread from the
 * input) and preserves optional-key presence exactly: `content: []`
 * stays `[]`, a missing `content`/`marks` stays missing.
 */

import { z } from "zod";

import type { ContentDoc } from "./content-doc";

// ---- Limits (named, exported — card S1-03a §2) ----

/** Maximum node depth; doc itself is depth 0. */
export const MAX_DEPTH = 16;
/** Maximum total node count (doc, text, and hardBreak included). */
export const MAX_NODES = 5_000;
/** Maximum total characters across all text nodes. */
export const MAX_TEXT_LENGTH = 100_000;
/** Issue collection stops once this many have been gathered. */
export const MAX_ISSUES = 20;

// ---- Issues ----

export type ContentDocIssueCode =
  | "FORBIDDEN_EMBED"
  | "UNKNOWN_NODE"
  | "UNKNOWN_MARK"
  | "INVALID_ATTRS"
  | "INVALID_STRUCTURE"
  | "INVALID_LINK"
  | "TOO_LARGE"
  | "TOO_DEEP";

export type ContentDocIssue = {
  readonly path: readonly (string | number)[];
  readonly code: ContentDocIssueCode;
  readonly message: string;
};

export type ContentDocResult =
  | { readonly ok: true; readonly doc: ContentDoc }
  | { readonly ok: false; readonly issues: readonly ContentDocIssue[] };

const MESSAGES: Record<ContentDocIssueCode, string> = {
  FORBIDDEN_EMBED:
    "Video, iframe, embed, dan script tidak bisa dipasang di dalam teks.",
  UNKNOWN_NODE: "Format teks ini tidak didukung editor.",
  UNKNOWN_MARK: "Format teks ini tidak didukung editor.",
  INVALID_ATTRS: "Format teks ini tidak didukung editor.",
  INVALID_STRUCTURE: "Format teks ini tidak didukung editor.",
  INVALID_LINK:
    "Tautan harus diawali https://, http://, mailto:, atau / untuk halaman BINZI.",
  TOO_LARGE: "Teks terlalu panjang.",
  TOO_DEEP: "Susunan teks terlalu bertingkat.",
};

// ---- Href classification (card S1-03a §3) ----

const HREF_MAX_LENGTH = 2_048;
// \s plus control characters U+0000–U+001F and U+007F–U+009F, anywhere in
// the value — never trimmed.
const HREF_FORBIDDEN_CHARS = /[\s\u0000-\u001f\u007f-\u009f]/;

export type HrefKind = "external" | "internal" | "mailto";

/**
 * Classify a link href against the whitelist. Shared by the validator
 * (null → INVALID_LINK) and the renderer (external → target/rel/sr-only).
 */
export function classifyHref(href: string): HrefKind | null {
  if (href.length === 0 || href.length > HREF_MAX_LENGTH) return null;
  if (HREF_FORBIDDEN_CHARS.test(href)) return null;
  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      return url.hostname.length > 0 ? "external" : null;
    } catch {
      return null;
    }
  }
  if (/^mailto:/i.test(href)) {
    return href.length > "mailto:".length ? "mailto" : null;
  }
  if (
    href.startsWith("/") &&
    !href.startsWith("//") &&
    !href.startsWith("/\\")
  ) {
    return "internal";
  }
  return null;
}

// ---- Whitelist table (card S1-03a §1) ----

const FORBIDDEN_EMBED_TYPES = new Set([
  "video",
  "iframe",
  "embed",
  "object",
  "script",
  "audio",
  "youtube",
]);

const MARK_TYPES = new Set(["bold", "italic", "underline", "link"]);
const BARE_MARK_KEYS = new Set(["type"]);
const LINK_MARK_KEYS = new Set(["type", "attrs"]);

const INLINE_TYPES = new Set(["text", "hardBreak"]);
const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "horizontalRule",
  "table",
]);
const CELL_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "horizontalRule",
]);
const LIST_ITEM_TYPES = new Set(["listItem"]);
const TABLE_ROW_TYPES = new Set(["tableRow"]);
const CELL_TYPES = new Set(["tableHeader", "tableCell"]);

/** Attrs value check; `attrs` gives access to siblings (colwidth↔colspan). */
type AttrFieldCheck = (
  value: unknown,
  attrs: Record<string, unknown>,
) => boolean;

/** The exact attrs key set is the spec's own keys — no more, no fewer. */
type AttrSpec = Readonly<Record<string, AttrFieldCheck>>;

type ChildSpec = {
  /** Node types allowed as children. */
  readonly allowed: ReadonlySet<string>;
  /** Minimum child count. */
  readonly min: number;
  /** Required type of the first child (listItem → paragraph). */
  readonly first?: string;
};

type NodeSpec = {
  /** Exact allowed node keys ("type" included). */
  readonly keys: ReadonlySet<string>;
  /** Attrs spec, or null when the node takes no attrs at all. */
  readonly attrs: AttrSpec | null;
  /** Content rules, or null when "content" is not an allowed key. */
  readonly children: ChildSpec | null;
  /** Node carries an optional marks array (text, hardBreak). */
  readonly marks: boolean;
  /** Node carries a required non-empty "text" string (text only). */
  readonly text: boolean;
};

const isIntInRange = (value: unknown, min: number, max: number): boolean =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;

const HEADING_ATTR_SPEC = {
  level: (v: unknown) => v === 2 || v === 3 || v === 4,
} satisfies AttrSpec;

const ORDERED_LIST_ATTR_SPEC = {
  start: (v: unknown) => isIntInRange(v, 1, 9_999),
  type: (v: unknown) =>
    v === null || v === "1" || v === "a" || v === "A" || v === "i" || v === "I",
} satisfies AttrSpec;

const LINK_ATTR_SPEC = {
  href: (v: unknown) => typeof v === "string",
  target: (v: unknown) => v === "_blank" || v === null,
  rel: (v: unknown) =>
    v === null || (typeof v === "string" && v.length <= 100),
  class: (v: unknown) => v === null,
  title: (v: unknown) =>
    v === null || (typeof v === "string" && v.length <= 200),
} satisfies AttrSpec;

const CELL_ATTR_SPEC = {
  colspan: (v: unknown) => isIntInRange(v, 1, 20),
  rowspan: (v: unknown) => isIntInRange(v, 1, 50),
  colwidth: (v: unknown, attrs: Record<string, unknown>): boolean => {
    if (v === null) return true;
    if (!Array.isArray(v)) return false;
    if (!v.every((n) => isIntInRange(n, 1, 10_000))) return false;
    if (!isIntInRange(attrs.colspan, 1, 20)) return v.length >= 1;
    return v.length >= 1 && v.length <= (attrs.colspan as number);
  },
  align: (v: unknown) =>
    v === null || v === "left" || v === "center" || v === "right",
} satisfies AttrSpec;

/** The whole whitelist: adding a node later means adding a row here. */
const NODE_SPECS = {
  doc: {
    keys: new Set(["type", "content"]),
    attrs: null,
    children: { allowed: BLOCK_TYPES, min: 1 },
    marks: false,
    text: false,
  },
  paragraph: {
    keys: new Set(["type", "content"]),
    attrs: null,
    children: { allowed: INLINE_TYPES, min: 0 },
    marks: false,
    text: false,
  },
  heading: {
    keys: new Set(["type", "attrs", "content"]),
    attrs: HEADING_ATTR_SPEC,
    children: { allowed: INLINE_TYPES, min: 0 },
    marks: false,
    text: false,
  },
  bulletList: {
    keys: new Set(["type", "content"]),
    attrs: null,
    children: { allowed: LIST_ITEM_TYPES, min: 1 },
    marks: false,
    text: false,
  },
  orderedList: {
    keys: new Set(["type", "attrs", "content"]),
    attrs: ORDERED_LIST_ATTR_SPEC,
    children: { allowed: LIST_ITEM_TYPES, min: 1 },
    marks: false,
    text: false,
  },
  listItem: {
    keys: new Set(["type", "content"]),
    attrs: null,
    children: { allowed: BLOCK_TYPES, min: 1, first: "paragraph" },
    marks: false,
    text: false,
  },
  blockquote: {
    keys: new Set(["type", "content"]),
    attrs: null,
    children: { allowed: BLOCK_TYPES, min: 1 },
    marks: false,
    text: false,
  },
  horizontalRule: {
    keys: new Set(["type"]),
    attrs: null,
    children: null,
    marks: false,
    text: false,
  },
  table: {
    keys: new Set(["type", "content"]),
    attrs: null,
    children: { allowed: TABLE_ROW_TYPES, min: 1 },
    marks: false,
    text: false,
  },
  tableRow: {
    keys: new Set(["type", "content"]),
    attrs: null,
    children: { allowed: CELL_TYPES, min: 1 },
    marks: false,
    text: false,
  },
  tableHeader: {
    keys: new Set(["type", "attrs", "content"]),
    attrs: CELL_ATTR_SPEC,
    children: { allowed: CELL_BLOCK_TYPES, min: 1 },
    marks: false,
    text: false,
  },
  tableCell: {
    keys: new Set(["type", "attrs", "content"]),
    attrs: CELL_ATTR_SPEC,
    children: { allowed: CELL_BLOCK_TYPES, min: 1 },
    marks: false,
    text: false,
  },
  text: {
    keys: new Set(["type", "text", "marks"]),
    attrs: null,
    children: null,
    marks: true,
    text: true,
  },
  hardBreak: {
    keys: new Set(["type", "marks"]),
    attrs: null,
    children: null,
    marks: true,
    text: false,
  },
} satisfies Record<string, NodeSpec>;

type NodeTypeName = keyof typeof NODE_SPECS;

const WHITELIST_TYPES = new Set<string>(Object.keys(NODE_SPECS));

// ---- Walker ----

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Shared exact-key gate for nodes, attrs objects, and marks: reports every
 * key of `actual` that the whitelist does not list. `onExtra` decides the
 * code (INVALID_STRUCTURE vs INVALID_ATTRS) — the path always points at
 * the offending key. Own keys only, so "__proto__"/"constructor" from
 * JSON.parse are caught and Object.prototype is never touched.
 */
function checkAllowedKeys(
  actual: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  basePath: readonly (string | number)[],
  onExtra: (path: (string | number)[]) => void,
): void {
  for (const key of Object.keys(actual)) {
    if (!allowed.has(key)) onExtra([...basePath, key]);
  }
}

export function validateContentDoc(input: unknown): ContentDocResult {
  const issues: {
    path: (string | number)[];
    code: ContentDocIssueCode;
    message: string;
  }[] = [];
  let nodeCount = 0;
  let textTotal = 0;
  let aborted = false;

  const fail = (
    path: (string | number)[],
    code: ContentDocIssueCode,
  ): void => {
    if (aborted) return;
    issues.push({ path, code, message: MESSAGES[code] });
    if (
      issues.length >= MAX_ISSUES ||
      code === "TOO_DEEP" ||
      code === "TOO_LARGE"
    ) {
      aborted = true;
    }
  };

  // Exact-key set check for one attrs object: extra keys, missing keys,
  // then per-field values. basePath is the owning node/mark path, so
  // issues land at [...basePath, "attrs", key].
  function validateAttrs(
    holder: Record<string, unknown>,
    basePath: readonly (string | number)[],
    spec: AttrSpec,
  ): Record<string, unknown> | undefined {
    const attrsRaw = Object.hasOwn(holder, "attrs")
      ? holder.attrs
      : undefined;
    if (!isPlainObject(attrsRaw)) {
      fail([...basePath, "attrs"], "INVALID_ATTRS");
      return undefined;
    }
    checkAllowedKeys(attrsRaw, new Set(Object.keys(spec)), [...basePath, "attrs"], (path) =>
      fail(path, "INVALID_ATTRS"),
    );
    for (const key of Object.keys(spec)) {
      if (!Object.hasOwn(attrsRaw, key)) {
        fail([...basePath, "attrs", key], "INVALID_ATTRS");
        continue;
      }
      const check = spec[key];
      if (check !== undefined && !check(attrsRaw[key], attrsRaw)) {
        fail([...basePath, "attrs", key], "INVALID_ATTRS");
      }
    }
    if (
      spec === LINK_ATTR_SPEC &&
      typeof attrsRaw.href === "string" &&
      classifyHref(attrsRaw.href) === null
    ) {
      fail([...basePath, "attrs", "href"], "INVALID_LINK");
    }
    if (aborted) return undefined;
    // Rebuild from literal whitelist keys only.
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(spec)) out[key] = attrsRaw[key];
    if (out.colwidth !== undefined && Array.isArray(out.colwidth)) {
      out.colwidth = [...(out.colwidth as unknown[])];
    }
    return out;
  }

  function walkMarks(
    marks: unknown[],
    basePath: readonly (string | number)[],
  ): unknown[] | undefined {
    const built: unknown[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < marks.length; i++) {
      const mark = marks[i];
      const markPath = [...basePath, "marks", i];
      if (!isPlainObject(mark)) {
        fail(markPath, "INVALID_STRUCTURE");
        built.push(undefined);
        continue;
      }
      const markType = Object.hasOwn(mark, "type") ? mark.type : undefined;
      if (typeof markType !== "string") {
        fail([...markPath, "type"], "INVALID_STRUCTURE");
        built.push(undefined);
        continue;
      }
      // Checked before keys/attrs: an unknown mark carrying attrs is
      // UNKNOWN_MARK, never INVALID_ATTRS.
      if (!MARK_TYPES.has(markType)) {
        fail([...markPath, "type"], "UNKNOWN_MARK");
        built.push(undefined);
        continue;
      }
      if (seen.has(markType)) {
        fail([...markPath, "type"], "INVALID_STRUCTURE");
        built.push(undefined);
        continue;
      }
      seen.add(markType);
      const allowedKeys = markType === "link" ? LINK_MARK_KEYS : BARE_MARK_KEYS;
      checkAllowedKeys(mark, allowedKeys, markPath, (path) =>
        fail(path, markType !== "link" && path.at(-1) === "attrs"
          ? "INVALID_ATTRS"
          : "INVALID_STRUCTURE"),
      );
      let builtAttrs: Record<string, unknown> | undefined;
      if (markType === "link") {
        builtAttrs = validateAttrs(mark, markPath, LINK_ATTR_SPEC);
      }
      if (aborted) return undefined;
      const out: Record<string, unknown> = { type: markType };
      if (builtAttrs !== undefined) out.attrs = builtAttrs;
      built.push(out);
    }
    return built;
  }

  function walkChildren(
    children: unknown[],
    basePath: readonly (string | number)[],
    depth: number,
    childSpec: ChildSpec,
  ): unknown[] | undefined {
    // The first-child rule only gates whitelisted types: a forbidden or
    // unknown first child reports its own code and nothing else.
    if (childSpec.first !== undefined && children.length > 0) {
      const first = children[0];
      if (
        isPlainObject(first) &&
        typeof first.type === "string" &&
        WHITELIST_TYPES.has(first.type) &&
        first.type !== childSpec.first
      ) {
        fail([...basePath, "content", 0], "INVALID_STRUCTURE");
      }
    }
    const built: unknown[] = [];
    for (let i = 0; i < children.length; i++) {
      const childPath = [...basePath, "content", i];
      // Depth is checked BEFORE descending one level.
      if (depth + 1 > MAX_DEPTH) {
        fail(childPath, "TOO_DEEP");
        return undefined;
      }
      const child = children[i];
      // Position rules (children.allowed) only gate whitelisted child
      // types; forbidden/unknown children still get visited below and
      // report only their own code.
      if (isPlainObject(child) && typeof child.type === "string") {
        if (
          WHITELIST_TYPES.has(child.type) &&
          !childSpec.allowed.has(child.type)
        ) {
          fail(childPath, "INVALID_STRUCTURE");
        }
      }
      built.push(walkNode(child, childPath, depth + 1));
      if (aborted) return undefined;
    }
    if (children.length < childSpec.min) {
      fail([...basePath, "content"], "INVALID_STRUCTURE");
      return undefined;
    }
    return built;
  }

  function walkNode(
    raw: unknown,
    basePath: readonly (string | number)[],
    depth: number,
  ): Record<string, unknown> | undefined {
    if (!isPlainObject(raw)) {
      fail([...basePath], "INVALID_STRUCTURE");
      return undefined;
    }
    nodeCount += 1;
    if (nodeCount > MAX_NODES) {
      fail([...basePath], "TOO_LARGE");
      return undefined;
    }

    const rawType = Object.hasOwn(raw, "type") ? raw.type : undefined;
    if (typeof rawType !== "string") {
      fail([...basePath, "type"], "INVALID_STRUCTURE");
      return undefined;
    }
    if (FORBIDDEN_EMBED_TYPES.has(rawType)) {
      fail([...basePath, "type"], "FORBIDDEN_EMBED");
      return undefined;
    }
    const spec = NODE_SPECS[rawType as NodeTypeName];
    if (spec === undefined) {
      fail([...basePath, "type"], "UNKNOWN_NODE");
      return undefined;
    }

    checkAllowedKeys(raw, spec.keys, basePath, (path) =>
      fail(
        path,
        path.at(-1) === "attrs" && spec.attrs === null
          ? "INVALID_ATTRS"
          : "INVALID_STRUCTURE",
      ),
    );

    let builtAttrs: Record<string, unknown> | undefined;
    if (spec.attrs !== null) {
      builtAttrs = validateAttrs(raw, basePath, spec.attrs);
      if (aborted) return undefined;
    }

    let textValue: string | undefined;
    if (spec.text) {
      const t = Object.hasOwn(raw, "text") ? raw.text : undefined;
      if (typeof t !== "string" || t.length < 1) {
        fail([...basePath, "text"], "INVALID_STRUCTURE");
      } else {
        textValue = t;
        textTotal += t.length;
        if (textTotal > MAX_TEXT_LENGTH) {
          fail([...basePath], "TOO_LARGE");
          return undefined;
        }
      }
    }

    let builtContent: unknown[] | undefined;
    const hadContent = Object.hasOwn(raw, "content");
    if (spec.children !== null) {
      if (hadContent) {
        if (!Array.isArray(raw.content)) {
          fail([...basePath, "content"], "INVALID_STRUCTURE");
        } else {
          builtContent = walkChildren(
            raw.content,
            basePath,
            depth,
            spec.children,
          );
          if (aborted) return undefined;
        }
      } else if (spec.children.min > 0) {
        // Required content (doc, lists, blockquote, table, rows, cells).
        fail([...basePath, "content"], "INVALID_STRUCTURE");
      }
    }

    let builtMarks: unknown[] | undefined;
    const hadMarks = Object.hasOwn(raw, "marks");
    if (spec.marks && hadMarks) {
      if (!Array.isArray(raw.marks)) {
        fail([...basePath, "marks"], "INVALID_STRUCTURE");
      } else {
        builtMarks = walkMarks(raw.marks, basePath);
        if (aborted) return undefined;
      }
    }

    // Rebuild from literal whitelist keys; presence of optional keys
    // (content/marks) is preserved exactly.
    const out: Record<string, unknown> = { type: rawType };
    if (builtAttrs !== undefined) out.attrs = builtAttrs;
    if (textValue !== undefined) out.text = textValue;
    if (hadContent && builtContent !== undefined) out.content = builtContent;
    if (hadMarks && builtMarks !== undefined) out.marks = builtMarks;
    return out;
  }

  if (
    !isPlainObject(input) ||
    (Object.hasOwn(input, "type") ? input.type : undefined) !== "doc"
  ) {
    return {
      ok: false,
      issues: [
        { path: [], code: "INVALID_STRUCTURE", message: MESSAGES.INVALID_STRUCTURE },
      ],
    };
  }

  const doc = walkNode(input, [], 0);
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, doc: doc as ContentDoc };
}

// ---- Zod adapter (card S1-03a §2) ----

/**
 * Zod adapter around validateContentDoc for input schemas (S1-04), e.g.
 * z.strictObject({ content: contentDocSchema }). On failure each
 * ContentDocIssue becomes one custom issue with a relative path — Zod
 * prefixes the field name automatically (checked on zod 4.6.6).
 */
export const contentDocSchema = z.unknown().transform((value, ctx) => {
  const result = validateContentDoc(value);
  if (result.ok) return result.doc;
  for (const issue of result.issues) {
    ctx.addIssue({
      code: "custom",
      path: [...issue.path],
      message: issue.message,
      params: { code: issue.code },
    });
  }
  return z.NEVER;
});
