import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/env";
import "@/styles/globals.scss";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "BINZI — Belajar Gizi dengan Cara yang Lebih Mudah",
    template: "%s | BINZI",
  },
  description:
    "Platform edukasi gizi untuk publik: pelajari gizi langkah demi langkah melalui kursus, artikel, dan kuis interaktif.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
