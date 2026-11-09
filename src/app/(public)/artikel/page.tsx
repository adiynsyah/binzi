// /artikel "Segera hadir" (card S6-01 §6) — the article index arrives in a
// later sprint; /artikel/{slug} keeps 404ing until then.
import type { Metadata } from "next";

import { ComingSoon } from "@/components/public/coming-soon";

export const metadata: Metadata = {
  title: "Artikel — BINZI",
  robots: { index: false },
};

export default function ArtikelPage() {
  return <ComingSoon title="Artikel" />;
}
