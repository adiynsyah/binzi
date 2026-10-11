import Image from "next/image";
import Link from "next/link";
import { PUBLIC_HREFS } from "./nav-items";

/*
 * Footer (card A-14a; screen 1a on ink-surface, stacked per 1d on phones).
 * A server component — the running year is baked at build time and the page
 * stays static.
 *
 * Focus ring: on the dark background the default --focus-ring (the text
 * token) would be invisible, so the footer overrides it to var(--surface)
 * locally (decision recorded in docs/STATUS.md, "Cincin fokus").
 *
 * The 1a mock draws internal separators in a dark hex on an even darker
 * footer background; both hexes map to the SAME ink-surface token
 * (TOKENS.md mapping table), so the lines vanish — spacing carries the
 * structure instead.
 */

type FooterLink = { label: string; href: string };

const BELAJAR_LINKS: readonly FooterLink[] = [
  { label: "Semua kursus", href: PUBLIC_HREFS.kursus },
  { label: "Nilai Saya", href: "/belajar/nilai" },
];

// Per-category links arrive in S4 — categories are not final yet (K-04).
const ARTIKEL_LINKS: readonly FooterLink[] = [
  { label: "Semua kategori", href: PUBLIC_HREFS.artikel },
];

const BINZI_LINKS: readonly FooterLink[] = [
  { label: "Tanya Ahli Gizi", href: PUBLIC_HREFS.konsultasi },
  { label: "Tentang Kami", href: PUBLIC_HREFS.tentang },
];

const KETENTUAN_LINKS: readonly FooterLink[] = [
  { label: "Kebijakan Privasi", href: "/kebijakan-privasi" },
  { label: "Syarat & Ketentuan", href: "/syarat-ketentuan" },
  { label: "Disclaimer medis", href: "/disclaimer" },
];

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly FooterLink[];
}) {
  return (
    <div>
      <h2 className="text-[13.5px] font-bold text-surface">{title}</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-[14.5px] text-ink-surface-text transition-colors duration-200 ease-out hover:text-surface"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-ink-surface [--focus-ring:var(--surface)]">
      <div className="mx-auto max-w-content px-4 py-14 sm:px-7 lg:px-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.35fr)_repeat(4,minmax(0,1fr))]">
          <div className="sm:col-span-2 lg:col-span-1">
            <Image
              src="/brand/logo-binzi-wordmark.png"
              alt="BINZI"
              width={1705}
              height={360}
              className="block h-5 w-auto"
            />
            <p className="mt-4 max-w-[30ch] text-[14.5px] leading-[1.65] text-ink-surface-text">
              Kursus dan artikel gizi berbahasa Indonesia — ringkas, gratis, dan
              ditinjau ahli gizi sebelum tayang.
            </p>
            <p className="mt-[18px] inline-flex items-center gap-2 rounded-pill px-3 py-2">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-pill bg-success"
              />
              <span className="text-[13.5px] font-bold text-surface">
                Ditinjau ahli gizi ber-STR aktif
              </span>
            </p>
          </div>
          <FooterColumn title="Belajar" links={BELAJAR_LINKS} />
          <FooterColumn title="Artikel" links={ARTIKEL_LINKS} />
          <FooterColumn title="BINZI" links={BINZI_LINKS} />
          <FooterColumn title="Ketentuan" links={KETENTUAN_LINKS} />
        </div>
        {/* Social icons are deliberately absent — accounts/URLs do not
            exist yet (card A-14a). */}
        <p className="mt-11 font-mono text-[12.5px] font-medium text-ink-surface-text">
          © {new Date().getFullYear()} BINZI
        </p>
      </div>
    </footer>
  );
}
