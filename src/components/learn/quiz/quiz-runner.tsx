"use client";

// QuizRunner (card S3-01 §4.B; screens 7g / 7u / 7n, 28c) — the "berjalan"
// state. Pure presentation + the three client-side concerns the card names:
// the server-clock timer (offset-corrected, ONE 2-minute announcement,
// zero → flush ≤ 5 s → collect → refresh), the answer save queue (see
// answer-save-queue.ts), and the ragu-ragu flag (client-only state by
// design — it disappears on reload; noted in the PR).
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Flag } from "lucide-react";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuizRunningDTO } from "@/modules/attempt/service";
import {
  createAnswerSaveQueue,
  type AnswerSaveState,
} from "./answer-save-queue";

const TWO_MINUTES_MS = 120_000;
const TWO_MINUTE_ANNOUNCEMENT = "Sisa waktu 2 menit.";
const EXPIRED_STATUS = "Waktu habis — mengumpulkan jawaban…";
const COLLECT_FAILED_MESSAGE =
  "Jawaban belum terkumpulkan. Periksa koneksi lalu coba lagi.";

/** mm:ss, ceiling so the display reaches 00:00 exactly at expiry. */
export function formatRemainingClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** "3" → "3" · "3,4" → "3 & 4" · "1,2,3" → "1, 2 & 3" (28c's "soal 3 & 4"). */
export function formatNumberList(numbers: number[]): string {
  if (numbers.length <= 1) return String(numbers[0] ?? "");
  return `${numbers.slice(0, -1).join(", ")} & ${numbers[numbers.length - 1]}`;
}

type QuestionDTO = QuizRunningDTO["questions"][number];

/** The 1…n navigator — one markup, three placements (mobile row, ≥1024 side
 *  card, summary grid; 7u's tablet rule). */
function QuestionChipGrid({
  questions,
  answers,
  flags,
  unsavedIds,
  currentNumber,
  onSelect,
}: {
  questions: QuestionDTO[];
  answers: Record<string, string>;
  flags: Record<string, true>;
  unsavedIds: Set<string>;
  currentNumber: number | null;
  onSelect: (number: number) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Navigator soal"
      className="flex flex-wrap gap-2"
    >
      {questions.map((question) => {
        const answered = answers[question.id] !== undefined;
        const flagged = flags[question.id] === true;
        const unsaved = unsavedIds.has(question.id);
        const current = currentNumber === question.number;
        return (
          <button
            key={question.id}
            type="button"
            onClick={() => onSelect(question.number)}
            aria-current={current ? "true" : undefined}
            aria-label={`Soal ${question.number}, ${
              answered ? "sudah dijawab" : "belum dijawab"
            }${flagged ? ", ditandai ragu" : ""}`}
            className={cn(
              "grid size-11 place-items-center rounded-control border font-mono text-sm font-medium transition-colors",
              unsaved
                ? "border-dashed border-border-dashed"
                : "border-border-strong",
              flagged
                ? "border-warning bg-warning-tint text-warning-tint-text"
                : answered
                  ? "bg-fill text-text"
                  : "bg-surface text-text-muted",
              current &&
                "ring-2 ring-primary ring-offset-2 ring-offset-surface",
            )}
          >
            {question.number}
          </button>
        );
      })}
    </div>
  );
}

export function QuizRunner({ data }: { data: QuizRunningDTO }) {
  const router = useRouter();
  const { refresh } = router;

  const [phase, setPhase] = useState<"soal" | "ringkasan">("soal");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({
    ...data.answers,
  });
  const [flags, setFlags] = useState<Record<string, true>>({});
  const [announcement, setAnnouncement] = useState("");
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);

  // The timer starts from the DTO's server/client pair so server and
  // client render the SAME first frame; the offset correction follows.
  const expiresAtMs = Date.parse(data.expiresAt);
  const [remainingMs, setRemainingMs] = useState(
    () => expiresAtMs - Date.parse(data.serverNow),
  );
  // Wall clock mirror of the tick above (0 until the first tick, which
  // keeps the first server/client frame identical).
  const [nowMs, setNowMs] = useState(0);

  const submitUrl = `/api/quiz/attempts/${data.attemptId}/submit`;

  const collectAndRefresh = useCallback(async () => {
    setSubmitting(true);
    setSubmitFailed(false);
    try {
      const response = await fetch(submitUrl, { method: "POST" });
      if (!response.ok && response.status !== 409) {
        // 409 = already final elsewhere — the refresh below still lands on
        // the result state; anything else keeps the runner retryable.
        setSubmitFailed(true);
        setSubmitting(false);
        return;
      }
    } catch {
      setSubmitFailed(true);
      setSubmitting(false);
      return;
    }
    refresh(); // submitting stays on until the refreshed page lands
  }, [refresh, submitUrl]);

  // The queue is created once per attempt (the page keys the runner by
  // attemptId). The DTO's persisted answers arrive pre-confirmed (QZ-08).
  const [queue] = useState(() => {
    const created = createAnswerSaveQueue({
      attemptId: data.attemptId,
      // 409 while saving: the attempt was finalized elsewhere — collect +
      // refresh, exactly like the timer-zero path.
      onFinalized: () => {
        void collectAndRefresh();
      },
      onGone: () => {
        refresh();
      },
    });
    for (const [questionId, optionId] of Object.entries(data.answers)) {
      created.hydrate(questionId, optionId);
    }
    return created;
  });
  const queueState: AnswerSaveState = useSyncExternalStore(
    queue.subscribe,
    queue.getState,
  );

  // ---- timer (server clock via a mount-time offset) ----------------------
  const offsetRef = useRef(0);
  const announcedRef = useRef(false);
  const expiredRef = useRef(false);

  const handleTimeUp = useCallback(async () => {
    setExpired(true);
    // Pending answers get ≤ 5 s to land, then the attempt is collected
    // with whatever the server received (card §4.B timer rules).
    await queue.flush(5_000);
    await collectAndRefresh();
  }, [collectAndRefresh, queue]);

  useEffect(() => {
    offsetRef.current = Date.parse(data.serverNow) - Date.now();
    const id = setInterval(() => {
      // One tick drives both displays: the clock and the 28c stage-2
      // check (render stays pure — no Date.now() during render).
      const now = Date.now() + offsetRef.current;
      setNowMs(now);
      setRemainingMs(Math.max(0, expiresAtMs - now));
    }, 1000);
    return () => clearInterval(id);
  }, [data.serverNow, expiresAtMs]);

  useEffect(() => {
    if (remainingMs <= 0) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        void handleTimeUp();
      }
      return;
    }
    if (remainingMs <= TWO_MINUTES_MS && !announcedRef.current) {
      announcedRef.current = true;
      setAnnouncement(TWO_MINUTE_ANNOUNCEMENT);
    }
  }, [remainingMs, handleTimeUp]);

  // ---- question bookkeeping ----------------------------------------------
  const questions = data.questions;
  // The server never starts an empty quiz (start guard) and the buttons
  // clamp `index`; the fallback only satisfies the type checker.
  const question = questions[index] ?? questions[0]!;
  const isLast = index === questions.length - 1;
  const numberById = useMemo(
    () => new Map(questions.map((item) => [item.id, item.number])),
    [questions],
  );
  const unsavedIds = useMemo(
    () => new Set(queueState.pending),
    [queueState.pending],
  );

  const answeredCount = questions.filter(
    (item) => answers[item.id] !== undefined,
  ).length;
  const unansweredCount = questions.length - answeredCount;
  const flaggedCount = questions.filter(
    (item) => flags[item.id] === true,
  ).length;

  // Focus moves to the question heading on every change — not on mount.
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [index, phase]);

  function selectOption(questionId: string, optionId: string) {
    if (expired) return;
    if (answers[questionId] === optionId) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    queue.setAnswer(questionId, optionId);
  }

  function toggleFlag(questionId: string) {
    setFlags((prev) => {
      const next = { ...prev };
      if (next[questionId] === true) {
        delete next[questionId];
      } else {
        next[questionId] = true;
      }
      return next;
    });
  }

  function goToQuestion(number: number) {
    setPhase("soal");
    setIndex(number - 1);
  }

  async function handleCollect() {
    // softDisabled keeps the control reachable — the guard lives here.
    if (queueState.pending.length > 0 || submitting) return;
    await collectAndRefresh();
  }

  // ---- 28c banners --------------------------------------------------------
  const pendingNumbers = queueState.pending
    .map((id) => numberById.get(id) ?? 0)
    .sort((a, b) => a - b);
  const recoveredNumbers = (queueState.recovered ?? [])
    .map((id) => numberById.get(id) ?? 0)
    .sort((a, b) => a - b);
  const showOfflineBanner =
    queueState.failingSince !== null &&
    queueState.pending.length > 0 &&
    nowMs - queueState.failingSince > 10_000;

  const indicator =
    Object.keys(answers).length === 0
      ? null
      : queueState.saving
        ? { text: "menyimpan…", className: "text-text-muted" }
        : queueState.pending.length > 0
          ? { text: "belum terkirim", className: "text-text-subtle" }
          : {
              text: "tersimpan otomatis",
              className: "text-success-tint-text",
            };

  const progressPercent =
    phase === "ringkasan"
      ? 100
      : Math.round(((index + 1) / questions.length) * 100);

  return (
    <div className="mx-auto max-w-3xl">
      {/* 28c stage 3 — recovery (self-dismissing success banner). */}
      {queueState.recovered !== null ? (
        <Banner
          key={queueState.recovered.join(",")}
          tone="success"
          title={`Tersambung. Jawaban soal ${formatNumberList(recoveredNumbers)} sudah tersimpan.`}
          onDismissed={() => queue.clearRecovered()}
          className="mb-4"
        />
      ) : null}
      {/* 28c stage 2 — offline for more than 10 seconds. */}
      {showOfflineBanner ? (
        <Banner
          tone="error"
          title={`${pendingNumbers.length} jawaban belum tersimpan di server`}
          description={`Koneksi terputus. Jawaban soal ${formatNumberList(pendingNumbers)} disimpan sementara di perangkat ini dan dikirim otomatis begitu tersambung. Jangan tutup atau muat ulang halaman ini.`}
          action={
            <Button
              variant="secondary"
              onClick={() => queue.retryNow()}
            >
              Coba kirim sekarang
            </Button>
          }
          className="mb-4"
        />
      ) : null}
      {submitFailed ? (
        <Banner
          tone="error"
          title={COLLECT_FAILED_MESSAGE}
          className="mb-4"
        />
      ) : null}

      <div className="rounded-card border border-border bg-surface p-4 sm:p-6">
        {/* Kepala: eyebrow + server timer + save indicator (7g). */}
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-primary-deep">
              {phase === "soal"
                ? `Soal ${question.number} dari ${questions.length} · Satu kesempatan`
                : `Ringkasan · Satu kesempatan`}
            </p>
            <p aria-live="polite" className="sr-only">
              {announcement}
            </p>
          </div>
          <div className="text-right">
            <p
              role="timer"
              aria-label="Sisa waktu"
              className={cn(
                "font-mono text-[22px] font-medium leading-none",
                remainingMs <= TWO_MINUTES_MS ? "text-danger" : "text-text",
              )}
            >
              {formatRemainingClock(remainingMs)}
            </p>
            {indicator ? (
              <p
                className={cn(
                  "mt-1 font-mono text-[11px] font-medium",
                  indicator.className,
                )}
              >
                {indicator.text}
              </p>
            ) : null}
          </div>
        </div>

        {/* Bilah kemajuan posisi soal (7g). */}
        <div
          aria-hidden="true"
          className="mt-4 h-1 rounded-pill bg-fill"
        >
          <div
            className="h-full rounded-pill bg-primary transition-[width] duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Navigator: chip row above the question (<1024, 7u tablet rule),
            side card at ≥1024 (7g desktop). */}
        <div className="mt-5 lg:hidden">
          <QuestionChipGrid
            questions={questions}
            answers={answers}
            flags={flags}
            unsavedIds={unsavedIds}
            currentNumber={phase === "soal" ? question.number : null}
            onSelect={goToQuestion}
          />
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            {expired ? (
              <p
                role="status"
                className="py-10 text-center font-mono text-sm font-medium text-text-muted"
              >
                {EXPIRED_STATUS}
              </p>
            ) : phase === "ringkasan" ? (
              <>
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="wrap-anywhere text-[20px] font-bold leading-snug text-text sm:text-[22px]"
                >
                  Ringkasan sebelum dikumpulkan
                </h2>
                <p className="mt-2 font-mono text-[13px] font-medium text-text-meta">
                  {answeredCount} dijawab · {unansweredCount} belum dijawab ·{" "}
                  {flaggedCount} ragu-ragu
                </p>
                <div className="mt-5">
                  <QuestionChipGrid
                    questions={questions}
                    answers={answers}
                    flags={flags}
                    unsavedIds={unsavedIds}
                    currentNumber={null}
                    onSelect={goToQuestion}
                  />
                </div>
                {unansweredCount > 0 ? (
                  <p className="mt-4 text-sm text-text-muted">
                    {unansweredCount} soal belum dijawab dan akan dinilai
                    salah.
                  </p>
                ) : null}
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-start">
                  <Button
                    variant="secondary"
                    onClick={() => setPhase("soal")}
                  >
                    Kembali ke soal
                  </Button>
                  <div className="sm:ml-auto sm:text-right">
                    <Button
                      onClick={() => void handleCollect()}
                      loading={submitting}
                      loadingLabel="Mengumpulkan…"
                      softDisabled={queueState.pending.length > 0}
                    >
                      Kumpulkan sekarang
                    </Button>
                    {queueState.pending.length > 0 ? (
                      <p className="mt-2 text-sm text-text-muted">
                        Tunggu, jawaban sedang disimpan…
                      </p>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="wrap-anywhere text-[18px] font-bold leading-snug text-text sm:text-[20px]"
                >
                  {question.text}
                </h2>
                <fieldset className="mt-4" disabled={expired}>
                  <legend className="sr-only">
                    Pilihan jawaban soal {question.number}
                  </legend>
                  {question.options.map((option) => {
                    const selected = answers[question.id] === option.id;
                    return (
                      <label
                        key={option.id}
                        className={cn(
                          "mt-2 flex min-h-[58px] w-full cursor-pointer items-center gap-3 rounded-control border px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2",
                          selected
                            ? "border-primary bg-primary-tint"
                            : "border-border-strong bg-surface hover:bg-fill",
                        )}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option.id}
                          checked={selected}
                          onChange={() =>
                            selectOption(question.id, option.id)
                          }
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-pill border font-mono text-[13px] font-medium",
                            selected
                              ? "border-primary bg-surface text-primary-deep"
                              : "border-border-strong bg-fill text-text",
                          )}
                        >
                          {option.label}
                        </span>
                        <span className="min-w-0 text-[15px] leading-relaxed text-text">
                          {option.text}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button
                    variant="secondary"
                    aria-pressed={flags[question.id] === true}
                    onClick={() => toggleFlag(question.id)}
                    className={cn(
                      flags[question.id] === true &&
                        "border-warning bg-warning-tint text-warning-tint-text hover:bg-warning-tint",
                    )}
                  >
                    <Flag className="size-4" aria-hidden="true" />
                    Tandai ragu-ragu
                  </Button>
                  <div className="ml-auto flex items-center gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => setIndex((value) => value - 1)}
                      disabled={index === 0}
                    >
                      <ArrowLeft className="size-4" aria-hidden="true" />
                      Sebelumnya
                    </Button>
                    {isLast ? (
                      <Button
                        variant="secondary"
                        onClick={() => setPhase("ringkasan")}
                      >
                        Lihat ringkasan
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => setIndex((value) => value + 1)}
                      >
                        Berikutnya
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="rounded-card border border-border bg-surface-2 p-4">
              <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-meta">
                Navigator soal
              </h3>
              <QuestionChipGrid
                questions={questions}
                answers={answers}
                flags={flags}
                unsavedIds={unsavedIds}
                currentNumber={phase === "soal" ? question.number : null}
                onSelect={goToQuestion}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
