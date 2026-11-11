// /disclaimer "Segera hadir" (card S5-01 §5) — the medical disclaimer
// (12e) is written and reviewed outside this card; the page exists so the
// footer link is not a 404 at the demo.
import type { Metadata } from "next";

import { ComingSoon } from "@/components/public/coming-soon";

export const metadata: Metadata = {
  title: "Disclaimer medis — BINZI",
  robots: { index: false },
};

export default function DisclaimerPage() {
  return <ComingSoon title="Disclaimer medis" />;
}
