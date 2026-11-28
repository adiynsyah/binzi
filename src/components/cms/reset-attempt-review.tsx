// Review page body for one report (card S3-03 §6, screen 26b). Server
// component: the reporter, "Kata user" (category chip + the story as-is),
// "Catatan sistem" built ONLY from database rows (decision 7 — no device,
// connection, or server-error lines), three number boxes, and on the right
// (≥ 1024, ±340 px; stacked below) either the decision form (PENDING) or
// the read-only decision. No "Lihat profil" link (that page is A8).
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ReportReviewDTO } from "@/modules/recovery/service";

import { ResetAttemptDecisionForm } from "./reset-attempt-decision-form";
import { DeadlineText, ReportStatusPill } from "./reset-attempt-status";

const BOX = "rounded-card border border-border bg-surface p-5";
const MONO_LABEL =
  "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-meta";

function NumberBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <dt className="text-xs font-bold text-text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-[17px] font-medium text-text">{value}</dd>
    </div>
  );
}

export function ResetAttemptReview({ data }: { data: ReportReviewDTO }) {
  const { attempt } = data;
  const quizWords =
    attempt.kind === "FINAL" ? "quiz Final" : `quiz materi ${attempt.lessonPosition}`;
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.08em]">
          <Link
            href="/cms/reset-attempt"
            className="inline-flex min-h-(--height-touch-min) items-center font-medium text-text hover:underline"
          >
            ← Reset attempt
          </Link>
          <span aria-hidden="true" className="text-text-subtle">
            /
          </span>
          <h1 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-text-meta">
            Laporan R-{data.number}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <ReportStatusPill status={data.status} />
          </div>
          {data.deadline ? (
            <div>
              <DeadlineText deadline={data.deadline} prefix="Tenggat " />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={data.reporter.name} aria-hidden className="shrink-0" />
            <div className="min-w-0">
              <h2 className="wrap-anywhere text-[20px] font-black text-text">
                {data.reporter.name}
              </h2>
              <p className="wrap-anywhere text-sm text-text-muted">
                {data.reporter.email} · laporan ke-{data.reporter.ordinal} dari akun ini
              </p>
            </div>
          </div>

          <section className={BOX}>
            <h3 className={MONO_LABEL}>Kata user · {data.createdAt}</h3>
            <p className="mt-2 inline-flex rounded-pill bg-fill px-3 py-1 text-xs font-bold text-text-body">
              {data.categoryLabel}
            </p>
            <p className="mt-3 wrap-anywhere whitespace-pre-line text-[15px] leading-relaxed text-text">
              {data.description}
            </p>
          </section>

          <section className={cn(BOX, "bg-surface-2")}>
            <h3 className={MONO_LABEL}>Catatan sistem · attempt ke-{attempt.attemptNumber}</h3>
            <p className="mt-1 wrap-anywhere font-mono text-[11px] uppercase tracking-[0.06em] text-text-subtle">
              {attempt.contextLine}
            </p>
            <ol className="mt-4 space-y-3">
              {data.timeline.map((entry, index) => (
                <li key={index} className="grid grid-cols-[64px_12px_minmax(0,1fr)] items-start gap-2 text-sm">
                  <span className="font-mono text-xs text-text-meta">{entry.time}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1.5 size-2 rounded-pill",
                      entry.tone === "success" ? "bg-success" : "bg-text-subtle",
                    )}
                  />
                  <span className="text-text-body">{entry.label}</span>
                </li>
              ))}
            </ol>
          </section>

          <dl className="grid gap-3 sm:grid-cols-3">
            <NumberBox label="Nilai tercatat" value={String(attempt.scorePercent)} />
            <NumberBox label="Sisa waktu saat terhenti" value={attempt.remaining} />
            <NumberBox
              label="Jawaban tersimpan"
              value={`${attempt.answered}/${attempt.total}`}
            />
          </dl>
        </div>

        <aside aria-label="Keputusan" className="min-w-0">
          {data.decision === null ? (
            <ResetAttemptDecisionForm
              number={data.number}
              scorePercent={attempt.scorePercent}
              quizWords={quizWords}
            />
          ) : (
            <section className={BOX}>
              <h2 className={MONO_LABEL}>Keputusan</h2>
              <div className="mt-3">
                <ReportStatusPill status={data.decision.status} />
              </div>
              <h3 className="mt-4 text-sm font-bold text-text">Alasan untuk user</h3>
              <p className="mt-1 wrap-anywhere whitespace-pre-line text-[15px] text-text-body">
                {data.decision.reason}
              </p>
              <h3 className="mt-4 text-sm font-bold text-text">Catatan internal</h3>
              <p className="mt-1 wrap-anywhere whitespace-pre-line text-sm text-text-body">
                {data.decision.internalNote ?? "—"}
              </p>
              <p className="mt-4 text-sm text-text-muted">
                Diputuskan oleh {data.decision.decidedByName ?? "—"} ·{" "}
                {data.decision.decidedAt}
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
