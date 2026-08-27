"use client";

import { ErrorState } from "@/components/feedback/ErrorState/ErrorState";

/**
 * CMS error boundary (TASK 059, CMS §45 "CMS Error Boundaries —
 * Important CMS sections should have error handling": the
 * "Something went wrong / We couldn't load this course / [Try
 * Again]" surface, rendered inside the admin shell for every admin
 * route). No stack traces to admins, no raw messages — detail stays
 * in the server logs the mutations already write (§45; Architecture
 * §27–§28). Retry resets the boundary; the dashboard link is the way
 * out when the route itself is the problem.
 */
export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Terjadi Kesalahan"
      description="Kami tidak dapat memuat halaman ini. Silakan coba lagi."
      onRetry={reset}
      linkHref="/admin"
      linkLabel="Kembali ke Dashboard"
    />
  );
}
