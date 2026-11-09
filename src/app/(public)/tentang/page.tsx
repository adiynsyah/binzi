// /tentang "Segera hadir" (card S6-01 §6) — the team page arrives in a
// later sprint.
import type { Metadata } from "next";

import { ComingSoon } from "@/components/public/coming-soon";

export const metadata: Metadata = {
  title: "Tentang Kami — BINZI",
  robots: { index: false },
};

export default function TentangPage() {
  return <ComingSoon title="Tentang Kami" />;
}
