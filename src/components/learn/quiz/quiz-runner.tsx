"use client";

// QuizRunner (card S3-01 §4.B; screens 7g / 7u / 7n, 28c; perapian S3-02
// §1) — the "berjalan" state. Pure presentation + the three client-side
// concerns the card names: the server-clock timer (offset-corrected, ONE
// 2-minute announcement, zero → flush ≤ 5 s → collect → refresh), the
// answer save queue (see answer-save-queue.ts), and the ragu-ragu flag
// (client-only state by design — it disappears on reload; noted in the PR).
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
  initialAnswerSaveState,
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
              // 28c contrast (owner review of PR 138, S3-02 §1): an unsaved
              // pick keeps the LIGHT bg and turns both the dashed outline
              // and the NUMBER danger — unsaved is the most severe state,
              // so it wins over the ragu tint (which only applies once the
              // pick is safe on the server). A saved answer goes dark like
              // 7u's dots (bg-fill was 1.15:1 against white).
              unsaved
                ? "border-2 border-dashed border-danger bg-surface text-danger"
                : flagged
                  ? "border-warning bg-warning-tint text-warning-tint-text"
                  : answered
                    ? "border-text bg-text text-surface"
                    : "border-border-strong bg-surface text-text-muted",
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
  // Re-entry lands on the FIRST unanswered question (same predicate as
  // the chip's "sudah dijawab"), or the last question when every one is
  // answered. Derived once from DTO data, so server and client render
  // the same first frame (card S3-02 §1).
  const [index, setIndex] = useState(() => {
    const firstUnanswered = data.questions.find(
      (item) => data.answers[item.id] === undefined,
    );
    return firstUnanswered
      ? firstUnanswered.number - 1
      : data.questions.length - 1;
  });
  const [answers, setAnswers] = useState<Record<string, string>>({
    ...data.answers,
  });
  const [flags, setFlags] = useState<Record<string, true>>({});
  const [announcement, setAnnouncement] = useState("");
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  // Bumps on every collect failure — keys the inline banner's remount
  // (a fresh role="alert" announcement + focus move per failure).
  const [submitFailCount, setSubmitFailCount] = useState(0);

  // The timer starts from the DTO's server/client pair so server and
  // client render the SAME first frame; the offset correction follows.
  const expiresAtMs = Date.parse(data.expiresAt);
  const [remainingMs, setRemainingMs] = useState(
    () => expiresAtMs - Date.parse(data.serverNow),
  );
  // Device wall clock mirror of the tick below (0 until the first tick,
  // which keeps the first server/client frame identical). The timer rides
  // the SERVER clock; the 28c failingSince stamp is device-side, so the
  // > 10 s stage-2 check must compare device-with-device (card S3-02 §1).
  const [deviceNowMs, setDeviceNowMs] = useState(0);

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
        setSubmitFailCount((count) => count + 1);
        setSubmitting(false);
        return;
      }
    } catch {
      setSubmitFailed(true);
      setSubmitFailCount((count) => count + 1);
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
    // getServerSnapshot: without it a JavaScript-less GET of the running
    // page dies with "Missing getServerSnapshot" (the S3-01 e2e key-leak
    // test caught the 500). The server render has no queue activity.
    initialAnswerSaveState,
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
      // One tick drives both clock domains: the server-offset timer
      // display and the device-domain 28c stage-2 check (render stays
      // pure — no Date.now() during render).
      const device = Date.now();
      const now = device + offsetRef.current;
      setDeviceNowMs(device);
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

  // A failed collect moves focus INTO the inline banner (keyboard users
  // must learn the submit did not land). preventScroll + a manual
  // center scroll keeps the jump deterministic — the learn area's fixed
  // bottom nav (< 768) can cover a browser-default "nearest" scroll.
  const collectFailRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (submitFailCount === 0) return;
    collectFailRef.current?.focus({ preventScroll: true });
    collectFailRef.current?.scrollIntoView({ block: "center" });
  }, [submitFailCount]);

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
  // Stage 2 compares DEVICE-with-device (failingSince is stamped by the
  // save queue's Date.now()); riding the server clock here would trip
  // the banner early/late whenever the two clocks drift (card S3-02 §1).
  const showOfflineBanner =
    queueState.failingSince !== null &&
    queueState.pending.length > 0 &&
    deviceNowMs - queueState.failingSince > 10_000;

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
      {/* Page heading from the DTO (card S3-02 §1) — quiz Materi N · judul
          for lesson quizzes, Final Quiz · nama kursus for the Final. */}
      <h1 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-primary-deep">
        {data.heading}
      </h1>
      {/* 28c stage 3 — recovery (self-dismissing success banner), sticky
          below the header so it stays visible while scrolling the quiz. */}
      {queueState.recovered !== null ? (
        <Banner
          key={queueState.recovered.join(",")}
          tone="success"
          title={`Tersambung. Jawaban soal ${formatNumberList(recoveredNumbers)} sudah tersimpan.`}
          onDismissed={() => queue.clearRecovered()}
          className="sticky top-[69px] z-20 mb-4 sm:top-[81px]"
        />
      ) : null}
      {/* 28c stage 2 — offline for more than 10 seconds, same sticky slot.
          top-[69px] sm:top-[81px] sinkron dengan HEADER_HEIGHT_CLASS
          (h-[68px] sm:h-[80px]) + border-b di header belajar. */}
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
          className="sticky top-[69px] z-20 mb-4 sm:top-[81px]"
        />
      ) : null}

      <div className="rounded-card border border-border bg-surface p-4 sm:p-6">
        {/* Kepala: eyebrow + server timer + save indicator (7g). One row
            at every width (7u/S3-02 §1): the eyebrow box may wrap its own
            text (min-w-0), the timer never shrinks. */}
        <div className="flex items-start justify-between gap-x-6">
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
          <div className="shrink-0 text-right">
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
            side card at ≥1024 (7g desktop). Soal phase only — the ringkasan
            already carries its own navigator (7u: exactly one). */}
        {phase === "soal" ? (
          <div className="mt-5 lg:hidden">
            <QuestionChipGrid
              questions={questions}
              answers={answers}
              flags={flags}
              unsavedIds={unsavedIds}
              currentNumber={question.number}
              onSelect={goToQuestion}
            />
          </div>
        ) : null}

        {/* The aside column is a FIXED 288px, not `auto`: an auto track
            sizes to the chip row UNWRAPPED (~546px for 10 chips), which
            starves the question column to ~140px and puts the nav buttons
            under the aside (found by the S3-01 e2e). At 288px the chips
            wrap 5+5 like 7g. Two columns in the SOAL phase only (S3-02
            §1) — the ringkasan spans the full card width. */}
        <div
          className={cn(
            "mt-6",
            phase === "soal" && "grid gap-8 lg:grid-cols-[minmax(0,1fr)_288px]",
          )}
        >
          <div className="min-w-0">
            {expired ? (
              <>
                <p
                  role="status"
                  className="py-10 text-center font-mono text-sm font-medium text-text-muted"
                >
                  {EXPIRED_STATUS}
                </p>
                {/* Collect failed at timer-zero: inline retry, not the
                    old top banner (S3-02 §1). The flush already ran, so
                    the retry goes straight to collectAndRefresh. */}
                {submitFailed ? (
                  <div ref={collectFailRef} tabIndex={-1}>
                    <Banner
                      key={submitFailCount}
                      tone="error"
                      title={COLLECT_FAILED_MESSAGE}
                      action={
                        <Button
                          variant="secondary"
                          onClick={() => void collectAndRefresh()}
                        >
                          Coba kumpulkan lagi
                        </Button>
                      }
                    />
                  </div>
                ) : null}
              </>
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
                      className="w-full sm:w-auto"
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
                {/* Collect failure: its OWN full-width row below the button
                    row (S3-02 §1) — never squeezed into the right-aligned
                    button column. Focus lands here via the effect above;
                    `key` remounts per failure for a fresh alert + focus. */}
                {submitFailed ? (
                  <div ref={collectFailRef} tabIndex={-1} className="mt-4">
                    <Banner
                      key={submitFailCount}
                      tone="error"
                      title={COLLECT_FAILED_MESSAGE}
                      action={
                        <Button
                          variant="secondary"
                          onClick={() => void handleCollect()}
                        >
                          Coba kumpulkan lagi
                        </Button>
                      }
                    />
                  </div>
                ) : null}
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

                {/* Owner review of PR 138: below 640 the old flex-wrap row
                    let "Sebelumnya" + "Berikutnya" press ~17 px into the
                    card's right padding — the pair becomes a two-column
                    grid as wide as the content, stacked under a full-width
                    "Tandai ragu-ragu"; ≥ 640 keeps the single row. */}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button
                    variant="secondary"
                    aria-pressed={flags[question.id] === true}
                    onClick={() => toggleFlag(question.id)}
                    className={cn(
                      "w-full sm:w-auto",
                      flags[question.id] === true &&
                        "border-warning bg-warning-tint text-warning-tint-text hover:bg-warning-tint",
                    )}
                  >
                    <Flag className="size-4" aria-hidden="true" />
                    Tandai ragu-ragu
                  </Button>
                  <div className="grid grid-cols-2 gap-3 sm:ml-auto sm:flex sm:items-center sm:gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => setIndex((value) => value - 1)}
                      disabled={index === 0}
                      className="w-full sm:w-auto"
                    >
                      <ArrowLeft
                        className="size-4 shrink-0"
                        aria-hidden="true"
                      />
                      Sebelumnya
                    </Button>
                    {/* Forward action is the visual primary of the pair
                        (7u) — dark at the md band so it matches
                        "Sebelumnya"'s 48px, not the 52px lg band. */}
                    {isLast ? (
                      <Button
                        variant="dark"
                        size="md"
                        onClick={() => setPhase("ringkasan")}
                        className="w-full sm:w-auto"
                      >
                        Lihat ringkasan
                        <ArrowRight
                          className="size-4 shrink-0"
                          aria-hidden="true"
                        />
                      </Button>
                    ) : (
                      <Button
                        variant="dark"
                        size="md"
                        onClick={() => setIndex((value) => value + 1)}
                        className="w-full sm:w-auto"
                      >
                        Berikutnya
                        <ArrowRight
                          className="size-4 shrink-0"
                          aria-hidden="true"
                        />
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {phase === "soal" ? (
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
                  currentNumber={question.number}
                  onSelect={goToQuestion}
                />
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
