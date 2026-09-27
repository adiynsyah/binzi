import type { Metadata } from "next";
import { IBM_Plex_Mono, Lato } from "next/font/google";
import "./globals.css";

// Lato is a static (non-variable) Google font, so weights are explicit.
// next/font builds weight × style as a cartesian set: italic faces for
// 300/700/900 are generated but the design only uses italic 400
// (TOKENS.md → "Tipografi"). Never add 500/600/800 — Lato has none.
const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-lato",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BINZI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${lato.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
