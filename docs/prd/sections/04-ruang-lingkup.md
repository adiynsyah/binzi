> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 4. Ruang Lingkup

### 4.1 In Scope (MVP)

- Autentikasi: Google SSO + registrasi email/password + verifikasi email + reset password
- **Beranda** (landing page)
- **Kursus**: katalog publik, detail kursus, free preview, player materi (video + teks), quiz bernilai, Final Quiz, progress
- **Artikel**: publik penuh, 6 kategori, tag
- **Konsultasi**: section "Tanya Ahli Gizi" di Beranda + tombol WhatsApp langsung; nav "Konsultasi" scroll ke section ini (lihat §5)
- **Tentang Kami**: kredibilitas, tim, ahli gizi, metodologi konten, disclaimer medis
- **Dashboard user**: Lanjutkan Belajar, Kursus Saya, progress, **Nilai Saya**
- **CMS**: kursus, materi, quiz, artikel, kategori artikel, media, user, audit log
- Pencarian dasar, SEO teknis, analitik, responsive penuh

### 4.2 Out of Scope (MVP)

| Item | Fase |
|---|---|
| Sertifikat penyelesaian | 2 |
| Pembayaran / kursus berbayar | 2 |
| Formulir & pencatatan permintaan konsultasi di database | 2 |
| Booking jadwal konsultasi & chat real-time | 2 |
| Aplikasi mobile native | 3 |
| Forum / komentar | 2 |
| Gamifikasi (badge, streak, leaderboard) | 2 |
| Soal esai / tugas upload | 2 |
| Multi-bahasa | 3 |
| Transcoding video adaptif (HLS) | 2 — saat durasi video bertambah panjang |
| Redis, queue, Docker | 2 — saat skala menuntut |
