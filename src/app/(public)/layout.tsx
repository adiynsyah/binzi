import { SessionHeader } from "../../components/shared/session-header";
import { SkipLink } from "../../components/shared/skip-link";
import { SiteFooter } from "../../components/shared/site-footer";

/*
 * Public shell (card A-14a; header gate added in A-14b): skip link →
 * session-aware header → main → footer. Server-rendered and free of
 * cookies()/headers()/session reads, so every (public) page keeps its
 * static/ISR output (PRD §10.4). Auth screens live in the (auth) group
 * with their own layout and stay chrome-less.
 *
 * SessionHeader is a client gate around the A-14a guest header: while the
 * session loads — and for guests — the guest header renders untouched, so
 * the static HTML of / always carries Masuk & Daftar Gratis; a resolved
 * member session swaps in the member header (A-14b).
 *
 * The wrapper is a min-h-dvh flex column with <main> as flex-1, so the
 * footer sits on the viewport bottom edge on short pages. <main> carries
 * the page surface: TOKENS assigns `surface` to page content and leaves
 * `surface-3` (the canvas behind modals) as the body default.
 */
export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <SessionHeader />
      <main id="konten-utama" className="flex-1 bg-surface">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
