// AttemptReport (card S3-03 §5, screens 7i / 7l) — the report page's five
// states over AttemptReportPageDTO: form · menunggu · disetujui · ditolak ·
// sudah-direset. Server component, pure render: every date and number was
// formed on the server; only the form is a client island. One column at the
// 7i panel width (35rem); one h1 per state, under a mono eyebrow.
//
// No email is promised anywhere (decision 6 — Production still logs mail),
// and the 7i-3 appeal box is not built.
import { Check } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type {
  AttemptReportPageDTO,
  ReportApprovedDTO,
  ReportFormDTO,
  ReportPendingDTO,
} from "@/modules/recovery/service";

import { AttemptReportForm } from "./attempt-report-form";

const EYEBROW_CLASS =
  "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-meta";
const H1_CLASS =
  "mt-2 wrap-anywhere text-[24px] font-black leading-tight tracking-[-0.01em] text-text sm:text-[28px]";
const PILL_CLASS = "inline-flex items-center rounded-pill px-3 py-1 text-xs font-bold";
const LINK_CLASS =
  "font-bold text-primary-deep underline-offset-2 hover:underline";

const EYEBROW_SUFFIX: Record<AttemptReportPageDTO["state"], string> = {
  form: "Laporkan gangguan",
  menunggu: "Status laporan",
  disetujui: "Hasil laporan",
  ditolak: "Hasil laporan",
  "sudah-direset": "Hasil laporan",
};

function FormState({ data }: { data: ReportFormDTO }) {
  const { summary } = data;
  return (
    <>
      <h1 className={H1_CLASS}>Quiz terputus di tengah jalan?</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-text-body">
        Ceritakan apa yang terjadi. Admin akan memeriksa catatan sistem — kalau
        memang gangguan dari sisi kami, kesempatan Anda direset tanpa mengubah
        nilai kursus lain.
      </p>
      <section className="mt-5 rounded-card border border-border bg-surface-2 p-4">
        <h2 className="text-sm font-bold text-text">Data yang ikut terkirim otomatis</h2>
        <ul className="mt-2 space-y-1 font-mono text-[12px] uppercase tracking-[0.04em] text-text-meta">
          <li className="wrap-anywhere">
            Attempt ke-{summary.attemptNumber} · {summary.scope} · Dimulai{" "}
            {summary.startedAt}
          </li>
          <li>
            Terhenti di soal {summary.stoppedAt} dari {summary.total} · Sisa waktu{" "}
            {summary.remaining}
          </li>
          <li>
            Jawaban tersimpan: {summary.answered} dari {summary.total}
          </li>
        </ul>
      </section>
      <AttemptReportForm attemptId={data.attemptId} cancelHref={data.quizHref} />
    </>
  );
}

function PendingState({ data }: { data: ReportPendingDTO }) {
  const steps = [
    { title: "Laporan terkirim", detail: data.createdAt, state: "done" as const },
    {
      title: "Ditinjau admin",
      detail: `Sedang berjalan — perkiraan selesai ${data.deadlineDate}`,
      state: "current" as const,
    },
    {
      title: "Keputusan",
      detail: "Reset disetujui atau ditolak, dengan alasan",
      state: "next" as const,
    },
  ];
  const next =
    data.nextLesson !== null
      ? { label: `Lanjut ke materi ${data.nextLesson.position}`, href: data.nextLesson.href }
      : { label: "Ke halaman kursus", href: data.courseHref };
  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className={cn(PILL_CLASS, "bg-pending-tint text-pending-tint-text")}>
          Menunggu ditinjau
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-meta">
          Laporan #R-{data.number} · {data.createdAt}
        </span>
      </div>
      <h1 className={H1_CLASS}>Laporan Anda sedang diperiksa</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-text-body">
        Admin memeriksa catatan sistem attempt ini. Biasanya selesai dalam 1×24
        jam kerja. Hasilnya muncul di halaman ini.
      </p>
      <ol className="mt-5 space-y-4 rounded-card border border-border bg-surface p-5">
        {steps.map((step) => (
          <li key={step.title} className="flex gap-3">
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-pill border-2",
                step.state === "done" && "border-success bg-success text-surface",
                step.state === "current" && "border-warning bg-surface",
                step.state === "next" && "border-border-strong bg-surface",
              )}
            >
              {step.state === "done" ? <Check className="size-3.5" /> : null}
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[15px] font-bold",
                  step.state === "next" ? "text-text-muted" : "text-text",
                )}
              >
                {step.title}
                {step.state === "done" ? <span className="sr-only"> (selesai)</span> : null}
                {step.state === "current" ? (
                  <span className="sr-only"> (sedang berjalan)</span>
                ) : null}
              </p>
              <p className="text-sm text-text-muted">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="mt-4 rounded-card border border-border bg-surface-2 p-5">
        <h2 className="text-sm font-bold text-text">Sementara menunggu</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-body">
          {data.kind === "FINAL"
            ? `Nilai ${data.scorePercent} tetap tercatat sementara. Kalau reset disetujui, nilai itu dihapus dan Anda mengulang Final Quiz.`
            : `Nilai ${data.scorePercent} tetap tercatat sementara dan materi lain boleh dilanjutkan. Kalau reset disetujui, nilai itu dihapus dan Anda mengulang quiz materi ${data.lessonPosition} saja.`}
        </p>
        <div className="mt-4">
          <Link href={next.href} className={buttonVariants({ variant: "secondary" })}>
            {next.label}
          </Link>
        </div>
      </section>
    </>
  );
}

function ApprovedState({ data }: { data: ReportApprovedDTO }) {
  return (
    <section className="mt-3 rounded-card border border-success bg-success-tint p-5">
      <span className={cn(PILL_CLASS, "bg-success text-surface")}>Reset disetujui</span>
      <h1 className={H1_CLASS}>Kesempatan Anda dikembalikan</h1>
      <p className="mt-3 wrap-anywhere whitespace-pre-line text-[15px] leading-relaxed text-text-body">
        {data.decisionReason}
      </p>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.08em] text-success-tint-text">
        Ditinjau admin · {data.decidedAt} · Alasan dicatat di audit log
      </p>
      <div className="mt-5">
        <Link href={data.quizHref} className={buttonVariants({ variant: "primary" })}>
          {data.kind === "FINAL"
            ? "Kerjakan ulang Final Quiz"
            : `Kerjakan ulang quiz materi ${data.lessonPosition}`}
        </Link>
      </div>
    </section>
  );
}

export function AttemptReport({ data }: { data: AttemptReportPageDTO }) {
  return (
    <div className="mx-auto max-w-[35rem]">
      <p className={EYEBROW_CLASS}>
        {data.eyebrow} · {EYEBROW_SUFFIX[data.state]}
      </p>
      {data.state === "form" ? (
        <FormState data={data} />
      ) : data.state === "menunggu" ? (
        <PendingState data={data} />
      ) : data.state === "disetujui" ? (
        <ApprovedState data={data} />
      ) : data.state === "ditolak" ? (
        <section className="mt-3 rounded-card border border-border bg-surface p-5">
          <span className={cn(PILL_CLASS, "bg-fill text-text-muted")}>Reset ditolak</span>
          <h1 className={H1_CLASS}>Nilai {data.scorePercent} tetap berlaku</h1>
          <p className="mt-3 wrap-anywhere whitespace-pre-line text-[15px] leading-relaxed text-text-body">
            {data.decisionReason}
          </p>
          <p className="mt-5">
            <Link href={data.courseHref} className={LINK_CLASS}>
              Ke halaman kursus
            </Link>
          </p>
        </section>
      ) : (
        <>
          <h1 className={H1_CLASS}>Quiz ini sudah pernah direset</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-text-body">
            Setiap quiz hanya bisa direset satu kali, jadi attempt ini tidak bisa
            dilaporkan lagi.
          </p>
          <p className="mt-5">
            <Link href={data.courseHref} className={LINK_CLASS}>
              Ke halaman kursus
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
