// FinalQuizResult (card S5-02 §4.D; screen 7h right) — the "hasil-final"
// state. Server component, pure render: everything graded or recorded
// arrived in the DTO (the stored Nilai Akhir is READ here, never
// recomputed). The review half reuses the S3-01 ResultItem as-is
// (exported from quiz-result.tsx); "Lulus kursus" is the Final Quiz's own
// verdict (decision 4 — never "Nilai Akhir ≥ 70"). The 7h CRS-12 box is
// NOT built (out of scope). Unlike the S3-01 result, this page HAS an h1
// (the S3-01 review finding) — styled as the eyebrow, mono uppercase.
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";
import type { FinalQuizResultDTO } from "@/modules/attempt/service";

import { ResultItem } from "./quiz-result";

/** "14:26" — the Final screens' mm:ss (a zero-padded clock, unlike the
 *  lesson result's "14m 26d"); the limit "20:00" is the same function. */
export function formatFinalClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function FinalVerdictPill({ passed }: { passed: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border px-3 py-1 text-[13px] font-bold",
        passed
          ? "border-success bg-success-tint text-success-tint-text"
          : "border-danger-tint-line bg-danger-tint text-danger-tint-text",
      )}
    >
      {passed ? "Lulus kursus" : "Belum lulus"}
    </span>
  );
}

export function FinalQuizResult({ data }: { data: FinalQuizResultDTO }) {
  const total = data.items.length;
  const { final } = data;
  // Unreachable in the recorded flow (submit wrote the score); "–" is the
  // defensive render and the bar just stays empty.
  const finalScore = final.finalScorePercent;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-primary-deep">
          FINAL QUIZ · HASIL
        </h1>
        <span className="rounded-pill border border-border bg-fill px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-meta">
          Terkunci permanen
        </span>
      </div>

      <section className="mt-4 rounded-card border border-border bg-surface p-6">
        <div className="flex items-center gap-4">
          <p className="font-mono text-[56px] font-medium leading-none text-text">
            {data.scorePercent}
          </p>
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-subtle">
              Nilai
            </p>
            <div className="mt-1">
              <FinalVerdictPill passed={data.isPassed} />
            </div>
          </div>
        </div>
        <p className="mt-5 text-sm text-text-body">
          {data.correct} dari {total} soal benar · waktu pengerjaan{" "}
          {formatFinalClock(data.durationSeconds)} dari{" "}
          {formatFinalClock(final.durationLimitSeconds)}
        </p>
        {data.status === "EXPIRED" ? (
          <p className="mt-3 text-sm text-text-muted">
            Waktu habis — jawaban yang sudah tersimpan dikumpulkan otomatis.
          </p>
        ) : null}
        <p className="mt-3 border-t border-border-soft pt-4 text-sm text-text-muted">
          Nilai Final Quiz sudah tercatat permanen.
        </p>
      </section>

      <section className="mt-4 rounded-card border border-border bg-surface p-6">
        <h2 className="text-[15px] font-bold text-text">Nilai Akhir Kursus</h2>
        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
          <p className="font-mono text-[40px] font-medium leading-none text-success">
            {finalScore ?? "–"}
          </p>
          <p className="font-mono text-[13px] leading-relaxed text-text-muted">
            <span className="block">
              = {final.lessonAveragePercent ?? "–"} ×{" "}
              {final.weights.lessonPercent}%
            </span>
            <span className="block">
              + {data.scorePercent} × {final.weights.finalPercent}%
            </span>
          </p>
        </div>
        <ProgressBar
          value={finalScore ?? 0}
          label="Nilai Akhir kursus"
          tone="success"
          className="mt-4"
        />
        <p className="mt-4 text-sm leading-relaxed text-text-body">
          {final.courseStatus === "PASSED" ? (
            <>
              Status kursus:{" "}
              <strong className="font-bold text-text">Lulus</strong> — nilai
              Final Quiz mencapai batas {final.passingScorePercent}.
            </>
          ) : (
            <>
              Status kursus:{" "}
              <strong className="font-bold text-text">Selesai</strong> — nilai
              Final Quiz di bawah batas {final.passingScorePercent}. Nilai ini
              tetap tercatat.
            </>
          )}
        </p>
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="#pembahasan"
          className={cn(buttonVariants({ variant: "primary" }), "sm:flex-1")}
        >
          Lihat pembahasan {total} soal
        </Link>
        <Link
          href="/belajar"
          className={cn(buttonVariants({ variant: "secondary" }), "sm:flex-1")}
        >
          Ke Belajar
        </Link>
      </div>

      {/* tabIndex lets the "Lihat pembahasan" link land focus here. */}
      <h2
        id="pembahasan"
        tabIndex={-1}
        className="mt-8 text-[20px] font-bold text-text sm:text-[22px]"
      >
        Pembahasan lengkap
      </h2>

      <div className="mt-5 space-y-4">
        {data.items.map((item) => (
          <ResultItem key={item.number} item={item} />
        ))}
      </div>
    </div>
  );
}
