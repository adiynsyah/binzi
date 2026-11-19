"use client";

// QuizExpiredSubmit (card S3-01 §4.D) — the "kedaluwarsa" state's beacon:
// the GET never writes (owner decision 6), so the page hands this the
// attemptId and the CLIENT performs the collect. On mount: POST submit,
// then router.refresh() — the refreshed GET lands on the hasil state. The
// ref guard keeps the double-invoked StrictMode effect to ONE post; a
// failed post is retried by the refresh re-mounting this component.
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function QuizExpiredSubmit({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    fetch(`/api/quiz/attempts/${attemptId}/submit`, { method: "POST" })
      .catch(() => {
        // Network failure: swallowed — the refresh below re-renders the
        // kedaluwarsa state and this beacon gets to try again.
      })
      .finally(() => {
        router.refresh();
      });
  }, [attemptId, router]);

  return (
    <div className="mx-auto max-w-2xl rounded-card border border-border bg-surface p-10 text-center">
      <p
        role="status"
        className="font-mono text-sm font-medium text-text-muted"
      >
        Waktu habis — mengumpulkan jawaban…
      </p>
    </div>
  );
}
