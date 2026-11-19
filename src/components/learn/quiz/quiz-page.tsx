// QuizPage (card S3-01 §4) — the state switch over LessonQuizPageDTO.
// The `kembali` member never reaches render (the route redirects to the
// lesson page, which owns the locked / not-eligible states); the null is
// the defensive leftover. `key` by attemptId: a refresh that swaps
// attempts remounts the runner instead of reconciling stale answers.
import type { LessonQuizPageDTO } from "@/modules/attempt/service";

import { PageContainer } from "@/components/shared/page-container";
import { QuizExpiredSubmit } from "./quiz-expired-submit";
import { QuizResult } from "./quiz-result";
import { QuizRules } from "./quiz-rules";
import { QuizRunner } from "./quiz-runner";

export function QuizPage({ data }: { data: LessonQuizPageDTO }) {
  return (
    <PageContainer className="pt-6 pb-12">
      {data.state === "aturan" ? (
        <QuizRules data={data} />
      ) : data.state === "berjalan" ? (
        <QuizRunner key={data.attemptId} data={data} />
      ) : data.state === "kedaluwarsa" ? (
        <QuizExpiredSubmit attemptId={data.attemptId} />
      ) : data.state === "hasil" ? (
        <QuizResult data={data} />
      ) : null}
    </PageContainer>
  );
}
