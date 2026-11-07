"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useEditorState, type Editor } from "@tiptap/react";

import { canInsertTable } from "./editor-extensions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/*
 * Editor toolbar (card S1-03b §4) — B, I, H2, lists, link, table, in that
 * order with thin separators (21i/20a). Underline, H3–H4, blockquote and
 * hr keep working through shortcuts and paste, without buttons (owner
 * decision 4 Nov evening no. 3).
 *
 * The 32×32 buttons follow 21i even though CLAUDE.md asks for ≥ 44px
 * touch targets: the CMS editor is desktop-only in the demo, WCAG 2.5.8
 * (≥ 24px) is met, and the 2px gaps leave no room for 44px targets
 * without overlap (owner decision; revisit with the tablet layout).
 *
 * Toolbar state MUST go through useEditorState — useEditor does not
 * re-render on transactions, so reading editor.isActive() during render
 * would be stale.
 */

const BUTTON_COUNT = 7;

const BUTTON_BASE =
  "grid size-8 place-items-center rounded-sm disabled:cursor-not-allowed disabled:pointer-events-none disabled:text-text-subtle";
const BUTTON_IDLE = "text-text-nav hover:bg-fill";
const BUTTON_ACTIVE = "bg-text text-surface";
const LABEL_BUTTON_BASE =
  "grid h-8 place-items-center rounded-sm px-2 text-[12.5px] font-bold disabled:cursor-not-allowed disabled:pointer-events-none disabled:text-text-subtle";

/* Icons copied from 20a.html markup, 17px, currentColor. */
const BULLET_LIST_ICON = (
  <svg
    width="17"
    height="17"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="3" cy="4.2" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="3" cy="8" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="3" cy="11.8" r="1.1" fill="currentColor" stroke="none" />
    <line x1="6.4" y1="4.2" x2="14" y2="4.2" />
    <line x1="6.4" y1="8" x2="14" y2="8" />
    <line x1="6.4" y1="11.8" x2="14" y2="11.8" />
  </svg>
);

const ORDERED_LIST_ICON = (
  <svg
    width="17"
    height="17"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="6.4" y1="4.2" x2="14" y2="4.2" />
    <line x1="6.4" y1="8" x2="14" y2="8" />
    <line x1="6.4" y1="11.8" x2="14" y2="11.8" />
    <path d="M2.2 2.9 L3.2 2.4 V5.6" strokeWidth="1.4" />
    <path d="M1.9 7.1 h1.6 L1.9 9.4 h1.7" strokeWidth="1.4" />
    <path d="M2 10.9 h1.5 v1.1 h-1 h1 v1.1 h-1.5" strokeWidth="1.4" />
  </svg>
);

const LINK_ICON = (
  <svg
    width="17"
    height="17"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6.6 9.4 a2.8 2.8 0 0 1 0-3.9 l1.6-1.6 a2.8 2.8 0 0 1 3.9 3.9 l-.8.8" />
    <path d="M9.4 6.6 a2.8 2.8 0 0 1 0 3.9 l-1.6 1.6 a2.8 2.8 0 0 1-3.9-3.9 l.8-.8" />
  </svg>
);

const SEPARATOR_CLASS = "mx-[5px] h-[18px] w-px bg-border";

export type EditorToolbarProps = {
  /** null until the editor is ready — every button renders disabled. */
  editor: Editor | null;
  /** Set only once the canvas exists in the DOM (aria-controls). */
  canvasId: string | undefined;
  onOpenLinkDialog: () => void;
};

type ToolbarState = {
  bold: boolean;
  italic: boolean;
  heading2: boolean;
  bulletList: boolean;
  orderedList: boolean;
  link: boolean;
  canInsertTable: boolean;
  canAddRowAfter: boolean;
  canAddColumnAfter: boolean;
  canDeleteRow: boolean;
  canDeleteColumn: boolean;
  canDeleteTable: boolean;
};

/** useEditorState returns null while the editor is null. */
const STATE_ALL_OFF: ToolbarState = {
  bold: false,
  italic: false,
  heading2: false,
  bulletList: false,
  orderedList: false,
  link: false,
  canInsertTable: false,
  canAddRowAfter: false,
  canAddColumnAfter: false,
  canDeleteRow: false,
  canDeleteColumn: false,
  canDeleteTable: false,
};

export function EditorToolbar({
  editor,
  canvasId,
  onOpenLinkDialog,
}: EditorToolbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  const state =
    useEditorState({
      editor,
      selector: ({ editor }): ToolbarState => {
        if (!editor) return STATE_ALL_OFF;
        return {
          bold: editor.isActive("bold"),
          italic: editor.isActive("italic"),
          heading2: editor.isActive("heading", { level: 2 }),
          bulletList: editor.isActive("bulletList"),
          orderedList: editor.isActive("orderedList"),
          link: editor.isActive("link"),
          // Guarded with isActive, NOT can().insertTable(), which reports
          // true inside a cell and would nest tables (validator rejects).
          canInsertTable: canInsertTable(editor),
          canAddRowAfter: editor.can().addRowAfter(),
          canAddColumnAfter: editor.can().addColumnAfter(),
          canDeleteRow: editor.can().deleteRow(),
          canDeleteColumn: editor.can().deleteColumn(),
          canDeleteTable: editor.can().deleteTable(),
        };
      },
    }) ?? STATE_ALL_OFF;

  // Roving tabindex: exactly one button in the tab order; arrows wrap,
  // Home/End jump to the ends (card §4).
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? BUTTON_COUNT - 1
          : event.key === "ArrowRight"
            ? (focusIndex + 1) % BUTTON_COUNT
            : (focusIndex - 1 + BUTTON_COUNT) % BUTTON_COUNT;
    setFocusIndex(next);
    containerRef.current
      ?.querySelectorAll<HTMLButtonElement>("[data-toolbar-button]")
      .item(next)
      ?.focus();
  }

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Format teks"
      aria-controls={canvasId}
      onKeyDown={handleKeyDown}
      className="flex items-center gap-0.5 border-b border-border-soft bg-surface-2 px-3 py-[7px]"
    >
      <button
        type="button"
        data-toolbar-button
        aria-label="Tebal"
        aria-pressed={state.bold}
        tabIndex={focusIndex === 0 ? 0 : -1}
        onFocus={() => setFocusIndex(0)}
        disabled={!editor}
        onClick={() => editor?.chain().focus().toggleBold().run()}
        className={cn(BUTTON_BASE, state.bold ? BUTTON_ACTIVE : BUTTON_IDLE)}
      >
        <span className="text-sm font-black">B</span>
      </button>
      <button
        type="button"
        data-toolbar-button
        aria-label="Miring"
        aria-pressed={state.italic}
        tabIndex={focusIndex === 1 ? 0 : -1}
        onFocus={() => setFocusIndex(1)}
        disabled={!editor}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
        className={cn(BUTTON_BASE, state.italic ? BUTTON_ACTIVE : BUTTON_IDLE)}
      >
        <span className="text-sm font-bold italic">I</span>
      </button>
      <span aria-hidden="true" className={SEPARATOR_CLASS} />
      <button
        type="button"
        data-toolbar-button
        aria-label="Judul bagian (H2)"
        aria-pressed={state.heading2}
        tabIndex={focusIndex === 2 ? 0 : -1}
        onFocus={() => setFocusIndex(2)}
        disabled={!editor}
        onClick={() =>
          editor?.chain().focus().toggleHeading({ level: 2 }).run()
        }
        className={cn(LABEL_BUTTON_BASE, state.heading2 ? BUTTON_ACTIVE : BUTTON_IDLE)}
      >
        H2
      </button>
      <span aria-hidden="true" className={SEPARATOR_CLASS} />
      <button
        type="button"
        data-toolbar-button
        aria-label="Daftar berpoin"
        aria-pressed={state.bulletList}
        tabIndex={focusIndex === 3 ? 0 : -1}
        onFocus={() => setFocusIndex(3)}
        disabled={!editor}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
        className={cn(BUTTON_BASE, state.bulletList ? BUTTON_ACTIVE : BUTTON_IDLE)}
      >
        {BULLET_LIST_ICON}
      </button>
      <button
        type="button"
        data-toolbar-button
        aria-label="Daftar bernomor"
        aria-pressed={state.orderedList}
        tabIndex={focusIndex === 4 ? 0 : -1}
        onFocus={() => setFocusIndex(4)}
        disabled={!editor}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        className={cn(BUTTON_BASE, state.orderedList ? BUTTON_ACTIVE : BUTTON_IDLE)}
      >
        {ORDERED_LIST_ICON}
      </button>
      <span aria-hidden="true" className={SEPARATOR_CLASS} />
      <button
        type="button"
        data-toolbar-button
        aria-label="Tautan"
        tabIndex={focusIndex === 5 ? 0 : -1}
        onFocus={() => setFocusIndex(5)}
        disabled={!editor}
        onClick={onOpenLinkDialog}
        // Visually active while the cursor sits in a link (20a active
        // state) — not aria-pressed: the button opens a dialog.
        className={cn(BUTTON_BASE, state.link ? BUTTON_ACTIVE : BUTTON_IDLE)}
      >
        {LINK_ICON}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-toolbar-button
            aria-label="Tabel"
            tabIndex={focusIndex === 6 ? 0 : -1}
            onFocus={() => setFocusIndex(6)}
            disabled={!editor}
            className={cn(LABEL_BUTTON_BASE, BUTTON_IDLE)}
          >
            Tabel<span aria-hidden="true"> ▾</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // Guarded: this can fire during unmount, after the editor
            // was destroyed (the commands getter throws then).
            if (editor && !editor.isDestroyed) editor.commands.focus();
          }}
        >
          <DropdownMenuItem
            disabled={!state.canInsertTable}
            onSelect={() =>
              editor
                ?.chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          >
            Sisipkan tabel 3 × 3
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!state.canAddRowAfter}
            onSelect={() => editor?.chain().focus().addRowAfter().run()}
          >
            Tambah baris di bawah
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!state.canAddColumnAfter}
            onSelect={() => editor?.chain().focus().addColumnAfter().run()}
          >
            Tambah kolom di kanan
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!state.canDeleteRow}
            onSelect={() => editor?.chain().focus().deleteRow().run()}
          >
            Hapus baris
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!state.canDeleteColumn}
            onSelect={() => editor?.chain().focus().deleteColumn().run()}
          >
            Hapus kolom
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!state.canDeleteTable}
            onSelect={() => editor?.chain().focus().deleteTable().run()}
          >
            Hapus tabel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
