// /syarat-ketentuan "Segera hadir" (card S5-01 §5) — the legal copy (12d)
// is written and reviewed outside this card; the page exists so the footer
// link is not a 404 at the demo.
import type { Metadata } from "next";

import { ComingSoon } from "@/components/public/coming-soon";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan — BINZI",
  robots: { index: false },
};

export default function SyaratKetentuanPage() {
  return <ComingSoon title="Syarat & Ketentuan" />;
}
