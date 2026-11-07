"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import type { BlockedPaste } from "./editor-paste";

/*
 * Inline blocked-paste panel (card S1-03b §7, screen 20b). Not a modal: it
 * sits between the toolbar and the canvas, explains why video/embed cannot
 * live inside the text (CRS-05), and offers the way out its detection kind
 * allows. The parent owns the actions; this component only renders copy
 * and manages focus.
 *
 * Buttons are Button md (48px) instead of the 40px in 20b.html — touch
 * targets must clear 44px (owner decision).
 */

const COPY: Record<BlockedPaste["kind"], { title: string; body: string }> = {
  "video-link": {
    title: "Video tidak bisa dipasang di dalam teks",
    body: "Video dipasang terpisah di materi kursus, supaya halaman tetap ringan dan bisa dibaca dengan kuota kecil. Tautannya bisa disimpan sebagai teks biasa.",
  },
  "embed-html": {
    title: "Sebagian isi tempelan tidak bisa dipasang",
    body: "Video, iframe, embed, dan script tidak bisa dipasang di dalam teks, supaya halaman tetap ringan dan aman. Sisa tulisannya bisa ditempel tanpa bagian itu.",
  },
  "embed-code": {
    title: "Kode sematan tidak bisa dipasang di dalam teks",
    body: "Video, iframe, embed, dan script tidak bisa dipasang di dalam teks, supaya halaman tetap ringan dan aman. Video dipasang terpisah di materi kursus.",
  },
};

export type EditorBlockedPastePanelProps = {
  result: BlockedPaste;
  /** video-link primary: store/apply the URL as a text link. */
  onInsertAsLink: () => void;
  /** embed-html primary: insert the stored slice minus the blocked parts. */
  onPasteWithoutBlocked: () => void;
  /** Batal/Tutup/Esc — also runs after the other two close the panel. */
  onDismiss: () => void;
};

export function EditorBlockedPastePanel({
  result,
  onInsertAsLink,
  onPasteWithoutBlocked,
  onDismiss,
}: EditorBlockedPastePanelProps) {
  const titleId = useId();
  // One ref, one branch per kind — the button that receives focus.
  const primaryRef = useRef<HTMLButtonElement>(null);
  const copy = COPY[result.kind];

  // The panel appears from a paste, not a click: focus moves into it so
  // keyboard writers are not stranded in the canvas (card §7).
  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onDismiss();
    }
  }

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      className="m-2.5 rounded-control border-[1.5px] border-danger-tint-line bg-danger-tint px-4 py-3.5"
    >
      <div className="flex items-start gap-[11px]">
        <span
          aria-hidden="true"
          className="grid size-[22px] flex-none place-items-center rounded-pill bg-danger text-xs font-bold text-surface"
        >
          !
        </span>
        <div>
          <div id={titleId} className="text-[14.5px] font-bold text-text">
            {copy.title}
          </div>
          <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-[1.6] text-text-muted">
            {copy.body}
          </p>
          <div className="mt-3 flex flex-wrap gap-[9px]">
            {result.kind === "video-link" ? (
              <>
                <Button
                  ref={primaryRef}
                  variant="dark"
                  size="md"
                  onClick={onInsertAsLink}
                >
                  Sisipkan sebagai tautan teks
                </Button>
                <Button variant="ghost" size="md" onClick={onDismiss}>
                  Batal
                </Button>
              </>
            ) : result.kind === "embed-html" ? (
              <>
                <Button
                  ref={primaryRef}
                  variant="dark"
                  size="md"
                  onClick={onPasteWithoutBlocked}
                >
                  Tempel tanpa bagian itu
                </Button>
                <Button variant="ghost" size="md" onClick={onDismiss}>
                  Batal
                </Button>
              </>
            ) : (
              <Button ref={primaryRef} variant="ghost" size="md" onClick={onDismiss}>
                Tutup
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
