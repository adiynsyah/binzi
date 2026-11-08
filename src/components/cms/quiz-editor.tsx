"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import {
  CONTENT_DOC_HEADING_CLASS,
  ContentDocBreadcrumb,
} from "@/components/cms/content-doc-form";
import { LOCKED_NOTICE } from "@/components/cms/course-settings-panel";
import { QuestionDialog, twoDigits } from "@/components/cms/question-dialog";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import type { QuizEditorDTO, QuizEditorQuestionDTO } from "@/modules/quiz/service";

/*
 * /cms/quiz/{quizId} (card S1-09 §3, designs 22a + 22h): the shared editor
 * for the FINAL quiz and a lesson quiz — the type is fixed per quiz
 * ("JENIS TIDAK BISA DIUBAH"), only the questions are edited here. Outside
 * DRAFT the list stays readable, the banner explains the lock, and every
 * add/edit door disappears.
 *
 * The h1 carries tabIndex -1: when a 409 mid-dialog flips the page to the
 * locked state, the opener button is gone, and the dialog's close lands
 * focus on the heading (card §4).
 */

/** 22a: the FINAL quiz's own completeness bar (distinct from the settings
 *  publish minimum in the mono line below — both are shown). */
const FINAL_TARGET_QUESTIONS = 20;

function ruleRow(term: string, value: string) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[13px] text-text-muted">{term}</dt>
      <dd className="text-right text-sm font-bold text-text">{value}</dd>
    </div>
  );
}

/** "PG · KUNCI ✓ · PEMBAHASAN ✓" — one success line when complete; mixed
 *  tones otherwise (✓ = success, KOSONG = danger, the type stays meta).
 *  Each segment is a single text literal so the line's pieces are stable
 *  query targets. */
function MarkerLine({ question }: { question: QuizEditorQuestionDTO }) {
  const typeLabel = question.type === "SINGLE_CHOICE" ? "PG" : "B/S";
  if (question.hasKey && question.hasExplanation) {
    return (
      <p className="font-mono text-[11.5px] font-medium uppercase tracking-[0.08em] text-success">
        {`${typeLabel} · KUNCI ✓ · PEMBAHASAN ✓`}
      </p>
    );
  }
  return (
    <p className="font-mono text-[11.5px] font-medium uppercase tracking-[0.08em]">
      <span className="text-text-meta">{typeLabel}</span>
      <span className={question.hasKey ? "text-success" : "text-danger"}>
        {question.hasKey ? "· KUNCI ✓" : "· KUNCI KOSONG"}
      </span>
      <span className={question.hasExplanation ? "text-success" : "text-danger"}>
        {question.hasExplanation ? "· PEMBAHASAN ✓" : "· PEMBAHASAN KOSONG"}
      </span>
    </p>
  );
}

export function QuizEditor({ editor }: { editor: QuizEditorDTO }) {
  const { quiz, owner, questions, minQuestions, weights } = editor;
  const isFinal = quiz.type === "FINAL";
  const editable = owner.courseStatus === "DRAFT";
  const lesson = owner.lesson;

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [dialog, setDialog] = useState<{
    open: boolean;
    question: QuizEditorQuestionDTO | null;
  }>({ open: false, question: null });

  function openNew(): void {
    setDialog({ open: true, question: null });
  }
  function openEdit(question: QuizEditorQuestionDTO): void {
    setDialog({ open: true, question });
  }
  function onDialogOpenChange(open: boolean): void {
    if (!open) setDialog((previous) => ({ ...previous, open: false }));
  }
  function onSaved(mode: "save" | "add"): void {
    if (mode === "save") setDialog({ open: false, question: null });
  }

  const breadcrumb = lesson
    ? [
        { label: "Kursus", href: "/cms/kursus" },
        { label: owner.courseTitle, href: `/cms/kursus/${owner.courseId}` },
        {
          label: `Materi ${lesson.orderIndex}`,
          href: `/cms/kursus/${owner.courseId}/materi/${lesson.id}`,
        },
        { label: "Quiz", href: null },
      ]
    : [
        { label: "Kursus", href: "/cms/kursus" },
        { label: owner.courseTitle, href: `/cms/kursus/${owner.courseId}` },
        { label: "Final Quiz", href: null },
      ];

  const heading = lesson ? lesson.title : owner.courseTitle;

  const count = questions.length;
  const meetsMin = count >= minQuestions;
  // 22a: the FINAL pill counts against its own 20; the lesson pill (22h)
  // only against the publish minimum.
  const pillText = isFinal
    ? count < FINAL_TARGET_QUESTIONS
      ? `${count} dari ${FINAL_TARGET_QUESTIONS} soal`
      : `${count} soal`
    : `${count} soal`;
  const pillTone = meetsMin && (!isFinal || count >= FINAL_TARGET_QUESTIONS)
    ? "bg-success-tint text-success-tint-text"
    : "bg-pending-tint text-pending-tint-text";

  const monoLine = meetsMin
    ? `MINIMUM PUBLISH ${minQuestions} SOAL · SUDAH TERPENUHI`
    : `MINIMUM PUBLISH ${minQuestions} SOAL · KURANG ${minQuestions - count}`;

  // The 22a "BELUM LENGKAP" block — present ONLY while something is
  // missing; a complete quiz shows no warning-shaped section at all.
  const deficiencies: string[] = [];
  for (const question of questions) {
    if (!question.hasExplanation) {
      deficiencies.push(
        `Soal ${twoDigits(question.orderIndex)} belum ada pembahasan`,
      );
    }
    if (!question.hasKey) {
      deficiencies.push(`Soal ${twoDigits(question.orderIndex)} belum ada kunci`);
    }
  }
  if (!meetsMin) {
    deficiencies.push(
      `Kurang ${minQuestions - count} soal dari minimum ${minQuestions}`,
    );
  }

  return (
    <div>
      {lesson ? (
        <Link
          href={`/cms/kursus/${owner.courseId}/materi/${lesson.id}`}
          className="inline-flex min-h-11 items-center font-mono text-[11.5px] font-medium uppercase tracking-[0.1em] text-text-subtle transition-colors duration-200 ease-out hover:text-text"
        >
          ← Materi {lesson.orderIndex}
        </Link>
      ) : null}
      <div className={lesson ? "mt-1" : undefined}>
        <ContentDocBreadcrumb items={breadcrumb} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={`rounded-pill px-3 py-1 text-[13px] font-bold ${
            isFinal ? "bg-text text-surface" : "bg-fill text-text-muted"
          }`}
        >
          {isFinal ? "Final Quiz" : "Quiz materi"}
        </span>
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-subtle">
          {lesson
            ? `MILIK MATERI ${lesson.orderIndex}`
            : "MILIK KURSUS"}{" "}
          · JENIS TIDAK BISA DIUBAH
        </span>
      </div>

      <h1
        ref={headingRef}
        tabIndex={-1}
        className={`${CONTENT_DOC_HEADING_CLASS} mt-3`}
      >
        {heading}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={`rounded-pill px-3 py-1 text-[13px] font-bold ${pillTone}`}>
          {pillText}
        </span>
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-subtle">
          {monoLine}
        </span>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 pb-8 lg:grid-cols-[minmax(0,1fr)_288px]">
        <section aria-labelledby="quiz-questions-heading">
          <div className="flex flex-wrap items-center gap-3">
            <h2
              id="quiz-questions-heading"
              className="text-lg font-black tracking-tight text-text"
            >
              Daftar soal
            </h2>
            {editable ? (
              <Button
                variant="secondary"
                className="ml-auto"
                onClick={openNew}
              >
                + Tambah soal
              </Button>
            ) : null}
          </div>

          {editable ? null : (
            <div className="mt-4">
              <Banner tone="info" title={LOCKED_NOTICE} />
            </div>
          )}

          {count === 0 ? (
            <div className="mt-4 rounded-card border-[1.5px] border-dashed border-border-dashed bg-surface-2 p-7 text-center">
              <p className="text-lg font-black tracking-tight text-text">
                Belum ada soal.
              </p>
            </div>
          ) : (
            <ol className="@container mt-4 flex flex-col gap-2.5">
              {questions.map((question) => {
                const nn = twoDigits(question.orderIndex);
                const deficient = !question.hasKey || !question.hasExplanation;
                return (
                  <li
                    key={question.id}
                    className={`relative flex flex-col gap-2 rounded-card border p-3 @min-[560px]:flex-row @min-[560px]:items-center @min-[560px]:gap-3.5 sm:p-4 ${
                      deficient
                        ? "border-danger-tint-line bg-danger-tint"
                        : "border-border bg-surface"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="shrink-0 font-mono text-[13px] font-medium text-text-subtle">
                        {nn}
                      </span>
                      {/* One line, truncated — the full text rides along on
                          the title attribute (22a). */}
                      <p
                        className="min-w-0 flex-1 truncate text-[15px] font-bold text-text"
                        title={question.text}
                      >
                        {question.text}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 @min-[560px]:shrink-0 @min-[560px]:justify-start">
                      <MarkerLine question={question} />
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => openEdit(question)}
                          className="relative inline-flex min-h-11 items-center text-sm font-bold text-primary-deep transition-colors duration-200 ease-out hover:text-primary-deeper"
                        >
                          Sunting{" "}
                          <span className="sr-only">soal {nn}</span>
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <aside
          aria-labelledby="quiz-rules-heading"
          className="h-fit rounded-card border border-border bg-surface-2 p-4"
        >
          <h2
            id="quiz-rules-heading"
            className="font-mono text-[11.5px] font-medium uppercase tracking-[0.1em] text-text-subtle"
          >
            Aturan quiz
          </h2>
          <dl className="mt-3 flex flex-col gap-3">
            {ruleRow("Durasi", `${quiz.durationMinutes} menit`)}
            {lesson ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[13px] text-text-muted">Ambang lulus</dt>
                <dd className="flex flex-col items-end">
                  <span className="text-sm font-bold text-text">
                    {quiz.passingScorePercent}%
                  </span>
                  <span className="text-[12px] leading-snug text-text-muted">
                    Hanya label — lulus atau tidak, materi tetap selesai
                  </span>
                </dd>
              </div>
            ) : (
              ruleRow("Ambang lulus", `${quiz.passingScorePercent}%`)
            )}
            {ruleRow("Kesempatan", "1 — terkunci")}
            {ruleRow("Acak soal", quiz.shuffleQuestions ? "Ya" : "Tidak")}
            {ruleRow("Acak opsi", quiz.shuffleOptions ? "Ya" : "Tidak")}
            {isFinal
              ? ruleRow("Bobot", `${weights.finalPercent}% Nilai Akhir`)
              : ruleRow("Bobot", `Bagian dari ${weights.lessonPercent}%`)}
          </dl>
          {lesson ? (
            <p className="mt-3 text-[12.5px] leading-relaxed text-text-muted">
              Rata-rata semua quiz materi di kursus ini.
            </p>
          ) : null}
          <p className="mt-4 border-t border-border-soft pt-3 text-[12.5px] leading-relaxed text-text-muted">
            Jumlah kesempatan tidak bisa diubah. Satu kesempatan adalah
            keputusan produk, bukan setelan per quiz.
          </p>

          {deficiencies.length > 0 ? (
            <div className="mt-4 rounded-control border border-danger-tint-line bg-danger-tint p-3.5">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-danger">
                Belum lengkap
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {deficiencies.map((line) => (
                  <li
                    key={line}
                    className="text-[13px] leading-snug text-danger-tint-text"
                  >
                    · {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      {/* Never keyed by server data: an open dialog survives refreshes
          (card §4); `total` is read by the dialog at open time only. */}
      <QuestionDialog
        open={dialog.open}
        onOpenChange={onDialogOpenChange}
        quizId={quiz.id}
        question={dialog.question}
        total={count}
        headingRef={headingRef}
        onSaved={onSaved}
      />
    </div>
  );
}
