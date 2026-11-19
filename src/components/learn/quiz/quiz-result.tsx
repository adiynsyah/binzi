// QuizResult (card S3-01 §4.C; screen 7u) — the "hasil" state: the score
// card, the per-question review and the closing actions. Server component,
// pure render — everything graded arrived in the DTO, and the key /
// explanation pair is already gated by explanation_policy in the
// serializer (options.correct === null means "hidden", never "wrong").
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type { QuizResultDTO, QuizResultItemDTO } from "@/modules/attempt/service";

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

function ResultItem({ item }: { item: QuizResultItemDTO }) {
  const selected = item.options.find((option) => option.selected) ?? null;
  // Unanswered counts as wrong — "Salah" — and the key shows for every
  // wrong answer WHEN the policy reveals it (correct === null = hidden).
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
        <ItemVerdictPill correct={answeredCorrectly} />
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
      {!answeredCorrectly && keyOption ? (
        <p className="mt-1 text-sm text-text-body">
          Kunci: <span className="font-bold text-text">{keyOption.text}</span>
        </p>
      ) : null}
      {item.explanation !== null ? (
        <p className="mt-3 max-w-(--width-measure) text-sm leading-relaxed text-text-muted">
          {item.explanation}
        </p>
      ) : null}
    </article>
  );
}

export function QuizResult({ data }: { data: QuizResultDTO }) {
  const total = data.items.length;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-primary-deep">
          Materi {data.lesson.position} · Hasil Quiz
        </p>
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
        Pembahasan lengkap
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        Ditampilkan untuk semua soal, apa pun nilainya — karena tidak ada
        percobaan kedua.
      </p>

      <div className="mt-5 space-y-4">
        {data.items.map((item) => (
          <ResultItem key={item.number} item={item} />
        ))}
      </div>

      <section className="mt-8 rounded-card border border-border bg-surface-2 p-6">
        <p className="text-[15px] leading-relaxed text-text">
          {data.next
            ? `Materi ${data.lesson.position} ditandai selesai. Materi ${data.next.position} sekarang terbuka.`
            : `Materi ${data.lesson.position} ditandai selesai.`}
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {data.next ? (
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
      </section>
    </div>
  );
}
