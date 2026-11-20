"use client";

// QuizExpiredSubmit (card S3-01 §4.D, retry per S3-02 §2) — the
// "kedaluwarsa" state's beacon: the GET never writes (owner decision 6),
// so the page hands this the attemptId and the CLIENT performs the
// collect. On mount: POST submit once — the ref guard keeps the
// double-invoked StrictMode effect to ONE post. 200/409 → refresh() and
// the refreshed GET lands on the hasil state; any other failure shows
// the inline retry banner ("Coba lagi" re-POSTs) instead of waiting for
// a re-render that may never come.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";

const COLLECT_FAILED_MESSAGE =
  "Jawaban belum terkumpulkan. Periksa koneksi lalu coba lagi.";

export function QuizExpiredSubmit({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const sent = useRef(false);
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const postCollect = useCallback(async () => {
    setRetrying(true);
    try {
      const response = await fetch(
        `/api/quiz/attempts/${attemptId}/submit`,
        { method: "POST" },
      );
      if (response.ok || response.status === 409) {
        // 409 = already final elsewhere — the refreshed GET still lands
        // on the hasil state. The banner clears; `retrying` stays on so
        // the card keeps the "mengumpulkan…" line until the refresh
        // unmounts this beacon.
        router.refresh();
        setFailed(false);
        return;
      }
    } catch {
      // Network failure — fall through to the retry banner.
    }
    setFailed(true);
    setRetrying(false);
  }, [attemptId, router]);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void postCollect();
  }, [postCollect]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-card border border-border bg-surface p-10 text-center">
        <p
          role="status"
          className="font-mono text-sm font-medium text-text-muted"
        >
          {failed && !retrying
            ? "Waktu habis."
            : "Waktu habis — mengumpulkan jawaban…"}
        </p>
      </div>
      {failed ? (
        <Banner
          tone="error"
          title={COLLECT_FAILED_MESSAGE}
          action={
            <Button variant="secondary" onClick={() => void postCollect()}>
              Coba lagi
            </Button>
          }
          className="mt-4"
        />
      ) : null}
    </div>
  );
}
