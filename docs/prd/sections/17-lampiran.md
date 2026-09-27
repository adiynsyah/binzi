> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 17. Lampiran

### 17.1 Ringkasan Biaya

| Komponen | MVP | Setelah rilis publik | Skala (~50k MAU) |
|---|---|---|---|
| Hosting | $0 (Hobby) | $0–20 | $20–50 |
| Database | $0 (Supabase Free) | $0–25 | $25–60 |
| Storage + video | $0 (R2 10 GB) | $0–2 | $5–30 |
| Email | $0 (Resend Free) | $0 | $20 |
| CDN / WAF / Turnstile | $0 (Vercel bawaan + Cloudflare Turnstile) | $0 | $0–20 |
| Analitik & error tracking | $0 | $0 | $0–30 |
| Domain | ~Rp 25rb/bln setara | sama | sama |
| **Total infrastruktur** | **≈ Rp 25rb/bln** | **≈ Rp 25rb – 750rb/bln** | **≈ Rp 1,2–3,5 juta/bln** |

Di luar tabel di atas, ada satu biaya alat kerja yang nyata: **langganan Claude (Pro atau lebih tinggi)** untuk Claude Design dan Claude Code. Ini bukan biaya infrastruktur, tetapi harus masuk anggaran karena seluruh pengembangan bergantung padanya.

*Harga dapat berubah — verifikasi di halaman resmi masing-masing layanan sebelum berkomitmen.*

### 17.2 Pemetaan Permintaan Anda → Solusi

| Permintaan | Terpenuhi di |
|---|---|
| Nav: Beranda, Kursus, Artikel, Konsultasi, Tentang Kami | §7.1 |
| Konsultasi = section di Beranda + tombol WhatsApp langsung; nav scroll ke section | §5, KSL-13 |
| Penjelasan mobile-first | §1 |
| Bisa dibuka di laptop, tablet, HP | §1, §8.7, AC §14.1 |
| ORM Drizzle | §9.2, §9.6, §11 |
| Tanpa Docker | §9.7 |
| Tanpa Redis & BullMQ | §9.1, §10.4, §10.5 |
| Semua stack gratis di awal | §9.2, §9.3, §17.1 |
| Kursus berbayar nanti | `enrollments.access_type` (§11.2) |
| Sertifikat belum masuk MVP | §4.2, digantikan §6.4 "Nilai Saya" |
| 3 kursus, 6 kategori, 6 artikel | §13.2, dengan catatan R-01 |
| Video 3–5 menit @720p | §10.3 — inilah yang memungkinkan stack gratis |
| Ahli gizi sebagai verifikator | `reviewer_id` wajib (ART-01, §6.6) |
| Boleh mengulang kursus | CRS-12, §14.5 |
| Quiz **1 kali kerjakan**, tidak wajib lulus | QZ-11, QZ-12, CRS-08, §6.3 |
| Pembahasan muncul setelah quiz dikerjakan | QZ-10 — selalu, apa pun nilainya |
| Tujuan quiz = user mengetahui nilainya | §6.4 PRG-04, halaman "Nilai Saya" |
| Dikerjakan penuh dengan AI (desain UI/UX & kode) | §12.6 checklist keamanan, §13.3 tim, §13.4 model eksekusi, §13.5 panduan desain |
| Belum perlu bahasa Inggris | §4.2 |
| 1 kursus banyak materi | CRS-02 |
| Materi = video + teks | CRS-03 |
| Teks bisa gambar, tidak bisa video | CRS-04, CRS-05, §12.3 |
| Quiz min 10 soal, durasi custom, mode ujian | QZ-02, QZ-01, QZ-05 |
| Final Quiz setelah semua materi | CRS-07, QZ-13 |
| 1 artikel tepat 1 kategori | ART-02, §11.4 |
| Login Google + registrasi langsung | AUTH-01, AUTH-02 |
| Artikel tanpa login | ART-04 |
| CMS untuk admin | §3.2, §6.7 |
| Admin upload video | §10.3 |
| Admin tulis bebas + attach gambar | CMS-03 |

### 17.3 Glosarium

| Istilah | Arti |
|---|---|
| **Mobile-first** | Metode desain: mulai dari layar kecil, lalu tambahkan untuk layar besar (§1) |
| **Responsive** | Satu website yang menyesuaikan diri ke semua ukuran layar |
| **Breakpoint** | Lebar layar tempat tata letak berubah |
| **ISR** | Halaman statis yang otomatis diperbarui berkala — cepat sekaligus selalu segar |
| **Presigned URL** | Tautan berbatas waktu untuk mengakses file privat di storage |
| **Egress** | Biaya data keluar dari server ke pengguna. R2 menggratiskannya — ini alasan utama pemilihannya |
| **RBAC** | Pembatasan akses berdasarkan peran |
| **Free tier** | Kuota gratis permanen dari suatu layanan |
| **E-E-A-T** | Kriteria kualitas konten Google — sangat menentukan untuk topik kesehatan |

---

*Dokumen ini adalah baseline v1.0. Tidak ada pertanyaan yang memblokir dimulainya pengembangan. Langkah berikutnya: wireframe untuk empat halaman publik (Beranda — termasuk section Tanya Ahli Gizi, Katalog Kursus, Detail Kursus, Artikel), lalu penyusunan backlog teknis per sprint. Perubahan setelah dokumen ini disetujui dicatat sebagai v1.1, v1.2, dan seterusnya.*

### 17.4 Dokumen Desain & Keputusan yang Diserap (v1.3)

Desain final dibuat di Claude Design dan diekspor sebagai handoff bundle. Di repositori kode, dokumen disusun sebagai berikut:

| Lokasi | Isi |
|---|---|
| `CLAUDE.md` (root) | Aturan yang dibaca AI agent di setiap sesi |
| `docs/prd/` | PRD ini — utuh (`PRD-v1.3.md`) dan dipecah per bagian (`INDEX.md` sebagai pintu masuk) |
| `docs/design/handoff/` | `README.md`, `TOKENS.md`, `COMPONENTS.md`, `SCREENS.md` |
| `docs/design/screens/` | Tiga berkas per ID layar: `<ID>.png` (screenshot), `<ID>.md` (rute, status, copy, pemetaan warna → token), `<ID>.html` (markup hasil render). Indeks: `INDEX.md` |
| `docs/design/OPEN-ISSUES.md` | Hal desain yang masih perlu diputuskan |
| `docs/design/source/` | Kanvas desain asli (`.dc.html`) untuk dibuka di browser |
| `public/brand/` | Logo & foto ahli gizi |

**Pembagian otoritas:** PRD = sumber kebenaran **perilaku**; desain = sumber kebenaran **tampilan**. Semua perbedaan yang diketahui antara PRD v1.2 dan desain final sudah diselesaikan di v1.3:

| Hal | Keputusan final | Referensi |
|---|---|---|
| Nama produk | BINZI | Header, Q29, KSL-04 |
| Tombol WhatsApp | Netral terang, hover primary; bukan hijau | Q30, §5.4 |
| Lebar uji | 360 / 768 / 1280 (+1440 Beranda & Masuk) | Q31, §1, §14 |
| Alur tinjau konten | 18d (18a–18c ditolak) | Q32, §3.2 |
| Hero Beranda | Copy dari 1a; visual ilustrasi 6a (dipasang seperti 6b), bukan kartu video | Q33, Q37, §7.3 |
| Versi Next.js | 16.3.x (Active LTS), minimal 16.3.7 setelah 30 Sep 2026 | Q36, §9.2 |
| Route daftar konten & keputusan terbit | `/cms/konten` (19c, 19d) | §7.2 |
| STR & nomor WhatsApp | Dummy selama desain & pengembangan; asli sebelum rilis | OQ-08, OQ-09, §14.9 |
| DNS & perlindungan edge | Vercel DNS + Vercel Firewall; Cloudflare hanya untuk R2 & Turnstile | Q38, §9.2, §10.1, §12.4 |
| Hosting fase penelitian | Vercel Hobby; keputusan Pro/Workers sebelum rilis publik | OQ-12, §9.4 |
| Konteks penelitian | Tidak ada fitur tambahan; pendaftaran umum; retensi selama akun aktif | Q39, §8.4 |
| Aturan soal quiz (D-06) | Pilihan ganda tepat 4 opsi; benar/salah 2 opsi; pembahasan wajib. Teks "2–5 opsi" di layar 22c tidak berlaku | Q40, QZ-04, §11.4 |
| Fitur S/C CMS & notifikasi | Fase 2 | Q34, §6.7, §6.8 |
| Navigasi | Hamburger < 640, bottom nav < 768 | Q35, §7.1 |
| Player desktop | Daftar materi di kanan | §14.1 |
| Bobot font | Desain menulis 500/600/800; kode memakai bobot Lato yang dirender: 400/700/900 | `TOKENS.md` |
| Ulangi kursus | Membuka lagi semua quiz; nilai siklus lama tetap tersimpan (catatan lama di layar 13b tidak berlaku) | §6.3.3, desain 16a–16b |
| Warna | ±150 kode hex di file desain dipetakan ke token; kode hanya memakai token | `TOKENS.md` |

Jika di kemudian hari ditemukan perbedaan baru: perbarui PRD lebih dulu (naikkan versi), baru kemudian kode.
