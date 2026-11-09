/*
 * Beranda content constants (card S6-01 §1) — the ONE file the product
 * owner edits without touching a component: the nutritionist profile
 * (OQ-08: name & credentials from the design; the STR number is a DUMMY
 * that must be replaced before release — PRD §14.9), hero stats, hero
 * copy pieces reused as page metadata, consultation examples, service
 * hours/SLA copy (static for the demo — the settings rows exist but
 * reading them would make / dynamic, card §4), and the WhatsApp opening
 * message (KSL-04). The route reads WHATSAPP_TEMPLATE from here so the
 * owner edits text in exactly one place.
 */

export const AHLI_GIZI = {
  nama: "Pundra Dara Avindharin S.Tr.Gz, M.K.M",
  kredensial: "Nutrisionis",
  /** DUMMY — replace with the real STR before public release (PRD §14.9). */
  str: "1234 5678 9012 3456",
  pengalaman:
    "8 tahun mendampingi ibu hamil dan keluarga menyusun menu harian. Juga meninjau seluruh materi & artikel di BINZI.",
  foto: {
    src: "/images/ahli-gizi/pundra-dara.jpg",
    width: 256,
    height: 256,
  },
} as const;

/** Hero subjudul (1a) — also the page metadata description (card §1). */
export const SUBJUDUL_HERO =
  "Video singkat 3–5 menit, quiz dengan pembahasan lengkap, dan setiap materi diverifikasi ahli gizi sebelum tayang. Bisa dilanjut kapan saja dari HP.";

export const STATISTIK_HERO = [
  { angka: "3", label: "kursus terkurasi" },
  { angka: "6", label: "kategori artikel" },
  { angka: "10", label: "soal per materi" },
] as const;

export const CONTOH_PERTANYAAN = [
  "Menu sarapan untuk ibu hamil yang sering mual",
  "Cara membaca gula di label minuman kemasan",
  "Porsi nasi yang pas untuk anak usia 5 tahun",
  "Camilan sore untuk pekerja kantoran",
] as const;

/** Copy 1a — the quotes are drawn by the component, not stored here. */
export const JAM_LAYANAN = "Senin–Jumat · 09.00–17.00 WIB";
export const WAKTU_BALAS = "Dibalas dalam 1×24 jam kerja";

/** WhatsApp opening message (KSL-04, final copy from the design). */
export const WHATSAPP_TEMPLATE =
  "Halo, saya ___ dan ingin bertanya seputar gizi. Saya menemukan halaman ini dari BINZI.";
