import Image from "next/image";
import Link from "next/link";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

// Layout shells for the (auth) pages (card A-13): one shell per breakpoint
// family from the screen set —
//   < 768  (2d/3d): soft page background, white card, logo + ✕ header row
//   ≥ 768  (2t/3t): centered 480px column, mono eyebrow label
//   ≥ 1024 (2a/3a): split layout — cream marketing panel + form column
// Centered pages (3b, verification) reuse the shell without marketing
// content. All copy below is final copy from the screen .md files.
//
// NOTE (copy divergence, PR): 2t/3t show heading variants ("Lanjutkan
// belajar" / "Buat akun gratis") — one heading per page is used instead so
// a page never carries two different h1 texts; see the A-13 PR summary.

export function AuthBrandLogo({
  className = "",
  width = 120,
}: {
  className?: string;
  width?: number;
}) {
  return (
    <Image
      src="/brand/logo-binzi.png"
      alt="BINZI"
      width={width}
      height={width / 3}
      priority
      className={`h-auto w-auto ${className}`}
    />
  );
}

export type AuthShellProps = {
  /** Mono eyebrow shown in the tablet band only (2t "MASUK", 3t "DAFTAR"). */
  eyebrow?: string;
  /** Page heading — the same copy at every width (see note above). */
  heading: string;
  /** Supporting line under the heading. */
  sub?: string;
  /** Marketing panel content for ≥1024px; omit for centered pages. */
  marketing?: ReactNode;
  /** Cross-link row under the form, e.g. "Belum punya akun? Daftar gratis". */
  footer?: ReactNode;
  /** Small meta note at the very bottom (2d session note). */
  note?: string;
  /** Show the mobile ✕ close control (entry pages 2d/3d). */
  closable?: boolean;
  /** Destination of the ✕ close control. */
  closeHref?: string;
  children: ReactNode;
};

export function AuthShell({
  eyebrow,
  heading,
  sub,
  marketing,
  footer,
  note,
  closable = false,
  closeHref = "/",
  children,
}: AuthShellProps) {
  return (
    <div className="min-h-dvh bg-fill-soft lg:grid lg:min-h-dvh lg:grid-cols-[1.15fr_500px] lg:bg-surface xl:grid-cols-[1.3fr_560px]">
      {marketing ? (
        <aside className="hidden bg-fill-soft lg:flex lg:min-h-dvh lg:flex-col lg:px-14 lg:py-12 xl:px-20">
          {marketing}
        </aside>
      ) : null}
      <main className="flex min-h-dvh flex-col px-4 py-6 sm:px-6 lg:items-center lg:justify-center lg:bg-surface lg:px-10 lg:py-12">
        <div className="flex w-full items-center justify-between lg:hidden">
          <AuthBrandLogo width={104} />
          {closable ? (
            <Link
              href={closeHref}
              aria-label="Tutup"
              className="grid size-11 place-items-center rounded-control text-text-muted transition-colors duration-200 ease-out hover:bg-fill hover:text-text"
            >
              <X aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </div>
        <div className="w-full rounded-card border border-border-soft bg-surface p-5 sm:p-6 lg:max-w-[410px] lg:rounded-none lg:border-0 lg:p-0">
          {eyebrow ? (
            <p className="mb-3 hidden font-mono text-xs font-medium uppercase tracking-[0.2em] text-text-subtle md:block lg:hidden">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-black tracking-tight text-text lg:text-3xl">
            {heading}
          </h1>
          {sub ? <p className="mt-2 text-sm text-text-muted">{sub}</p> : null}
          <div className="mt-6">{children}</div>
          {footer ? (
            <div className="mt-6 text-center text-sm text-text-muted">
              {footer}
            </div>
          ) : null}
          {note ? (
            // 2d: the session note is the MOBILE replacement for the
            // desktop marketing panel's session line — hide it at ≥1024.
            <p className="mt-4 text-center text-sm text-text-meta lg:hidden">
              {note}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}

/** Inline red link inside footer copy (2a/3a pattern). */
export function AuthInlineLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-bold text-primary transition-colors duration-200 ease-out hover:text-primary-deep"
    >
      {children}
    </Link>
  );
}

function MarketingCheckItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-pill bg-success text-surface"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
      <span className="text-sm text-text">{children}</span>
    </li>
  );
}

/** Marketing panel for /masuk (screen 2a, desktop ≥1024). */
export function LoginMarketing() {
  return (
    <>
      <AuthBrandLogo width={136} />
      <div className="mt-auto max-w-md">
        <h2 className="text-3xl font-black tracking-tight text-text">
          Lanjutkan dari materi terakhir Anda.
        </h2>
        <p className="mt-4 text-base text-text-muted">
          Progres, nilai quiz, dan posisi video tersimpan otomatis di setiap
          perangkat.
        </p>
        <ul className="mt-8 space-y-3">
          <MarketingCheckItem>Semua kursus gratis</MarketingCheckItem>
          <MarketingCheckItem>
            Materi ditinjau ahli gizi ber-STR aktif
          </MarketingCheckItem>
          <MarketingCheckItem>
            Nilai quiz tercatat di halaman Nilai Saya
          </MarketingCheckItem>
        </ul>
        <p className="mt-10 text-sm text-text-meta">
          Sesi member bertahan 30 hari. Akun admin &amp; editor otomatis keluar
          setelah 8 jam.
        </p>
      </div>
    </>
  );
}

/** Marketing panel for /daftar (screen 3a, desktop ≥1024). */
export function RegisterMarketing() {
  return (
    <>
      <AuthBrandLogo width={136} />
      <div className="mt-auto max-w-md">
        <p className="inline-flex items-center gap-2 rounded-pill bg-primary-tint px-3 py-1 text-sm font-bold text-primary-deep">
          <span aria-hidden="true" className="size-2 rounded-pill bg-primary" />
          Tanpa biaya sama sekali
        </p>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-text">
          Satu akun untuk semua kursus.
        </h2>
        <p className="mt-4 text-base text-text-muted">
          Mendaftar dari halaman kursus? Anda langsung terdaftar ke kursus itu
          dan kembali ke materi yang sedang dibuka.
        </p>
        <ul className="mt-8 space-y-3">
          <MarketingCheckItem>
            Progres &amp; nilai quiz tersimpan otomatis
          </MarketingCheckItem>
          <MarketingCheckItem>
            Materi ditinjau ahli gizi ber-STR aktif
          </MarketingCheckItem>
          <MarketingCheckItem>
            Bisa dilanjut dari HP, hemat kuota
          </MarketingCheckItem>
        </ul>
        <p className="mt-10 text-sm text-text-muted">
          Sudah punya akun?{" "}
          <AuthInlineLink href="/masuk">Masuk di sini.</AuthInlineLink>
        </p>
      </div>
    </>
  );
}
