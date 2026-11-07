/*
 * Editor configuration (card S1-03b §2). createEditorExtensions is the
 * single source of TipTap configuration: the RichTextEditor component and
 * the headless tests both build editors from it, so the CMS schema is
 * exactly the S1-03a validator whitelist — 14 nodes, 4 marks. What the
 * editor produces must survive the validator, and the paste tests pin
 * that both ways.
 */

import { Extension, type Editor, type Extensions } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import { TableKit } from "@tiptap/extension-table";
import { StarterKit } from "@tiptap/starter-kit";
import { Fragment, Slice, type Node } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";

import { classifyHref } from "@/lib/content-doc-validator";

export function createEditorExtensions(
  options?: { placeholder?: string },
): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      code: false,
      codeBlock: false,
      strike: false,
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        isAllowedUri: (url) => classifyHref(url) !== null,
      },
    }),
    // renderWrapper makes serialization (getHTML) wrap each table in a
    // div.tableWrapper. The editing DOM has that wrapper anyway — with
    // resizable: false TipTap always installs the TableView node view,
    // which wraps tables itself — so wide tables scroll inside it
    // instead of scrolling the whole canvas (visual review item 2).
    // getJSON is unchanged either way.
    TableKit.configure({ table: { resizable: false, renderWrapper: true } }),
    Placeholder.configure({
      placeholder: options?.placeholder ?? "Mulai menulis…",
    }),
    normalizePastedColwidth,
  ];
}

/**
 * insertTable inside a table cell would nest tables, which the validator
 * rejects — and editor.can().insertTable() still reports true there
 * (tested against 3.32.0). The toolbar menu guards with isActive instead.
 */
export function canInsertTable(editor: Editor): boolean {
  return !editor.isActive("table");
}

/*
 * Pasted tables drag their colwidth along, and <col width="auto"> even
 * parses to NaN, which the validator rejects. The renderer ignores
 * column widths entirely, so paste nulls them ALL: the editor shows the
 * same table the participant page will.
 */
const CELL_TYPES = new Set(["tableCell", "tableHeader"]);

function normalizeColwidth(node: Node): Node {
  const children: Node[] = [];
  node.forEach((child) => {
    children.push(normalizeColwidth(child));
  });
  const content = Fragment.fromArray(children);
  if (CELL_TYPES.has(node.type.name) && node.attrs.colwidth !== null) {
    return node.type.create(
      { ...node.attrs, colwidth: null },
      content,
      node.marks,
    );
  }
  // Leaf nodes keep Fragment.empty, so unchanged subtrees stay identical.
  if (content === node.content) return node;
  return node.copy(content);
}

function normalizePastedSlice(slice: Slice): Slice {
  const children: Node[] = [];
  slice.content.forEach((child) => {
    children.push(normalizeColwidth(child));
  });
  return new Slice(
    Fragment.fromArray(children),
    slice.openStart,
    slice.openEnd,
  );
}

const normalizePastedColwidth = Extension.create({
  name: "normalizePastedColwidth",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          transformPasted: normalizePastedSlice,
        },
      }),
    ];
  },
});
