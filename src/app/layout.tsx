import type { Metadata } from "next";
import "@/styles/globals.scss";

export const metadata: Metadata = {
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
