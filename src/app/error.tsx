"use client";

import { ErrorState } from "@/components/feedback/ErrorState/ErrorState";

/**
 * Root error boundary (TASK 059, UI/UX §37 — say what happened and what
 * to do next; BR §39 actionable errors). Next resolves the NEAREST
 * boundary: (public), (learning), and admin each own one, so this file
 * exists for the segments that have none of their own — today the
 * (auth) login/register pages — so a network/Supabase outage during
 * SSR still shows the Indonesian recovery surface instead of Next's
 * default English error page. Retry resets the boundary; the homepage
 * link is the way out when the route itself is the problem.
 */
export default function RootError({
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
      linkHref="/"
      linkLabel="Kembali ke Beranda"
    />
  );
}
