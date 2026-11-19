"use client";

// FinalQuizRules (card S5-02 §4.A; screen 7h left) — the "aturan-final"
// state. This page IS the QZ-18 one-chance confirmation (decision 7): no
// extra dialog, the copy itself carries "satu kesempatan" and "nilai
// tercatat permanen". Copy from 7h minus the design annotations ("(QZ-21)")
// and minus the "Nilai Akhir ≥ 70" sentence — PRD §6.2 wins: lulus is the
// Final Quiz's own passing score (decision 4), worded as *(usulan)*. The
// start button shares its brain with QuizRules (useQuizStart); the 7h
// "Belum semua materi selesai?" box is NOT built — that state never
// renders here (the route redirects `kembali`).
import Link from "next/link";
import type { ReactNode } from "react";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type { FinalQuizRulesDTO } from "@/modules/attempt/service";

import { useQuizStart } from "./use-quiz-start";

const START_FAILED_MESSAGE =
  "Final Quiz belum dimulai. Periksa koneksi lalu coba lagi.";

export function FinalQuizRules({ data }: { data: FinalQuizRulesDTO }) {
  const { start, starting, failed, buttonRef } = useQuizStart(
    `/api/quiz/courses/${data.courseId}/final-attempt`,
  );

  // null is unreachable under the gate — "–" is the defensive render.
  const average = data.lessonAveragePercent ?? "–";

  const rules: ReactNode[] = [
    <>
      Rata-rata quiz materi Anda sekarang{" "}
      <strong className="font-bold text-text">{average}</strong> (bobot{" "}
      {data.weights.lessonPercent}%)
    </>,
    <>
      <strong className="font-bold text-text">
        Waktu {data.durationMinutes} menit
      </strong>{" "}
      — timer dihitung server dan terus berjalan meski tab ditutup; habis waktu
      berarti auto-submit
    </>,
    <>Jawaban tersimpan otomatis tiap soal</>,
    <>Lulus kursus bila nilai Final Quiz ≥ {data.passingScorePercent}</>,
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-primary-deep">
        FINAL QUIZ · {data.courseTitle}
      </p>
      <h1 className="mt-3 wrap-anywhere text-[22px] font-black leading-[1.22] tracking-[-0.02em] text-text sm:text-[26px]">
        Final Quiz menentukan {data.weights.finalPercent}% Nilai Akhir
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-text-body">
        {data.questionCount} soal dari seluruh materi kursus. Sama seperti quiz
        materi: <strong className="font-bold text-text">satu kesempatan</strong>
        , nilai tercatat permanen.
      </p>

      <ol className="mt-6 space-y-4">
        {rules.map((rule, index) => (
          <li key={index} className="flex gap-4">
            <span className="font-mono text-[13px] font-medium text-primary-deep">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 text-[15px] leading-relaxed text-text">
              {rule}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button
          ref={buttonRef}
          onClick={start}
          loading={starting}
          loadingLabel="Memulai…"
          className="sm:flex-1"
        >
          Saya siap, mulai Final Quiz
        </Button>
        <Link
          href={data.lastLessonHref}
          className={cn(buttonVariants({ variant: "secondary" }), "sm:flex-1")}
        >
          Ulas materi dulu
        </Link>
      </div>

      {failed ? (
        <Banner tone="error" title={START_FAILED_MESSAGE} className="mt-4" />
      ) : null}
    </div>
  );
}
