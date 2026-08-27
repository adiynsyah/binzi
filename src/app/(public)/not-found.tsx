import { ErrorState } from "@/components/feedback/ErrorState/ErrorState";

/**
 * Public not-found boundary (TASK 059, UI/UX §37) — the same
 * Indonesian 404 as the root boundary, rendered INSIDE the public
 * shell so catalog/detail denials (/courses/[slug],
 * /articles/[slug] — drafts indistinguishable from unknown, UI/UX
 * §44) keep the site header and skip link while they tell the
 * reader what happened and where to go next.
 */
export default function PublicNotFound() {
  return (
    <ErrorState
      title="Halaman Tidak Ditemukan"
      description="Halaman yang Anda cari tidak tersedia atau telah dipindahkan."
      linkHref="/"
      linkLabel="Kembali ke Beranda"
    />
  );
}
