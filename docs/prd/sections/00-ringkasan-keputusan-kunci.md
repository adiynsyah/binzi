> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 0. Ringkasan Keputusan Kunci

Keputusan berikut membentuk seluruh isi dokumen ini. Setiap requirement, pilihan teknologi, dan estimasi di bawah mengalir dari sini. Rincian alasan tiap keputusan ada di §2 (Decision Log).

| # | Keputusan | Dampak terbesarnya |
|---|---|---|
| K-01 | Platform web responsive, **dirancang mobile-first** | Menentukan urutan kerja desain & CSS (§1) |
| K-02 | Kursus **gratis** di MVP; berbayar dipertimbangkan nanti | `enrollments.access_type` dimodelkan sejak awal agar tidak perlu migrasi besar |
| K-03 | **Sertifikat tidak masuk MVP** | Digantikan halaman "Nilai Saya" sebagai bukti hasil belajar (§6.4) |
| K-04 | **Quiz hanya boleh dikerjakan 1 kali, tidak wajib lulus** | Menghilangkan farming nilai dan drop-off sekaligus; mesin quiz jadi sederhana (§6.3) |
| K-05 | Pembahasan **selalu ditampilkan** setelah submit | Aman karena tidak ada percobaan kedua |
| K-06 | Video **3–5 menit @720p** | Kunci yang membuat seluruh stack bisa gratis — tidak perlu transcoding (§10.3) |
| K-07 | **Stack $0/bulan** untuk MVP | Menghapus Docker, Redis, dan BullMQ dari lingkup (§9) |
| K-08 | **Drizzle ORM**, bukan Prisma | Migrasi SQL eksplisit, bundle kecil (§9.6) |
| K-09 | 1 artikel = **tepat 1 kategori**, ditambah tag | `category_id` NOT NULL + tabel tag terpisah (§6.5) |
| K-10 | **Konsultasi = section "Tanya Ahli Gizi" di Beranda + tombol WhatsApp** (tanpa halaman terpisah) | Nol tabel database, nol modul CMS, nol halaman tambahan; nav "Konsultasi" = anchor ke section (§5) |
| K-11 | Konten kesehatan **wajib direview ahli gizi** sebelum publish | `reviewer_id` wajib terisi; kritis untuk kredibilitas & SEO |
| K-12 | Target rilis: **3 kursus, 6 artikel** | Lihat R-01 — saya sarankan 3 kategori × 2 artikel, bukan 6 × 1 |
| K-13 | **Desain UI/UX di Claude Design; kode dengan AI** | Mengubah komposisi tim & urutan pengerjaan; menambah checklist verifikasi wajib (§12.6, §13.4, §13.5) |
| K-14 | **Kursus tidak memiliki kategori**; kategori hanya untuk artikel | Tabel `course_categories` & kolom `courses.category_id` dihapus; katalog kursus difilter berdasarkan level & durasi saja (§6.2, §6.8, §11.2) |
| K-15 | **Desain final dikunci; keputusan desain diserap ke PRD ini (v1.3)** | PRD = sumber kebenaran perilaku, file desain = sumber kebenaran tampilan. Setiap perbedaan yang sudah diketahui telah diselesaikan di dokumen ini, sehingga aturan "jika bertentangan, ikuti PRD" berlaku tanpa pengecualian (§17.4) |
