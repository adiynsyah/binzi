import { PageContainer } from "@/components/shared/page-container";

/*
 * Cara kerjanya (card S6-01 §5): heading, intro, and the three 01–03
 * cards with final copy from 1a. Three columns from lg, stacked below
 * (1d/1t). Static server component; plain cards — no shadows (TOKENS.md).
 */

const LANGKAH = [
  {
    nomor: "01",
    judul: "Pilih kursus",
    teks: "Tiga kursus tersedia. Materi pertama bisa ditonton dulu tanpa akun — daftar hanya kalau Anda ingin lanjut.",
  },
  {
    nomor: "02",
    judul: "Belajar & kerjakan quiz",
    teks: "Video 3–5 menit per materi, lalu satu quiz berpembahasan. Satu kesempatan per quiz, jadi kerjakan saat siap.",
  },
  {
    nomor: "03",
    judul: "Pantau nilai & progress",
    teks: "Nilai Akhir dihitung 60% dari quiz materi dan 40% dari Final Quiz. Progress tersimpan, bisa dilanjut lain hari.",
  },
] as const;

export function CaraKerjanya() {
  return (
    <section className="border-t border-border-soft bg-surface">
      <PageContainer className="py-12 sm:py-16">
        <h2 className="text-[28px] font-black leading-[1.12] tracking-[-0.028em] text-text sm:text-[34px] lg:text-[40px]">
          Cara kerjanya
        </h2>
        <p className="mt-3 max-w-[56ch] text-[16px] leading-[1.65] text-text-muted text-pretty sm:text-[17px]">
          Tiga langkah, tanpa biaya dan tanpa sertifikat. Yang Anda bawa
          pulang adalah pemahaman dan catatan nilai yang bisa dilihat kapan
          saja.
        </p>
        <ol className="mt-9 grid gap-6 lg:grid-cols-3">
          {LANGKAH.map((langkah) => (
            <li
              key={langkah.nomor}
              className="rounded-card border border-border bg-surface p-6"
            >
              <div className="font-mono text-[30px] font-medium leading-none text-primary-deep">
                {langkah.nomor}
              </div>
              <h3 className="mt-4 text-[19px] font-black leading-[1.25] tracking-[-0.014em] text-text lg:text-[20px]">
                {langkah.judul}
              </h3>
              <p className="mt-2 text-[15px] leading-[1.62] text-text-muted text-pretty">
                {langkah.teks}
              </p>
            </li>
          ))}
        </ol>
      </PageContainer>
    </section>
  );
}
