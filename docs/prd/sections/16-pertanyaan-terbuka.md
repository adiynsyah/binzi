> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 16. Pertanyaan Terbuka

Semua keputusan yang memblokir sudah tertutup. Status di bawah diperbarui pada v1.3 berdasarkan desain final. **"Diasumsikan"** berarti desain sudah memakai nilai rekomendasi dan pengembangan boleh berjalan dengan nilai itu, tetapi masih perlu konfirmasi eksplisit Anda.

| # | Pertanyaan | Dibutuhkan pada | Rekomendasi | Status v1.3 |
|---|---|---|---|---|
| OQ-01 | Setuju mengubah 6 kategori × 1 artikel menjadi 3 kategori × 2 artikel? | Minggu 1 (perencanaan konten) | Ya — lihat R-01 | **Terbuka** |
| OQ-02 | Berapa jumlah materi per kursus? | Minggu 1 (penulisan naskah) | 5–8 materi; dokumen ini mengasumsikan 6 | **Terbuka** (desain memakai contoh 6 dan 8 materi) |
| OQ-03 | Apakah bulk import soal CSV masuk MVP? | Sprint S3 | Ya | **Terjawab: Ya** — QZ-15 berprioritas M dan sudah didesain (22c) |
| OQ-04 | Apakah Final Quiz juga hanya 1 kesempatan? | Sprint S3 | Ya, demi konsistensi | **Terjawab: Ya** — desain 7h memakai dialog konfirmasi satu kesempatan |
| OQ-05 | Apakah mengulang kursus memberi kesempatan quiz baru? | Sprint S5 | Ya (§6.3.3) | **Terjawab: Ya** — desain 16a–16b, nilai siklus lama tetap tersimpan |
| OQ-06 | Berapa jumlah soal Final Quiz? | Sprint S3 | 20 soal, mencakup seluruh materi | **Diasumsikan: 20 soal** (dipakai di desain) |
| OQ-07 | Nilai lulus 70% atau 60%? | Sprint S3 | Mulai 70%; kalibrasi setelah 4 minggu data | **Diasumsikan: 70** (dipakai di desain). Simpan sebagai konfigurasi, bukan konstanta |
| OQ-08 | Nama & kredensial ahli gizi yang ditampilkan | Sebelum rilis | Diperlukan untuk Tentang Kami & Tanya Ahli Gizi | **Diputuskan untuk pengembangan**: nama & gelar dari desain (Pundra Dara Avindharin, S.Tr.Gz, M.K.M); **nomor STR memakai dummy** selama desain & pengembangan. STR asli wajib sebelum rilis (§14.9) |
| OQ-09 | Nomor WhatsApp untuk section Tanya Ahli Gizi | Sebelum rilis | WhatsApp Business dengan nomor khusus | **Diputuskan untuk pengembangan**: memakai **nomor dummy** di `system_settings` (KSL-08). Nomor asli dimasukkan lewat CMS sebelum rilis (§14.9) — tanpa deploy ulang |
| OQ-10 | Jam operasional & SLA balasan konsultasi | Sprint S6 | Cantumkan eksplisit | **Terjawab oleh desain**: Senin–Jumat 09.00–17.00 WIB, dibalas 1×24 jam kerja |
| OQ-11 | Apakah tanya jawab via WhatsApp gratis atau berbayar? | Sprint S6 | Gratis di MVP | **Terjawab oleh desain: gratis**, tanpa perlu mendaftar |
| OQ-12 | Hosting saat rilis: Vercel Pro ($20/bln) atau Cloudflare Workers (gratis)? | Sebelum rilis publik | Vercel Pro bila anggaran ada; Cloudflare bila harus $0 (§9.4) | **Sebagian**: selama fase penelitian memakai **Vercel Hobby**. Keputusan akhir sebelum rilis publik, atau lebih awal bila Usage Vercel melewati ±70% (§9.4) |
| OQ-13 | Siapa yang menjalankan checklist verifikasi §12.6 jika Product Owner berhalangan? | Sebelum Sprint S3 | Idealnya ada satu orang cadangan | **Terbuka** |
| OQ-14 | Next.js 15 (sesuai §9.2 v1.2) atau versi major terbaru? | Fase 0 | Kunci sekali di `CLAUDE.md` dan `package.json` | **Terjawab: Next.js 16.3.x** (Q36) |
| OQ-15 | BINZI dipakai untuk **penelitian ahli gizi** — apa konsekuensinya bagi produk? | Sebelum peserta pertama mendaftar | Klarifikasi etik, data, pendaftaran, retensi | **Terjawab (Q39)**: tanpa alur etik/consent khusus; tidak ada ekspor analisis; pendaftaran umum; tidak dianonimkan, disimpan selama akun aktif (§8.4) |
