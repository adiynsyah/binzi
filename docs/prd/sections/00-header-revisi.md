> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

# PRD — Nutrition & Health Learning Platform
*Baseline dokumen — siap dipakai sebagai acuan pengembangan*

| Field | Value |
|---|---|
| Nama Produk | **BINZI** (nama final; "NutriLearn" di versi sebelumnya hanya working title) |
| Versi Dokumen | **1.3** |
| Tanggal | 27 September 2026 (baseline v1.0: 7 September 2026) |
| Target Platform | Web — desktop, tablet, dan mobile browser (responsive penuh) |
| Prinsip Biaya | **Zero-cost stack** untuk MVP; jalur upgrade berbayar terdefinisi |
| Target Rilis MVP | ~12 minggu sejak kick-off |

**Riwayat revisi**

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 7 Sep 2026 | Baseline |
| 1.3 | 27 Sep 2026 | **Menyerap keputusan desain final (handoff Claude Design BINZI)** sehingga PRD kembali menjadi satu-satunya sumber kebenaran perilaku: nama produk BINZI; tombol WhatsApp netral (bukan hijau); lebar uji desktop 1280 (+1440 untuk Beranda & Masuk); hero memakai ilustrasi animasi; alur tinjau konten 18d; ambang navigasi & bottom nav; daftar materi player di kanan; CMS-13/14/15, NTF-03/04 dipindah ke fase 2; sitemap CMS disesuaikan; status pertanyaan terbuka diperbarui; §17.4 baru (peta dokumen desain); **Next.js 16.3 (Active LTS)**; judul hero dari 1a; route `/cms/konten` final; STR & nomor WhatsApp dummy selama pengembangan; **DNS & perlindungan edge di Vercel** (Cloudflare hanya untuk R2 & Turnstile); Vercel Hobby selama fase penelitian; konteks penelitian dijawab (tanpa alur etik/consent khusus, pendaftaran umum, tanpa ekspor analisis, retensi selama akun aktif); **aturan soal: pilihan ganda tepat 4 opsi, pembahasan wajib**. Keputusan K-15, Q29–Q40. Terdampak: header, §0, §1, §2, §3.2, §5.3, §5.4, §6.7, §6.8, §7.1–7.3, §8.7, §6.3, §8.4, §9.2, §9.4, §10.1, §10.4, §11.2, §11.4, §12.4, §13.1, §15, §13.4, §13.5, §14.1, §14.9, §16, §17 |
| 1.2 | 24 Sep 2026 | **Halaman `/konsultasi` dihapus** — konsultasi menjadi section "Tanya Ahli Gizi" di Beranda; item nav "Konsultasi" melakukan scroll otomatis ke section tersebut (K-10 direvisi, Q28). Terdampak: §3, §4.1, §5, §7.1–7.4, §10.2, §11, §13.1, §13.5, §14.7, §14.9, §15, §16, §17.2 |
| 1.1 | 24 Sep 2026 | **Kategori kursus dihapus** — kategori hanya dipakai untuk artikel (K-14, Q27). Terdampak: CRS-01, SRC-02, CMS-07, §3.2, §4.1, §7.2, §10.4, §11.1, §11.2, §13.5 |

---
