# Handoff: BINZI — Platform Belajar Gizi & Kesehatan (MVP)

> **Mulai dari sini.** Baca file ini sampai habis sebelum membuka file desain.
> Urutan baca: `README.md` → `TOKENS.md` → `COMPONENTS.md` → `SCREENS.md` → `../../prd/INDEX.md` (bagian PRD yang relevan) → `../screens/<ID>.md` + `<ID>.png` (hanya untuk layar yang sedang dikerjakan).

## Overview
BINZI adalah platform edukasi gizi: kursus video pendek + quiz satu kesempatan, artikel yang ditinjau ahli gizi, section konsultasi WhatsApp di Beranda, area member (dashboard, Nilai Saya), dan CMS untuk ahli gizi & admin. Spesifikasi lengkap ada di `docs/prd/PRD-v1.3.md`.

## Tiga aturan yang tidak boleh dilanggar
1. **PRD = sumber kebenaran perilaku.** File desain = sumber kebenaran tampilan. Jika keduanya bertentangan, ikuti PRD dan catat perbedaannya.
2. **Hanya bangun layar yang terdaftar di `SCREENS.md`.** Board desain berisi riwayat eksplorasi — ada layar yang ditolak/diganti (lihat "Jangan dipakai" di bawah).
3. **Warna, font, spasi hanya dari `TOKENS.md`.** Jangan menyalin hex dari file desain — petakan ke token.

## About the Design Files
File di bundle ini adalah **referensi desain dalam HTML** — prototipe yang menunjukkan tampilan dan perilaku, **bukan kode produksi untuk disalin**. Tugasnya: membangun ulang desain ini di stack yang dipilih PRD §9.2 (Next.js + Drizzle + Better Auth + Supabase + R2), memakai pola dan library proyek.

- `docs/design/source/Binzi Landing Hero.dc.html` adalah satu kanvas besar (~12.000 baris) berisi semua layar, dikelompokkan per "turn" (t1…t29). Setiap layar punya ID (mis. `7d`, `28c`) — buka file di browser lalu tambahkan `#7d` di URL untuk melompat ke layar itu. **Untuk AI agent:** pakai `docs/design/screens/7d.md` + `7d.png` — kanvas utuh terlalu besar dan berisi ±150 hex mentah.
- **Logika JavaScript di dalam file (class `Component`) hanya untuk demo** — timer palsu, data dummy, toggle state. Jangan ditiru. Timer quiz, auto-save, dan penilaian wajib dihitung server (PRD §6.3, §12.2).
- Semua style ditulis inline; di kode produksi, turunkan ke komponen + token.

> ⚠️ **Isi gizi/kesehatan di desain adalah pengisi tata letak** (teks materi, artikel, soal, angka kebutuhan gizi). Jangan dipakai sebagai seed atau konten tanpa ditulis dan ditinjau ahli gizi (PRD §13.4). Copy *antarmuka* tetap final.

## Fidelity
**High-fidelity.** Warna, tipografi, spasi, radius, dan copy sudah final. Bangun ulang sedekat mungkin. Copy dalam Bahasa Indonesia di desain adalah copy final kecuali ditandai sebagai contoh data (nama user, angka nilai).

## Urutan pengerjaan (mengikuti PRD §13.1)
Kerjakan satu baris dalam satu waktu. Setiap baris selesai = semua state di `SCREENS.md` untuk layar itu sudah ada.

| Fase | Fokus | Layar (ID) |
|---|---|---|
| 0 · Fondasi | Token, komponen dasar, 3 kerangka layout (publik, member, CMS), auth | 17a–17d · header publik (1a) · menu akun 13a/13d · sidebar CMS 19a/19b · 2a–2d · 3a–3d · 15a–15b |
| S1 | CMS: kursus, materi, editor, media | 19c–19e · 21a–21i · 20a–20e · 24a–24t |
| S2 | Video & player, progress | 7d · 28f · 29a–29b · 8c |
| S3 | Mesin quiz (CMS + member) + reset attempt | 22a–22h · 7e · 7g · 7h · 7j · 7n · 28c · 7i · 26a–26t |
| S4 | Artikel, kategori, tag, SEO | 23a–23t · 5a–5t |
| S5 | Dashboard, Kursus Saya, Nilai Saya, Final Quiz, ulangi kursus, profil | 8a · 28a–28b · 8b · 8f · 13b–13t · 16a–16c · 7k · 7l · 9c–9t · 25a–25t · 27a–27t |
| S6 | Beranda (+ Tanya Ahli Gizi), katalog, pencarian, Tentang, legal | 1a · 6a–6b · 1d · 1t · 7a–7c · 7m · 11a–11t · 4a–4t · 12c–12t |
| 1.5 · Stabilisasi | State lintas layar, tablet, error | 28d–28e · 28g · 14a–14t · semua varian `…t` (tablet) · checklist 17d |

## Jangan dipakai (masih ada di board sebagai arsip)
| ID | Status | Pakai ini |
|---|---|---|
| 18a, 18b, 18c | Opsi alur tinjau yang **ditolak** | **18d** — ahli gizi menggarap konten di CMS, admin menyetujui & menerbitkan |
| Kartu preview video di hero **1a** | **Diganti** | Ilustrasi animasi **6a**, dipasang seperti **6b**. Bagian 1a lainnya tetap berlaku — **termasuk copy hero 1a** (judul, subjudul, CTA). Teks di 6b bukan copy final (PRD Q37) |
| Halaman `/konsultasi` | **Tidak ada** | Menu "Konsultasi" = scroll ke `/#tanya-ahli-gizi` di Beranda (PRD §5, KSL-13) |
| Catatan lama di 13b soal ulangi kursus | Dikoreksi di turn 16 | Ulangi kursus **membuka lagi semua quiz**; nilai siklus lama tetap tersimpan (PRD §6.3.3, 16a–16b) |
| Nama "NutriLearn" di PRD ≤ v1.2 | Nama lama (sudah diganti di v1.3) | Produk bernama **BINZI** |
| Fitur S/C (CMS-13 analitik, CMS-14 versioning, CMS-15 jadwal terbit, NTF-03, NTF-04) | Di luar MVP | Jangan dibangun |

## Ketidakcocokan yang diketahui — sudah diselesaikan di PRD v1.3

> Semua baris di bawah sudah diserap ke PRD v1.3 (§2 Q29–Q35, §17.4). Tabel dipertahankan sebagai catatan. Aturan "jika desain dan PRD bertentangan, ikuti PRD" kini berlaku tanpa pengecualian.

| Hal | Yang benar |
|---|---|
| PRD memakai nama "NutriLearn" (termasuk template pesan WhatsApp KSL-04) | **BINZI** di semua copy |
| PRD menyebut uji 360 / 768 / 1440; sebagian besar layar desain 1280 | Uji 360 / 768 / 1280; Beranda (1a) & Masuk (2a) juga di 1440. Lebar isi maks 1200 berlaku di semua lebar desktop |
| File desain menulis bobot font 500/600/800 (sisa Plus Jakarta Sans) | Tulis bobot Lato yang dirender: 400 / 700 / 900 (lihat TOKENS.md) |
| Menu "Terjadwal" di sidebar CMS 19b | Fitur CMS-15, di luar MVP — sembunyikan |
| Kartu preview video di hero 1a | Diganti ilustrasi 6a/6b |
| Aturan soal di layar 22c ("pg butuh 2–5 opsi") vs PRD v1.2 (2–6 opsi, pembahasan opsional) | **Pilihan ganda tepat 4 opsi (a–d); benar/salah 2 opsi; pembahasan wajib** (PRD Q40). Tulis ulang teks aturan di 22c sesuai ini |
| Kode JavaScript di file desain (timer, data dummy) | Hanya demo — logika asli di server sesuai PRD |
| File desain memakai ±150 kode hex | Petakan ke token — tabel pemetaan di TOKENS.md |
| PRD §5.4: tombol WhatsApp "warna hijau WhatsApp"; desain 1a/1d memakai tombol terang netral (hover oranye) | **Ikuti desain** (diputuskan pemilik produk; kini tertulis di PRD v1.3 §5.4 & Q30): latar `fill-soft` `#f7f5f2`, teks `text`, hover `primary` + teks putih, tinggi 60, radius 10, ikon chat garis. **Jangan** memakai hijau WhatsApp |

## Interactions & Behavior (ringkas — detail di PRD)
- **Quiz satu kesempatan** (§6.3): konfirmasi eksplisit sebelum mulai (7d dialog, 7h), timer dari server, auto-save tiap perubahan, gagal simpan → banner + tombol Kumpulkan dikunci (28c), waktu habis → auto-submit. Kunci jawaban tidak pernah dikirim ke klien.
- **Gerbang akun**: preview materi 1 publik; gerbang daftar muncul *setelah* preview habis (7c). Login di tengah alur memakai modal (2c), konteks halaman tidak hilang.
- **Konsultasi**: nav → smooth scroll (instan bila `prefers-reduced-motion`), `scroll-margin-top` = tinggi header, fokus pindah ke judul section.
- **Gerak**: 160–220ms ease-out; hormati `prefers-reduced-motion` di semua animasi (hero 1a/6a, skeleton 28d).
- **Responsif**: uji di 360 / 768 / 1280 (+1440 untuk Beranda & Masuk). Aturan turunan di 17c dan 16d.
- **State wajib per layar**: tabel PRD §13.5 + checklist 17d. Setiap layar di `SCREENS.md` mencantumkan ID state-nya.

## State Management (garis besar)
- Sesi: member 30 hari, staf 8 jam (AUTH-07).
- Progress materi: status, posisi video (disimpan tiap 10 dtk), status quiz (PRG-01).
- Attempt quiz: satu aktif per user per quiz; refresh melanjutkan attempt yang sama (QZ-08); jawaban lokal ditahan sampai server mengonfirmasi (28c).
- Preferensi player (kecepatan, subtitle) diingat lintas materi (29a).
- Konten CMS: `DRAFT → IN_REVIEW → PUBLISHED → ARCHIVED` (CMS-05), auto-save 20 dtk dengan 4 state simpan (20c).

## Design Tokens
Lihat `TOKENS.md`.

## Assets
| File | Dipakai di |
|---|---|
| `logo-binzi-wordmark.png` | Header publik, member, CMS, email |
| `logo-binzi-mark.png` | Header player & mode fokus, favicon |
| `logo-binzi.png` | Logo lengkap (mark + wordmark) |
| `foto-pundra-face.jpg` | Avatar peninjau (artikel, detail kursus, Tanya Ahli Gizi) |
| `foto-pundra.jpg` | Foto penuh ahli gizi (Tentang Kami, Tanya Ahli Gizi) |

Thumbnail kursus/artikel di desain adalah placeholder bergaris gelap — ganti dengan gambar asli dari media library. Ikon di desain adalah SVG garis 1.6–1.8px; pakai satu library ikon garis yang setara (mis. Lucide) secara konsisten.

## Files
Struktur di repositori kode (v1.3):

| File | Isi |
|---|---|
| `docs/design/handoff/README.md` | File ini — pintu masuk |
| `docs/design/handoff/TOKENS.md` | Warna, tipografi, spasi, radius, bayangan, breakpoint |
| `docs/design/handoff/SCREENS.md` | Daftar layar per route → ID desain → state → requirement PRD |
| `docs/design/handoff/COMPONENTS.md` | Daftar komponen + layar contoh + fase dibangun |
| `docs/design/screens/INDEX.md` | Indeks semua layar; per ID ada `<ID>.png`, `<ID>.md`, `<ID>.html` |
| `docs/design/OPEN-ISSUES.md` | Hal desain yang masih perlu diputuskan |
| `docs/design/source/` | Kanvas desain asli (buka `Binzi Landing Hero.dc.html` di browser). **Jangan dibaca utuh oleh AI agent** |
| `docs/prd/PRD-v1.3.md` · `docs/prd/INDEX.md` | Spesifikasi produk utuh · peta bagian PRD |
| `CLAUDE.md` (root) | Aturan yang dibaca AI di setiap sesi |
| `public/brand/` | Logo & foto ahli gizi |
| Layar `10a` | Peta alur UX (interaktif di kanvas; screenshot di `screens/10a.png`) |
