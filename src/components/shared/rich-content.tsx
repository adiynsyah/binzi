/*
 * RichContent (card S1-03a §5) — renders a validated ContentDoc as React
 * elements. Never a string of HTML, never dangerouslySetInnerHTML
 * (react/no-danger): text enters as React children, so it is escaped.
 *
 * Re-validates on every render (§12.3 "sanitasi ulang saat render") and
 * renders ONLY the validated doc; an invalid document shows one fallback
 * paragraph. No "use client" and no server imports, so the same component
 * serves server pages (lesson material, ISR articles) and client
 * components (editor preview).
 *
 * Every Tailwind class is a full literal string (maps included) —
 * template-built class names generate no CSS. Table numbering is counted
 * per render inside the component closure, never in module state.
 */

import { Fragment, type ReactNode } from "react";

import type {
  ContentDocBlock,
  ContentDocCell,
  ContentDocInline,
  ContentDocListItem,
  ContentDocMark,
  ContentDocTableRow,
} from "@/lib/content-doc";
import { classifyHref, validateContentDoc } from "@/lib/content-doc-validator";
import { cn } from "@/lib/utils";

const ROOT_CLASS =
  "relative flex min-w-0 max-w-(--width-measure) flex-col gap-4 wrap-anywhere text-[17px] leading-[1.75] text-text-body";

const PARAGRAPH_CLASS = "text-pretty";

/** Margins add to the parent's 16px flex gap (h2 32, h3 24, h4 20). */
const HEADING_CLASSES: Record<2 | 3 | 4, string> = {
  2: "text-[24px] leading-[1.28] font-black tracking-[-0.02em] text-text text-balance mt-4 first:mt-0",
  3: "text-[19px] leading-[1.3] font-black tracking-[-0.015em] text-text text-balance mt-2 first:mt-0",
  4: "text-[17px] leading-[1.4] font-bold text-text text-balance mt-1 first:mt-0",
};

const BULLET_LIST_CLASS = "flex list-disc flex-col gap-2 pl-6";
const ORDERED_LIST_CLASS = "flex flex-col gap-2 pl-6";
const LIST_ITEM_CLASS = "space-y-2";

const BLOCKQUOTE_CLASS =
  "flex flex-col gap-4 border-l-2 border-text pl-5 text-[18px] leading-[1.7] text-text";

const HORIZONTAL_RULE_CLASS = "my-4 border-t border-border first:mt-0 last:mb-0";

/** The <ol> type attribute loses to list-style utilities, so map each
 *  whitelisted value to its class (literal strings, never concatenated). */
const OL_TYPE_CLASSES: Record<"1" | "a" | "A" | "i" | "I", string> = {
  "1": "list-decimal",
  a: "list-[lower-alpha]",
  A: "list-[upper-alpha]",
  i: "list-[lower-roman]",
  I: "list-[upper-roman]",
};

const TABLE_WRAPPER_CLASS = "relative overflow-x-auto";
const TABLE_CLASS = "w-full border-collapse text-[16px] leading-[1.5]";
const CELL_CLASS = "border border-border px-3 py-2 align-top min-w-30 wrap-anywhere";
const HEADER_CELL_CLASS = "bg-surface-2 font-bold text-text";
const CELL_CONTENT_CLASS = "flex flex-col gap-2";

const CELL_ALIGN_CLASSES: Record<"left" | "center" | "right", string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const LINK_CLASS = "text-primary-deep underline hover:text-primary-deeper";
const EXTERNAL_LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

type LinkMark = Extract<ContentDocMark, { type: "link" }>;
type ReactNodeKey = string | number;

function linkMarkOf(node: ContentDocInline | undefined): LinkMark | undefined {
  return node?.marks?.find((mark): mark is LinkMark => mark.type === "link");
}

/** Nest non-link marks in a fixed order: strong > em > u. */
function wrapMarks(
  content: ReactNode,
  marks: readonly ContentDocMark[] | undefined,
): ReactNode {
  const has = (type: ContentDocMark["type"]): boolean =>
    marks?.some((mark) => mark.type === type) ?? false;
  let wrapped = content;
  if (has("underline")) wrapped = <u>{wrapped}</u>;
  if (has("italic")) wrapped = <em>{wrapped}</em>;
  if (has("bold")) wrapped = <strong className="font-bold">{wrapped}</strong>;
  return wrapped;
}

function renderInline(node: ContentDocInline, key: ReactNodeKey): ReactNode {
  if (node.type === "hardBreak") return <br key={key} />;
  // Keyed Fragment: this element lands in a children array (renderInlines
  // output, link groups), so a bare <strong>/<em>/<u> triggers React's
  // "unique key prop" warning (PR 110 item 2).
  return <Fragment key={key}>{wrapMarks(node.text, node.marks)}</Fragment>;
}

/**
 * Consecutive inlines carrying a link mark with the SAME href render as
 * ONE <a> with ONE sr-only hint — TipTap splits "satu **dua** tiga" into
 * three text nodes.
 */
function renderInlines(nodes: readonly ContentDocInline[]): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    if (node === undefined) break;
    const href = linkMarkOf(node)?.attrs.href ?? null;
    if (href === null) {
      out.push(renderInline(node, i));
      i += 1;
      continue;
    }
    let end = i + 1;
    while (
      end < nodes.length &&
      linkMarkOf(nodes[end])?.attrs.href === href
    ) {
      end += 1;
    }
    out.push(renderLinkGroup(nodes.slice(i, end), href, i));
    i = end;
  }
  return out;
}

function renderLinkGroup(
  group: readonly ContentDocInline[],
  href: string,
  key: ReactNodeKey,
): ReactNode {
  const external = classifyHref(href) === "external";
  return (
    <a
      key={key}
      href={href}
      className={LINK_CLASS}
      {...(external ? EXTERNAL_LINK_PROPS : {})}
    >
      {group.map((node, i) => renderInline(node, i))}
      {external ? (
        <span className="sr-only">{" (membuka tab baru)"}</span>
      ) : null}
    </a>
  );
}

/**
 * Numbers every table in document order (1-based) in a pre-render walk.
 * Reassigning a closure counter inside the render helpers trips
 * react-hooks/immutability, and a module-level counter would leak across
 * renders — a fresh per-render WeakMap does neither. Tables nest inside
 * list items and blockquotes, and INDIRECTLY inside cells (a cell holds
 * no table itself, but its blockquote or list may) — so the walk also
 * descends rows → cells → cell content (PR 110 item 3).
 */
function numberTables(
  blocks: readonly ContentDocBlock[],
  counter: { value: number },
  numbers: WeakMap<object, number>,
): void {
  for (const block of blocks) {
    if (block.type === "table") {
      numbers.set(block, counter.value);
      counter.value += 1;
      for (const row of block.content) {
        for (const cell of row.content) {
          numberTables(cell.content, counter, numbers);
        }
      }
      continue;
    }
    if (block.type === "bulletList" || block.type === "orderedList") {
      for (const item of block.content) {
        numberTables(item.content, counter, numbers);
      }
    } else if (block.type === "blockquote") {
      numberTables(block.content, counter, numbers);
    }
  }
}

export function RichContent({
  doc,
  className,
}: {
  doc: unknown;
  className?: string;
}) {
  if (doc === null || doc === undefined) return null;

  const result = validateContentDoc(doc);
  if (!result.ok) {
    // Codes and paths only — never the document's text.
    console.error(
      "RichContent: dokumen konten tidak lolos validasi",
      result.issues.map((issue) => ({ code: issue.code, path: issue.path })),
    );
    return (
      <p className="text-text-muted">Konten ini belum bisa ditampilkan.</p>
    );
  }

  // Per-render table numbering (see numberTables) — fresh every render.
  const tableNumbers = new WeakMap<object, number>();
  numberTables(result.doc.content, { value: 1 }, tableNumbers);

  function renderListItem(
    node: ContentDocListItem,
    key: ReactNodeKey,
  ): ReactNode {
    // NOT flex: display:flex removes the marker. Spacing via space-y-2.
    return (
      <li key={key} className={LIST_ITEM_CLASS}>
        {node.content.map((block, i) => renderBlock(block, i))}
      </li>
    );
  }

  function renderCell(
    cell: ContentDocCell,
    scope: "col" | "row",
    key: ReactNodeKey,
  ): ReactNode {
    const isHeader = cell.type === "tableHeader";
    const Tag = isHeader ? "th" : "td";
    return (
      <Tag
        key={key}
        className={cn(
          CELL_CLASS,
          isHeader ? HEADER_CELL_CLASS : undefined,
          cell.attrs.align
            ? CELL_ALIGN_CLASSES[cell.attrs.align]
            : // Browsers text-center th by default; align null must mean
              // the same left alignment as td (owner decision, PR 110
              // item 4).
              isHeader
              ? CELL_ALIGN_CLASSES.left
              : undefined,
        )}
        scope={isHeader ? scope : undefined}
        colSpan={cell.attrs.colspan > 1 ? cell.attrs.colspan : undefined}
        rowSpan={cell.attrs.rowspan > 1 ? cell.attrs.rowspan : undefined}
      >
        <div className={CELL_CONTENT_CLASS}>
          {cell.content.map((block, i) => renderBlock(block, i))}
        </div>
      </Tag>
    );
  }

  function renderRow(
    row: ContentDocTableRow,
    scope: "col" | "row",
    key: ReactNodeKey,
  ): ReactNode {
    return (
      <tr key={key}>
        {row.content.map((cell, i) => renderCell(cell, scope, i))}
      </tr>
    );
  }

  function renderBlock(node: ContentDocBlock, key: ReactNodeKey): ReactNode {
    switch (node.type) {
      case "paragraph":
        if (node.content === undefined || node.content.length === 0) {
          return null;
        }
        return (
          <p key={key} className={PARAGRAPH_CLASS}>
            {renderInlines(node.content)}
          </p>
        );
      case "heading": {
        const level = node.attrs.level;
        const HeadingTag =
          level === 2 ? "h2" : level === 3 ? "h3" : "h4";
        return (
          <HeadingTag key={key} className={HEADING_CLASSES[level]}>
            {node.content ? renderInlines(node.content) : null}
          </HeadingTag>
        );
      }
      case "bulletList":
        return (
          <ul key={key} className={BULLET_LIST_CLASS}>
            {node.content.map((item, i) => renderListItem(item, i))}
          </ul>
        );
      case "orderedList":
        return (
          <ol
            key={key}
            className={cn(
              ORDERED_LIST_CLASS,
              OL_TYPE_CLASSES[node.attrs.type ?? "1"],
            )}
            start={node.attrs.start !== 1 ? node.attrs.start : undefined}
            type={node.attrs.type ?? undefined}
          >
            {node.content.map((item, i) => renderListItem(item, i))}
          </ol>
        );
      case "blockquote":
        return (
          <blockquote key={key} className={BLOCKQUOTE_CLASS}>
            {node.content.map((block, i) => renderBlock(block, i))}
          </blockquote>
        );
      case "horizontalRule":
        return <hr key={key} className={HORIZONTAL_RULE_CLASS} />;
      case "table": {
        const rows = node.content;
        const first = rows[0];
        const headRow =
          first !== undefined &&
          first.content.every((cell) => cell.type === "tableHeader")
            ? first
            : null;
        const bodyRows = headRow ? rows.slice(1) : rows;
        // The pre-render walk numbers every table; a miss would be an
        // internal bug, and the renderer tests would fail on the label.
        const tableNumber = tableNumbers.get(node);
        return (
          <div
            key={key}
            role="region"
            aria-label={tableNumber === undefined ? "Tabel" : `Tabel ${tableNumber}`}
            tabIndex={0}
            className={TABLE_WRAPPER_CLASS}
          >
            <table className={TABLE_CLASS}>
              {headRow ? <thead>{renderRow(headRow, "col", 0)}</thead> : null}
              {bodyRows.length > 0 ? (
                <tbody>
                  {bodyRows.map((row, i) => renderRow(row, "row", i))}
                </tbody>
              ) : null}
            </table>
          </div>
        );
      }
    }
  }

  return (
    <div className={cn(ROOT_CLASS, className)}>
      {result.doc.content.map((block, i) => renderBlock(block, i))}
    </div>
  );
}
