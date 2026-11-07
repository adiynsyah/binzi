"use client";

/*
 * ContentDocForm (card S1-04 §4) — the one form behind BOTH content-editing
 * pages: the lesson editor (/cms/kursus/{id}/materi/{lessonId}) and the
 * course description editor (/cms/kursus/{id}/deskripsi). One field around
 * RichTextEditor (S1-03b), manual save, no react-hook-form — a document is
 * not a set of scalar fields.
 *
 * Rendering discipline (review D9): the LATEST document lives in a ref;
 * the only per-edit state is `dirty`, which lights once and never
 * re-renders the editor on later keystrokes (React bails on the repeated
 * value).
 *
 * Save flow: Simpan or Ctrl+S/⌘S → client validateContentDoc first (no
 * fetch on an invalid document, focus back to the canvas) → fetch with the
 * inFlight double-submit guard. Revision counter (review K3): the revision
 * at request time is captured; a 200 only reports TERSIMPAN when no edit
 * arrived meanwhile — otherwise BELUM DISIMPAN stays lit and beforeunload
 * stays armed.
 *
 * Unsaved-changes guards: beforeunload only while dirty (removed on
 * unmount, including the 409 → router.refresh() flip), and the breadcrumb
 * links open the A-06 dialog — plain left clicks only, so Cmd/Ctrl/Shift/
 * Alt clicks and middle clicks keep their native new-tab behavior.
 */

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type FormEvent,
} from "react";
import type { JSONContent } from "@tiptap/react";

import { RichTextEditor } from "./rich-text-editor";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FieldError } from "./form-fields";
import { validateContentDoc } from "@/lib/content-doc-validator";
import type { ContentDoc } from "@/lib/content-doc";

export type ContentDocFormProps = {
  /** The stored document (EMPTY_DOC for a never-filled field). */
  initialDoc: ContentDoc;
  saveUrl: string;
  method: "PATCH" | "PUT";
  /** "content" (lesson) or "description" (course) — the request body key. */
  bodyKey: "content" | "description";
  /** id of the label-text element; the editor's aria-labelledby points here. */
  labelId: string;
  breadcrumb: { label: string; href: string | null }[];
  heading: string;
  intro?: string;
};

/** Field label per bodyKey (21i: "Teks materi"; the description page: "Deskripsi"). */
const LABEL_BY_BODY_KEY = {
  content: "Teks materi",
  description: "Deskripsi",
} as const;

// Agent copy (card §4 table + 20c) — the approved proposal list in the PR.
const INDICATOR_SAVING = "⟳ MENYIMPAN…";
const INDICATOR_UNSAVED = "BELUM DISIMPAN";
const INDICATOR_FAILED = "⚠ GAGAL MENYIMPAN";
const NETWORK_BAR_TITLE = "Gagal menyimpan — koneksi terputus";
const TOO_LARGE_MESSAGE = "Teks terlalu panjang.";
const CONFLICT_FALLBACK = "Kursus sudah bukan draf — hanya draf yang bisa diubah.";
const LEAVE_DIALOG_TITLE = "Tinggalkan tanpa menyimpan?";
const LEAVE_DIALOG_DESCRIPTION = "Perubahan sejak simpan terakhir akan hilang.";

/**
 * Heading scale of the editor pages (21i): 28 / 1.18, 900, −0.022em —
 * exported so the locked variant of both pages renders the same scale
 * without importing a client component's internals.
 */
export const CONTENT_DOC_HEADING_CLASS =
  "break-words text-[28px] font-black leading-[1.18] tracking-[-0.022em] text-text";

/** 24-hour HH:MM with a colon (20c "12:04"). Manual on purpose: no
 *  toLocaleTimeString — id-ID renders "12.04" and other locales add
 *  AM/PM (review D5). */
function clockHM(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

type ApiFieldError = { path: string; message: string };

export function ContentDocForm({
  initialDoc,
  saveUrl,
  method,
  bodyKey,
  labelId,
  breadcrumb,
  heading,
  intro,
}: ContentDocFormProps) {
  const router = useRouter();
  const label = LABEL_BY_BODY_KEY[bodyKey];

  // Latest document + its revision (D9/K3). The editor's onChange only
  // fires for real document changes (S1-03b), so dirty means unsaved edits.
  const docRef = useRef<ContentDoc>(initialDoc);
  const revisionRef = useRef(0);
  const dirtyRef = useRef(false);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [leaveHref, setLeaveHref] = useState<string | null>(null);

  const editorRef = useRef<{ focus: () => void } | null>(null);
  const saveRef = useRef<HTMLButtonElement | null>(null);
  const pendingSaveFocus = useRef(false);
  const inFlight = useRef(false);

  function handleEditorChange(doc: JSONContent): void {
    // The S1-03b extension whitelist guarantees getJSON() passes the
    // validator, so the payload is kept as-is and re-validated on save.
    docRef.current = doc as unknown as ContentDoc;
    revisionRef.current += 1;
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setDirty(true);
    }
  }

  async function doSave(): Promise<void> {
    if (inFlight.current) return;

    // Client check first (card §4): an invalid document never leaves the
    // browser; the first issue shows under the editor and focus returns
    // to the canvas.
    const check = validateContentDoc(docRef.current);
    if (!check.ok) {
      setFieldError(check.issues[0]?.message ?? "Format teks ini tidak didukung editor.");
      editorRef.current?.focus();
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setFailed(false);
    setConflict(null);
    setFieldError(null);
    // K3: the revision being saved. If edits land while the request is in
    // flight, the 200 below must NOT report the document as saved.
    const sentRevision = revisionRef.current;

    try {
      const response = await fetch(saveUrl, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [bodyKey]: docRef.current }),
      });

      if (response.ok) {
        if (revisionRef.current === sentRevision) {
          dirtyRef.current = false;
          setDirty(false);
          setSavedAt(new Date());
        }
        pendingSaveFocus.current = true;
      } else if (response.status === 400) {
        const json = (await response.json().catch(() => null)) as {
          error?: { fields?: ApiFieldError[] };
        } | null;
        // Only this form's field errors map to the editor (the path is
        // prefixed with bodyKey, e.g. "content.content.0.type"); anything
        // else falls through to the generic failure bar.
        const first = (json?.error?.fields ?? []).find((field) =>
          field.path.startsWith(bodyKey),
        );
        if (first) {
          setFieldError(first.message);
          editorRef.current?.focus();
        } else {
          setFailed(true);
          pendingSaveFocus.current = true;
        }
      } else if (response.status === 413) {
        setFieldError(TOO_LARGE_MESSAGE);
        editorRef.current?.focus();
      } else if (response.status === 409) {
        const json = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setConflict(json?.error?.message ?? CONFLICT_FALLBACK);
        // The refresh flips the page to its locked shape (card §4); the
        // mounted form unmounts and its beforeunload cleanup runs (D8).
        router.refresh();
        pendingSaveFocus.current = true;
      } else {
        // Includes 401 (expired session) — known limitation, listed in
        // the PR; not changed in this card.
        setFailed(true);
        pendingSaveFocus.current = true;
      }
    } catch {
      setFailed(true);
      pendingSaveFocus.current = true;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  // Focus RETURN to Simpan after responses that do not move focus to the
  // canvas (S1-02 pendingSaveFocus pattern: `loading` sets the native
  // disabled attribute, which drops keyboard focus).
  useEffect(() => {
    if (pendingSaveFocus.current && !saving) {
      pendingSaveFocus.current = false;
      saveRef.current?.focus();
    }
  }, [saving, failed, conflict]);

  // Ctrl+S / ⌘S anywhere on the page (card §4): preventDefault ALWAYS —
  // including with no changes or while a request runs — so the browser's
  // save-page dialog never opens (D7). Plain "s" only: no Alt combos.
  const saveFnRef = useRef(doSave);
  useEffect(() => {
    saveFnRef.current = doSave;
  });
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key.toLowerCase() !== "s") return;
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.altKey) return;
      event.preventDefault();
      void saveFnRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // beforeunload only while there are unsaved changes (D8), always
  // removed again — on save, on unmount, and after the 409 refresh flip.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent): void {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  /** Breadcrumb guard (D8): plain left clicks only — Cmd/Ctrl/Shift/Alt
   *  and non-left buttons keep their native new-tab navigation. */
  function onBreadcrumbClick(
    event: ReactMouseEvent<HTMLAnchorElement>,
    href: string,
  ): void {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (!dirty) return;
    event.preventDefault();
    setLeaveHref(href);
  }

  function leave(): void {
    const href = leaveHref;
    setLeaveHref(null);
    if (href !== null) router.push(href);
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void doSave();
  }

  // Indicator precedence: saving > failed > dirty > savedAt (card §4).
  const indicator = saving
    ? { text: INDICATOR_SAVING, className: "text-text-meta" }
    : failed
      ? { text: INDICATOR_FAILED, className: "text-danger" }
      : dirty
        ? { text: INDICATOR_UNSAVED, className: "text-text-meta" }
        : savedAt
          ? { text: `✓ TERSIMPAN ${clockHM(savedAt)}`, className: "text-success" }
          : null;
  const errorId = `${labelId}-error`;

  return (
    <form onSubmit={onFormSubmit} noValidate>
      {/* Header bar (21i): breadcrumb + save indicator + Simpan. */}
      <header className="flex min-h-[60px] flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-soft px-6">
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex flex-wrap items-center gap-x-2 font-mono text-[11.5px] uppercase tracking-[0.1em] text-text-subtle">
            {breadcrumb.map((segment, index) => {
              const isLink = segment.href !== null;
              return (
                <li key={segment.label} className="flex items-center gap-x-2">
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-border-strong">
                      /
                    </span>
                  ) : null}
                  {isLink ? (
                    <a
                      href={segment.href ?? undefined}
                      onClick={(event) =>
                        onBreadcrumbClick(event, segment.href ?? "/")
                      }
                      className="transition-colors duration-200 ease-out hover:text-text"
                    >
                      {segment.label}
                    </a>
                  ) : (
                    <span aria-current="page">{segment.label}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        {indicator ? (
          <p role="status" className={`font-mono text-[11px] ${indicator.className}`}>
            {indicator.text}
          </p>
        ) : null}
        <Button
          ref={saveRef}
          type="submit"
          className="ml-auto"
          loading={saving}
          loadingLabel="Menyimpan…"
        >
          Simpan
        </Button>
      </header>

      <div className="px-6 pb-8 pt-[26px]">
        <h1 className={CONTENT_DOC_HEADING_CLASS}>{heading}</h1>
        {intro ? (
          <p className="mt-2 max-w-(--width-measure) text-[15px] text-text-muted">
            {intro}
          </p>
        ) : null}

        {/* Response feedback above the editor: the 409 banner (server
            message) and the 20c network-failure bar with its retry. */}
        {conflict ? (
          <div className="mt-6">
            <Banner tone="error" title={conflict} />
          </div>
        ) : null}
        {failed ? (
          <div className="mt-6">
            <Banner
              tone="error"
              title={NETWORK_BAR_TITLE}
              action={
                <Button type="button" variant="secondary" onClick={() => void doSave()}>
                  Coba lagi
                </Button>
              }
            />
          </div>
        ) : null}

        <div className="mt-6 flex items-baseline gap-2">
          {/* labelId sits on the label TEXT alone (not the WAJIB tag), so
              the editor's accessible name is exactly "Teks materi" /
              "Deskripsi" (card §4). */}
          <span id={labelId} className="text-[15px] font-bold text-text">
            {label}
          </span>
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-primary-deep">
            WAJIB
          </span>
        </div>
        <div className="mt-3 max-w-[calc(var(--width-measure)+42px)] text-[17px]">
          <RichTextEditor
            ref={editorRef}
            defaultValue={initialDoc}
            onChange={handleEditorChange}
            aria-labelledby={labelId}
            aria-describedby={fieldError ? errorId : undefined}
            aria-invalid={fieldError ? true : undefined}
          />
        </div>
        {/* The field message sits OUTSIDE the measure-capped wrapper. */}
        <FieldError id={errorId} message={fieldError ?? undefined} />
      </div>

      <Dialog
        open={leaveHref !== null}
        onOpenChange={(open) => {
          if (!open) setLeaveHref(null);
        }}
      >
        <DialogContent
          title={LEAVE_DIALOG_TITLE}
          description={LEAVE_DIALOG_DESCRIPTION}
        >
          <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
            <Button type="button" autoFocus onClick={() => setLeaveHref(null)}>
              Tetap di sini
            </Button>
            <Button type="button" variant="secondary" onClick={leave}>
              Tinggalkan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
