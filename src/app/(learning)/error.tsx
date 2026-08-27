"use client";

import { ErrorState } from "@/components/feedback/ErrorState/ErrorState";

/**
 * Learning segment error boundary (TASK 059, UI/UX §37 — the spec's
 * own example is a lesson that fails to load). Covers the learn hub,
 * lesson viewer, and both quiz player routes; retry re-runs the
 * segment (the 044/048 gates re-evaluate on reset exactly as on a
 * fresh navigation). No error detail in the UI — server logs only.
 */
export default function LearningError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Terjadi Kesalahan"
      description="Kami tidak dapat memuat pelajaran ini. Silakan coba lagi."
      onRetry={reset}
      linkHref="/"
      linkLabel="Kembali ke Beranda"
    />
  );
}
