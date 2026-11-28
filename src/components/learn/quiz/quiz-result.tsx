// QuizResult (card S3-01 §4.C; screen 7u; perapian S3-02 §3) — the
// "hasil" state: the score card, the per-question review and the closing
// actions. Server component, pure render — everything graded arrived in
// the DTO, and the key / explanation pair is already gated by
// explanation_policy in the serializer (options.correct === null means
// "hidden", never "wrong"). A hidden policy (reviewAccess HIDDEN_*),
// also hides the per-item Benar/Salah verdict — on a Benar/Salah
// question the "Salah" pill itself would leak the key (card decision 4).
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type {
  QuizResultDTO,
  QuizResultItemDTO,
  QuizReviewAccess,
} from "@/modules/attempt/service";

/** Whether this policy reveals the key + explanation. PASSED is
 *  ON_PASS_ONLY with the bar cleared — it reveals like ALWAYS. */
export function reviewReveals(reviewAccess: QuizReviewAccess): boolean {
  return reviewAccess === "ALWAYS" || reviewAccess === "PASSED";
}

/** The intro line under the review title. ALWAYS keeps the 7u sentence;
 *  the hidden policies say why; PASSED gets none (the reveal is
 *  conditional, so the "apa pun nilainya" wording would be wrong). */
export function reviewIntro(reviewAccess: QuizReviewAccess): string | null {
  switch (reviewAccess) {
    case "ALWAYS":
      return "Ditampilkan untuk semua soal, apa pun nilainya — karena tidak ada percobaan kedua.";
    case "HIDDEN_NEVER":
      return "Kunci jawaban dan pembahasan tidak ditampilkan untuk quiz ini.";
    case "HIDDEN_NOT_PASSED":
      return "Kunci jawaban dan pembahasan hanya ditampilkan bila nilai lulus.";
    default:
      return null;
  }
}

/** "3m 12d" — minutes unbounded (a quiz longer than an hour shows "75m",
 *  no hours unit is invented), seconds zero-padded. */
export function formatQuizDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}d`;
}

function VerdictPill({ passed }: { passed: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border px-3 py-1 text-[13px] font-bold",
        passed
          ? "border-success bg-success-tint text-success-tint-text"
          : "border-danger-tint-line bg-danger-tint text-danger-tint-text",
      )}
    >
      {passed ? "Lulus" : "Belum lulus"}
    </span>
  );
}

function ItemVerdictPill({ correct }: { correct: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em]",
        correct
          ? "border-success bg-success-tint text-success-tint-text"
          : "border-danger-tint-line bg-danger-tint text-danger-tint-text",
      )}
    >
      {correct ? "Benar" : "Salah"}
    </span>
  );
}

/** Neutral pill for a hidden policy — says only whether the question was
 *  answered; "Salah" would leak the key on a Benar/Salah question. */
function AnsweredPill({ answered }: { answered: boolean }) {
  return (
    <span className="inline-flex items-center rounded-pill border border-border-strong bg-fill px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
      {answered ? "Dijawab" : "Tidak dijawab"}
    </span>
  );
}

/** The per-question review card — shared as-is by the Final Quiz result
 *  screen (card S5-02 §4.D); its look does not change. `reveals` false
 *  (hidden policy) swaps the verdict pill and drops Kunci + explanation. */
export function ResultItem({
  item,
  reveals,
}: {
  item: QuizResultItemDTO;
  reveals: boolean;
}) {
  const selected = item.options.find((option) => option.selected) ?? null;
  // Revealed: unanswered counts as wrong — "Salah" — and the key shows
  // for every wrong answer (correct === null = hidden, not "wrong").
  const answeredCorrectly = item.options.some(
    (option) => option.selected && option.correct === true,
  );
  const keyOption = item.options.find((option) => option.correct === true);

  return (
    <article className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-meta">
          Soal {item.number}
        </h3>
        {reveals ? (
          <ItemVerdictPill correct={answeredCorrectly} />
        ) : (
          <AnsweredPill answered={selected !== null} />
        )}
      </div>
      <p className="mt-3 wrap-anywhere text-[15px] font-bold leading-relaxed text-text">
        {item.text}
      </p>
      <p className="mt-3 text-sm text-text-body">
        Jawaban Anda:{" "}
        {selected ? (
          selected.text
        ) : (
          <span className="text-text-muted">tidak dijawab</span>
        )}
      </p>
      {reveals && !answeredCorrectly && keyOption ? (
        <p className="mt-1 text-sm text-text-body">
          Kunci: <span className="font-bold text-text">{keyOption.text}</span>
        </p>
      ) : null}
      {reveals && item.explanation !== null ? (
        <p className="mt-3 max-w-(--width-measure) text-sm leading-relaxed text-text-muted">
          {item.explanation}
        </p>
      ) : null}
    </article>
  );
}

/** "Ada kendala teknis? Laporkan gangguan" (card S3-03 §5; adaptation of
 *  PRD §6.3.2 "Ada kendala teknis? Hubungi kami") — under the result
 *  actions of BOTH result screens (SUBMITTED and EXPIRED alike). */
export function ReportProblemLink({ href }: { href: string }) {
  return (
    <p className="mt-4 text-sm text-text-muted">
      Ada kendala teknis?{" "}
      <Link
        href={href}
        className="font-bold text-primary-deep underline-offset-2 hover:underline"
      >
        Laporkan gangguan
      </Link>
    </p>
  );
}

export function QuizResult({ data }: { data: QuizResultDTO }) {
  const total = data.items.length;
  const reveals = reviewReveals(data.reviewAccess);
  const intro = reviewIntro(data.reviewAccess);
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center gap-3">
        {/* The eyebrow is the page's single h1 (S3-02 §3) — same pattern
            as the Final result screen. */}
        <h1 className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-primary-deep">
          Materi {data.lesson.position} · Hasil Quiz
        </h1>
        <span className="rounded-pill border border-border bg-fill px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-meta">
          Terkunci permanen
        </span>
      </div>

      <section className="mt-4 rounded-card border border-border bg-surface p-6">
        <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <div className="flex items-center gap-4">
            <p className="font-mono text-[56px] font-medium leading-none text-text">
              {data.scorePercent}
            </p>
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-subtle">
                Nilai
              </p>
              <div className="mt-1">
                <VerdictPill passed={data.isPassed} />
              </div>
            </div>
          </div>
          {/* Each dl div holds ONLY dt/dd (axe definition-list): the visible
              label span rides INSIDE the dd next to the value it labels. */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:justify-self-end">
            <div>
              <dt className="sr-only">Benar</dt>
              <dd className="flex items-baseline gap-2">
                <span className="font-mono text-[15px] font-medium text-text">
                  {data.correct}/{total}
                </span>
                <span className="text-sm text-text-muted">benar</span>
              </dd>
            </div>
            <div>
              <dt className="sr-only">Salah</dt>
              <dd className="flex items-baseline gap-2">
                <span className="font-mono text-[15px] font-medium text-text">
                  {data.wrong}
                </span>
                <span className="text-sm text-text-muted">salah</span>
              </dd>
            </div>
            <div>
              <dt className="sr-only">Waktu</dt>
              <dd className="flex items-baseline gap-2">
                <span className="font-mono text-[15px] font-medium text-text">
                  {formatQuizDuration(data.durationSeconds)}
                </span>
                <span className="text-sm text-text-muted">waktu</span>
              </dd>
            </div>
            {data.unanswered > 0 ? (
              <div>
                <dt className="sr-only">Tidak dijawab</dt>
                <dd className="flex items-baseline gap-2">
                  <span className="font-mono text-[15px] font-medium text-text">
                    {data.unanswered}
                  </span>
                  <span className="text-sm text-text-muted">tidak dijawab</span>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        {data.status === "EXPIRED" ? (
          <p className="mt-5 border-t border-border-soft pt-4 text-sm text-text-muted">
            Waktu habis — jawaban yang sudah tersimpan dikumpulkan otomatis.
          </p>
        ) : null}
      </section>

      <h2 className="mt-8 text-[20px] font-bold text-text sm:text-[22px]">
        {reveals ? "Pembahasan lengkap" : "Jawaban Anda"}
      </h2>
      {intro !== null ? (
        <p className="mt-2 text-sm leading-relaxed text-text-muted">{intro}</p>
      ) : null}

      <div className="mt-5 space-y-4">
        {data.items.map((item) => (
          <ResultItem key={item.number} item={item} reveals={reveals} />
        ))}
      </div>

      <section className="mt-8 rounded-card border border-border bg-surface-2 p-6">
        <p className="text-[15px] leading-relaxed text-text">
          {data.finalQuizHref !== null && data.finalQuizDone
            ? // The Final was already collected — the stored enrollment
              // status says so (S3-02 §5), never a recomputation here.
              `Materi ${data.lesson.position} ditandai selesai. Final Quiz sudah dikerjakan.`
            : data.finalQuizHref !== null
              ? // Every lesson is COMPLETED and the course has a Final Quiz —
                // that opening REPLACES the next-lesson branch (card S5-02
                // §5, even when a next lesson exists).
              `Materi ${data.lesson.position} ditandai selesai. Final Quiz sekarang terbuka.`
              : data.next
                ? `Materi ${data.lesson.position} ditandai selesai. Materi ${data.next.position} sekarang terbuka.`
                : `Materi ${data.lesson.position} ditandai selesai.`}
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {data.finalQuizHref !== null && data.finalQuizDone ? (
            <Link
              href={data.finalQuizHref}
              className={cn(buttonVariants({ variant: "primary" }), "sm:flex-1")}
            >
              Lihat hasil Final Quiz
            </Link>
          ) : data.finalQuizHref !== null ? (
            <Link
              href={data.finalQuizHref}
              className={cn(buttonVariants({ variant: "primary" }), "sm:flex-1")}
            >
              Lanjut ke Final Quiz
            </Link>
          ) : data.next ? (
            <Link
              href={data.next.href}
              className={cn(buttonVariants({ variant: "primary" }), "sm:flex-1")}
            >
              Lanjut ke Materi {data.next.position}
            </Link>
          ) : null}
          <Link
            href={data.lesson.href}
            className={cn(buttonVariants({ variant: "secondary" }), "sm:flex-1")}
          >
            Kembali ke materi
          </Link>
        </div>
        <ReportProblemLink href={`${data.lesson.href}/quiz/laporan`} />
      </section>
    </div>
  );
}
