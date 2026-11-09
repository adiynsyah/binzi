// /cari "Segera hadir" (card S6-01 §6) — search arrives in a later sprint.
import type { Metadata } from "next";

import { ComingSoon } from "@/components/public/coming-soon";

export const metadata: Metadata = {
  title: "Cari — BINZI",
  robots: { index: false },
};

export default function CariPage() {
  return <ComingSoon title="Cari" />;
}
