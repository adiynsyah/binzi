"use client";

import type { JSONContent } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import styles from "./TiptapEditor.module.scss";

/**
 * BINZI reusable rich-text editor (TASK 017, CMS Spec §15,
 * Blueprint §21–22).
 *
 * Sits at the "TiptapEditor" layer of the approved boundary:
 * ContentEditor (TASK 018/019) → TiptapEditor → Tiptap JSON →
 * Zod → Content Service → JSONB. The component is pure client
 * UI: it receives an initial JSON document and reports changes
 * upward via onChange(editor.getJSON()). No database, Supabase,
 * or server-only imports belong here.
 *
 * Extension set is exactly the approved V1 list (Blueprint §22):
 * StarterKit (paragraphs, headings, bold/italic/underline,
 * lists, blockquote, horizontal rule, history — v3 also bundles
 * Link and Underline), Image, Placeholder. Underline is included
 * because CMS Spec §15 lists it in the minimum support set.
 */

export type TiptapEditorProps = {
  /**
   * Initial Tiptap JSON document — the same representation stored
   * in contents.body (JSONB). Null/undefined starts an empty doc.
   */
  content?: JSONContent | null;
  /** Called on every document change with the full Tiptap JSON. */
  onChange?: (document: JSONContent) => void;
  /** Placeholder copy shown when the document is empty. */
  placeholder?: string;
  /** Accessible name for the editable region. */
  label?: string;
};

const DEFAULT_PLACEHOLDER = "Tulis konten Anda di sini…";
const DEFAULT_LABEL = "Isi konten";

/**
 * Prompts for an http(s) URL. Returns null when the user cancels
 * or the value is not a usable web URL — no partial states.
 * Minimal TASK 017 behavior; a richer link/image UI belongs to
 * later polish, not to the reusable editor.
 */
function askForUrl(message: string): string | null {
  const value = window.prompt(message);
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
  } catch {
    return null;
  }
  return trimmed;
}

type ToggleControl = {
  key: string;
  label: string;
  hint: string;
  pressed: boolean;
  run: () => void;
};

export function TiptapEditor({
  content,
  onChange,
  placeholder = DEFAULT_PLACEHOLDER,
  label = DEFAULT_LABEL,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Links must not navigate while the author is editing.
        link: { openOnClick: false },
      }),
      Image,
      Placeholder.configure({ placeholder }),
    ],
    content: content ?? undefined,
    // Next.js SSR: create the editor view only after mount.
    immediatelyRender: false,
    // Keep toolbar aria-pressed states in sync with the document.
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
    editorProps: {
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
      },
    },
  });

  if (!editor) {
    // Server render / pre-mount: toolbar visible but inert.
    return (
      <div className={styles.root}>
        <div className={styles.toolbar} role="group" aria-label="Alat format teks">
          <button type="button" className={styles.button} disabled>
            Memuat editor…
          </button>
        </div>
        <div className={styles.editable} aria-busy="true" />
      </div>
    );
  }

  const chain = () => editor.chain().focus();

  const toggleControls: ToggleControl[] = [
    {
      key: "bold",
      label: "Tebal",
      hint: "Tebal (Ctrl+B)",
      pressed: editor.isActive("bold"),
      run: () => chain().toggleBold().run(),
    },
    {
      key: "italic",
      label: "Miring",
      hint: "Miring (Ctrl+I)",
      pressed: editor.isActive("italic"),
      run: () => chain().toggleItalic().run(),
    },
    {
      key: "underline",
      label: "Garis Bawah",
      hint: "Garis bawah (Ctrl+U)",
      pressed: editor.isActive("underline"),
      run: () => chain().toggleUnderline().run(),
    },
    {
      key: "heading2",
      label: "H2",
      hint: "Judul bagian",
      pressed: editor.isActive("heading", { level: 2 }),
      run: () => chain().toggleHeading({ level: 2 }).run(),
    },
    {
      key: "heading3",
      label: "H3",
      hint: "Sub-judul bagian",
      pressed: editor.isActive("heading", { level: 3 }),
      run: () => chain().toggleHeading({ level: 3 }).run(),
    },
    {
      key: "bulletList",
      label: "Daftar",
      hint: "Daftar berbutir",
      pressed: editor.isActive("bulletList"),
      run: () => chain().toggleBulletList().run(),
    },
    {
      key: "orderedList",
      label: "Daftar Bernomor",
      hint: "Daftar bernomor",
      pressed: editor.isActive("orderedList"),
      run: () => chain().toggleOrderedList().run(),
    },
    {
      key: "blockquote",
      label: "Kutipan",
      hint: "Kutipan blok",
      pressed: editor.isActive("blockquote"),
      run: () => chain().toggleBlockquote().run(),
    },
    {
      key: "link",
      label: "Tautan",
      hint: "Tautan (http/https)",
      pressed: editor.isActive("link"),
      run: () => {
        if (editor.isActive("link")) {
          chain().unsetLink().run();
          return;
        }
        const href = askForUrl("URL tautan (http/https)");
        if (href) {
          chain().setLink({ href }).run();
        }
      },
    },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.toolbar} role="group" aria-label="Alat format teks">
        {toggleControls.map((control) => (
          <button
            key={control.key}
            type="button"
            className={
              control.pressed ? styles.buttonActive : styles.button
            }
            aria-pressed={control.pressed}
            title={control.hint}
            onClick={control.run}
          >
            {control.label}
          </button>
        ))}
        <button
          type="button"
          className={styles.button}
          title="Sisipkan gambar dari URL (http/https)"
          onClick={() => {
            const src = askForUrl("URL gambar (http/https)");
            if (!src) {
              return;
            }
            const alt = window.prompt("Teks alternatif gambar (opsional)") ?? "";
            chain().setImage({ src, alt }).run();
          }}
        >
          Gambar
        </button>
        <button
          type="button"
          className={styles.button}
          title="Sisipkan garis pemisah"
          onClick={() => chain().setHorizontalRule().run()}
        >
          Garis Pemisah
        </button>
      </div>
      <EditorContent editor={editor} className={styles.editable} />
    </div>
  );
}
