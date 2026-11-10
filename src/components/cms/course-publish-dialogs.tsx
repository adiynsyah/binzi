"use client";

/*
 * Submit + publish confirmations (card S1-08 §4, screens 20d/19d): the two
 * gate dialogs behind the builder's top-bar buttons. The fetch and the
 * response table live here; the STATUS banner, router.refresh(), and the
 * post-refresh focus request stay in course-builder.tsx, delivered through
 * onOutcome (card §4 table).
 *
 * Focus (owner review 5): EVERY close path — Esc, "Kembali menyunting"/
 * "Batal", the ✕, and the closes after 200/409/5xx — runs the SAME
 * `focusReturn` prop via onCloseAutoFocus: the opener button when it is
 * still connected, otherwise the builder h1. The refresh paths additionally
 * leave a post-refresh focus request with the builder (consumed when the
 * refreshed props land, because the refresh can unmount the opener).
 *
 * The shared checklist row (PublishChecklistRow) is exported for the
 * settings panel's checklist block — one look, two places (owner review 9).
 */

import { useRef, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type {
  CourseReviewDTO,
  PublishChecklist,
} from "@/modules/course/service";

/** The status-banner shape the builder renders under the heading row. */
export type StatusBannerState = {
  tone: "success" | "error";
  title: string;
  description?: string;
};

// Agent copy (not from a design screen) — listed in the PR.
const RETRY_DESCRIPTION = "Periksa koneksi Anda lalu coba lagi.";
const SUBMIT_SUCCESS = "Kursus terkirim — menunggu persetujuan admin.";
const SUBMIT_FAILURE = "Kursus belum terkirim.";
const PUBLISH_SUCCESS = "Kursus terbit.";
const PUBLISH_FAILURE = "Kursus belum terbit.";
const UNSAVED_ROW = "Pengaturan kursus belum disimpan — simpan dulu, lalu kirim.";

/**
 * One checklist row, identical in the settings panel and both dialogs
 * (card §4): ✓ in a green pill / open circle on the same 20px footprint,
 * with the state in text for screen readers.
 */
export function PublishChecklistRow({
  met,
  label,
}: {
  met: boolean;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2.5 border-b border-border-soft py-2 last:border-b-0">
      {met ? (
        <span
          aria-hidden="true"
          className="grid size-5 shrink-0 place-items-center rounded-pill bg-success text-[11px] font-bold text-surface"
        >
          ✓
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="size-5 shrink-0 rounded-pill border-2 border-border-strong"
        />
      )}
      <span
        className={`text-[12.5px] leading-[1.45] ${
          met ? "text-text-muted" : "text-text"
        }`}
      >
        {label}
        <span className="sr-only">
          {" "}
          {met ? "terpenuhi" : "belum terpenuhi"}
        </span>
      </span>
    </li>
  );
}

/** The response table shared by both dialogs (card §4). */
function useGateAction(input: {
  url: string;
  /** aria-disabled stays clickable — the handler owns the guard. */
  locked: boolean;
  successTitle: string;
  failureTitle: string;
  onOutcome: (banner: StatusBannerState, refresh: boolean) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  // Handler-level double-submit guard: softDisabled stays clickable.
  const inFlight = useRef(false);

  async function confirm(): Promise<void> {
    if (input.locked) return; // no fetch while incomplete/unsaved/no reviewer
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      let response: Response;
      try {
        response = await fetch(input.url, { method: "POST" });
      } catch {
        // Network: dialog closes, generic banner, NO refresh (§4 table).
        input.onOutcome(
          {
            tone: "error",
            title: input.failureTitle,
            description: RETRY_DESCRIPTION,
          },
          false,
        );
        input.onOpenChange(false);
        return;
      }

      if (response.ok) {
        input.onOutcome({ tone: "success", title: input.successTitle }, true);
        input.onOpenChange(false);
        return;
      }
      if (
        response.status === 409 ||
        response.status === 403 ||
        response.status === 404
      ) {
        const json = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        input.onOutcome(
          { tone: "error", title: json?.error?.message ?? input.failureTitle },
          true,
        );
        input.onOpenChange(false);
        return;
      }
      // 5xx and anything else: generic banner, no refresh.
      input.onOutcome(
        {
          tone: "error",
          title: input.failureTitle,
          description: RETRY_DESCRIPTION,
        },
        false,
      );
      input.onOpenChange(false);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return { busy, confirm };
}

/** Eyebrow + title + intro + rows + footnote + buttons, shared shape. */
function GateDialog({
  open,
  onOpenChange,
  focusReturn,
  eyebrow,
  title,
  intro,
  rows,
  footnote,
  confirmLabel,
  confirmLoadingLabel,
  confirmVariant,
  cancelLabel,
  locked,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opener if connected, else the builder h1 — every close path. */
  focusReturn: () => void;
  eyebrow: string;
  title: string;
  intro?: string;
  rows: ReactNode;
  footnote: string;
  confirmLabel: string;
  confirmLoadingLabel: string;
  confirmVariant: "dark" | "success";
  cancelLabel: string;
  locked: boolean;
  busy: boolean;
  onConfirm: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={title}
        description={intro}
        onCloseAutoFocus={(event) => {
          // Radix would return focus to the trigger/body; every close path
          // (Esc, secondary button, ✕, response closes) runs the same
          // helper instead (owner review 5).
          event.preventDefault();
          focusReturn();
        }}
      >
        {/* 20d-style eyebrow: mono uppercase, one truncated line. */}
        <div className="order-first pr-11">
          <p className="w-fit max-w-full truncate font-mono text-xs uppercase tracking-wide text-text-subtle">
            {eyebrow}
          </p>
        </div>

        <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-5">
          <ul>{rows}</ul>

          <p className="rounded-control bg-surface-2 p-3.5 text-[12.5px] leading-relaxed text-text-muted">
            {footnote}
          </p>

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row-reverse">
            <Button
              type="submit"
              variant={confirmVariant}
              loading={busy}
              loadingLabel={confirmLoadingLabel}
              softDisabled={locked || busy}
            >
              {confirmLabel}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type SubmitCourseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  checklist: PublishChecklist;
  /** formState.isDirty of the settings form — unsaved settings block. */
  settingsDirty: boolean;
  focusReturn: () => void;
  onOutcome: (banner: StatusBannerState, refresh: boolean) => void;
};

export function SubmitCourseDialog({
  open,
  onOpenChange,
  courseId,
  checklist,
  settingsDirty,
  focusReturn,
  onOutcome,
}: SubmitCourseDialogProps) {
  const locked = checklist.missing.length > 0 || settingsDirty;
  const { busy, confirm } = useGateAction({
    url: `/api/cms/courses/${courseId}/submit`,
    locked,
    successTitle: SUBMIT_SUCCESS,
    failureTitle: SUBMIT_FAILURE,
    onOutcome,
    onOpenChange,
  });

  // "{n} hal belum lengkap": unmet checklist items + 1 when the settings
  // form is still dirty (card §4).
  const pending =
    checklist.items.filter((item) => !item.met).length + (settingsDirty ? 1 : 0);
  const title =
    pending === 0
      ? "Semua syarat terpenuhi"
      : pending === 1
        ? "Satu hal belum lengkap"
        : `${pending} hal belum lengkap`;

  return (
    <GateDialog
      open={open}
      onOpenChange={onOpenChange}
      focusReturn={focusReturn}
      eyebrow="KIRIM UNTUK PERSETUJUAN"
      title={title}
      intro="Validasi yang sama dijalankan server saat admin menekan Setujui & terbitkan — lebih baik ketahuan sekarang."
      rows={
        <>
          {checklist.items.map((item) => (
            <PublishChecklistRow key={item.key} met={item.met} label={item.label} />
          ))}
          {settingsDirty ? (
            <PublishChecklistRow met={false} label={UNSAVED_ROW} />
          ) : null}
        </>
      }
      footnote="Setelah terkirim, kursus terkunci dari suntingan sampai admin menyetujuinya."
      confirmLabel="Kirim"
      confirmLoadingLabel="Mengirim…"
      confirmVariant="dark"
      cancelLabel="Kembali menyunting"
      locked={locked}
      busy={busy}
      onConfirm={() => void confirm()}
    />
  );
}

export type PublishCourseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  checklist: PublishChecklist;
  review: CourseReviewDTO | null;
  focusReturn: () => void;
  onOutcome: (banner: StatusBannerState, refresh: boolean) => void;
};

export function PublishCourseDialog({
  open,
  onOpenChange,
  courseId,
  checklist,
  review,
  focusReturn,
  onOutcome,
}: PublishCourseDialogProps) {
  const locked = checklist.missing.length > 0 || review === null;
  const { busy, confirm } = useGateAction({
    url: `/api/cms/courses/${courseId}/publish`,
    locked,
    successTitle: PUBLISH_SUCCESS,
    failureTitle: PUBLISH_FAILURE,
    onOutcome,
    onOpenChange,
  });

  return (
    <GateDialog
      open={open}
      onOpenChange={onOpenChange}
      focusReturn={focusReturn}
      eyebrow="SETUJUI & TERBITKAN"
      title="Terbitkan kursus ini?"
      rows={
        <>
          {checklist.items.map((item) => (
            <PublishChecklistRow key={item.key} met={item.met} label={item.label} />
          ))}
          <PublishChecklistRow
            met={review !== null}
            label={
              review
                ? `Penggarap tercatat: ${review.reviewerName}`
                : "Penggarap belum tercatat"
            }
          />
        </>
      }
      footnote="Setelah terbit, kursus bisa diikuti peserta dan tetap terkunci dari suntingan."
      confirmLabel="Setujui & terbitkan"
      confirmLoadingLabel="Menerbitkan…"
      confirmVariant="success"
      cancelLabel="Batal"
      locked={locked}
      busy={busy}
      onConfirm={() => void confirm()}
    />
  );
}
