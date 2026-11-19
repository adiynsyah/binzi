"use client";

// QuizStartButton (card S3-01 §3, screens 7d + QZ-18) — the lesson page's
// bottom-bar quiz control. Eligible: the primary "Tandai selesai & mulai
// quiz" opens the one-chance confirmation dialog (contents from the PRD
// §6.3.2 box — 7d does not draw it); its primary action is a LINK to the
// rules page, because the timer only starts there. Not eligible: the same
// button softDisabled (C-08) with the watch-more line linked through
// aria-describedby — no DialogTrigger, so nothing opens on click.
import { useId } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { OpenQuizDTO } from "@/modules/progress/service";

export function QuizStartButton({ quiz }: { quiz: OpenQuizDTO }) {
  const describedById = useId();

  if (!quiz.eligible) {
    return (
      <div className="flex flex-col items-end gap-2">
        <Button softDisabled aria-describedby={describedById}>
          Tandai selesai &amp; mulai quiz
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
        <p
          id={describedById}
          className="max-w-(--width-measure) text-sm text-text-meta"
        >
          Tonton video sampai minimal 90 % untuk membuka quiz.
        </p>
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          Tandai selesai &amp; mulai quiz
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent title={`Quiz: ${quiz.title}`}>
        <ul className="mt-4 flex flex-col gap-2.5 text-[15px] leading-relaxed text-text">
          <li>{quiz.questionCount} soal</li>
          <li>Waktu {quiz.durationMinutes} menit</li>
          <li className="flex items-start gap-2 font-bold">
            <AlertCircle
              className="mt-0.5 size-4 shrink-0 text-warning"
              aria-hidden="true"
            />
            Hanya dapat dikerjakan SATU KALI
          </li>
          <li>Timer berjalan terus meski halaman ditutup</li>
          <li>Nilai akan tercatat permanen</li>
        </ul>
        <p className="mt-4 text-sm text-text-muted">
          Pastikan koneksi stabil dan Anda siap.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="secondary">Nanti saja</Button>
          </DialogClose>
          <Link
            href={quiz.href}
            className={cn(buttonVariants(), "gap-2")}
          >
            Lanjut ke aturan quiz
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
