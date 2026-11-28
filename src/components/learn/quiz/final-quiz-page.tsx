// FinalQuizPage (card S5-02 §4) — the state switch over FinalQuizPageDTO,
// mirroring QuizPage. `berjalan`/`kedaluwarsa` reuse the S3-01 runner and
// beacon untouched (decision 3); the `kembali` member never reaches render
// (the route redirects to the lesson page); the null is the defensive
// leftover. `key` by attemptId: a refresh that swaps attempts remounts the
// runner instead of reconciling stale answers.
import type { FinalQuizPageDTO } from "@/modules/attempt/service";

import { PageContainer } from "@/components/shared/page-container";
import { FinalQuizResult } from "./final-quiz-result";
import { FinalQuizRules } from "./final-quiz-rules";
import { QuizExpiredSubmit } from "./quiz-expired-submit";
import { QuizRunner } from "./quiz-runner";

export function FinalQuizPage({
  data,
  reportHref,
}: {
  data: FinalQuizPageDTO;
  /** Card S3-03 §5: "Laporkan gangguan" on the result screen. */
  reportHref: string;
}) {
  return (
    <PageContainer className="pt-6 pb-12">
      {data.state === "aturan-final" ? (
        <FinalQuizRules data={data} />
      ) : data.state === "berjalan" ? (
        <QuizRunner key={data.attemptId} data={data} />
      ) : data.state === "kedaluwarsa" ? (
        <QuizExpiredSubmit attemptId={data.attemptId} />
      ) : data.state === "hasil-final" ? (
        <FinalQuizResult data={data} reportHref={reportHref} />
      ) : null}
    </PageContainer>
  );
}
