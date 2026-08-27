"use client";

import { ErrorState } from "@/components/feedback/ErrorState/ErrorState";

/**
 * Public segment error boundary (TASK 059, UI/UX §37 "We couldn't
 * load this lesson. [Try Again]"; CMS §45 discipline carried over
 * the public shell). Catches render/data failures on the public
 * routes below the (public) layout — the shell (skip link, header)
 * stays mounted; this replaces only the failing content with the
 * what-happened + what-to-do-next pair. No error detail is shown:
 * the server log owns the detail (Architecture §27–§28).
 */
export default function PublicError({
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
