"use client";

/*
 * Builder materi outline (card S1-02 §3, screens 21a/21g): the ordered
 * lesson list whose rows each show their two publish requirements (video,
 * quiz) directly — "yang kurang terlihat tanpa harus membuka satu per
 * satu" (21a). No drag handle, no "+ n materi lain", no
 * "seret untuk mengurutkan": reordering is S1-02b and every lesson is
 * rendered.
 *
 * The marker line's color carries emphasis only — the TEXT carries the
 * meaning (card §3): the whole line is `success` when the lesson meets the
 * publish requirement (teks isi + quiz ≥ min), `pending-tint-text` when
 * not. Video never changes the color (video is optional, CRS-03).
 *
 * The <ol> is `relative` on purpose: the sr-only lesson-title span inside
 * each "Sunting" link is position:absolute, and without a positioned
 * ancestor its containing block is the viewport — the S1-01 lesson about
 * sr-only spans widening the page.
 */
import Link from "next/link";

import type { LessonOutlineItemDTO } from "@/modules/lesson/service";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";

type FinalQuizDTO = {
  id: string;
  questionCount: number;
  durationMinutes: number;
} | null;

export type LessonOutlineProps = {
  courseId: string;
  outline: LessonOutlineItemDTO[];
  isSequential: boolean;
  minQuestions: number;
  finalQuiz: FinalQuizDTO;
  /** DRAFT → the add buttons and "Sunting" links render; else read-only. */
  editable: boolean;
  /** Opens the 21h dialog; only required while editable. */
  onAddLesson?: () => void;
};

/** "04:12" — zero-padded minutes, like 21a's duration chip. */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The three mono markers of one row, joined by " · " (card §3). */
function markerLine(
  lesson: LessonOutlineItemDTO,
  minQuestions: number,
): { text: string; complete: boolean } {
  const segments = [
    lesson.videoReady ? "VIDEO ✓" : "BELUM ADA VIDEO",
    lesson.isContentEmpty ? "TEKS BELUM DIISI" : null,
    lesson.quizQuestionCount >= minQuestions
      ? `QUIZ ${lesson.quizQuestionCount} SOAL ✓`
      : lesson.quizQuestionCount > 0
        ? `QUIZ ${lesson.quizQuestionCount} SOAL`
        : "QUIZ BELUM DIBUAT",
  ].filter((segment): segment is string => segment !== null);

  return {
    text: segments.join(" · "),
    complete:
      !lesson.isContentEmpty && lesson.quizQuestionCount >= minQuestions,
  };
}

export function LessonOutline({
  courseId,
  outline,
  isSequential,
  minQuestions,
  finalQuiz,
  editable,
  onAddLesson,
}: LessonOutlineProps) {
  // Non-null in the filled branch: questionCount > 0 implies finalQuiz
  // exists — spelled out so the template never interpolates undefined.
  const finalQuizLine =
    finalQuiz !== null && finalQuiz.questionCount > 0
      ? `${finalQuiz.questionCount} soal · ${finalQuiz.durationMinutes} menit · bobot 40% Nilai Akhir · satu kesempatan`
      : `Sudah disiapkan kosong — minimum ${minQuestions} soal, target 20 · bobot 40% Nilai Akhir`;

  return (
    <div className="min-w-0 flex flex-col gap-6">
      <section aria-labelledby="builder-materi-heading">
        <div className="flex flex-wrap items-center gap-3">
          <h2
            id="builder-materi-heading"
            className="text-lg font-black text-text"
          >
            Materi
          </h2>
          <span className="font-mono text-xs font-medium uppercase tracking-wide text-text-subtle">
            {outline.length} materi{isSequential ? " · wajib berurutan" : ""}
          </span>
          {/* Header add button only once a lesson exists — the empty state
              owns the first add (21g's header is just "0 MATERI"). */}
          {editable && outline.length > 0 ? (
            <Button
              variant="secondary"
              className="ml-auto"
              onClick={onAddLesson}
            >
              + Tambah materi
            </Button>
          ) : null}
        </div>

        {outline.length === 0 ? (
          <div className="mt-4 rounded-card border-[1.5px] border-dashed border-border-dashed bg-surface-2 p-7 text-center sm:p-8">
            <p className="text-lg font-black tracking-tight text-text">
              Belum ada materi
            </p>
            <p className="mx-auto mt-2 max-w-(--width-measure) text-text-muted">
              Tiap materi berisi satu video 3–5 menit (opsional), teks isi
              (wajib), dan satu quiz. Materi pertama otomatis jadi preview
              gratis.
            </p>
            {editable ? (
              <div className="mt-4 flex justify-center">
                <Button variant="dark" onClick={onAddLesson}>
                  + Tambah materi pertama
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <ol className="relative mt-4 grid gap-2.5">
            {outline.map((lesson) => {
              const marker = markerLine(lesson, minQuestions);
              return (
                <li
                  key={lesson.id}
                  className="grid grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-3 rounded-control border border-border bg-surface p-3 sm:grid-cols-[92px_minmax(0,1fr)_auto] sm:gap-3.5 sm:p-4"
                >
                  {/* Video slot: READY + a known duration → the --video-bg
                      gradient chip with m:ss; anything else (NONE/
                      UPLOADING/FAILED, no duration) → the "KOSONG" fill
                      box — that is what "KOSONG" means in 21a. */}
                  {lesson.videoReady && lesson.videoDurationSeconds !== null ? (
                    <div
                      aria-hidden="true"
                      style={{ backgroundImage: "var(--video-bg)" }}
                      className="grid h-[54px] w-full place-items-center rounded-control font-mono text-[10px] font-medium text-surface/70"
                    >
                      {formatDuration(lesson.videoDurationSeconds)}
                    </div>
                  ) : (
                    <div
                      aria-hidden="true"
                      className="grid h-[54px] w-full place-items-center rounded-control bg-fill font-mono text-[10px] font-medium text-text-meta"
                    >
                      KOSONG
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="wrap-anywhere font-bold text-text">
                      {lesson.orderIndex} · {lesson.title}
                    </p>
                    <p
                      className={`mt-1 font-mono text-[11.5px] font-medium ${
                        marker.complete
                          ? "text-success"
                          : "text-pending-tint-text"
                      }`}
                    >
                      {marker.text}
                    </p>
                  </div>

                  {editable ? (
                    <Link
                      href={`/cms/kursus/${courseId}/materi/${lesson.id}`}
                      className={buttonVariants({ variant: "secondary" })}
                    >
                      Sunting{" "}
                      {/* Lesson title in the accessible name so every row's
                          link is unique in a screen reader's link list. */}
                      <span className="sr-only">{lesson.title}</span>
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section
        aria-labelledby="builder-final-quiz-heading"
        className="rounded-card border border-border bg-surface-2 px-4 py-4 sm:px-[18px]"
      >
        <div className="flex flex-wrap items-center gap-3">
          <h3
            id="builder-final-quiz-heading"
            className="text-[15px] font-bold text-text"
          >
            Final Quiz
          </h3>
          {/* The door to /cms/quiz/{id} in EVERY status (card S1-09 §5):
              DRAFT edits, anything else is still readable there — "Lihat"
              keeps the word "Sunting" meaning editable. */}
          {finalQuiz !== null ? (
            <Link
              href={`/cms/quiz/${finalQuiz.id}`}
              className={`${buttonVariants({ variant: "secondary" })} ml-auto`}
            >
              {editable ? "Sunting Final Quiz" : "Lihat Final Quiz"}
            </Link>
          ) : null}
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
          {finalQuizLine}
        </p>
      </section>
    </div>
  );
}
