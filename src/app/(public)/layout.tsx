import { SiteFooter } from "../../components/shared/site-footer";
import { SiteHeader } from "../../components/shared/site-header";

/*
 * Public shell (card A-14a): skip link → sticky guest header → main →
 * footer. Server-rendered and free of cookies()/headers()/session reads, so
 * every (public) page keeps its static/ISR output (PRD §10.4). Auth screens
 * live in the (auth) group with their own layout and stay chrome-less.
 */
export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {/* Fixed + transform (not sr-only): the link must appear at the
          viewport top even when the page is scrolled, and land above the
          sticky header while focused. */}
      <a
        href="#konten-utama"
        className="fixed left-4 top-4 z-50 flex min-h-11 -translate-y-[200%] items-center rounded-control bg-surface px-4 font-bold text-text transition-transform duration-200 ease-out focus:translate-y-0"
      >
        Lewati ke konten utama
      </a>
      <SiteHeader />
      <main id="konten-utama">{children}</main>
      <SiteFooter />
    </>
  );
}
