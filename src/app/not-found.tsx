import { ErrorState } from "@/components/feedback/ErrorState/ErrorState";

/**
 * Root not-found boundary (TASK 059 "Not found"; UI/UX §37 — say
 * what happened and what to do next). Every notFound() call the app
 * already makes (public/learning/CMS denials keep unknown and DRAFT
 * indistinguishable) and every unmatched route renders HERE instead
 * of Next's default English 404 — at last matching the
 * "Halaman Tidak Ditemukan" title the generateMetadata denial paths
 * have always promised.
 */
export default function NotFound() {
  return (
    <ErrorState
      title="Halaman Tidak Ditemukan"
      description="Halaman yang Anda cari tidak tersedia atau telah dipindahkan."
      linkHref="/"
      linkLabel="Kembali ke Beranda"
    />
  );
}
