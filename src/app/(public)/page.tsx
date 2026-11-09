/*
 * Beranda versi demo (card S6-01): Hero → Cara kerjanya → Tanya Ahli
 * Gizi → CTA penutup. Stays a static page (○) — no DB, cookies(), headers()
 * or session here or in any of its components (A-14a, PRD §10.4; the CI
 * build runs with a dummy DATABASE_URL and no server). The WhatsApp number
 * is read at click time by GET /api/konsultasi/whatsapp, not here.
 */
import type { Metadata } from "next";

import { CaraKerjanya } from "@/components/public/beranda/cara-kerjanya";
import { CtaPenutup } from "@/components/public/beranda/cta-penutup";
import { Hero } from "@/components/public/beranda/hero";
import { TanyaAhliGizi } from "@/components/public/beranda/tanya-ahli-gizi";
import { SUBJUDUL_HERO } from "@/components/public/beranda/beranda-content";

export const metadata: Metadata = {
  description: SUBJUDUL_HERO,
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <CaraKerjanya />
      <TanyaAhliGizi />
      <CtaPenutup />
    </>
  );
}
