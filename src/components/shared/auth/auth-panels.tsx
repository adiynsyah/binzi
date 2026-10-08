import Image from "next/image";
import Link from "next/link";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

// Layout shells for the (auth) pages (card A-13): one shell per breakpoint
// family from the screen set —
//   < 768  (2d/3d): soft page background, white card, logo + ✕ header row
//   ≥ 768  (2t/3t): centered 480px column, mono eyebrow label
//   ≥ 1024 (2a/3a): split layout — marketing panel + form column
// Centered pages (3b, verification) reuse the shell without marketing
// content. All copy below is final copy from the screen .md files.
//
// The marketing panel skin differs per screen and is chosen with `tone`:
// /masuk is 2a's ink panel (ink-surface, white heading, focus ring
// overridden per docs/STATUS.md), /daftar keeps 3a's cream panel. The tone
// also carries the ≥1024 column ratio from the designs (2a 0.86fr : 1fr,
// 3a 0.82fr : 1fr) — one prop, no shell duplication.
//
// Heading/label sizes follow the TOKENS.md Tipografi table, not the mock's
// raw values: auth h1 = "Judul halaman" 32/1.14 (mock's 28px mobile, 1.2
// leading and -0.022em tracking sit outside the table), panel h2 = 38/1.14,
// checklist items = "Badan antarmuka" 15/1.6. tracking-tight (-0.025em) is
// inside the table's -0.024..-0.028em band.

// Brand lockup (2a/2d/3a/3d): black mark + red wordmark side by side, 9px
// gap, 26px/15px at ≥1024 and 22px/13px below. next/image gets each file's
// INTRINSIC width/height (mark 715×645, wordmark 1705×360); the display
// size is set through height only (`h-[..] w-auto`) so the ratio — and
// with it the declared width/height pair — is never modified.
const LOGO_MARK_HEIGHT = { sm: "h-[22px]", lg: "h-[26px]" } as const;
const LOGO_WORDMARK_HEIGHT = { sm: "h-[13px]", lg: "h-[15px]" } as const;

export function AuthBrandLogo({
  size = "sm",
  bright = false,
  className = "",
}: {
  /** "sm" = mobile header (2d/3d), "lg" = desktop marketing panel (2a/3a). */
  size?: keyof typeof LOGO_MARK_HEIGHT;
  /** 2a's ink panel only: the black mark is inverted and brightened
      exactly like 2a.html (the red wordmark stays untouched). */
  bright?: boolean;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-[9px] ${className}`}>
      <Image
        src="/brand/logo-binzi-mark.png"
        alt=""
        width={715}
        height={645}
        priority
        className={`block w-auto ${LOGO_MARK_HEIGHT[size]}${
          bright ? " [filter:invert(1)_brightness(1.6)]" : ""
        }`}
      />
      <Image
        src="/brand/logo-binzi-wordmark.png"
        alt="BINZI"
        width={1705}
        height={360}
        priority
        className={`block w-auto ${LOGO_WORDMARK_HEIGHT[size]}`}
      />
    </span>
  );
}

// ≥1024 split ratio per design: 2a 0.86fr : 1fr (ink), 3a 0.82fr : 1fr.
// Full literals so Tailwind's scanner sees both arbitrary-value classes.
const SHELL_COLUMNS = {
  cream: "lg:grid-cols-[0.82fr_1fr]",
  ink: "lg:grid-cols-[0.86fr_1fr]",
} as const;

// Marketing panel skin at ≥1024. 3a's cream panel carries a soft right
// border (3a.html); 2a's ink panel meets the white column edge-on. Dark
// sections override --focus-ring locally (docs/STATUS.md, tokens.css).
const PANEL_SKIN = {
  cream: "bg-fill-soft lg:border-r lg:border-border-soft",
  ink: "bg-ink-surface [--focus-ring:var(--surface)]",
} as const;

export type AuthShellProps = {
  /** Marketing panel skin + ≥1024 column ratio. Default "cream" (3a). */
  tone?: keyof typeof SHELL_COLUMNS;
  /** Mono eyebrow shown in the tablet band only (2t "MASUK", 3t "DAFTAR"). */
  eyebrow?: string;
  /** Page heading — the same copy at every width. */
  heading: string;
  /** Supporting line under the heading (2a/3a: 16px muted). */
  sub?: ReactNode;
  /** Render `sub` at ≥1024 only — 2a uses the sub slot for the cross-link
      line, which on mobile (2d) is the card's bottom footer instead. */
  subFromLg?: boolean;
  /** Marketing panel content for ≥1024px; omit for centered pages. */
  marketing?: ReactNode;
  /** Cross-link row at the bottom of the card (2d/3d mobile pattern —
      hidden at ≥1024, where the link lives in the sub slot or the
      marketing panel). */
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
  tone = "cream",
  eyebrow,
  heading,
  sub,
  subFromLg = false,
  marketing,
  footer,
  note,
  closable = false,
  closeHref = "/",
  children,
}: AuthShellProps) {
  return (
    <div
      className={`min-h-dvh bg-fill-soft lg:grid lg:min-h-dvh lg:bg-surface ${SHELL_COLUMNS[tone]}`}
    >
      {marketing ? (
        <aside
          className={`hidden lg:flex lg:min-h-dvh lg:flex-col lg:px-14 lg:py-12 xl:px-20 ${PANEL_SKIN[tone]}`}
        >
          {marketing}
        </aside>
      ) : null}
      <main className="flex min-h-dvh flex-col px-4 py-6 sm:px-6 lg:items-center lg:justify-center lg:bg-surface lg:px-10 lg:py-12">
        <div className="flex w-full items-center justify-between lg:hidden">
          <AuthBrandLogo />
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
          <h1 className="text-[32px] leading-[1.14] font-black tracking-tight text-balance text-text">
            {heading}
          </h1>
          {sub ? (
            <p
              className={`mt-2.5 text-base text-text-muted${
                subFromLg ? " hidden lg:block" : ""
              }`}
            >
              {sub}
            </p>
          ) : null}
          <div className="mt-6">{children}</div>
          {footer ? (
            <div className="mt-6 text-center text-sm text-text-muted lg:hidden">
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

function MarketingCheckItem({
  tone = "cream",
  children,
}: {
  tone?: keyof typeof SHELL_COLUMNS;
  children: ReactNode;
}) {
  // 2a's ink panel swaps the success pill for a translucent white badge
  // with a white check (2a.html: rgba(255,255,255,.12) over the panel).
  const badge =
    tone === "ink" ? "bg-surface/[0.12] text-surface" : "bg-success text-surface";
  const label = tone === "ink" ? "text-surface/[0.86]" : "text-text";
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-pill ${badge}`}
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
      <span className={`text-[15px] leading-[1.6] ${label}`}>{children}</span>
    </li>
  );
}

/** Marketing panel for /masuk — 2a's ink panel (renders at ≥1024 only, so
    its dark styling has no mobile variant). */
export function LoginMarketing() {
  return (
    <>
      <AuthBrandLogo size="lg" bright />
      <div className="mt-auto max-w-md">
        <h2 className="text-[38px] leading-[1.14] font-black tracking-tight text-balance text-surface">
          Lanjutkan dari materi terakhir Anda.
        </h2>
        <p className="mt-4 text-base text-ink-surface-text">
          Progres, nilai quiz, dan posisi video tersimpan otomatis di setiap
          perangkat.
        </p>
        <ul className="mt-8 space-y-3">
          <MarketingCheckItem tone="ink">Semua kursus gratis</MarketingCheckItem>
          <MarketingCheckItem tone="ink">
            Materi ditinjau ahli gizi ber-STR aktif
          </MarketingCheckItem>
          <MarketingCheckItem tone="ink">
            Nilai quiz tercatat di halaman Nilai Saya
          </MarketingCheckItem>
        </ul>
        <p className="mt-10 text-sm text-ink-surface-text">
          Sesi member bertahan 30 hari. Akun admin &amp; editor otomatis keluar
          setelah 8 jam.
        </p>
      </div>
    </>
  );
}

/** Marketing panel for /daftar — 3a's cream panel (renders at ≥1024 only). */
export function RegisterMarketing() {
  return (
    <>
      <AuthBrandLogo size="lg" />
      <div className="mt-auto max-w-md">
        <p className="inline-flex items-center gap-2 rounded-pill bg-primary-tint px-3 py-1 text-sm font-bold text-primary-deep">
          <span aria-hidden="true" className="size-2 rounded-pill bg-primary" />
          Tanpa biaya sama sekali
        </p>
        <h2 className="mt-4 text-[38px] leading-[1.14] font-black tracking-tight text-balance text-text">
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
