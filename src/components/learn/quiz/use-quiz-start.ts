"use client";

// useQuizStart (cards S3-01 §4.A + S5-02 §4.A) — the ONE start-button
// brain, shared by QuizRules and FinalQuizRules: POST the attempt, treat
// 201 / 200 / 409 as "the server answered — refresh and let the GET land
// on the right state" (berjalan / hasil / kembali), keep everything else
// as a transport failure for the caller's Banner. loading + inFlight stay
// on until the refresh lands (no re-tap); focus returns to the button on
// the re-render that clears loading (the disabled attribute drops focus
// to <body> — lesson 4 Nov).
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function useQuizStart(href: string) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const inFlight = useRef(false);
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    if (inFlight.current) return;
    inFlight.current = true;
    setStarting(true);
    setFailed(false);
    try {
      const response = await fetch(href, { method: "POST" });
      // 201 new · 200 resumed (QZ-08) · 409 finalized or gated — in every
      // case the refreshed GET lands on the right state.
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

  useEffect(() => {
    if (failed) {
      buttonRef.current?.focus();
    }
  }, [failed]);

  return { start, starting, failed, buttonRef };
}
