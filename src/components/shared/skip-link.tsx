/*
 * Skip link (A-14a pattern) shared by the (public) and (learn) shells —
 * both land on <main id="konten-utama">.
 *
 * Fixed + transform (not sr-only): the link must appear at the viewport
 * top even when the page is scrolled, and land above the sticky header
 * while focused.
 */
export function SkipLink() {
  return (
    <a
      href="#konten-utama"
      className="fixed left-4 top-4 z-50 flex min-h-11 -translate-y-[200%] items-center rounded-control bg-surface px-4 font-bold text-text transition-transform duration-200 ease-out focus:translate-y-0"
    >
      Lewati ke konten utama
    </a>
  );
}
