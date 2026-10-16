# Isu Desain

Diperbarui 16 Okt 2026 (tinjauan kartu A-15, PRD v1.4). Jika menemukan isu baru, tambahkan baris di tabel "Terbuka", lalu setelah diputuskan catat di PRD (naikkan versi) dan pindahkan ke tabel "Sudah diputuskan".

## Terbuka

| # | Isu | Dibutuhkan pada | Detail |
|---|---|---|---|
| D-07 | Tujuan bottom nav area belajar (8e, 28g, 29b): item Materi · Quiz · Progress berupa teks tanpa tujuan di semua layar, dan di tablet 8t diganti tab berbeda (Dashboard · Kursus Saya · Nilai Saya) | Sebelum kartu S2 (player) | A-14b memasang tujuan **sementara**: Materi → `/belajar`, Quiz → `/belajar/kursus-saya`, Progress → `/belajar/nilai`. Yang perlu diputuskan: tujuan di dalam kursus (materi berjalan, quiz materi, progress kursus `/belajar/{slug}`), perilaku di dashboard, dan apakah tab tablet 8t memakai tujuan yang sama |

## Sudah diputuskan

| # | Isu | Keputusan | Di PRD |
|---|---|---|---|
| D-01 | Judul hero Beranda berbeda antara 1a dan 6b | **Pakai hero 1a** (judul, subjudul, CTA, baris peninjau, statistik). Ilustrasi dari 6a; teks di 6b bukan copy final | Q37, §7.3 |
| D-02 | Route Daftar konten (19c) & Keputusan terbit (19d) | `/cms/konten` | §7.2 |
| D-03 | Nomor STR di desain masih contoh | Tetap dummy selama desain & pengembangan; nomor asli wajib sebelum rilis | OQ-08, §14.9 |
| D-04 | Nomor WhatsApp di desain | Tetap dummy selama desain & pengembangan; nomor asli dimasukkan lewat CMS sebelum rilis | OQ-09, KSL-08, §14.9 |
| D-06 | Aturan soal quiz berbeda antara PRD (2–6 opsi, pembahasan opsional) dan layar 22c (kolom a–d, teks "2–5 opsi", pembahasan wajib) | **Pilihan ganda tepat 4 opsi (a–d); benar/salah 2 opsi; pembahasan wajib.** Teks aturan "2–5 opsi" di layar 22c harus ditulis ulang saat implementasi menjadi "Tipe pg butuh tepat 4 opsi (a–d)" | Q40, QZ-04, §11.4 |
| D-05 | Kartu hero di screenshot `1a.png` tampak bertumpuk | Artefak screenshot animasi; kartu sudah diganti ilustrasi. Tidak perlu tindakan | — |
| D-08 | Isi header berbeda antar-layar: 1a (Beranda, "Tentang Kami", "Daftar"), 7a (tanpa Beranda, "Daftar Gratis"), 1t (tanpa Beranda & Daftar), header member 8a/13a/8t tanpa Tentang | ≥ 1024: Beranda · Kursus · Artikel · Konsultasi · Tentang Kami · Cari · Masuk (ghost) · Daftar Gratis. 640–1023: tanpa Beranda & Daftar Gratis, label "Tentang", Masuk tombol gelap (1t). Member: Belajar menggantikan Beranda, **Tentang tetap ada** (PRD). Logo header = wordmark saja | Q41, §7.1 (v1.4). Kartu A-14a, A-14b |
| D-09 | Header ponsel member (13d) hanya logo + avatar, tanpa jalan ke Kursus/Artikel/Konsultasi; PRD §7.1 hanya menggambar drawer tamu | **Ikuti 13d.** Navigasi utama + Cari dipindah ke drawer akun, di bawah item akun dan di atas Keluar. Menu ponsel tamu (1d) memuat 5 item + Masuk & Daftar Gratis (PRD) | Q41, §7.1 (v1.4). Kartu A-14b |
| D-10 | Sidebar CMS (19a/19b/19c) berisi Artikel · Kursus · Materi · Quiz · Media, Persetujuan (admin), Menunggu persetujuan & Perlu revisi (ahli gizi) — sebagian tanpa rute di PRD v1.3 §7.2, dan §7.2 memakai `/cms/artikel` untuk editor sementara 19c menjadikannya daftar | **Satu daftar per jenis**: `/cms/artikel`, `/cms/kursus`, `/cms/quiz`, `/cms/media`. **`/cms/konten` = antrean status** + keputusan terbit 19d (`/cms/konten/{id}`): "Persetujuan" (ADMIN+), "Menunggu persetujuan" & "Perlu revisi" (ahli gizi, kontennya sendiri). **Menu Materi disembunyikan** (tidak ada layar daftar materi) | Q42, §7.2 (v1.4). Kartu A-15 |
| D-11 | Sidebar admin 19b menampilkan Audit log, padahal PRD §3.2 dan catatan 27a/27c menjadikannya milik Super admin | **Hanya SUPER_ADMIN.** Menu Audit log tidak tampil untuk Admin | Q43, §3.2 (v1.4). Kartu A-15 |
