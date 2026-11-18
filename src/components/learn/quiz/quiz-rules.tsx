"use client";

// QuizRules (card S3-01 §4.A; screen 7e) — the "aturan" state: the last
// stop before the timer starts. Copy from 7e minus the design annotations
// ("(7d)", "(QZ-21)" — CLAUDE.md copy rule). The start button POSTs THE
// one attempt; every state-changing answer (201 new, 200 resumed, 409
// finalized-or-gated) is handled by router.refresh() — the GET re-renders
// into berjalan / hasil / kembali. Only a transport failure keeps the
// participant here, with the Banner (usulan copy from the card).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type { QuizRulesDTO } from "@/modules/attempt/service";

const START_FAILED_MESSAGE =
  "Quiz belum dimulai. Periksa koneksi lalu coba lagi.";

/** Rule 05 follows explanation_policy; the card only words ALWAYS — the
 *  other two are ours, flagged as such in the PR. */
const EXPLANATION_RULES: Record<QuizRulesDTO["explanationPolicy"], string> = {
  ALWAYS: "Pembahasan lengkap muncul setelah dikumpulkan",
  ON_PASS_ONLY: "Pembahasan muncul setelah dikumpulkan bila nilai lulus",
  NEVER: "Pembahasan soal tidak ditampilkan setelah dikumpulkan",
};

export function QuizRules({ data }: { data: QuizRulesDTO }) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const inFlight = useRef(false);
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);

  const rules = [
    `${data.questionCount} soal${
      data.allSingleChoice ? " pilihan ganda" : ""
    } · waktu ${data.durationMinutes} menit`,
    "Timer berjalan terus meski halaman ditutup — dihitung dari server, bukan dari perangkat Anda",
    "Habis waktu = jawaban yang sudah terisi otomatis dikumpulkan",
    "Jawaban tersimpan otomatis tiap soal",
    EXPLANATION_RULES[data.explanationPolicy],
    `Lulus di nilai ≥ ${data.passingScorePercent} — tidak lulus pun materi tetap tercatat selesai`,
  ];

  async function handleStart() {
    if (inFlight.current) return;
    inFlight.current = true;
    setStarting(true);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/quiz/lessons/${data.lessonId}/attempt`,
        { method: "POST" },
      );
      // 201 new · 200 resumed (QZ-08) · 409 finalized or video gate — in
      // every case the refreshed GET lands on the right state.
      if (
        response.status === 201 ||
        response.status === 200 ||
        response.status === 409
      ) {
        router.refresh();
        return; // loading + inFlight stay on until the refresh lands
      }
      setFailed(true);
    } catch {
      setFailed(true);
    }
    setStarting(false);
    inFlight.current = false;
  }

  // Focus returns to the button after the re-render that clears loading
  // (the disabled attribute drops focus to <body> — lesson 4 Nov).
  useEffect(() => {
    if (failed) {
      buttonRef.current?.focus();
    }
  }, [failed]);

  return (
    <div className="mx-auto max-w-2xl">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-primary-deep">
        Quiz Materi {data.lessonPosition} · {data.lessonTitle}
      </p>
      <h1 className="mt-3 wrap-anywhere text-[22px] font-black leading-[1.22] tracking-[-0.02em] text-text sm:text-[26px]">
        Aturan quiz sebelum timer jalan
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-text-body">
        Anda sudah menyetujui ketentuan satu kesempatan di layar materi.
        Halaman ini merangkum cara kerja quiz-nya sebelum waktu mulai
        berjalan.
      </p>

      <ol className="mt-6 space-y-4">
        {rules.map((rule, index) => (
          <li key={rule} className="flex gap-4">
            <span className="font-mono text-[13px] font-medium text-primary-deep">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 text-[15px] leading-relaxed text-text">
              {rule}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-card border border-border bg-fill-soft p-6 text-center">
        <p className="font-mono text-[34px] font-medium leading-none text-text">
          {String(data.durationMinutes).padStart(2, "0")}:00
        </p>
        <p className="mx-auto mt-3 max-w-[42ch] text-sm leading-relaxed text-text-muted">
          Timer baru mulai setelah Anda menekan tombol di bawah. Menekan
          “Nanti saja” tidak membuat attempt apa pun.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          ref={buttonRef}
          onClick={handleStart}
          loading={starting}
          loadingLabel="Memulai…"
          className="sm:flex-1"
        >
          Saya paham, mulai quiz
        </Button>
        <Link
          href={data.lessonHref}
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "sm:flex-1",
          )}
        >
          Nanti saja, kembali ke materi
        </Link>
      </div>

      {failed ? (
        <Banner tone="error" title={START_FAILED_MESSAGE} className="mt-4" />
      ) : null}
    </div>
  );
}
