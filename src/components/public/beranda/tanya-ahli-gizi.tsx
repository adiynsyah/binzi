import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { PUBLIC_HREFS } from "@/components/shared/nav-items";
import { PageContainer } from "@/components/shared/page-container";
import { buttonVariants } from "@/components/ui/button-variants";

import {
  AHLI_GIZI,
  CONTOH_PERTANYAAN,
  JAM_LAYANAN,
  WAKTU_BALAS,
} from "./beranda-content";

/*
 * Tanya Ahli Gizi (card S6-01 §4, KSL-01…14): dark section on ink-surface
 * with the focus ring overridden to surface (same pattern as site-footer).
 * The section keeps the id + scroll-mt the "Konsultasi" nav link targets.
 * The WhatsApp number is NOT read here — the button points at
 * GET /api/konsultasi/whatsapp, which 302s to wa.me using the live
 * system_settings value, keeping this page static (○) and the number
 * replaceable without a deploy (KSL-08).
 *
 * The 1a mock paints internal lines and card fills in hexes that all map
 * to ink-surface (invisible on the same background); the card prescribes
 * opacity modifiers instead (surface/10 lines, primary-deep/15
 * disclaimer), and axe decides the contrast.
 */
export function TanyaAhliGizi() {
  return (
    <section
      id="tanya-ahli-gizi"
      aria-label="Tanya Ahli Gizi"
      className="scroll-mt-[68px] bg-ink-surface pt-12 pb-14 sm:scroll-mt-[80px] sm:pt-16 sm:pb-[68px] [--focus-ring:var(--surface)]"
    >
      <PageContainer>
        <p className="font-mono text-[11px] font-medium tracking-[0.16em] text-ink-surface-text">
          KONSULTASI
        </p>
        <h2 className="mt-3.5 text-[28px] font-black leading-[1.12] tracking-[-0.028em] text-surface sm:text-[34px] lg:text-[40px]">
          Tanya Ahli Gizi Kami
        </h2>
        <p className="mt-3 max-w-[58ch] text-[16px] leading-[1.65] text-ink-surface-text text-pretty sm:text-[17px]">
          Pertanyaan singkat soal menu, porsi, dan label gizi dijawab
          langsung oleh ahli gizi kami lewat WhatsApp — gratis, tanpa perlu
          mendaftar.
        </p>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-12">
          {/* kartu profil (KSL-02) */}
          <div className="rounded-card border border-surface/10 bg-surface/5 p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <Image
                src={AHLI_GIZI.foto.src}
                alt=""
                width={AHLI_GIZI.foto.width}
                height={AHLI_GIZI.foto.height}
                className="size-16 flex-none rounded-full object-cover object-[50%_30%] sm:size-20"
              />
              <div className="min-w-0">
                <h3 className="text-[16px] font-black leading-[1.3] tracking-[-0.012em] text-surface sm:text-[18px]">
                  {AHLI_GIZI.nama}
                </h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="rounded-pill bg-surface/10 px-2.5 py-[5px] text-[12px] font-bold text-surface">
                    {AHLI_GIZI.kredensial}
                  </span>
                  <span className="rounded-pill bg-surface/10 px-2.5 py-[5px] font-mono text-[12px] font-medium text-surface">
                    STR {AHLI_GIZI.str}
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-3.5 text-[14px] leading-[1.6] text-ink-surface-text text-pretty">
              {AHLI_GIZI.pengalaman}
            </p>
            <Link
              href={PUBLIC_HREFS.tentang}
              className="mt-1.5 inline-flex min-h-11 items-center text-[14px] font-bold text-surface underline underline-offset-4"
            >
              Kenali tim kami →
            </Link>
          </div>

          <div>
            <h3 className="text-[15px] font-bold text-surface">
              Contoh yang bisa ditanyakan
            </h3>
            <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
              {CONTOH_PERTANYAAN.map((contoh) => (
                <li
                  key={contoh}
                  className="rounded-[10px] border border-surface/10 px-3.5 py-3 text-[14px] leading-[1.45] text-surface"
                >
                  “{contoh}”
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[14px] leading-[1.6] text-ink-surface-text text-pretty">
              <strong className="font-bold text-surface">Tidak dilayani:</strong>{" "}
              diagnosis penyakit, resep obat atau suplemen dosis tertentu,
              diet untuk kondisi medis berat, dan keadaan darurat.
            </p>

            <ul className="mt-4 flex flex-wrap gap-2.5">
              <li className="flex items-center gap-2 rounded-[10px] border border-surface/10 px-3.5 py-2 text-[13.5px] font-bold text-surface">
                <span
                  aria-hidden="true"
                  className="size-[7px] flex-none rounded-pill bg-success"
                />
                {JAM_LAYANAN}
              </li>
              <li className="rounded-[10px] border border-surface/10 px-3.5 py-2 text-[13.5px] font-bold text-ink-surface-text">
                {WAKTU_BALAS}
              </li>
              <li className="rounded-[10px] border border-surface/10 px-3.5 py-2 text-[13.5px] font-bold text-ink-surface-text">
                Gratis
              </li>
            </ul>

            <aside
              role="note"
              className="mt-4 rounded-[12px] border border-primary-deep/40 bg-primary-deep/15 p-4 sm:px-[18px]"
            >
              <h3 className="text-[14.5px] font-black text-surface">
                Edukasi gizi, bukan layanan medis
              </h3>
              <p className="mt-1.5 text-[14px] leading-[1.6] text-ink-surface-text text-pretty">
                Jawaban bersifat umum dan tidak menggantikan pemeriksaan
                dokter.{" "}
                <strong className="font-bold text-surface">
                  Kondisi darurat? Segera hubungi 119
                </strong>{" "}
                atau fasilitas kesehatan terdekat — jangan menunggu balasan
                WhatsApp.
              </p>
            </aside>

            <div className="mt-4">
              <a
                href="/api/konsultasi/whatsapp"
                target="_blank"
                rel="noopener noreferrer"
                className={`${buttonVariants({ variant: "primary", size: "lg" })} w-full sm:w-auto`}
              >
                <MessageCircle aria-hidden="true" className="size-5" />
                Chat Ahli Gizi di WhatsApp{" "}
                <span className="sr-only">(membuka tab baru)</span>
              </a>
              <p className="mt-3 max-w-[60ch] text-[13px] leading-[1.6] text-ink-surface-text text-pretty">
                Membuka WhatsApp dengan pesan pembuka yang sudah terisi.
                Riwayat chat tidak kami simpan.
              </p>
            </div>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
