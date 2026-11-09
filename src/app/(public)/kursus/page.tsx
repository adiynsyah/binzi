// /kursus "Segera hadir" (card S6-01 §6) — the catalog arrives in a later
// sprint; /kursus/{slug} keeps 404ing until then.
import type { Metadata } from "next";

import { ComingSoon } from "@/components/public/coming-soon";

export const metadata: Metadata = {
  title: "Kursus — BINZI",
  robots: { index: false },
};

export default function KursusPage() {
  return <ComingSoon title="Kursus" />;
}
