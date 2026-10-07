// 403 UI for forbidden() interrupts (card A-12). Temporary copy & layout —
// the designed error states arrive with the A-13/A-14 screens.
import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-svh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-black">Akses ditolak</h1>
      <p className="text-text-muted">
        Anda tidak memiliki izin untuk membuka halaman ini.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-bold text-primary-foreground"
      >
        Kembali ke Beranda
      </Link>
    </main>
  );
}
