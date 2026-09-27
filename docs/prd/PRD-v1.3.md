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

## 1. Penjelasan: Apa Itu "Mobile First"?

Anda bertanya soal ini, dan pertanyaannya bagus karena istilah ini sering disalahpahami.

**Mobile-first bukan berarti "hanya untuk HP".** Itu adalah **urutan cara mendesain dan menulis kode**, bukan batasan platform. Hasil akhirnya persis seperti yang Anda inginkan: satu website yang bisa dibuka di laptop, tablet, maupun HP.

**Dua pendekatan untuk membuat website responsive:**

| | Desktop-first (cara lama) | Mobile-first (rekomendasi) |
|---|---|---|
| Cara kerja | Desain untuk layar besar dulu, lalu "dipaksa muat" ke layar kecil | Desain untuk layar kecil dulu, lalu *ditambahkan* ruang saat layar membesar |
| CSS | `@media (max-width: 768px)` — menimpa gaya desktop | `@media (min-width: 768px)` — menambah gaya di atas dasar mobile |
| Masalah umum | Tampilan HP terasa "sisa" — elemen dipaksa mengecil, banyak yang tersembunyi, halaman berat karena aset desktop tetap dimuat | Tampilan HP terasa dirancang khusus; desktop mendapat ruang lebih |
| Performa di HP | Buruk — browser HP tetap mengunduh aset desktop | Baik — aset besar hanya dimuat saat layar besar |

**Contoh konkret di platform Anda — halaman detail kursus:**

```
Layar HP (360–767px)      → 1 kolom. Video di atas, daftar materi
                             sebagai accordion di bawah. Menu = hamburger.

Layar tablet (768–1023px) → 2 kolom. Konten utama + sidebar sempit.
                             Menu mulai terlihat sebagian.

Layar laptop (≥1024px)    → Sidebar daftar materi menempel di kiri (sticky),
                             konten di kanan. Navigasi penuh terlihat.
```

Dengan mobile-first, kita menulis tampilan HP sebagai dasar, lalu menambahkan sidebar di breakpoint tablet & laptop. Dengan desktop-first, kita akan menulis sidebar dulu lalu menyembunyikannya di HP — dan kode CSS-nya menjadi berlapis-lapis serta rawan bug.

**Kesimpulan praktis untuk Anda:** yang Anda minta ("bisa dibuka di laptop dan juga support penuh di tablet & HP") **sama persis** dengan yang saya rekomendasikan. Mobile-first hanyalah metode untuk mencapainya dengan hasil lebih baik. Tidak ada fitur desktop yang dikorbankan.

**Breakpoint resmi proyek:**

| Nama | Lebar | Perangkat acuan |
|---|---|---|
| `base` | 360px+ | HP kecil (dasar, tanpa media query) |
| `sm` | 640px+ | HP besar / landscape |
| `md` | 768px+ | Tablet portrait |
| `lg` | 1024px+ | Tablet landscape / laptop kecil |
| `xl` | 1280px+ | Laptop / desktop |
| `2xl` | 1536px+ | Monitor besar |

Setiap halaman **wajib** diuji pada minimal 3 lebar: **360px, 768px, dan 1280px** sebelum dianggap selesai. Beranda dan Masuk juga diuji di **1440px**. Lebar isi maksimum **1200px** berlaku di semua lebar desktop. (v1.3: desain final digambar di 1280, bukan 1440.)

---

## 2. Decision Log

| # | Pertanyaan | Keputusan | Konsekuensi teknis |
|---|---|---|---|
| Q1 | Kursus berbayar? | **Nanti, tidak sekarang** | `enrollments.access_type` tetap dimodelkan; tidak ada integrasi pembayaran di MVP |
| Q2 | Sertifikat di MVP? | **Tidak** | Tabel `certificates`, job PDF, dan halaman verifikasi dihapus dari MVP. Digantikan halaman **Nilai Saya** |
| Q3 | Konten saat rilis | **3 kursus, 6 kategori, 6 artikel (1 per kategori)** | Lihat risiko R-01 |
| Q4 | Durasi & kualitas video | **3–5 menit, minimal 720p** | Tidak perlu transcoding; MP4 langsung dari R2 sudah memadai — ini yang membuat stack gratis jadi mungkin |
| Q5 | Aplikasi mobile 12 bulan? | **Belum** | Server Actions boleh dipakai bebas; tidak perlu disiplin REST API penuh. Struktur modular tetap dijaga |
| Q6 | Verifikator akurasi konten | **Ahli gizi** | Field `reviewer_id` + `reviewed_at` wajib sebelum publish |
| Q7 | Ulang kursus setelah selesai? | **Boleh** | Progress dapat di-reset; riwayat attempt & nilai lama **tetap disimpan** |
| Q8 | Quiz wajib lulus? | **Tidak wajib lulus, tetapi hanya boleh dikerjakan 1 kali.** Materi berikutnya terbuka setelah quiz dikerjakan, apa pun nilainya | Quiz murni menjadi *alat ukur*. Satu percobaan membuat nilai kredibel tanpa gerbang. Lihat §6.3 |
| Q9 | Bahasa Inggris? | **Belum** | Bahasa Indonesia saja; string tetap dipisah ke file agar siap |
| Q10 | Akun dihapus tapi punya sertifikat | **Tidak relevan** (tidak ada sertifikat) | Penghapusan akun cukup anonimkan data + hapus progress |
| Q26 | Bagaimana model pengerjaan? | **Desain UI/UX di Claude Design, kode dengan AI**, diarahkan & diverifikasi 1 orang | Peran Designer/Engineer/QA ditiadakan; verifikasi manusia jadi jalur kritis. Keputusan UX utama sudah dikunci di dokumen ini agar AI cukup mengeksekusi (§13.4, §13.5) |
| Q27 | Apakah kursus perlu kategori? | **Tidak.** Kategori hanya dibutuhkan untuk artikel | Tabel `course_categories` dan `courses.category_id` dihapus; filter kategori di katalog kursus dan CRUD kategori kursus di CMS ditiadakan. Dengan 3 kursus saat rilis, kategori kursus tidak menambah nilai navigasi |
| Q11 | Apa isi fitur Konsultasi? | **Ajakan menghubungi ahli gizi + tombol WhatsApp yang langsung membuka chat ke nomor terdaftar** | Tidak ada tabel database, tidak ada formulir, tidak ada modul CMS. Hemat ~3 hari kerja. Lihat §5 |
| Q28 | Apakah Konsultasi perlu halaman sendiri? | **Tidak.** Cukup section "Tanya Ahli Gizi" di Beranda; klik nav "Konsultasi" melakukan scroll otomatis ke section tersebut | Route `/konsultasi` dihapus; satu layar publik berkurang. Seluruh requirement KSL dipenuhi di dalam section Beranda (§5.4) |
| Q29 | Nama produk? | **BINZI** | Seluruh copy, template pesan WhatsApp (KSL-04), email, dan metadata SEO memakai BINZI |
| Q30 | Warna tombol WhatsApp? | **Netral terang, bukan hijau WhatsApp** (keputusan pemilik produk, desain 1a/1d) | Latar `fill-soft`, teks `text`, hover `primary` + teks putih, tinggi 60px, radius 10px, ikon chat bergaris (§5.4) |
| Q31 | Lebar uji desktop? | **1280px**; Beranda & Masuk juga 1440px | Desain final digambar di 1280; lebar isi maks 1200px (§1) |
| Q32 | Alur tinjau konten? | **Opsi 18d**: ahli gizi (EDITOR) menggarap konten di CMS; ADMIN menyetujui & menerbitkan | Opsi 18a–18c ditolak. Selaras dengan CMS-05 (§3.2) |
| Q33 | Visual hero Beranda? | **Ilustrasi animasi (desain 6a, dipasang seperti 6b)**, bukan kartu preview video. Copy hero tetap dari 1a (Q37) | Hormati `prefers-reduced-motion`; ilustrasi diekspor sebagai aset/komponen tersendiri, warnanya bukan token (§7.3) |
| Q34 | Fitur Should/Could CMS & notifikasi di MVP? | **Tidak.** CMS-13, CMS-14, CMS-15, NTF-03, NTF-04 pindah ke fase 2 | Menu "Terjadwal" di sidebar CMS disembunyikan; `/cms/analitik` tidak dibuat (§6.7, §6.8, §7.2) |
| Q35 | Navigasi responsif? | Hamburger + drawer di **< 640px**; menu teks mulai 640px; bottom nav area belajar di **< 768px** | Mengikuti token breakpoint desain (§7.1) |
| Q36 | Versi Next.js? | **Next.js 16.3.x** (Active LTS) | Dipilih karena berstatus Active LTS, didukung adapter Cloudflare (menjaga opsi OQ-12), dan menyediakan dokumentasi yang cocok dengan versi terpasang untuk coding agent. Konsekuensi untuk AI: pola Next.js 15 (mis. `middleware.ts`) tidak dipakai — aturan versi ada di `CLAUDE.md` |
| Q37 | Judul hero Beranda (1a vs 6b)? | **Pakai hero 1a** — judul, subjudul, CTA, dan baris peninjau dari 1a; visualnya ilustrasi 6a | Teks di layar 6b hanya contoh pemasangan ilustrasi, bukan copy final (§7.3) |
| Q38 | DNS & perlindungan edge? | **Vercel DNS + Vercel Firewall.** Cloudflare hanya dipakai untuk R2 dan Turnstile | Vercel tidak merekomendasikan reverse proxy (termasuk proxy Cloudflare) di depan deployment Vercel karena firewall kehilangan visibilitas trafik dan IP asli pengguna. R2 diakses lewat presigned URL sehingga tidak butuh domain di Cloudflare. Jika OQ-12 memilih Cloudflare Workers, DNS dipindah ke Cloudflare saat itu (bisa tanpa downtime) |
| Q39 | BINZI dipakai untuk penelitian ahli gizi — apa dampaknya ke produk? | **Tidak ada fitur tambahan.** Tanpa persetujuan komisi etik/informed consent khusus; pendaftaran **terbuka untuk umum**; **tidak ada** kebutuhan ekspor data untuk analisis; data **tidak dianonimkan** dan **disimpan selama akun aktif** | Alur daftar, skema, dan CMS tetap seperti rencana. Hak pengguna menghapus akun (AUTH-09, UU PDP) tetap berlaku — lihat §8.4 |
| Q40 | Aturan soal quiz (D-06)? | **Pilihan ganda: tepat 4 opsi (a–d), tepat 1 benar. Benar/salah: 2 opsi tetap. Pembahasan wajib untuk setiap soal** | Menggantikan QZ-04 v1.2 (2–6 opsi, pembahasan opsional). Selaras dengan kolom impor CSV di desain 22c (`opsi_a`…`opsi_d`); teks aturan "2–5 opsi" di layar 22c tidak berlaku. Pembahasan wajib konsisten dengan K-05 (pembahasan selalu ditampilkan) |

---

## 3. Persona & Role

### 3.1 Persona

**P1 — Rina, 29 th, karyawan kantoran (utama).** Menemukan artikel dari Google di HP. Koneksi 4G, kuota terbatas. Butuh halaman ringan dan bisa dilanjutkan nanti.

**P2 — Dimas, 22 th, mahasiswa gizi.** Belajar di laptop, sesi panjang. Peduli pada nilai quiz dan akurasi materi.

**P3 — Sari, 45 th, ibu rumah tangga.** Awam teknologi. Login pakai Google karena tidak mau mengingat password. Tertarik pada fitur Konsultasi.

**P4 — Admin Konten.** Non-developer. Menyusun kursus, unggah video pendek, tulis materi, buat 10 soal per materi.

**P5 — Ahli Gizi (Reviewer/Konsultan).** Memverifikasi akurasi konten dan menerima pertanyaan pengguna langsung lewat WhatsApp.

### 3.2 Role & Hak Akses

| Role | Akses |
|---|---|
| `GUEST` | Beranda, katalog kursus (outline terkunci), materi preview gratis, semua artikel, section Tanya Ahli Gizi di Beranda, Tentang Kami |
| `MEMBER` | + konsumsi materi, quiz, progress, Nilai Saya, profil |
| `EDITOR` | + CMS dalam status Draft, submit for review. Dipakai oleh **ahli gizi** yang menggarap konten (alur 18d) |
| `ADMIN` | + menyetujui & publish/unpublish, kelola kategori artikel, kelola user, reset attempt quiz |
| `SUPER_ADMIN` | + kelola role, pengaturan sistem, audit log |

> Rekomendasi: pisahkan `EDITOR` dan `ADMIN`. Untuk MVP Anda cukup membuat 1 akun ADMIN dan 1 akun EDITOR (untuk ahli gizi). Biayanya nol sekarang, mahal kalau ditambahkan belakangan.

---

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

---

## 5. Fitur Konsultasi (ruang lingkup final)

### 5.1 Keputusan

Konsultasi adalah **section "Tanya Ahli Gizi" di Beranda** (bukan halaman terpisah) berisi ajakan menghubungi ahli gizi, dengan tombol WhatsApp yang langsung membuka percakapan ke nomor terdaftar. Item nav "Konsultasi" melakukan **scroll otomatis** ke section ini. **Tidak ada halaman `/konsultasi`, tidak ada formulir, tidak ada penyimpanan data, tidak ada modul CMS.**

Ini lebih sederhana dari opsi yang saya usulkan sebelumnya, dan menurut saya pilihan yang tepat untuk MVP. Tiga alasannya:

1. **Anda tidak membangun apa pun yang belum terbukti dibutuhkan.** Jika ternyata hanya 3 orang per bulan yang menghubungi, Anda tidak rugi waktu membangun sistem tiket.
2. **WhatsApp adalah kanal yang paling dikenal pengguna Indonesia.** Tidak ada friksi belajar antarmuka baru.
3. **Beban kepatuhan data turun drastis.** Karena keluhan kesehatan tidak pernah masuk ke database Anda, kewajiban UU PDP untuk kategori data ini praktis hilang — percakapan terjadi di WhatsApp, di luar sistem Anda.

Penghematan: **± 3 hari kerja** dibanding opsi formulir, dan satu tabel database serta satu modul CMS tidak perlu dibangun.

### 5.2 Yang Perlu Diperhatikan (dan cara menanganinya)

| Konsekuensi | Mitigasi |
|---|---|
| **Tidak ada catatan permintaan.** Anda tidak bisa tahu berapa banyak orang yang butuh konsultasi | Lacak klik tombol WhatsApp sebagai event analitik (KSL-06). Angka klik = ukuran permintaan, tanpa menyimpan data pribadi apa pun |
| **Nomor WhatsApp terekspos publik** → berpotensi spam | Gunakan **WhatsApp Business** dengan nomor khusus, bukan nomor pribadi ahli gizi. Jangan tulis nomornya sebagai teks di halaman — cukup tombol dengan tautan `wa.me` |
| **Percakapan tidak terhubung ke riwayat belajar user** | Pesan otomatis (`?text=`) dapat menyertakan konteks halaman asal, sehingga ahli gizi tahu dari mana user datang |
| **Tidak ada antrian atau SLA** | Cantumkan jam operasional & estimasi waktu balas di halaman, agar ekspektasi terkendali |
| **Ahli gizi menerima pesan tanpa penyaringan apa pun** | Pesan otomatis diawali template yang mengarahkan user menuliskan pertanyaan secara terstruktur |

### 5.3 Requirement

| ID | Requirement | Prio |
|---|---|---|
| KSL-01 | Section **"Tanya Ahli Gizi"** di Beranda dengan anchor `id="tanya-ahli-gizi"`, publik **tanpa perlu login**: penjelasan layanan, cakupan yang dilayani, apa yang **tidak** dilayani, jam operasional, estimasi waktu balas, biaya (gratis/berbayar). **Tidak ada halaman `/konsultasi` terpisah** | M |
| KSL-13 | Item nav "Konsultasi" (desktop & drawer mobile) menautkan ke `/#tanya-ahli-gizi`. Di Beranda: smooth scroll ke section (instan bila `prefers-reduced-motion`). Dari halaman lain: pindah ke Beranda lalu langsung ke section. Drawer mobile tertutup otomatis setelah diklik | M |
| KSL-14 | Section memakai `scroll-margin-top` setinggi header sticky, sehingga judul section tidak tertutup header setelah scroll | M |
| KSL-15 | Fokus keyboard dipindahkan ke judul section setelah scroll (aksesibilitas) | S |
| KSL-02 | **Profil ahli gizi** (ringkas, di dalam section): foto, nama, kredensial, nomor STR, pengalaman singkat. Profil lengkap tetap di Tentang Kami (ABT-02) | M |
| KSL-03 | **Tombol WhatsApp** dengan tautan `https://wa.me/62xxxxxxxxxx?text={pesan-template}`. Membuka aplikasi WhatsApp di HP, WhatsApp Web di desktop | M |
| KSL-04 | Pesan template otomatis, contoh: `Halo, saya {kosong} dan ingin bertanya seputar gizi. Saya menemukan halaman ini dari BINZI.` | M |
| KSL-05 | **Disclaimer medis menonjol** di atas tombol: layanan bersifat edukasi gizi, bukan diagnosis medis, bukan untuk kondisi darurat | M |
| KSL-06 | Event analitik `consultation_whatsapp_clicked` dengan properti status login. Ditambah event `consultation_nav_clicked` saat item nav "Konsultasi" diklik, dengan properti halaman asal — untuk membedakan user yang sengaja mencari konsultasi dari yang menemukannya saat menggulir Beranda | M |
| KSL-07 | **Jalur darurat**: teks jelas "Untuk kondisi darurat, segera hubungi 119 atau fasilitas kesehatan terdekat" | M |
| KSL-08 | Nomor WhatsApp disimpan di `system_settings` (bukan hardcode), agar dapat diganti tanpa deploy ulang | M |
| KSL-09 | Pertanyaan umum seputar konsultasi (apa yang bisa ditanyakan, berapa lama dibalas, apakah berbayar) digabung ke section **FAQ Beranda** (§7.3 no. 7), bukan FAQ terpisah | S |
| KSL-10 | Fallback email untuk pengguna tanpa WhatsApp | S |
| KSL-11 | Formulir + pencatatan permintaan di CMS | W (fase 2) |
| KSL-12 | Booking slot kalender + reminder | W (fase 2) |

### 5.4 Struktur Section "Tanya Ahli Gizi" di Beranda (`/#tanya-ahli-gizi`)

Karena kini berada di dalam Beranda, section ini harus **ringkas** — cukup untuk membangun kepercayaan dan menegaskan batasan, tanpa membuat Beranda terasa seperti dua halaman yang ditumpuk.

```
1. Judul + subjudul       "Tanya Ahli Gizi Kami"  ← target anchor
                          Satu kalimat menjelaskan apa yang bisa dibantu

2. Profil ahli gizi       Foto, nama, kredensial, nomor STR (ringkas)
                          → ini yang membangun kepercayaan, bukan tombolnya
                          → tautan "Kenali tim kami" ke /tentang

3. Apa yang bisa          3–4 contoh pertanyaan yang cocok
   ditanyakan             (mis. "Bagaimana menyusun menu seimbang untuk keluarga?")

4. Apa yang TIDAK         Daftar batasan yang tegas
   dilayani               (diagnosis, resep obat, interpretasi hasil lab,
                          kondisi darurat)

5. Jam operasional        Mis. Senin-Jumat 09.00-17.00 WIB, balas dalam 1x24 jam

6. DISCLAIMER             Kotak menonjol, berisi juga jalur darurat 119
   + JALUR DARURAT        → wajib berada SEBELUM tombol WhatsApp

7. [Tombol WhatsApp]      Besar (tinggi 60px, radius 10px), latar netral
                          terang `fill-soft`, teks `text`, ikon chat bergaris.
                          Hover: latar `primary` + teks putih.
                          BUKAN hijau WhatsApp (keputusan desain final, Q30)
```

**Tata letak responsif:** di HP (360px) semua elemen satu kolom berurutan seperti di atas. Mulai `lg` (≥1024px), profil ahli gizi dapat diletakkan di kolom kiri dan poin 3–7 di kolom kanan, agar tombol WhatsApp terlihat tanpa menggulir jauh setelah anchor dituju.

**Catatan mobile:** tombol WhatsApp **tidak** dibuat sticky — karena kini berada di Beranda, tombol sticky akan menutupi konten section lain (kursus, artikel) sepanjang halaman. Tombol cukup berada di dalam section; nav "Konsultasi" sudah mengantar user langsung ke sana.

**Integritas URL:** route `/konsultasi` tidak dibuat. Jika pernah dibagikan (mis. di materi promosi), tambahkan redirect 308 `/konsultasi` → `/#tanya-ahli-gizi` di `next.config` (S).

### 5.5 Peringatan Kepatuhan (tetap berlaku)

Meski Anda tidak menyimpan data apa pun, tanggung jawab atas **layanannya** tetap ada:

1. **Konsultasi gizi harus dilakukan oleh Nutrisionis/Dietisien bersertifikat dengan STR aktif.** Tampilkan kredensial dan nomor STR — ini kewajiban sekaligus pembangun kepercayaan.
2. **Jangan pernah memberikan diagnosis, resep obat, atau interpretasi hasil lab** — baik di halaman maupun di percakapan WhatsApp. Batasan ini harus tertulis eksplisit.
3. **Percakapan WhatsApp tetap berisi data kesehatan.** Meski di luar sistem Anda, ahli gizi tetap wajib menjaga kerahasiaannya. Buat panduan internal singkat: jangan bagikan tangkapan layar, jangan gunakan untuk pemasaran, hapus percakapan lama secara berkala.
4. **Sediakan jalur darurat** yang jelas (119).
5. **Tinjau halaman ini ke penasihat hukum sebelum rilis.**

> **Rekomendasi penamaan:** gunakan **"Tanya Ahli Gizi"** sebagai judul section, meski item navigasinya tetap tertulis "Konsultasi". Kata "konsultasi" memunculkan ekspektasi sesi klinis personal; "tanya" menempatkannya sebagai layanan edukatif. Perbedaan ini kecil di layar, tapi material dalam menurunkan paparan risiko Anda.

---

## 6. Requirement Fungsional

Prioritas: **[M]** Must (MVP) · **[S]** Should · **[C]** Could · **[W]** Won't (fase berikutnya).

### 6.1 Autentikasi & Akun

| ID | Requirement | Prio |
|---|---|---|
| AUTH-01 | Registrasi email + password (min 8 karakter, huruf + angka) | M |
| AUTH-02 | Login/registrasi dengan Google OAuth 2.0 | M |
| AUTH-03 | Verifikasi email via magic link (kedaluwarsa 24 jam) | M |
| AUTH-04 | Lupa password & reset (token sekali pakai, 1 jam) | M |
| AUTH-05 | Account linking: email Google sama dengan akun terverifikasi → tautkan, jangan duplikat | M |
| AUTH-06 | Logout; logout semua perangkat | M |
| AUTH-07 | Session: 30 hari (member), 8 jam (admin/editor) | M |
| AUTH-08 | Rate limit login: 5 gagal / 15 menit / IP+email | M |
| AUTH-09 | Profil: nama, foto, ubah password, hapus akun (soft delete → purge 30 hari) | M |
| AUTH-10 | Cloudflare Turnstile di form registrasi & login | M |
| AUTH-11 | 2FA (TOTP) untuk ADMIN & SUPER_ADMIN | S |

### 6.2 Kursus & Materi

| ID | Requirement | Prio |
|---|---|---|
| CRS-01 | Kursus: judul, slug, ringkasan, deskripsi kaya, thumbnail, level, estimasi durasi, status, tanggal publish. **Kursus tidak memiliki kategori** (K-14) | M |
| CRS-02 | Kursus berisi ≥1 materi berurutan (`order_index`). Tabel `sections` disiapkan di skema, UI disembunyikan di MVP | M |
| CRS-03 | Materi: **1 video (opsional, 3–5 menit, ≥720p)** + **konten teks kaya (wajib)** | M |
| CRS-04 | Editor teks mendukung: paragraf, H2–H4, bold/italic/underline, list, blockquote, tabel, link, callout, **gambar (alt text + caption)**, pemisah | M |
| CRS-05 | Editor teks **tidak boleh** menyisipkan video atau iframe apa pun — divalidasi di editor **dan** di server | M |
| CRS-06 | Setiap materi memiliki tepat 1 quiz | M |
| CRS-07 | Setiap kursus memiliki tepat 1 Final Quiz, terbuka setelah semua materi selesai | M |
| CRS-08 | `is_sequential` per kursus (default true) — materi berikutnya terbuka setelah quiz materi sebelumnya **DIKERJAKAN** (lulus atau tidak) | M |
| CRS-09 | Materi pertama dapat ditandai `is_free_preview` — dapat diakses tanpa login | M |
| CRS-10 | Player video: HTML5 native, kontrol kecepatan, fullscreen, resume posisi terakhir, pelacakan progress tiap 10 detik, pilihan subtitle jika tersedia | M |
| CRS-11 | Enrollment gratis sebelum akses materi non-preview | M |
| CRS-12 | **Ulangi kursus**: user yang sudah selesai dapat me-reset progress; riwayat nilai lama tetap tersimpan dan tetap terlihat di Nilai Saya | M |
| CRS-13 | Lampiran materi yang dapat diunduh (PDF) | C |
| CRS-14 | Catatan pribadi per materi | C |

**Definisi "Materi Selesai":**
```
(video_watched_percent >= 90 ATAU lesson.video_id IS NULL)
DAN quiz sudah dikerjakan (1 kali)   ← LULUS ATAU TIDAK, keduanya sah
```
> Quiz **wajib dikerjakan**, tetapi **tidak wajib lulus**. Inilah yang memastikan
> setiap user punya data nilai, tanpa ada satu pun user yang tersangkut.

**Definisi "Kursus Selesai" & "Kursus Lulus":**
```
SELESAI  = SEMUA materi berstatus COMPLETED
           DAN Final Quiz sudah dikerjakan

LULUS    = SELESAI DAN final_quiz.is_passed = true
           → badge "Lulus" tampil di Nilai Saya
           → Nilai Akhir dihitung (§6.4)
           → TIDAK ada sertifikat di MVP
```
> "Lulus" murni sebuah label pencapaian — tidak mengunci atau membuka apa pun.

### 6.3 Quiz & Sistem Penilaian

Model final: **satu quiz, satu kesempatan, nilai tercatat sekali.** Quiz wajib dikerjakan agar materi ditandai selesai, tetapi tidak wajib lulus.

| ID | Requirement | Prio |
|---|---|---|
| QZ-01 | Quiz: judul, instruksi, `duration_minutes` (1–180), `passing_score_percent` (default 70 — hanya penentu label Lulus/Belum Lulus), **`max_attempts` = 1 (dikunci untuk quiz materi)**, `shuffle_questions`, `shuffle_options`, `explanation_policy` (default **`ALWAYS`**) | M |
| QZ-02 | Validasi saat **publish**: soal ≥ `system.quiz.min_questions` (default **10**). Maksimum bebas. Draft boleh kurang dari 10 | M |
| QZ-03 | Tipe soal MVP: pilihan ganda satu jawaban & benar/salah | M |
| QZ-04 | Soal: teks, gambar opsional, bobot poin (default 1), **pembahasan wajib**. Pilihan ganda: **tepat 4 opsi (a–d)**, tepat 1 benar. Benar/salah: 2 opsi tetap (Benar, Salah), tepat 1 benar. (v1.3, Q40) | M |
| QZ-05 | **Mode ujian**: timer dihitung server dari `started_at`; sisa waktu tampil; auto-submit saat habis; menutup tab tidak menghentikan timer | M |
| QZ-06 | Navigator soal: pindah antar soal, tandai ragu-ragu, ringkasan sebelum submit | M |
| QZ-07 | Kunci jawaban **tidak pernah** dikirim ke klien sebelum submit | M |
| QZ-08 | Satu attempt aktif per user per quiz; refresh melanjutkan attempt yang sama | M |
| QZ-09 | Auto-save jawaban setiap perubahan — **kritis**, karena tidak ada kesempatan kedua | M |
| QZ-10 | Hasil setelah submit: skor, persentase, jumlah benar/salah, waktu pengerjaan, status **LULUS / BELUM LULUS**, dan **pembahasan lengkap seluruh soal** — ditampilkan apa pun nilainya | M |
| QZ-11 | **Hanya 1 kali pengerjaan.** Setelah submit, quiz terkunci permanen. Tombol berubah menjadi "Lihat Hasil & Pembahasan" | M |
| QZ-12 | **Nilai resmi = nilai dari satu-satunya percobaan.** Tidak ada nilai tertinggi, tidak ada rata-rata percobaan | M |
| QZ-13 | Final Quiz: terbuka setelah semua materi selesai. Juga **1 kali pengerjaan**. Kelulusannya menentukan badge "Lulus" pada kursus | M |
| QZ-14 | Question bank + ambil acak N dari M soal — mengurangi penyebaran soal antar user | C (fase 2) |
| QZ-15 | Bulk import soal (CSV/XLSX) dengan template & validasi | **M** |
| QZ-16 | Analitik butir soal + peringatan bila pass rate < 40% (indikasi soal salah kalibrasi) | S |
| QZ-17 | Deteksi perpindahan tab (dicatat, tidak memblokir) | C |
| QZ-18 | **Layar konfirmasi wajib sebelum memulai quiz** — lihat §6.3.2 | **M** |
| QZ-19 | **CMS: admin dapat mereset attempt seorang user** (jalur pemulihan) — lihat §6.3.3 | **M** |
| QZ-20 | Setelah dikerjakan, hasil & pembahasan dapat dibuka kembali kapan pun dari "Nilai Saya" | M |
| QZ-21 | Quiz yang belum dikerjakan dapat ditunda; user boleh kembali lain waktu tanpa memulai timer | M |

### 6.3.1 Mengapa Model Ini Bersih

Keputusan ini menyelesaikan sekaligus dua masalah yang saling bertentangan di versi-versi sebelumnya:

| Masalah | Bagaimana terselesaikan |
|---|---|
| **Farming nilai** (mengulang sampai 100%) | Tidak ada pengulangan. Tidak ada yang bisa di-*farming*. Nilai otomatis kredibel |
| **Drop-off karena tersangkut quiz** | Tidak ada gerbang kelulusan. Tidak ada user yang bisa terjebak |
| **Pembahasan bocor jadi kunci jawaban** | Tidak relevan — tidak ada percobaan berikutnya. Pembahasan bisa ditampilkan penuh, selalu |
| **Beban question bank 2× soal** | Tidak dibutuhkan. Beban tetap ~240 soal |
| **Cooldown, batas percobaan, kebijakan pembahasan bersyarat** | Semua kompleksitas ini hilang. Logikanya jadi satu jalur lurus |

Efek sampingnya positif untuk implementasi: mesin quiz menjadi jauh lebih sederhana. Tidak ada state percobaan ke-n, tidak ada perhitungan nilai tertinggi, tidak ada countdown cooldown, tidak ada percabangan tampilan pembahasan.

### 6.3.2 ⚠️ Konsekuensi Terpenting: Satu Kesempatan Berarti Tidak Ada Pengaman

Ini satu-satunya risiko serius dari model ini, dan harus ditangani sejak awal.

Kalau koneksi user putus, baterainya habis, atau dia tidak sengaja membuka quiz lalu meninggalkannya sampai waktu habis, **nilainya terkunci permanen** — mungkin 0 — tanpa cara apa pun untuk memperbaikinya sendiri. Pada model pengulangan tak terbatas, masalah teknis hanyalah gangguan kecil. Di sini, masalah teknis menjadi kerusakan permanen.

Tiga pengaman wajib:

**1. Layar konfirmasi sebelum memulai (QZ-18).** Bukan sekadar tombol "Mulai". Layar terpisah berisi:
```
┌──────────────────────────────────────────────┐
│  Quiz: Dasar Gizi Seimbang                    │
│                                               │
│  • 10 soal                                    │
│  • Waktu 15 menit                             │
│  • ⚠ Hanya dapat dikerjakan SATU KALI         │
│  • Timer berjalan terus meski halaman ditutup │
│  • Nilai akan tercatat permanen               │
│                                               │
│  Pastikan koneksi stabil dan Anda siap.       │
│                                               │
│  [ Nanti Saja ]        [ Mulai Sekarang ]     │
└──────────────────────────────────────────────┘
```
Peringatan bahwa timer terus berjalan adalah bagian terpenting — inilah yang paling sering mengejutkan user.

**2. Auto-save yang andal (QZ-09).** Setiap perubahan jawaban langsung disimpan ke server dengan retry otomatis. Jika koneksi terputus di menit ke-12, 11 menit jawaban yang sudah diisi tetap dinilai. Indikator status penyimpanan harus terlihat user.

**3. Reset attempt oleh admin (QZ-19).** Ini bukan fitur opsional — ini satu-satunya jalan pemulihan yang tersisa. Di CMS, admin dapat mencari user, melihat attempt-nya, dan meresetnya dengan alasan tercatat di audit log. Sediakan juga tautan "Ada kendala teknis? Hubungi kami" di halaman hasil, agar user tahu jalur ini ada.

> Tanpa QZ-19, setiap gangguan teknis akan berakhir menjadi user yang meninggalkan platform tanpa pernah memberi tahu Anda.

### 6.3.3 Interaksi dengan "Ulangi Kursus" (CRS-12)

User boleh mengulang kursus yang sudah selesai. Ini menciptakan pertanyaan: apakah mengulang kursus memberi kesempatan quiz baru?

**Rekomendasi: ya.** Mereset kursus berarti mengulang seluruh materi dari awal — friksinya jauh lebih besar daripada sekadar menekan "ulangi quiz", jadi ini bukan celah farming yang praktis. Justru ini menjadi jalur pemulihan mandiri yang wajar bagi user yang merasa nilainya tidak mencerminkan pemahamannya.

**Aturan pencatatan nilai:**
```
Nilai utama yang ditampilkan  = nilai dari SIKLUS TERAKHIR
Riwayat siklus sebelumnya     = tetap tersimpan & dapat dilihat
Label                          = "Siklus ke-2" dst. bila reset_count > 0
```

> Jika Anda ingin menutup celah ini sepenuhnya, alternatifnya adalah menjadikan nilai siklus pertama sebagai nilai resmi permanen. Menurut saya tidak perlu — tanpa sertifikat, tidak ada yang cukup berharga untuk diperjuangkan lewat mengulang seluruh kursus.

### 6.3.4 Yang Perlu Dipantau

Karena nilai kini hanya berasal dari satu percobaan, kualitas soal jadi jauh lebih menentukan. Soal yang ambigu langsung merusak nilai seseorang secara permanen.

| Sinyal | Ambang | Tindakan |
|---|---|---|
| Pass rate sebuah quiz | < 40% | Soal terlalu sulit atau materinya kurang jelas — tinjau bersama ahli gizi |
| Sebuah butir soal dijawab salah oleh | > 70% user | Kemungkinan besar soalnya ambigu atau kuncinya keliru — periksa |
| User membuka quiz tapi tidak menyelesaikan | > 15% | Layar konfirmasi mungkin terlalu menakutkan, atau durasi terlalu pendek |
| Permintaan reset attempt | > 5% dari attempt | Ada masalah teknis sistemik, bukan sekadar kasus individual |

Kalibrasi ulang soal setelah 4 minggu data pertama. Perbaikan soal **tidak** mengubah nilai yang sudah tercatat — jika sebuah soal terbukti keliru, gunakan reset attempt untuk user yang terdampak.

### 6.4 Progress & Nilai Saya (menggantikan Sertifikat)

| ID | Requirement | Prio |
|---|---|---|
| PRG-01 | Progress materi: `NOT_STARTED` / `IN_PROGRESS` / `COMPLETED`, persen video, posisi terakhir (detik), status quiz | M |
| PRG-02 | Progress kursus: persen selesai, waktu belajar total, terakhir diakses | M |
| PRG-03 | Widget "Lanjutkan Belajar" di dashboard → materi terakhir yang belum selesai | M |
| PRG-04 | **Halaman "Nilai Saya"**: tabel per kursus berisi nilai tiap quiz materi, nilai Final Quiz, **Nilai Akhir kursus**, status Lulus/Belum Lulus, tanggal pengerjaan, dan tautan ke pembahasan | M |
| PRG-05 | Perhitungan **Nilai Akhir Kursus** = **(rata-rata nilai seluruh quiz materi × 60%) + (nilai Final Quiz × 40%)** | M |
| PRG-06 | Badge status kursus: Belum Mulai / Sedang Berjalan / Selesai / **Lulus** | M |
| PRG-10 | Pada daftar materi, tampilkan status per materi: Terkunci / Sedang Dipelajari / **Quiz Belum Dikerjakan** / Selesai, beserta nilainya bila sudah ada | M |
| PRG-07 | Halaman detail progress per kursus dengan daftar materi & status masing-masing | M |
| PRG-08 | Ekspor Nilai Saya ke PDF sederhana (transkrip nilai — bukan sertifikat) | C |
| PRG-09 | Sertifikat | W (fase 2) |

> Bobot 60/40 pada PRG-05 adalah usulan saya dan dapat diubah lewat `system_settings` tanpa perubahan kode.

### 6.5 Artikel & Kategori

| ID | Requirement | Prio |
|---|---|---|
| ART-01 | Artikel: judul, slug, ringkasan, cover, konten kaya, penulis, **reviewer ahli gizi + tanggal review**, waktu baca otomatis, status | M |
| ART-02 | Artikel wajib memiliki **tepat satu** kategori (`category_id` NOT NULL) | M |
| ART-03 | Tag many-to-many untuk discovery silang | S |
| ART-04 | URL `/artikel/{slug-kategori}/{slug-artikel}` — akses tanpa login | M |
| ART-05 | Listing per kategori, terbaru, populer; paginasi | M |
| ART-06 | "Artikel Terkait" + **CTA ke kursus terkait** di akhir artikel | M |
| ART-07 | SEO: meta title/description, canonical, Open Graph, JSON-LD `Article`, sitemap otomatis | M |
| ART-08 | Badge "Ditinjau oleh {nama ahli gizi}, {tanggal}" tampil di artikel | M |
| ART-09 | Berbagi ke WhatsApp / X / Facebook / salin tautan | S |
| ART-10 | Bookmark artikel | C |
| ART-11 | Komentar | W |

**Integritas:** menghapus kategori yang masih punya artikel **ditolak**; sediakan aksi pindah massal.

### 6.6 Halaman Tentang Kami

| ID | Requirement | Prio |
|---|---|---|
| ABT-01 | Profil platform, misi, untuk siapa | M |
| ABT-02 | **Profil ahli gizi & tim reviewer** — nama, foto, kredensial, nomor STR | M |
| ABT-03 | **Metodologi konten**: bagaimana materi disusun, sumber rujukan, proses review | M |
| ABT-04 | **Disclaimer medis** yang menonjol | M |
| ABT-05 | Kontak & formulir kontak umum | M |
| ABT-06 | JSON-LD `Organization` + `Person` untuk sinyal E-E-A-T Google | M |

> Halaman ini bukan sekadar formalitas. Untuk topik kesehatan, Google secara eksplisit menilai kredensial penulis dan transparansi sumber (kategori "Your Money or Your Life"). Halaman Tentang Kami yang kuat berdampak langsung pada peringkat pencarian seluruh artikel Anda.

### 6.7 CMS

| ID | Requirement | Prio |
|---|---|---|
| CMS-01 | Dashboard: jumlah kursus/artikel/user, enrollment terbaru, konten menunggu review | M |
| CMS-02 | Course builder: CRUD kursus + reorder materi drag & drop | M |
| CMS-03 | Lesson editor: judul, upload video (progress bar), editor teks kaya + upload gambar (drag/paste), auto-save 20 detik | M |
| CMS-04 | Quiz builder: tambah/hapus/reorder soal, opsi & jawaban benar, pembahasan, setelan quiz, indikator "X dari 10 soal minimum" | M |
| CMS-05 | Workflow `DRAFT` → `IN_REVIEW` → `PUBLISHED` → `ARCHIVED`; hanya ADMIN+ boleh publish | M |
| CMS-06 | Checklist validasi pra-publish yang eksplisit | M |
| CMS-07 | CRUD artikel, kategori artikel, tag; pindah artikel massal antar kategori. Tidak ada kategori kursus (K-14) | M |
| CMS-08 | Media library: telusuri/cari/hapus, lihat penggunaan aset, cegah hapus aset terpakai | M |
| CMS-09 | Manajemen user: cari, lihat progress & nilai, ubah role, nonaktifkan | M |
| CMS-10 | **Reset attempt quiz seorang user** (QZ-19): cari user → lihat daftar attempt → reset dengan alasan wajib diisi, tercatat di audit log | M |
| CMS-11 | Preview konten sebelum publish | M |
| CMS-12 | Audit log: siapa, apa, kapan, nilai sebelum/sesudah | M |
| CMS-13 | Analitik konten: view, enrollment, completion, distribusi nilai quiz | W (fase 2, Q34) |
| CMS-14 | Versioning konten & restore | W (fase 2, Q34) |
| CMS-15 | Penjadwalan publish — menu "Terjadwal" di sidebar CMS disembunyikan di MVP | W (fase 2, Q34) |

### 6.8 Pencarian & Notifikasi

| ID | Requirement | Prio |
|---|---|---|
| SRC-01 | Pencarian global (kursus + artikel) dengan PostgreSQL full-text search | M |
| SRC-02 | Filter katalog kursus: level, durasi | M |
| SRC-03 | Filter artikel: kategori, tag, terbaru/populer | M |
| NTF-01 | Email transaksional: verifikasi, reset password, selamat datang | M |
| NTF-03 | Email pengingat belajar (tidak aktif 7 hari) | W (fase 2, Q34) |
| NTF-04 | Notifikasi in-app | W (fase 2, Q34) |

---

## 7. Navigasi & Information Architecture

### 7.1 Navigasi Utama (sesuai permintaan Anda)

```
Desktop (≥1024px)
┌────────────────────────────────────────────────────────────────────┐
│ [Logo]   Beranda  Kursus  Artikel  Konsultasi  Tentang Kami        │
│                              └─ scroll ke /#tanya-ahli-gizi        │
│                                        [🔍]  [Masuk] [Daftar]      │
└────────────────────────────────────────────────────────────────────┘

Setelah login, kanan atas berubah menjadi:
                          [🔍]  [Belajar]  [Avatar ▾]
                                            ├ Dashboard
                                            ├ Kursus Saya
                                            ├ Nilai Saya
                                            ├ Profil
                                            └ Keluar

Mobile (<768px)
┌──────────────────────────────┐
│ [☰]      [Logo]        [🔍]  │   → drawer berisi 5 item nav
└──────────────────────────────┘     + tombol Masuk/Daftar
```

**Catatan desain:**
- **"Konsultasi" bukan halaman**, melainkan anchor ke section Beranda (`/#tanya-ahli-gizi`, KSL-13). Karena itu, jangan tampilkan state aktif "Konsultasi" di nav hanya karena user berada di Beranda — state aktif Beranda tetap yang menyala.
- Nav CMS **terpisah total** dari nav publik (layout berbeda, sidebar kiri). Admin masuk lewat `/cms`, bukan lewat nav publik.
- Di bawah 768px, area belajar (`/belajar/*`) memakai **bottom navigation**: Materi · Quiz · Progress (desain 8e, 28g, 29b). Jempol lebih mudah menjangkau bawah layar, dan area belajar adalah tempat user menghabiskan waktu terlama.
- **Ambang responsif (v1.3, mengikuti desain):** hamburger + drawer di **< 640px**; menu teks mulai 640px (tablet: avatar tanpa nama); tata letak desktop penuh mulai 1024px. Diagram "Mobile (<768px)" di atas dibaca sebagai < 640px.
- **Header member:** setelah login, item "Belajar" menggantikan "Beranda", ditambah avatar + menu akun (desain 8a, 13a).
- **Header mode fokus** di player & quiz: logo mark + judul kursus + progress, tanpa nav utama (desain 7d, 29a).

### 7.2 Sitemap

```
PUBLIK
├── /                                Beranda (termasuk section #tanya-ahli-gizi = Konsultasi)
├── /kursus                          Katalog (filter, cari)
├── /kursus/{slug}                   Detail — outline penuh (terkunci) + free preview
├── /kursus/{slug}/preview/{materi}  Materi preview gratis
├── /artikel                         Semua artikel
├── /artikel/{kategori}              Artikel per kategori
├── /artikel/{kategori}/{slug}       Detail artikel
├── /tentang                         Tentang Kami, tim, ahli gizi, metodologi
├── /cari                            Hasil pencarian
├── /kebijakan-privasi, /syarat-ketentuan, /disclaimer
└── /masuk, /daftar, /lupa-password

MEMBER
├── /belajar                         Dashboard — Lanjutkan Belajar, statistik
├── /belajar/kursus-saya             Kursus yang diikuti
├── /belajar/nilai                   ★ Nilai Saya (gradebook)
├── /belajar/{slug}                  Ringkasan progress kursus
├── /belajar/{slug}/{materi}         Player materi
├── /belajar/{slug}/{materi}/quiz    Quiz materi
├── /belajar/{slug}/final-quiz       Final Quiz
└── /profil                          Profil & pengaturan

CMS (EDITOR / ADMIN) — sidebar sesuai peran; menu tanpa hak akses tidak ditampilkan
├── /cms                             Ringkasan (versi admin 19b, versi ahli gizi 19a)
├── /cms/konten                      Daftar konten + keputusan terbit (19c, 19d)*
├── /cms/artikel                     Editor artikel (20a)
├── /cms/kursus[/{id}/materi/{id}]   Builder kursus & editor materi + quiz (21a–22h)
├── /cms/kategori                    Kategori & tag artikel (23a)
├── /cms/media                       Media library (24a)
├── /cms/pengguna                    Manajemen user (ADMIN+) (25a)
├── /cms/reset-attempt               Reset attempt quiz (ADMIN+) (26a)
├── /cms/pengaturan                  Pengaturan sistem (SUPER_ADMIN) (27a)
└── /cms/audit-log                   Audit log (27c)

* Route /cms/konten final (v1.3); desain tidak menetapkan URL untuk 19c/19d.
  /cms/analitik tidak dibuat di MVP (CMS-13 → fase 2).
```

### 7.3 Struktur Beranda

1. **Hero** — proposisi nilai + CTA ganda ("Mulai Belajar Gratis" / "Baca Artikel"). **Copy hero dari layar 1a** (judul "Belajar gizi dari penjelasan yang benar", subjudul, CTA, baris peninjau ahli gizi, statistik) — Q37. Visual hero berupa **ilustrasi animasi** (desain 6a, dipasang seperti 6b), bukan kartu preview video; animasi mati bila `prefers-reduced-motion` (Q33)
2. **Kursus Unggulan** — 3 kartu (sesuai jumlah kursus saat rilis): thumbnail, judul, level, jumlah materi, durasi, badge "Preview Gratis"
3. **Cara Kerjanya** — 3 langkah: Pilih Kursus → Belajar & Kerjakan Quiz → Pantau Nilai & Progress
4. **Artikel Terbaru** — 6 artikel dari 6 kategori (menampilkan keluasan topik meski jumlahnya sedikit)
5. **Tanya Ahli Gizi** (`id="tanya-ahli-gizi"`) — **section konsultasi lengkap**, target scroll dari nav "Konsultasi". Struktur & requirement: §5.3–5.4
6. **Kredibilitas** — metodologi konten, sumber rujukan
7. **FAQ** dengan JSON-LD `FAQPage` — termasuk pertanyaan seputar konsultasi (KSL-09)
8. **CTA penutup** + footer navigasi lengkap

> Catatan: dengan hanya 6 artikel, bagian "Artikel Terbaru" akan menampilkan seluruh artikel Anda. Ini justru bagus di awal — tampilkan 6 kartu penuh agar halaman tidak terasa kosong, dan ubah menjadi carousel/rotasi begitu jumlahnya bertambah.

### 7.4 Alur Kritis

**A. Guest → Member:**
```
Google → Artikel → CTA "Pelajari lebih dalam di Kursus X"
→ Detail kursus (outline terlihat, materi 1 gratis) → tonton preview
→ Klik materi 2 → MODAL login (bukan halaman terpisah) → Google 1-klik
→ Kembali ke materi 2, auto-enroll → belajar
```

**B. Alur belajar:**
```
Dashboard → Lanjutkan Belajar → Player materi
→ Tonton video (progress tiap 10 dtk) + baca teks
→ Tombol "Kerjakan Quiz" aktif setelah video ≥90%
→ LAYAR KONFIRMASI: "10 soal · 15 menit · hanya SATU kali kesempatan"
   │
   ├─ [Nanti Saja] → kembali ke materi, timer TIDAK dimulai
   │
   └─ [Mulai Sekarang] → Quiz (timer server, auto-save tiap jawaban)
       → Submit (atau auto-submit saat waktu habis)
       → Hasil: nilai + status Lulus/Belum Lulus
                + PEMBAHASAN LENGKAP semua soal (apa pun nilainya)
       → Quiz terkunci permanen; tombol jadi "Lihat Hasil & Pembahasan"
       → Materi ditandai SELESAI, materi berikutnya terbuka
       → Nilai tercatat di "Nilai Saya"

→ Semua materi selesai → Final Quiz terbuka (juga 1 kesempatan)
→ Kursus berstatus SELESAI; badge "Lulus" bila Final Quiz lulus
```

> Catatan UX: layar konfirmasi adalah elemen paling penting di alur ini. Tanpanya, user akan membuka quiz karena penasaran, lalu kehilangan kesempatannya tanpa pernah menjawab satu soal pun.

**C. Alur konsultasi:**
```
Nav "Konsultasi" (dari halaman mana pun)
→ event consultation_nav_clicked terkirim
→ Beranda, scroll otomatis ke section "Tanya Ahli Gizi"
  (profil ahli gizi + batasan + disclaimer + 119)
→ Klik tombol WhatsApp (tanpa perlu login)
→ Event analitik consultation_whatsapp_clicked terkirim
→ WhatsApp terbuka dengan pesan template terisi
→ Percakapan berlanjut di WhatsApp, di luar sistem
```
Tidak ada data yang disimpan di database. Ukuran keberhasilan fitur ini adalah **jumlah klik tombol**, bukan jumlah baris di tabel.

---

## 8. Requirement Non-Fungsional

### 8.1 Performa

| Metrik | Target (p75, mobile 4G) |
|---|---|
| LCP | < 2,5 s |
| INP | < 200 ms |
| CLS | < 0,1 |
| TTFB (halaman ter-cache) | < 300 ms |
| Video mulai diputar | < 3 s |
| Submit quiz | < 1 s |
| JS bundle awal | < 200 KB gzip |
| Halaman artikel | < 1 MB total |

### 8.2 Skala Target

- Awal: 5.000 MAU, 200 pengguna serentak, 3 kursus, 6 artikel.
- Dirancang tumbuh ke 50.000 MAU tanpa perombakan arsitektur — hanya perlu naik tier layanan.
- Aplikasi *stateless* → dapat di-scale horizontal kapan saja.

### 8.3 Keandalan

- Uptime target 99% (MVP dengan free tier), 99,9% setelah pindah ke tier berbayar.
- **Backup:** free tier Supabase tidak menyediakan backup otomatis → wajib `pg_dump` harian via GitHub Actions ke R2 (gratis). Uji restore setiap bulan.
- RPO ≤ 24 jam, RTO ≤ 8 jam.
- Degradasi anggun: jika video gagal dimuat, teks materi tetap dapat dibaca dan quiz tetap bisa dikerjakan.

### 8.4 Privasi & Kepatuhan

- **UU No. 27/2022 (PDP)**: persetujuan eksplisit, hak akses & penghapusan, retensi terdefinisi.
- **Retensi (v1.3, Q39):** data akun, progress, dan nilai **disimpan selama akun aktif, tanpa batas waktu dan tanpa penghapusan otomatis karena tidak aktif**, dan tidak dianonimkan. Data dihapus hanya bila pengguna menghapus akunnya sendiri (AUTH-09: soft delete → purge 30 hari, data dianonimkan sesuai Q10) atau atas permintaan resmi. Kebijakan ini dituliskan eksplisit di Kebijakan Privasi — itulah bentuk "retensi terdefinisi". Persetujuan saat daftar tetap berupa persetujuan S&K + Kebijakan Privasi biasa; tidak ada alur consent penelitian.
- Karena data disimpan jangka panjang, **backup harian + uji restore** (§10.5, R-10) menjadi semakin penting sebelum pengguna pertama mendaftar.
- Data disimpan di region **Singapura (ap-southeast-1)** — latensi ~20–40 ms dari Jakarta.
- Wajib ada sebelum rilis: Kebijakan Privasi, Syarat & Ketentuan, Disclaimer Medis, banner cookie.
- **Tidak ada data kesehatan yang disimpan di sistem.** Konsultasi berlangsung sepenuhnya di WhatsApp, sehingga kewajiban PDP untuk kategori data spesifik tidak muncul di aplikasi. Ahli gizi tetap terikat panduan kerahasiaan internal (§5.5).

### 8.5 Aksesibilitas

- Target **WCAG 2.1 AA**: kontras ≥ 4,5:1, navigasi keyboard penuh, focus state terlihat, semantic HTML + ARIA.
- Target sentuh ≥ 44×44 px.
- Dukungan `prefers-reduced-motion`.
- Ukuran font dasar 16px (jangan lebih kecil — persona P3 berusia 45+).

### 8.6 SEO

- SSR/ISR untuk semua halaman publik.
- JSON-LD: `Course`, `Article`, `BreadcrumbList`, `FAQPage`, `Organization`, `Person` (ahli gizi).
- `sitemap.xml` dinamis, `robots.txt`, canonical, slug bahasa Indonesia.
- E-E-A-T: penulis & reviewer berkredensial, tanggal update, daftar rujukan.

### 8.7 Browser

Chrome, Safari, Firefox, Edge (2 versi terakhir). Safari iOS ≥ 15. Diuji pada 360px, 768px, 1280px (+1440px untuk Beranda & Masuk).

---

## 9. Rekomendasi Teknologi

### 9.1 Apa yang Berubah dan Mengapa

Anda menyampaikan dua hal yang mengubah rekomendasi saya secara signifikan:

1. **Anda belum menguasai Docker, Redis, dan BullMQ.**
2. **Anda ingin menekan biaya — idealnya semua gratis di awal.**

Ditambah satu fakta teknis dari jawaban Q4: **video hanya 3–5 menit @720p.** Ini ternyata kunci yang membuat semuanya mungkin.

**Analisisnya:** pendekatan konvensional untuk platform kursus adalah memakai layanan video terkelola, karena biasanya video panjang dan butuh adaptive bitrate. Video 4 menit @720p hanya berukuran ~45–60 MB. File sekecil itu bisa diputar langsung sebagai MP4 dari object storage tanpa transcoding sama sekali. Dan begitu transcoding tidak diperlukan, **kebutuhan akan queue (BullMQ) dan Redis ikut hilang** — karena satu-satunya pekerjaan berat di sistem ini adalah memproses video.

Berikut yang saya hapus dan penggantinya:

| Yang tidak dipakai | Alasan | Penggantinya |
|---|---|---|
| **Docker** | Hanya dipakai untuk database lokal dan deployment | Database cloud gratis untuk dev; deploy via Git push (tanpa container) |
| **Redis** | Dipakai untuk cache & rate limit | Cache bawaan Next.js + rate limit di tabel PostgreSQL + Vercel Firewall |
| **BullMQ + worker** | Dipakai untuk transcoding & PDF sertifikat | Transcoding tidak perlu; sertifikat tidak ada di MVP; cron via GitHub Actions |
| **Layanan video terkelola** | Biaya bulanan | Cloudflare R2 (gratis 10 GB, egress $0) + MP4 progressive |
| **Prisma** | Preferensi Anda | **Drizzle ORM** |

Hasilnya: **tiga teknologi yang belum Anda kuasai hilang dari MVP, dan biaya turun ke nol.** Semuanya bisa ditambahkan kembali nanti saat skala menuntut — dan pada saat itu Anda akan menambahkannya karena ada masalah nyata yang perlu diselesaikan, bukan karena "katanya perlu". Itu cara terbaik untuk belajar teknologi baru.

### 9.2 Stack Final MVP

| Lapisan | Pilihan | Biaya | Catatan |
|---|---|---|---|
| Framework | **Next.js 16.3.x (App Router) + TypeScript** | Gratis | SSR/ISR untuk SEO; satu codebase untuk 3 area. **v1.3:** 16.3 berstatus Active LTS (15.5 = Maintenance LTS). Pin versi patch terbaru — minimal **16.3.7** setelah rilis keamanan 30 Sep 2026 (Q36) |
| Styling | **Tailwind CSS v4 + shadcn/ui** | Gratis | Mobile-first secara desain; komponen dimiliki sendiri |
| **ORM** | **Drizzle ORM + drizzle-kit** | Gratis | Sesuai permintaan Anda. SQL-like, bundle kecil, migrasi eksplisit |
| Database | **Supabase Free** (PostgreSQL, region Singapura) | **$0** | 500 MB DB, 5 GB egress, 50K MAU |
| Auth | **Better Auth** | Gratis | Google OAuth + email/password + verifikasi email + rate limit, semuanya bawaan. Adapter Drizzle resmi |
| Object storage | **Cloudflare R2** | **$0** | 10 GB gratis, **egress selalu $0** — ini yang membuat video gratis |
| Video | **MP4 (H.264) di R2 + `<video>` HTML5** | $0 | Tidak perlu transcoding untuk video 3–5 menit @720p |
| Gambar | R2 + `next/image` | $0 | Optimasi AVIF/WebP otomatis |
| Rich text editor | **TipTap** (open source core) | Gratis | Mudah melarang node video/iframe. Hindari ekstensi Pro yang berbayar |
| Email | **Resend** free tier | $0 | ~3.000 email/bulan. Alternatif: Brevo (300/hari) |
| CDN, WAF, anti-bot | **Vercel CDN & Firewall** (bawaan) + **Cloudflare Turnstile** | $0 | DDoS mitigation & cache bawaan Vercel; CAPTCHA gratis. **v1.3:** tanpa proxy Cloudflare di depan Vercel (Q38) |
| Hosting | **Vercel Hobby** (dev) → lihat §9.4 | $0 (dev) | ⚠️ Ada catatan penting soal lisensi |
| Cron / job terjadwal | **GitHub Actions** (schedule) | Gratis | Memanggil API route; tidak perlu queue |
| CI/CD | **GitHub Actions** | Gratis | 2.000 menit/bulan untuk repo privat |
| Pencarian | **PostgreSQL full-text search** | $0 | Cukup untuk ribuan dokumen |
| Analitik produk | **PostHog** free | $0 | Funnel, retensi, session replay |
| Analitik web | **GA4 + Search Console** | $0 | Kebutuhan SEO |
| Error tracking | **Sentry** free | $0 | ~5.000 error/bulan |
| Form & validasi | React Hook Form + **Zod** | Gratis | Skema Zod dipakai ulang di klien & server |
| Data fetching | Server Components + **TanStack Query** (klien) | Gratis | Untuk auto-save quiz & polling |
| Testing | Vitest + Playwright | Gratis | E2E wajib untuk alur quiz |
| **Domain** | `.com` atau `.id` | **~Rp 200–500rb/tahun** | Satu-satunya biaya yang tak terhindarkan |

**Total biaya berjalan MVP: Rp 0/bulan + biaya domain tahunan.**

### 9.3 Perhitungan Kapasitas Free Tier

**Video (batas paling kritis):**
```
3 kursus × ~6 materi = 18 video
Video 4 menit @720p, H.264, ~1,5 Mbps ≈ 45 MB
Total penyimpanan ≈ 18 × 45 MB = 810 MB

R2 gratis: 10 GB penyimpanan → terpakai 8%
R2 egress: SELALU $0, berapa pun jumlah penontonnya  ← ini kuncinya
R2 Class B (baca): 10 juta/bulan gratis → jauh di atas kebutuhan

Ruang tersisa cukup untuk ± 200 video lagi sebelum perlu membayar.
Setelah 10 GB: ~$0,015/GB/bulan (sekitar Rp 250/GB) — tetap sangat murah.
```

**Database:**
```
Supabase gratis: 500 MB
Isi database Anda hampir seluruhnya teks & metadata:
  - 6 artikel + 3 kursus + 18 materi (konten JSON) ≈ 5 MB
  - ~200 soal quiz ≈ 1 MB
  - 5.000 user + progress + attempt quiz ≈ 50 MB
Total ≈ 60 MB → terpakai 12%
```
Gambar dan video **tidak** disimpan di database (hanya URL-nya), sehingga 500 MB sangat longgar.

**Kesimpulan:** free tier bukan sekadar "cukup untuk demo" — dengan volume konten Anda, ini realistis untuk produksi selama ± 12 bulan pertama.

### 9.4 ⚠️ Peringatan Penting: Lisensi Vercel Hobby

Ini hal yang harus Anda ketahui sebelum memilih hosting.

**Vercel Hobby (gratis) dibatasi untuk penggunaan non-komersial/pribadi.** Vercel mendefinisikan "komersial" secara luas — termasuk situs yang menghasilkan keuntungan finansial bagi siapa pun yang terlibat dalam pembuatannya, termasuk developer berbayar. Batasannya adalah **klausul lisensi, bukan batas kuota**.

Artinya untuk kasus Anda:

| Situasi | Status Hobby |
|---|---|
| Tahap pengembangan, belum rilis publik | ✅ Aman |
| Rilis publik, seluruh konten gratis, tanpa iklan, tanpa monetisasi | ⚠️ Area abu-abu — banyak yang melakukannya, tapi tidak dijamin |
| Ada developer/konsultan yang dibayar untuk membangunnya | ❌ Dianggap komersial |
| Kursus berbayar diaktifkan (rencana Anda "nanti") | ❌ Wajib Pro |

**Rekomendasi bertahap:**

1. **Selama pengembangan:** Vercel Hobby, gratis, tanpa keraguan.
2. **Saat rilis publik**, pilih salah satu:
   - **Vercel Pro — ~$20/bulan (± Rp 320rb).** Paling sederhana, tanpa perubahan kode, aman secara lisensi. Ini rekomendasi saya jika anggaran memungkinkan.
   - **Cloudflare Workers — gratis, penggunaan komersial diizinkan.** Next.js dapat di-deploy ke sini lewat adapter OpenNext. Benar-benar $0, tapi ada beberapa penyesuaian teknis dan komunitasnya lebih kecil.
   - **VPS murah (~Rp 80rb/bulan)** — paling murah untuk jangka panjang, tapi membutuhkan pengetahuan server (dan kemungkinan Docker) yang saat ini ingin Anda hindari.

> Verifikasi ulang syarat & harga di halaman resmi masing-masing sebelum memutuskan — kebijakan free tier berubah cukup sering.

**Catatan v1.3 — fase penelitian dan kuota Hobby.** Dalam waktu dekat hingga pertengahan, BINZI dipakai untuk **penelitian ahli gizi** dengan jumlah pengguna kecil. Untuk fase ini Vercel Hobby memadai: kuota bulanannya (per 2026: ±100 GB transfer, 1 juta Edge Request, 1 juta function invocation, 4 jam CPU aktif) jauh di atas kebutuhan, dan video/upload tidak lewat Vercel (R2 langsung). Yang perlu dipantau menjelang **rilis publik**:

- **Edge Request** kemungkinan menjadi batas pertama. Estimasi kasar di target 5.000 MAU (§8.2): ±100.000 page view/bulan × belasan request per halaman (JS, font, gambar — termasuk yang ter-cache) bisa mendekati atau melewati 1 juta.
- **Transfer data** dan **optimasi gambar** (`next/image`) menyusul.
- Melewati batas Hobby dilaporkan tidak menimbulkan tagihan, tetapi fitur terkait dijeda — bagi pengguna sama dengan situs bermasalah.
- Pantau dashboard Usage Vercel mingguan; bila salah satu metrik melewati ±70%, putuskan OQ-12.

### 9.5 Jalur Upgrade (kapan harus mulai membayar)

| Pemicu | Tindakan | Perkiraan biaya |
|---|---|---|
| Rilis publik / ada monetisasi | Vercel Pro **atau** pindah ke Cloudflare Workers | $0–20/bln |
| DB > 400 MB, atau butuh backup otomatis | Supabase Pro | $25/bln |
| Video > 10 GB | Bayar overage R2 | ~$0,015/GB |
| Video mulai > 10 menit atau banyak keluhan buffering | Pindah ke Bunny Stream / Cloudflare Stream (HLS adaptif) | $5–30/bln |
| Konten > 2.000 dokumen & pencarian terasa lambat | Meilisearch (self-host atau cloud) | $0–30/bln |
| Butuh background job berat (transcoding, laporan besar) | Baru kenalkan Redis + BullMQ | $0–10/bln |
| Email > 3.000/bulan | Resend berbayar atau Amazon SES | $0–20/bln |

**Prinsipnya:** setiap komponen di atas dapat diupgrade **secara terpisah** tanpa menyentuh yang lain. Tidak ada satu pun yang memaksa penulisan ulang aplikasi.

### 9.6 Catatan Khusus Drizzle (sesuai permintaan Anda)

Perubahan praktis dari Prisma:

| Aspek | Prisma | Drizzle |
|---|---|---|
| Definisi skema | File `schema.prisma` (DSL sendiri) | File TypeScript biasa (`schema.ts`) |
| Migrasi | `prisma migrate` (otomatis) | `drizzle-kit generate` → hasilkan file SQL → `drizzle-kit migrate` |
| Query | Abstraksi tinggi | Mirip SQL (`db.select().from(courses).where(eq(...))`) |
| Relasi | Otomatis | Dideklarasikan eksplisit lewat `relations()` |
| Bundle size | Besar | Kecil — cocok untuk serverless |
| Kurva belajar | Lebih mudah bagi pemula | Perlu paham SQL, tapi lebih transparan |

**Konvensi proyek yang saya sarankan:**
```
src/db/
├── schema/
│   ├── auth.ts          # users, sessions, accounts, verifications
│   ├── course.ts        # courses, sections, lessons
│   ├── quiz.ts          # quizzes, questions, options, attempts, answers
│   ├── progress.ts      # enrollments, lesson_progress
│   ├── article.ts       # articles, categories, tags
│   ├── media.ts         # media_assets
│   ├── system.ts        # audit_logs, settings, rate_limits
│   └── index.ts         # re-export semua + relations
├── migrations/          # SQL hasil drizzle-kit (COMMIT ke git)
├── seed.ts
└── index.ts             # instance koneksi db
```

Aturan: **selalu tinjau file SQL yang dihasilkan `drizzle-kit generate` sebelum commit.** Ini keunggulan Drizzle dibanding Prisma — Anda melihat persis apa yang akan dijalankan di database.

Gunakan **connection pooler Supabase (Supavisor, port 6543)** dengan driver `postgres-js`, bukan koneksi langsung, karena lingkungan serverless membuka banyak koneksi singkat.

### 9.7 Development Tanpa Docker

Anda tidak perlu Docker sama sekali:

| Kebutuhan | Cara tanpa Docker |
|---|---|
| Database lokal | Buat **project Supabase kedua** khusus development (free tier mengizinkan 2 project aktif). Cukup ganti `DATABASE_URL` di `.env.local` |
| Menjalankan aplikasi | `npm run dev` |
| Migrasi database | `npx drizzle-kit generate` lalu `npx drizzle-kit migrate` |
| Deploy | `git push` → Vercel build & deploy otomatis |
| Job terjadwal | GitHub Actions memanggil `POST /api/cron/{nama}` dengan header rahasia |

Alternatif jika ingin database benar-benar lokal: pasang PostgreSQL langsung di komputer (installer resmi tersedia untuk Windows/macOS) — tetap tanpa Docker.

---

## 10. Arsitektur & System Design

### 10.1 Diagram (disederhanakan — tanpa Redis, queue, dan worker)

```
                    ┌──────────────────────────────┐
                    │ Browser (HP / Tablet / Laptop)│
                    └───────────────┬──────────────┘
                                    │ HTTPS
                    ┌───────────────▼──────────────┐
                    │  Vercel CDN & Firewall        │
                    │  DNS · cache · DDoS (bawaan)  │
                    └───────────────┬──────────────┘
                                    │
   ┌────────────────────────────────▼─────────────────────────────────┐
   │              Next.js 16 App  (Vercel / Cloudflare Workers)        │
   │                                                                   │
   │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
   │  │  Publik    │  │  Belajar   │  │    CMS     │  │ API Routes │  │
   │  │  ISR/SSR   │  │  SSR+CSR   │  │  CSR+SSR   │  │ + Actions  │  │
   │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │
   │  ──────────────────── Modul Domain ────────────────────────────  │
   │   auth │ course │ lesson │ quiz │ progress │ article             │
   │   media │ user │ notification                                    │
   │  ──────────────────── Infrastruktur ───────────────────────────  │
   │   db (Drizzle) │ storage (R2) │ mail (Resend) │ ratelimit (DB)   │
   └──────┬───────────────────────┬──────────────────────┬────────────┘
          │                       │                      │
   ┌──────▼────────┐   ┌──────────▼─────────┐   ┌────────▼─────────┐
   │  PostgreSQL   │   │  Cloudflare R2     │   │     Resend       │
   │  (Supabase)   │   │  video MP4, gambar │   │  email transaksi │
   │  Singapura    │   │  egress GRATIS     │   └──────────────────┘
   └───────────────┘   └────────────────────┘
          ▲
          │ POST /api/cron/* (header rahasia)
   ┌──────┴──────────────┐
   │  GitHub Actions     │  cron harian: backup DB, pengingat,
   │  (pengganti queue)  │  bersih-bersih media yatim
   └─────────────────────┘
```

Dibanding arsitektur konvensional untuk platform sejenis, **empat komponen infrastruktur tidak diperlukan sama sekali** (Redis, worker BullMQ, penyedia video terkelola, Docker). Yang tersisa hanya tiga layanan eksternal, semuanya dikonfigurasi lewat environment variable.

### 10.2 Struktur Kode

```
src/
├── app/
│   ├── (public)/        # beranda (termasuk section konsultasi), kursus, artikel, tentang — ISR
│   ├── (auth)/          # masuk, daftar, reset
│   ├── (learn)/         # dashboard, player, quiz, nilai — protected
│   ├── (cms)/           # CMS — protected + RBAC
│   └── api/
│       ├── auth/[...all]/     # Better Auth handler
│       ├── upload/            # presigned URL R2
│       ├── progress/          # tracking video & materi
│       ├── quiz/              # attempt, autosave, submit
│       └── cron/              # dipanggil GitHub Actions
│
├── modules/             # inti bisnis, terisolasi per domain
│   ├── auth/  course/  lesson/  quiz/  progress/
│   ├── article/  media/  user/  notification/
│   └── (tiap modul: service.ts | queries.ts | schema.ts | policy.ts)
│
├── components/
│   ├── ui/              # shadcn primitives
│   └── public/  learn/  cms/  shared/
│
├── db/                  # Drizzle: schema, migrations, seed
├── lib/                 # storage, mail, auth, sanitize, ratelimit, utils
└── config/              # env (validasi Zod), constants
```

**Aturan:** modul berkomunikasi lewat `service.ts` masing-masing; tidak boleh saling mengimpor `queries.ts`. Ini yang menjaga batas tetap rapi jika suatu saat perlu dipecah.

### 10.3 Alur Video (tanpa transcoding)

```
UPLOAD (admin)
1. Admin pilih file → POST /api/upload/video
2. Server: cek role, validasi tipe & ukuran (maks 200 MB) → buat presigned PUT URL R2
3. Browser upload LANGSUNG ke R2 (progress bar); tidak melewati server aplikasi
4. Server catat lessons.video_key, video_status = READY (langsung, tanpa proses)
5. Ekstrak durasi video di sisi klien lewat elemen <video> lalu kirim ke server

PEMUTARAN (member)
1. Member buka materi → server cek: login? enrolled? materi terbuka?
2. Server buat presigned GET URL R2 (TTL 2 jam)
3. <video src={signedUrl} preload="metadata"> — browser melakukan range request
4. Progress dikirim tiap 10 detik (throttled) → POST /api/progress/video
```

**Batasan yang perlu Anda terima (dan mengapa dapat diterima):**

| Batasan | Dampak | Mengapa dapat diterima sekarang |
|---|---|---|
| Tidak ada adaptive bitrate | User di koneksi lambat menunggu lebih lama | File 45 MB terunduh progresif; untuk video 4 menit, buffering awal masih wajar |
| Satu resolusi saja | User HP mengunduh kualitas penuh | 720p @1,5 Mbps masih hemat dibanding standar video panjang |
| Presigned URL dapat dibagikan selama TTL | Kebocoran terbatas | TTL 2 jam + konten gratis = risiko rendah. Bila kursus jadi berbayar, ganti dengan Cloudflare Worker penjaga token |

**Kapan harus pindah ke HLS:** jika video melebihi 10 menit, atau muncul keluhan buffering dari pengguna di luar Jawa. Migrasinya terisolasi di `lib/storage/video.ts` — hanya satu file yang berubah.

**Panduan wajib untuk admin sebelum upload** (masukkan ke dokumentasi CMS):
```
Format   : MP4 (H.264 + AAC)
Resolusi : 1280×720
Bitrate  : 1,2–1,8 Mbps (video), 128 kbps (audio)
Ukuran   : usahakan < 60 MB per video
Faststart: WAJIB aktif (agar video bisa diputar sebelum unduhan selesai)
Alat     : HandBrake (gratis) — preset "Fast 720p30", centang "Web Optimized"
```
Jika video melebihi 200 MB, sistem menolak dan menampilkan panduan di atas.

### 10.4 Strategi Caching (tanpa Redis)

| Lapisan | Konten | Strategi |
|---|---|---|
| Vercel CDN | Aset statis (JS, CSS, font) & gambar hasil `next/image` | Cache lama; nama file ber-hash |
| Cloudflare R2 (langsung) | Video & berkas asli | Diakses lewat presigned URL; tidak melewati Vercel sehingga tidak memakan kuota transfer Vercel |
| Next.js ISR | Beranda, katalog, artikel, halaman tentang | `revalidate: 3600` + **revalidasi on-demand saat admin publish** |
| Next.js `unstable_cache` | Daftar kategori artikel, kursus populer | 5–15 menit, invalidasi berbasis tag |
| React Query | Data dashboard user | `staleTime` 60 detik |
| Tidak di-cache | Progress, nilai quiz, seluruh CMS | Selalu segar |

Cache Next.js menggantikan peran Redis di skala ini. Redis baru dibutuhkan saat aplikasi berjalan di banyak instance yang perlu berbagi cache — jauh di atas 50.000 MAU.

### 10.5 Job Terjadwal (tanpa queue)

Semua dijalankan GitHub Actions yang memanggil API route terlindungi:

| Job | Jadwal | Fungsi |
|---|---|---|
| `backup-db` | Harian 02:00 WIB | `pg_dump` → unggah ke R2 (menutupi ketiadaan backup di free tier) |
| `keep-alive` | Tiap 3 hari | Satu query ringan agar project Supabase tidak auto-pause |
| `cleanup-media` | Mingguan | Hapus aset tidak terpakai > 30 hari |
| `purge-accounts` | Harian | Hapus permanen akun soft-deleted > 30 hari |
| `learning-reminder` | Harian (fase 1.5) | Email pengingat untuk user tidak aktif 7 hari |

Contoh:
```yaml
# .github/workflows/cron.yml
on:
  schedule:
    - cron: '0 19 * * *'   # 02:00 WIB
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST "${{ secrets.APP_URL }}/api/cron/backup-db" \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
```

### 10.6 Environment

| Environment | Database | Hosting |
|---|---|---|
| Local | Supabase project #2 (dev) | `npm run dev` |
| Preview (per PR) | Supabase project #2 (dev) | Vercel preview otomatis |
| Production | Supabase project #1 | Vercel production |

Migrasi dijalankan manual & sengaja (`drizzle-kit migrate`) sebelum deploy produksi — bukan otomatis, agar tidak ada perubahan skema yang tidak disadari.

---

## 11. Model Data

### 11.1 Catatan Desain Skema

| Keputusan skema | Alasan |
|---|---|
| Tidak ada tabel `certificates` | Sertifikat di luar MVP (K-03) |
| Tidak ada tabel `consultation_requests` | Konsultasi hanya tautan WhatsApp (K-10) |
| Tidak ada tabel `course_categories` / kolom `courses.category_id` | Kategori hanya untuk artikel (K-14) |
| `lessons.video_key` menyimpan kunci objek R2, bukan URL | URL bersifat sementara (presigned); kunci objek permanen |
| `enrollments.access_type` ada sejak awal meski semua gratis | Menyiapkan monetisasi tanpa migrasi besar (K-02) |
| Tabel `rate_limits` di PostgreSQL | Pengganti Redis, cukup untuk skala MVP (§12.4) |
| Tabel `sections` ada tapi UI-nya disembunyikan | Menghindari migrasi berisiko saat kursus mulai panjang |
| `articles.reviewer_id` wajib terisi saat publish | Kredibilitas konten kesehatan (K-11) |
| Konten kaya disimpan sebagai JSONB (dokumen TipTap) | Dapat divalidasi strukturnya — inilah yang menegakkan larangan video di teks |

### 11.2 Skema (notasi SQL; implementasi dengan Drizzle)

```sql
-- ============ IDENTITAS (kelola Better Auth) ============
users (
  id TEXT PK, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  image TEXT, email_verified BOOLEAN DEFAULT false,
  role user_role DEFAULT 'MEMBER',        -- MEMBER|EDITOR|ADMIN|SUPER_ADMIN
  status user_status DEFAULT 'ACTIVE',    -- ACTIVE|SUSPENDED|DELETED
  phone TEXT, last_login_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ,
  created_at, updated_at
)
sessions   (id, user_id FK, token UNIQUE, expires_at, ip_address, user_agent)
accounts   (id, user_id FK, provider_id, account_id, tokens…, UNIQUE(provider_id, account_id))
verifications (id, identifier, value, expires_at)

-- ============ KURSUS ============
-- Tidak ada course_categories: kursus tidak berkategori (K-14)

courses (
  id UUID PK, title, slug UNIQUE, summary, description JSONB,
  thumbnail_url, level course_level,
  estimated_minutes INT, is_sequential BOOLEAN DEFAULT true,
  status content_status DEFAULT 'DRAFT',
  final_quiz_id UUID UNIQUE NULL,
  reviewer_id FK NULL, reviewed_at TIMESTAMPTZ NULL,
  seo_title, seo_description, published_at,
  enrollment_count INT DEFAULT 0,
  created_by, updated_by, created_at, updated_at
)

sections (id, course_id FK, title, order_index)     -- siap pakai, UI disembunyikan di MVP

lessons (
  id UUID PK, course_id FK, section_id FK NULL,
  title, slug, order_index INT NOT NULL,
  content JSONB NOT NULL,                  -- dokumen TipTap
  video_key TEXT NULL,                     -- kunci objek di R2
  video_status video_status DEFAULT 'NONE',-- NONE|UPLOADING|READY|FAILED
  video_duration_seconds INT, video_size_bytes BIGINT,
  quiz_id UUID UNIQUE NULL,
  is_free_preview BOOLEAN DEFAULT false,
  estimated_minutes INT, created_at, updated_at,
  UNIQUE(course_id, slug)
)

-- ============ QUIZ ============
quizzes (
  id UUID PK, type quiz_type NOT NULL,     -- LESSON | FINAL
  title, instructions TEXT,
  duration_minutes INT NOT NULL CHECK (BETWEEN 1 AND 180),
  passing_score_percent INT DEFAULT 70,    -- label informatif di MVP
  max_attempts INT NOT NULL DEFAULT 1,     -- 1 = sekali kerjakan (K-04)
  cooldown_minutes INT DEFAULT 0,          -- tidak relevan saat max_attempts = 1
  questions_per_attempt INT NULL,
  shuffle_questions BOOLEAN DEFAULT true,
  shuffle_options BOOLEAN DEFAULT true,
  explanation_policy explanation_policy DEFAULT 'ALWAYS',  -- ALWAYS|ON_PASS_ONLY|NEVER
  created_at, updated_at
)

questions (
  id UUID PK, quiz_id FK, order_index INT,
  type question_type DEFAULT 'SINGLE_CHOICE',
  text JSONB NOT NULL, image_url TEXT NULL,
  explanation JSONB NULL,      -- boleh NULL hanya saat draft; wajib terisi untuk simpan final, impor CSV, dan publish (Q40, §11.4 no. 12)
  points INT DEFAULT 1,
  topic_tag TEXT NULL          -- bagian materi yang diuji; dipakai saat gagal (QZ-20)
)

question_options (
  id UUID PK, question_id FK, order_index INT,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false   -- JANGAN diserialisasi ke klien
)

quiz_attempts (
  id UUID PK, quiz_id FK, user_id FK, enrollment_id FK,
  attempt_number INT NOT NULL,
  status attempt_status DEFAULT 'IN_PROGRESS',  -- IN_PROGRESS|SUBMITTED|EXPIRED
  question_order UUID[] NOT NULL,               -- dikunci saat attempt dimulai
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,              -- OTORITATIF, dihitung server
  submitted_at TIMESTAMPTZ,
  score INT, max_score INT, score_percent NUMERIC(5,2), is_passed BOOLEAN,
  reset_by FK NULL, reset_reason TEXT, reset_at TIMESTAMPTZ,  -- jalur pemulihan (QZ-19)
  focus_lost_count INT DEFAULT 0, ip INET,
  UNIQUE(quiz_id, user_id, attempt_number)
)
CREATE UNIQUE INDEX one_active_attempt ON quiz_attempts (quiz_id, user_id)
  WHERE status = 'IN_PROGRESS';

quiz_answers (
  id UUID PK, attempt_id FK, question_id FK,
  selected_option_id FK NULL, is_correct BOOLEAN NULL,
  points_earned INT DEFAULT 0, answered_at TIMESTAMPTZ,
  UNIQUE(attempt_id, question_id)
)

-- ============ PROGRESS & NILAI ============
enrollments (
  id UUID PK, user_id FK, course_id FK,
  access_type access_type DEFAULT 'FREE',   -- FREE|PAID (disiapkan untuk fase 2)
  status enrollment_status DEFAULT 'IN_PROGRESS',  -- IN_PROGRESS|COMPLETED|PASSED
  enrolled_at, completed_at TIMESTAMPTZ NULL,
  progress_percent NUMERIC(5,2) DEFAULT 0,
  final_score_percent NUMERIC(5,2) NULL,    -- (rata2 quiz materi × 60%) + (final × 40%)
  last_lesson_id FK NULL,
  total_seconds_spent INT DEFAULT 0,
  reset_count INT DEFAULT 0,                -- berapa kali user mengulang kursus
  UNIQUE(user_id, course_id)
)

lesson_progress (
  id UUID PK, user_id FK, lesson_id FK, enrollment_id FK,
  status progress_status DEFAULT 'NOT_STARTED',
  video_watched_percent NUMERIC(5,2) DEFAULT 0,
  video_last_position_seconds INT DEFAULT 0,
  quiz_attempted BOOLEAN DEFAULT false,          -- ← gerbang materi berikutnya
  quiz_score_percent NUMERIC(5,2) NULL,          -- nilai tunggal & final
  quiz_is_passed BOOLEAN NULL,                   -- label saja, tidak mengunci apa pun
  quiz_submitted_at TIMESTAMPTZ NULL
  first_accessed_at, completed_at,
  UNIQUE(user_id, lesson_id)
)

-- ============ ARTIKEL ============
article_categories (id, name, slug UNIQUE, description, icon, color, order_index)

articles (
  id UUID PK, title, slug UNIQUE, excerpt,
  content JSONB NOT NULL, cover_url,
  category_id FK NOT NULL,                  -- TEPAT SATU kategori
  author_id FK, reviewer_id FK NULL, reviewed_at TIMESTAMPTZ NULL,
  reading_minutes INT, view_count INT DEFAULT 0,
  related_course_id FK NULL,
  status content_status DEFAULT 'DRAFT',
  seo_title, seo_description, published_at,
  search_vector TSVECTOR,
  created_at, updated_at
)
tags (id, name, slug UNIQUE)
article_tags (article_id FK, tag_id FK, PK(article_id, tag_id))

-- ============ KONSULTASI ============
-- TIDAK ADA TABEL. Konsultasi adalah section di Beranda dengan tautan WhatsApp.
-- Nomor WhatsApp & jam operasional disimpan di system_settings:
--   {"consultation.whatsapp_number": "628xxxxxxxxxx",
--    "consultation.operating_hours": "Senin-Jumat 09.00-17.00 WIB",
--    "consultation.response_sla": "1x24 jam"}

-- ============ OPERASIONAL ============
media_assets (
  id UUID PK, type media_type,              -- IMAGE|VIDEO|DOCUMENT
  storage_key TEXT UNIQUE, url TEXT, filename, mime_type,
  size_bytes BIGINT, width INT, height INT, duration_seconds INT,
  alt_text TEXT, uploaded_by FK, created_at
)

audit_logs (
  id BIGSERIAL PK, actor_id FK, action TEXT,
  entity_type TEXT, entity_id TEXT,
  before JSONB, after JSONB, ip INET, created_at
)

rate_limits (                                -- pengganti Redis
  key TEXT PRIMARY KEY,                      -- mis. "login:user@mail.com"
  count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL
)
CREATE INDEX ON rate_limits (expires_at);    -- dibersihkan lewat cron

system_settings (key TEXT PK, value JSONB, updated_by FK, updated_at)
-- {"quiz.min_questions": 10, "score.lesson_weight": 60, "score.final_weight": 40}
```

### 11.3 Index Penting

```sql
CREATE INDEX ON courses (status, published_at DESC) WHERE status = 'PUBLISHED';
CREATE INDEX ON articles (status, category_id, published_at DESC);
CREATE INDEX ON articles USING GIN (search_vector);
CREATE INDEX ON enrollments (user_id, updated_at DESC);
CREATE INDEX ON lesson_progress (user_id, lesson_id);
CREATE INDEX ON quiz_attempts (user_id, quiz_id);
CREATE INDEX ON lessons (course_id, order_index);
```

### 11.4 Aturan Integritas

1. `articles.category_id` **NOT NULL** — satu artikel tepat satu kategori.
2. Hapus kategori yang masih punya artikel → **ditolak** (`ON DELETE RESTRICT`).
3. `courses.final_quiz_id` dan `lessons.quiz_id` **UNIQUE** — satu quiz per pemilik.
4. Kursus `PUBLISHED` yang punya enrollment tidak boleh dihapus — gunakan `ARCHIVED`.
5. `quiz_attempts.expires_at` selalu dihitung server.
6. Reset progress kursus **tidak menghapus** `quiz_attempts` — hanya menaikkan `reset_count` dan mengosongkan `lesson_progress`.
7. **Gerbang materi diberlakukan di server.** Endpoint materi ke-N memeriksa `quiz_attempted = true` pada materi ke-(N−1). Menyembunyikan tautan di UI tidak cukup.
8. **Attempt kedua ditolak di server.** Percobaan membuat attempt baru untuk quiz yang sudah `SUBMITTED`/`EXPIRED` dikembalikan 409, kecuali ada baris reset yang sah.
9. `max_attempts` untuk quiz materi **selalu 1** — tidak dapat diubah dari CMS di MVP.
10. **Pembahasan & `is_correct` hanya diserialisasi setelah attempt `SUBMITTED` atau `EXPIRED`**, tidak pernah sebelumnya.
11. Reset attempt **wajib** menyertakan `reset_reason` dan tercatat di `audit_logs`.
12. **Aturan soal (Q40) ditegakkan di server:** pilihan ganda tepat 4 opsi dengan tepat 1 benar; benar/salah tepat 2 opsi dengan tepat 1 benar; pembahasan terisi. Diperiksa saat soal disimpan di editor, saat impor CSV (baris yang melanggar ditolak dengan alasan), dan saat quiz dipublikasikan (quiz dengan soal yang melanggar tidak bisa terbit). Kolom `explanation` tetap boleh NULL di database agar draft bisa auto-save.

---

## 12. Keamanan

### 12.1 Autentikasi & Otorisasi
- Password di-hash dengan algoritme bawaan Better Auth (scrypt/argon2) — jangan diganti dengan MD5/SHA.
- Cookie session: `HttpOnly`, `Secure`, `SameSite=Lax`.
- Rotasi session setelah login.
- **Setiap akses data diverifikasi di server.** Menyembunyikan tombol di UI bukan keamanan.
- Cek akses materi: `isPublished && (isFreePreview || (isAuthenticated && isEnrolled && isUnlocked))`.
- Anti-IDOR: setiap query berbasis ID menyertakan kondisi kepemilikan (`WHERE id = ? AND user_id = ?`).

### 12.2 Integritas Quiz

Tetap berlaku penuh meski quiz tidak lagi menjadi gerbang — nilai adalah satu-satunya output pembelajaran di MVP, jadi harus dapat dipercaya.

| Ancaman | Mitigasi |
|---|---|
| Melihat kunci jawaban di DevTools | `is_correct` tidak pernah diserialisasi sebelum submit; gunakan whitelist field, bukan `select *` |
| Memanipulasi timer | `expires_at` dihitung & disimpan server; submit setelah kedaluwarsa ditolak (toleransi 5 detik) |
| Refresh untuk mereset timer | Attempt aktif dilanjutkan, bukan dibuat baru (partial unique index) |
| Attempt paralel | Satu `IN_PROGRESS` per user per quiz, dijamin di level database |
| Mengulang quiz lewat manipulasi request | Server menolak attempt baru bila sudah ada attempt `SUBMITTED`/`EXPIRED` (409). Pemulihan hanya lewat reset admin yang teraudit |
| Mengirim skor palsu | Klien hanya mengirim `optionId`; **seluruh penilaian di server** |
| Race condition saat submit | Transaksi + status sebagai state machine + idempotency key |

### 12.3 Konten & Input
- **Konten kaya divalidasi sebagai skema TipTap JSON di server** dengan whitelist node. Node `video`, `iframe`, `script`, `embed` **ditolak** — inilah yang menegakkan CRS-05 secara tak-terbypass.
- Sanitasi ulang saat render ke HTML (defense in depth).
- Semua payload API divalidasi dengan Zod.
- Upload: validasi **magic bytes**, batas ukuran (gambar 5 MB, video 200 MB), nama file di-generate ulang, **SVG dilarang**.
- Bucket R2 tidak boleh publik — akses hanya lewat presigned URL.

### 12.4 Rate Limiting (tabel `rate_limits`)

| Endpoint | Limit |
|---|---|
| Login / registrasi | 5 / 15 menit / IP+email |
| Lupa password | 3 / jam / email |
| Mulai quiz attempt | 10 / jam / user |
| Auto-save jawaban | 60 / menit / attempt |
| Upload media | 20 / jam / user |
| Presigned video URL | 30 / jam / user |

Ditambah Vercel Firewall di lapisan edge (aktifkan *Attack Challenge Mode* bila diserang) dan Turnstile pada form publik. Tidak memakai proxy Cloudflare di depan Vercel (Q38).

### 12.5 Header Keamanan
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{random}';
  img-src 'self' data: https://<r2-domain>; media-src https://<r2-domain>;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Ditambah: Dependabot, `npm audit` di CI, secret di secret manager (tidak pernah di repo), `.env` divalidasi Zod saat startup.

### 12.6 Checklist Verifikasi Keamanan untuk Kode Buatan AI

Pengembangan dilakukan sepenuhnya dengan bantuan AI (§13.4). Kode yang dihasilkan AI umumnya benar secara fungsional tetapi **sering melewatkan pemeriksaan yang tidak terlihat dari UI** — dan justru itu yang menjadi celah keamanan. Sepuluh item berikut **wajib diverifikasi manual**, bukan sekadar ditanyakan ulang ke AI.

| # | Yang diperiksa | Cara mengujinya |
|---|---|---|
| V-01 | `is_correct` bocor di response soal quiz | Buka DevTools → tab Network → mulai quiz → periksa payload JSON. Tidak boleh ada `is_correct` atau `explanation` sebelum submit |
| V-02 | Timer dihitung di klien | Ubah jam sistem komputer maju 1 jam → submit. Harus tetap ditolak sesuai waktu server |
| V-03 | Attempt kedua bisa dibuat lewat API | Setelah submit, panggil ulang endpoint `POST /quizzes/{id}/attempts` dengan curl. Harus 409 |
| V-04 | RBAC hanya dicek di UI | Login sebagai MEMBER, akses `/cms` dan endpoint `/api/v1/cms/*` langsung. Harus 403, bukan halaman kosong |
| V-05 | IDOR pada data milik user | Ambil ID progress/attempt user lain, panggil endpointnya. Harus 403/404, bukan datanya |
| V-06 | Gerbang materi hanya di UI | Akses URL materi ke-3 langsung padahal materi ke-2 belum dikerjakan. Harus ditolak server |
| V-07 | Bucket R2 tidak sengaja publik | Buka URL objek R2 tanpa tanda tangan di jendela penyamaran. Harus ditolak |
| V-08 | Node video/iframe lolos ke konten materi | Kirim payload berisi node `iframe` langsung ke API materi (bypass editor). Harus ditolak server |
| V-09 | Secret ikut ter-commit | `git log -p \| grep -iE "sk_\|secret\|password\|api[_-]key"` dan periksa `.env` ada di `.gitignore` |
| V-10 | Rate limit tidak terpasang | Kirim 20 request login gagal berturut-turut lewat curl. Harus diblokir setelah 5 |

**Kapan dijalankan:** V-01 sampai V-06 setiap akhir sprint yang menyentuh quiz atau akses materi. V-07 sampai V-10 sekali sebelum rilis, lalu setiap ada perubahan konfigurasi.

> Kesalahan yang paling sering muncul pada kode buatan AI di proyek seperti ini adalah **V-01 dan V-05**: mengembalikan seluruh objek dari database (`select *` atau mengembalikan hasil query mentah) alih-alih memilih field secara eksplisit. Tampilan di layar terlihat benar sempurna, tapi data sensitifnya ikut terkirim. Selalu minta AI membuat fungsi serialisasi eksplisit per entitas, dan periksa sendiri hasilnya di Network tab.


---

## 13. Roadmap

### 13.1 Fase Pengembangan (MVP: 12 minggu)

**Fase 0 — Fondasi (2 minggu)**
Setup repo & CI/CD, dua project Supabase, skema Drizzle + migrasi awal, Better Auth (Google + email/password + verifikasi), RBAC, sistem desain & komponen dasar (mobile-first), layout tiga area, konfigurasi R2 + Turnstile. Domain & DNS (Vercel) boleh menyusul — tidak memblokir Fase 0.
*Deliverable: user dapat mendaftar, login, dan melihat halaman yang benar sesuai role, di HP maupun laptop.*

**Fase 1 — MVP (9 minggu)**

| Sprint | Minggu | Fokus |
|---|---|---|
| S1 | 3–4 | CMS: CRUD kursus & materi, editor TipTap + upload gambar, media library |
| S2 | 5–6 | Upload & pemutaran video (R2 presigned), player, pelacakan progress |
| S3 | 7–8 | Mesin quiz: builder di CMS, mode ujian, timer server, penilaian, riwayat attempt |
| S4 | 9 | Artikel + kategori + tag di CMS; halaman artikel publik; SEO teknis |
| S5 | 10 | Dashboard member, progress, **Nilai Saya**, Final Quiz, ulangi kursus |
| S6 | 11 | Beranda (termasuk section **Tanya Ahli Gizi** + nav scroll), katalog kursus, pencarian, **Tentang Kami** |

**Fase 1.5 — Stabilisasi (1 minggu)**
QA lintas perangkat (360 / 768 / 1280, +1440 untuk Beranda & Masuk), audit performa & aksesibilitas, uji keamanan dasar, seeding konten, pelatihan admin, UAT, uji restore backup.

**Fase 2 — Pertumbuhan**
Sertifikat, question bank & bulk import soal, formulir & booking konsultasi, analitik konten, monetisasi, versioning konten, gamifikasi ringan, notifikasi in-app.

**Fase 3 — Ekspansi**
Aplikasi mobile, forum, live class, learning path, rekomendasi personal, HLS adaptif, multi-bahasa.

### 13.2 Jalur Kritis: Produksi Konten

Berjalan **paralel** sejak minggu 1, bukan setelah pengembangan selesai:

| Minggu | Target konten |
|---|---|
| 1–2 | Kerangka 3 kursus, tetapkan 6 kategori artikel, rekrut/konfirmasi ahli gizi reviewer |
| 3–5 | Naskah + rekaman video kursus 1 (6 materi × 4 menit) |
| 6–8 | Naskah + rekaman kursus 2 & 3; tulis 6 artikel |
| 9–10 | Tulis soal quiz: 18 quiz materi × 10 soal + 3 Final Quiz × 20 soal ≈ **240 soal**. Kualitas soal kini kritis — tidak ada pengulangan yang bisa memperbaiki nilai akibat soal ambigu |
| 11 | Review ahli gizi untuk seluruh konten; input ke CMS |

> **Peringatan:** ini pekerjaan terbesar dan paling sering diremehkan. Dengan asumsi 8 menit per soal, 240 soal ≈ **32 jam kerja murni**. Mulai dari sekarang, naikkan bulk import CSV (QZ-15) ke prioritas Must, dan tulis soal di spreadsheet agar dapat diimpor massal.

### 13.3 Tim

Pengembangan dilakukan dengan bantuan AI untuk desain dan kode (§13.4), sehingga komposisi timnya berbeda dari proyek konvensional.

| Peran | Jumlah | Keterlibatan |
|---|---|---|
| Product Owner / Reviewer teknis | 1 | Penuh — mengarahkan AI, meninjau setiap keluaran, menjalankan checklist §12.6 |
| Content Specialist | 1 | Penuh, paralel — naskah materi, artikel, soal quiz |
| Ahli Gizi (reviewer + konsultan) | 0,25 | **Wajib** — verifikasi seluruh konten kesehatan, balas pertanyaan WhatsApp |
| Perekam & editor video | 0,25 | 18 video × 3–5 menit |
| AI (desain + kode) | — | Menghasilkan kode, komponen, skema, tes |

Peran Designer, Fullstack Engineer, QA, dan DevOps ditiadakan sebagai posisi terpisah — pekerjaannya dikerjakan AI di bawah arahan dan verifikasi Product Owner.

> **Konsekuensi yang perlu disadari:** peran paling kritis bukan lagi "yang menulis kode", melainkan **"yang memverifikasi kode"**. Satu orang yang mereview keluaran AI adalah titik kegagalan tunggal proyek ini. Jika orang tersebut tidak bisa membedakan kode yang benar dari kode yang *terlihat* benar, tidak ada lapisan pengaman lain. Ini alasan checklist §12.6 dibuat sebagai prosedur konkret yang bisa dijalankan siapa pun, bukan sebagai penilaian subjektif.

### 13.4 Model Eksekusi dengan AI

#### Pembagian kerja

| Kategori | Aman diserahkan ke AI | Wajib diverifikasi manusia |
|---|---|---|
| **Sangat cocok** | Komponen UI, form, halaman CRUD, layout responsive, skema Drizzle, migrasi, seed data, tes E2E, boilerplate API, penulisan tipe, refactor | Verifikasi visual di 360/768/1280px |
| **Cocok dengan pengawasan** | Logika progress, perhitungan nilai, upload R2, integrasi Better Auth, editor TipTap | Uji manual alur ujung-ke-ujung |
| **Berisiko tinggi** | Serialisasi respons quiz, pemeriksaan RBAC, kepemilikan data (IDOR), timer server, presigned URL, sanitasi konten, rate limit | **Wajib — checklist §12.6** |
| **Jangan serahkan ke AI** | Isi materi gizi & kesehatan, teks artikel, soal & pembahasan quiz, klaim medis | Ditulis manusia, diverifikasi ahli gizi |

#### ⚠️ Konten kesehatan tidak boleh dihasilkan AI tanpa verifikasi

Ini pengecualian terpenting. AI dapat menghasilkan klaim gizi yang terdengar meyakinkan tetapi salah, ketinggalan zaman, atau tidak berlaku untuk konteks Indonesia. Untuk topik kesehatan, kesalahan semacam ini membawa risiko reputasi dan hukum yang nyata (R-06), dan Google secara eksplisit menilai kredibilitas sumber pada kategori konten ini.

Aturannya: AI boleh membantu menyusun kerangka, merapikan bahasa, dan memformat — tetapi **setiap klaim faktual harus berasal dari atau diverifikasi oleh ahli gizi**, dengan sumber rujukan tercatat. `articles.reviewer_id` yang wajib terisi sebelum publish adalah penegakan teknis dari aturan ini.

#### Urutan pengerjaan yang cocok untuk AI

Urutan ini meminimalkan pengulangan kerja, karena setiap tahap menjadi kontrak yang dipatuhi tahap berikutnya:

```
1. Design tokens & komponen dasar   → kunci warna, tipografi, spacing, komponen
                                       shadcn. Semua layar disusun dari sini,
                                       bukan diciptakan ulang tiap kali.
2. Skema Drizzle lengkap            → jadi sumber kebenaran tipe untuk semua kode
3. Skema Zod + fungsi serialisasi   → tentukan eksplisit field apa yang boleh keluar
4. Auth & RBAC + policy per modul   → dibangun sebelum fitur, bukan ditambal sesudah
5. Fitur, satu modul per sesi       → CMS dulu (butuh data untuk menguji sisi user)
6. Tes E2E untuk alur kritis        → quiz, akses materi, login
```

**Kenapa desain didahulukan:** ini penyebab inkonsistensi nomor satu pada UI buatan AI. Tanpa token dan komponen yang dikunci di awal, setiap sesi akan menghasilkan tombol, spacing, dan warna yang sedikit berbeda — dan pada layar ke-20, aplikasinya terlihat seperti dibuat lima orang berbeda. Kunci token dulu, lalu larang AI membuat komponen baru bila komponen yang ada sudah cukup.

**Kenapa skema didahulukan:** skema Drizzle memberi AI konteks tipe yang konsisten lintas sesi. Tanpa itu, AI akan mengarang nama field yang berbeda-beda di tiap file.

#### File konteks repositori

Buat satu file di root repositori (`CLAUDE.md` atau `AGENTS.md`) berisi aturan yang harus dipatuhi AI di **setiap** sesi. Tanpa ini, konteks hilang setiap kali sesi baru dimulai dan konsistensi ikut hilang. Isi minimalnya:

```
- Stack & versi: Next.js 16.3 App Router, TypeScript strict, Drizzle, Tailwind v4, shadcn/ui
- Struktur folder wajib (§10.2) — modul tidak boleh saling impor queries.ts
- Design tokens: daftar warna, skala tipografi, spacing yang boleh dipakai
- Aturan keamanan: SELALU serialisasi eksplisit, JANGAN kembalikan objek DB mentah,
  SELALU cek kepemilikan di query, SELALU validasi input dengan Zod
- Aturan quiz: is_correct tidak pernah dikirim sebelum submit; timer dihitung server
- Bahasa UI: Indonesia. Bahasa kode & komentar: Inggris.
- Mobile-first: tulis gaya dasar untuk 360px, tambahkan dengan min-width
```

#### Ritme kerja yang disarankan

| Praktik | Alasan |
|---|---|
| Satu modul per sesi, jangan lintas modul | Menjaga konteks tetap fokus dan keluaran tetap konsisten |
| Commit kecil dan sering, satu fitur satu commit | Memudahkan menemukan penyebab saat ada yang rusak |
| Minta AI menulis tes bersamaan dengan fiturnya | Tes menjadi jaring pengaman untuk perubahan berikutnya |
| Jalankan `tsc --noEmit` dan lint sebelum menerima kode | Menangkap sebagian besar kesalahan integrasi secara otomatis |
| Sebelum mulai sesi, tunjukkan kode terkait yang sudah ada | Mencegah AI membuat versi kedua dari sesuatu yang sudah ada |
| Jangan minta fitur besar sekaligus | Semakin besar permintaan, semakin besar peluang AI mengarang detail |

#### Dampak pada jadwal

Penulisan kode akan lebih cepat, tetapi **verifikasi menjadi jalur kritis baru** dan produksi konten sama sekali tidak terbantu.

| Aktivitas | Konvensional | Dengan AI |
|---|---|---|
| Fase 0 — fondasi | 2 minggu | ~1 minggu |
| Fase 1 — kode fitur | 9 minggu | ~6 minggu |
| Verifikasi & perbaikan | (bagian dari sprint) | **+2 minggu** — jangan dihilangkan |
| Produksi konten (240 soal, 18 video, 6 artikel) | 10 minggu | **10 minggu — tidak berubah** |
| **Total realistis** | ~12 minggu | **~10–11 minggu**, dibatasi produksi konten |

Kesimpulannya: **konten, bukan kode, yang menentukan tanggal rilis Anda.** Mulai produksi konten di minggu pertama.

### 13.5 Panduan Desain UI/UX dengan AI

> **Status v1.3: tahap desain selesai.** Desain final ada di handoff Claude Design BINZI (lihat §17.4). Untuk implementasi, acuan tampilannya adalah `TOKENS.md`, `COMPONENTS.md`, dan `SCREENS.md` di folder desain — bukan tabel token di bawah. Bagian ini dipertahankan sebagai catatan proses dan sebagai checklist review. Beberapa pola di daftar "hindari" (label mono huruf besar, panah pada sebagian CTA) dipakai secara terbatas di desain final dan **diterima sebagai bagian desain final**; jangan menambahkannya di luar tempat yang sudah didesain.

#### Yang perlu diluruskan lebih dulu: UX-nya sudah selesai

"Desain" mencakup dua hal yang sangat berbeda tingkat kesulitannya untuk AI:

| | **UX** — struktur, alur, navigasi, hierarki informasi | **UI** — warna, tipografi, spacing, komponen |
|---|---|---|
| Sumbernya | Pemahaman terhadap pengguna & tujuan produk | Sistem visual yang konsisten |
| Kemampuan AI | Lemah — cenderung menyalin pola umum tanpa alasan | Kuat — sangat cepat begitu tokennya dikunci |
| Status di proyek ini | **Sudah ditentukan** di dokumen ini | Belum — perlu dikerjakan |

Keputusan UX yang penting sudah tertulis: sitemap dan navigasi (§7.1–7.2), struktur beranda (§7.3), tiga alur kritis (§7.4), struktur section konsultasi di Beranda (§5.4), dan aturan gerbang materi (§6.2). Jadi **AI tidak perlu menciptakan UX — ia perlu mengeksekusinya.** Ini penting karena UX adalah tempat AI paling sering salah: ia akan menghasilkan sesuatu yang terlihat masuk akal namun tidak mempertimbangkan bahwa pengguna Anda membaca artikel di HP saat jam istirahat dengan kuota terbatas.

Praktiknya: setiap kali meminta AI mendesain sebuah layar, **sertakan bagian PRD yang relevan sebagai konteks**, bukan sekadar nama layarnya.

#### Alur kerja dengan Claude Design

Desain UI/UX dikerjakan di **Claude Design** — kanvas visual dari Anthropic Labs yang menghasilkan HTML/CSS langsung dan dapat diserahkan ke Claude Code sebagai *handoff bundle*. Ini menghilangkan tahap penerjemahan mockup ke kode yang biasanya memakan waktu terbanyak.

```
1. Wireframe kasar 12 layar utama    → kotak & label saja, tanpa warna.
                                        Boleh di kertas atau Excalidraw.
                                        Tujuannya menyepakati tata letak.

2. Bangun DESIGN SYSTEM di Claude    → warna, tipografi, spacing, radius,
   Design sebagai artefak pertama       komponen dasar. Ini artefak yang akan
                                        dirujuk seluruh layar berikutnya.

3. Desain layar per area, bukan       → mulai dari area Belajar (paling
   satu per satu acak                   kompleks), lalu Publik, lalu CMS.
                                        Rujuk design system di setiap sesi.

4. Minta SEMUA state per layar        → gunakan tabel state wajib di bawah
   secara eksplisit                     sebagai bagian dari prompt.

5. Tinjau di 360 / 768 / 1280         → sebelum layar dianggap selesai.

6. Handoff bundle → Claude Code       → desain menjadi kode tanpa
                                        penerjemahan manual.
```

**Kenapa design system dibangun lebih dulu:** Claude Design dapat membaca design system yang sudah ada — tipografi, token warna, komponen — lalu menerapkannya konsisten ke seluruh keluaran berikutnya. Ini menjawab langsung risiko R-19 (inkonsistensi antar sesi), tetapi **hanya jika sistemnya dibuat lebih dulu dan dirujuk secara eksplisit**. Kalau Anda langsung minta "buatkan halaman detail kursus" di sesi pertama, tidak ada sistem yang bisa dirujuk dan setiap layar berikutnya akan sedikit berbeda.

**Setelah Fase 0 selesai, arahkan Claude Design ke repositori kode.** Claude Design bisa membaca codebase, sehingga layar-layar berikutnya dibuat mengikuti komponen yang benar-benar sudah ada, bukan komponen versi baru yang mirip.

**Urutan area yang disarankan: Belajar → Publik → CMS.** Area Belajar berisi layar tersulit (player materi, quiz mode ujian, hasil quiz) dan paling banyak state-nya. Mendesainnya lebih dulu memaksa design system menghadapi kasus tersulit sejak awal; kalau CMS didahulukan, sistemnya akan terbentuk dari layar tabel-dan-form yang sederhana lalu kewalahan saat sampai ke player.

#### Yang tetap harus Anda kerjakan sendiri

Claude Design mempercepat pembuatan, tetapi empat hal berikut tidak diselesaikan olehnya:

| Hal | Kenapa tetap manual |
|---|---|
| **Meminta state kosong & error** | Keluaran default adalah *happy path*. Tabel state wajib di bawah harus disertakan dalam prompt, bukan sebagai tindak lanjut |
| **Verifikasi mobile-first di 360px** | Kanvas cenderung menghasilkan tata letak lebar dulu. Tinjau 360px lebih dulu, bukan terakhir |
| **Menyediakan konten asli** | Judul kursus asli sepanjang 48 karakter merusak tata letak yang dirancang untuk teks placeholder pendek |
| **Memeriksa kontras & target sentuh** | Perlu diuji dengan alat pemeriksa kontras dan di perangkat nyata |

#### Catatan status produk

Claude Design berstatus **research preview**, tersedia untuk pengguna Claude Pro, Max, Team, dan Enterprise tanpa biaya tambahan di luar langganan. Tiga hal yang perlu diantisipasi:

- **Hanya satu editor pada satu waktu** — tidak masalah untuk tim satu orang, tapi perlu koordinasi bila nanti bertambah.
- **Tidak ada impor/ekspor Figma bawaan.** Jika suatu saat Anda perlu menyerahkan desain ke desainer eksternal, ekspornya berupa HTML, PDF, PPTX, atau Canva — bukan `.fig`.
- **Masih berkembang.** Karena berstatus preview, jangan menjadikan satu fitur spesifiknya sebagai satu-satunya jalur kerja. *Handoff bundle* ke Claude Code adalah jalur utama; ekspor HTML tersedia sebagai cadangan.

Periksa kondisi terkini di https://www.anthropic.com/news/claude-design-anthropic-labs sebelum menyusun jadwal yang bergantung padanya.

#### Token yang harus dikunci sebelum layar pertama dibuat

| Kategori | Yang perlu diputuskan |
|---|---|
| Warna | 4–6 warna bernama berdasarkan peran, bukan rupa: `surface`, `text`, `text-muted`, `primary`, `success`, `danger`. Tambah warna khusus untuk status quiz (Lulus / Belum Lulus) |
| Tipografi | 1–2 typeface. Jika 2, perbedaannya harus jelas. Skala ukuran tetap (mis. 12/14/16/20/24/32/40) dengan peran masing-masing |
| Spacing | Satu skala (mis. kelipatan 4px). Semua jarak diambil dari sini, tidak ada angka lepas |
| Radius & elevasi | Maksimal 2–3 nilai. Radius berbeda untuk hierarki berbeda, bukan satu radius untuk semua |
| Panjang baris | Teks materi & artikel maksimal ~70 karakter per baris — ini konten baca-panjang |
| Ukuran font dasar | **16px minimum.** Persona P3 berusia 45+; jangan pakai 14px untuk teks isi |

**Hindari lima pola berikut** — semuanya adalah default yang muncul di hampir semua UI buatan AI dan langsung terbaca sebagai hasil generate:

1. Latar krem hangat + serif kontras tinggi + aksen terakota
2. Semua konten dipotong menjadi kartu bersudut membulat identik, dengan bayangan abu-abu lembut yang sama di semuanya
3. Label ALL-CAPS ber-*letter-spacing* di atas setiap judul
4. Panah `→` ditempelkan di akhir teks tombol dan tautan
5. Animasi *fade-and-slide-up* pada setiap seksi saat digulir

Untuk platform gizi & kesehatan yang dibaca masyarakat umum, arah yang lebih tepat adalah **tenang, terang, dan mudah dibaca** — kredibilitas datang dari kejelasan, bukan dari dekorasi. Satu elemen boleh berani (misalnya perlakuan tipografi di hero); selebihnya tenang.

#### Inventaris layar

Ini yang menentukan besarnya pekerjaan desain, dan angkanya lebih besar dari yang biasanya diperkirakan:

| Area | Jumlah layar |
|---|---|
| Publik | 11 (beranda — termasuk section Tanya Ahli Gizi, katalog, detail kursus, preview materi, artikel ×3, tentang, pencarian, auth ×3) |
| Member | 9 (dashboard, kursus saya, progress kursus, player materi, konfirmasi quiz, quiz, hasil quiz, nilai saya, profil) |
| CMS | 9 (dashboard, kursus, editor materi, quiz builder, artikel, kategori artikel, media, pengguna, pengaturan) |
| **Total** | **~30 layar** |

Dikalikan 3–4 *state* per layar, totalnya sekitar **100 tampilan**. Inilah alasan token harus dikunci lebih dulu — tanpa itu, konsistensi mustahil dijaga di angka sebesar ini.

#### State wajib per layar (bagian yang paling sering dilupakan AI)

AI hampir selalu menghasilkan *happy path* saja. State berikut harus diminta eksplisit:

| Jenis layar | State yang wajib ada |
|---|---|
| Daftar (katalog, artikel, kursus saya) | Normal · **Kosong** · Memuat · Gagal memuat · **Hasil filter kosong** |
| Detail (kursus, artikel, materi) | Normal · Memuat · **Tidak ditemukan (404)** · **Terkunci** (belum login / materi belum terbuka) |
| Formulir (auth, profil, CMS) | Kosong · Terisi · **Error validasi per field** · Sedang mengirim · Berhasil |
| Player materi | Video memuat · **Video gagal dimuat** · **Materi tanpa video** · Video selesai |
| Quiz | Konfirmasi mulai · Sedang berjalan · **Sisa waktu < 2 menit** · **Auto-save gagal** · Waktu habis |
| Hasil quiz | Lulus · Belum lulus · Dibuka kembali dari Nilai Saya |
| Dashboard member | **Pengguna baru (belum ada kursus)** · Pengguna aktif |
| CMS editor | Menyimpan · **Tersimpan** · **Gagal menyimpan** · Konflik/kadaluwarsa |

Dua yang paling kritis untuk produk ini: **dashboard pengguna baru** (kesan pertama setelah registrasi — kalau kosong dan tanpa arahan, user langsung pergi) dan **auto-save gagal saat quiz** (karena hanya ada satu kesempatan, user harus tahu seketika bila jawabannya tidak tersimpan).

#### Kesalahan khas AI dalam UI/UX dan cara mencegahnya

| Kesalahan | Cara mencegah |
|---|---|
| Mendesain desktop lalu mengecilkannya | Minta eksplisit: "tulis gaya dasar untuk 360px, tambahkan dengan `min-width`". Tinjau di 360px lebih dulu, bukan terakhir |
| Memakai teks placeholder pendek | Selalu berikan konten asli. "Gizi Seimbang untuk Ibu Hamil Trimester Pertama" (48 karakter) merusak tata letak yang dirancang untuk "Judul Kursus" |
| Membuat komponen baru padahal sudah ada | Sebelum sesi, tunjukkan daftar komponen yang sudah dibangun dan larang membuat duplikat |
| Melupakan state kosong & error | Sertakan tabel di atas sebagai bagian dari permintaan, bukan sebagai tindak lanjut |
| Kontras rendah pada teks sekunder | Uji dengan pemeriksa kontras; minimum 4,5:1. `text-gray-400` di atas putih hampir selalu gagal |
| Target sentuh terlalu kecil | Minimum 44×44px. Ikon-saja tanpa area sentuh tambahan adalah pelanggaran paling umum |
| Focus state dihapus | `outline: none` tanpa pengganti membuat navigasi keyboard mustahil |
| Inkonsistensi antar sesi | Token di CLAUDE.md + tunjukkan 1–2 layar yang sudah jadi sebagai acuan gaya di awal sesi |

#### Checklist review per layar

Sebelum sebuah layar dianggap selesai:

- [ ] Terlihat benar di 360px, 768px, dan 1280px (+1440px untuk Beranda & Masuk)
- [ ] Semua state dari tabel di atas sudah ada
- [ ] Konten yang dipakai adalah konten asli, bukan placeholder
- [ ] Warna, font, dan spacing seluruhnya berasal dari token — tidak ada nilai lepas
- [ ] Tidak ada komponen baru yang menduplikasi komponen yang sudah ada
- [ ] Kontras teks ≥ 4,5:1
- [ ] Dapat dinavigasi penuh dengan keyboard, focus state terlihat
- [ ] Target sentuh ≥ 44×44px
- [ ] Teks tombol memakai kata kerja aktif yang menyebut akibatnya ("Simpan perubahan", bukan "Kirim")

---

## 14. Acceptance Criteria

### 14.1 Responsive (baru, sesuai penekanan Anda)
- **Ketika** halaman mana pun dibuka pada lebar 360px, **maka** tidak ada scroll horizontal, tidak ada teks terpotong, dan semua tombol dapat disentuh dengan nyaman (≥44px).
- **Ketika** halaman player materi dibuka di 1280px, **maka** daftar materi tampil sebagai kolom samping sticky **di kanan** (desain 7d) dan video tidak melebihi lebar maksimum yang nyaman dibaca.
- **Ketika** perangkat diputar dari portrait ke landscape saat video sedang diputar, **maka** posisi pemutaran tidak ter-reset.

### 14.2 Autentikasi
- **Diberikan** pengunjung belum login, **ketika** klik "Masuk dengan Google" dan menyetujui, **maka** akun dibuat dengan role `MEMBER` dan diarahkan **kembali ke halaman asal**, bukan ke beranda.
- **Diberikan** email Google sama dengan akun email/password terverifikasi, **ketika** login dengan Google, **maka** akun ditautkan, bukan diduplikasi.
- **Diberikan** 5 kali gagal login, **ketika** mencoba lagi, **maka** ditolak dengan pesan yang tidak mengungkap apakah email terdaftar.

### 14.3 Materi & Video
- **Diberikan** pengunjung belum login, **ketika** membuka detail kursus, **maka** seluruh outline materi terlihat dengan ikon gembok, dan materi preview dapat diputar penuh.
- **Diberikan** kursus `is_sequential`, materi 1 belum selesai, **ketika** user mengakses URL materi 2 langsung, **maka** server menolak (403) dan mengarahkan ke materi 1.
- **Diberikan** user menonton sampai 91% lalu menutup browser, **ketika** kembali, **maka** video melanjutkan dari posisi terakhir.
- **Diberikan** admin mengunggah file 250 MB, **ketika** upload dimulai, **maka** ditolak dengan pesan berisi panduan kompresi (§10.3).

### 14.4 Quiz & Nilai
- **Diberikan** quiz `duration_minutes = 15`, **ketika** attempt dimulai, **maka** `expires_at` = waktu server + 15 menit dan tidak dapat diubah dari klien.
- **Ketika** user menekan "Kerjakan Quiz", **maka** muncul layar konfirmasi yang menyebut jumlah soal, durasi, peringatan satu kesempatan, dan peringatan bahwa timer terus berjalan; **timer belum dimulai** sampai user menekan "Mulai Sekarang".
- **Diberikan** user menekan "Nanti Saja", **maka** tidak ada attempt yang dibuat dan quiz tetap dapat dikerjakan lain waktu.
- **Diberikan** attempt berjalan, **ketika** user menutup browser dan kembali 5 menit kemudian, **maka** attempt yang sama dilanjutkan dengan sisa waktu berkurang 5 menit dan seluruh jawaban yang sudah diisi masih ada.
- **Diberikan** koneksi terputus di menit ke-12, **maka** jawaban yang tersimpan sebelum putus tetap dinilai saat auto-submit.
- **Diberikan** waktu habis, **maka** server menilai jawaban tersimpan dan menandai attempt `EXPIRED` — jawaban tidak hilang.
- **Ketika** memeriksa response API soal quiz sebelum submit, **maka** tidak ada field `is_correct` maupun `explanation`.
- **Diberikan** user submit dengan nilai 40 (di bawah 70), **maka** ditampilkan status BELUM LULUS **beserta pembahasan lengkap semua soal**, materi ditandai SELESAI, dan materi berikutnya terbuka.
- **Diberikan** quiz sudah disubmit, **ketika** user membuka halaman quiz lagi, **maka** yang tampil adalah hasil & pembahasan, bukan soal — dan tombolnya berbunyi "Lihat Hasil & Pembahasan".
- **Diberikan** quiz sudah disubmit, **ketika** klien memaksa membuat attempt baru lewat API, **maka** server menolak dengan 409.
- **Diberikan** admin mereset attempt seorang user dengan alasan, **maka** user dapat mengerjakan quiz itu sekali lagi dan aksi reset tercatat di audit log.
- **Diberikan** semua materi selesai dan Final Quiz sudah dikerjakan, **maka** status kursus SELESAI; badge "Lulus" muncul hanya bila Final Quiz lulus.
- **Diberikan** quiz dengan 9 soal, **ketika** admin mencoba publish, **maka** ditolak dengan pesan yang menyebut minimum 10.

### 14.5 Ulangi Kursus
- **Diberikan** kursus berstatus SELESAI, **ketika** user menekan "Ulangi Kursus" dan mengonfirmasi, **maka** progress materi di-reset, `reset_count` bertambah 1, **seluruh quiz dapat dikerjakan kembali sekali lagi**, dan **riwayat nilai siklus sebelumnya tetap terlihat** di Nilai Saya dengan label siklus.

### 14.6 Artikel
- **Diberikan** artikel `PUBLISHED`, **ketika** diakses tanpa login, **maka** konten tampil penuh, dirender di server, dan lolos validasi structured data Google.
- **Ketika** admin mencoba menghapus kategori berisi artikel, **maka** ditolak dengan opsi memindahkan artikel.
- **Ketika** admin mem-publish artikel tanpa reviewer ahli gizi, **maka** ditolak.

### 14.7 Konsultasi (section Beranda)
- **Ketika** pengunjung yang belum login mengklik nav "Konsultasi" dari halaman mana pun, **maka** diarahkan ke Beranda dan langsung berada di section "Tanya Ahli Gizi" tanpa diminta login.
- **Ketika** nav "Konsultasi" diklik saat sudah di Beranda, **maka** halaman scroll halus ke section (instan bila `prefers-reduced-motion` aktif), dan judul section tidak tertutup header sticky.
- **Ketika** nav "Konsultasi" diklik dari drawer mobile, **maka** drawer tertutup dan halaman scroll ke section.
- **Ketika** URL `/#tanya-ahli-gizi` dibuka langsung (mis. dari tautan yang dibagikan), **maka** halaman terbuka tepat di section tersebut.
- **Ketika** tombol WhatsApp ditekan di HP, **maka** aplikasi WhatsApp terbuka dengan nomor tujuan benar dan pesan template sudah terisi; **ketika** ditekan di desktop, **maka** WhatsApp Web terbuka dengan hasil yang sama.
- **Ketika** nav "Konsultasi" diklik, **maka** event `consultation_nav_clicked` terkirim beserta halaman asal; **ketika** tombol WhatsApp ditekan, **maka** event `consultation_whatsapp_clicked` terkirim.
- **Ketika** section ditampilkan, **maka** disclaimer medis dan jalur darurat (119) berada sebelum tombol WhatsApp dalam urutan baca.
- **Ketika** admin mengubah nomor WhatsApp di pengaturan sistem, **maka** tautan berubah tanpa perlu deploy ulang.
- **Ketika** section dibuka di 360px, **maka** seluruh isi tampil satu kolom tanpa scroll horizontal dan tombol WhatsApp berukuran ≥ 44px.

### 14.8 CMS
- **Ketika** admin menyisipkan URL video ke editor teks materi, **maka** editor menolak; dan jika payload dipaksa lewat API, server juga menolak.
- **Diberikan** admin sedang mengedit materi, **ketika** koneksi terputus 30 detik, **maka** perubahan tidak hilang (auto-save + indikator status).

### 14.9 Gerbang Rilis
- [ ] Lighthouse mobile ≥ 90 (Performance), ≥ 95 (Accessibility, SEO) pada beranda, artikel, detail kursus
- [ ] Diuji manual pada 360px, 768px, 1280px (+1440px untuk Beranda & Masuk) + perangkat Android & iOS nyata
- [ ] **Checklist review desain per layar (§13.5) dijalankan untuk seluruh ~30 layar**
- [ ] Alur kritis tercakup tes E2E dan hijau
- [ ] **Checklist verifikasi keamanan §12.6 (V-01 s/d V-10) dijalankan seluruhnya dan lolos**
- [ ] Seluruh konten kesehatan sudah ditandatangani ahli gizi (`reviewer_id` terisi)
- [ ] Backup harian berjalan **dan restore sudah diuji minimal sekali**
- [ ] Sentry, uptime monitor, dan GitHub Actions cron aktif
- [ ] Kebijakan Privasi, S&K, Disclaimer Medis, section Tanya Ahli Gizi di Beranda ditinjau (idealnya oleh penasihat hukum)
- [ ] **Data dummy sudah diganti data asli:** nomor STR ahli gizi (tampil di Beranda, Tentang Kami, artikel) dan nomor WhatsApp di `system_settings` (OQ-08, OQ-09)
- [ ] Nomor WhatsApp diuji dari HP Android & iOS serta dari desktop; scroll nav "Konsultasi" diuji dari Beranda, halaman lain, dan drawer mobile
- [ ] 3 kursus + 6 artikel terbit, seluruhnya sudah direview ahli gizi
- [ ] Admin dilatih & dokumentasi CMS + panduan kompresi video tersedia
- [ ] Prosedur rollback terdokumentasi

---

## 15. Risiko & Mitigasi

| # | Risiko | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|---|
| **R-01** | **6 artikel terlalu sedikit untuk menghasilkan trafik organik** | Tinggi | **Tinggi** | Lihat catatan di bawah |
| R-02 | ~210 soal quiz tidak selesai tepat waktu | Tinggi | Tinggi | Mulai minggu 1; bulk import CSV (QZ-15) dinaikkan ke Must; tulis soal di spreadsheet. Beban tidak jadi naik ke 420 karena question bank tidak lagi wajib (§6.3.1) |
| R-03 | Free tier berubah kebijakan atau project di-pause | Sedang | Sedang | Cron keep-alive; backup harian ke R2; semua komponen punya pengganti setara |
| R-04 | Klausul non-komersial Vercel Hobby | Sedang | Sedang | Hobby dipakai selama fase penelitian (trafik kecil, non-komersial). Pindah ke Vercel Pro ($20) atau Cloudflare Workers saat rilis publik atau bila ada monetisasi / pihak yang dibayar untuk membangunnya (§9.4) |
| R-05 | Video buffering di koneksi lambat karena tanpa adaptive bitrate | Sedang | Sedang | Batasi 5 menit & 60 MB; panduan kompresi wajib; siapkan migrasi ke HLS di fase 2 |
| R-06 | Konten kesehatan tidak akurat → risiko reputasi & hukum | **Sangat tinggi** | Sedang | Review ahli gizi wajib sebelum publish; disclaimer; kredensial ditampilkan; daftar rujukan |
| R-07 | Fitur Konsultasi menimbulkan ekspektasi klinis / risiko regulasi | **Tinggi** | Sedang | Judul section "Tanya Ahli Gizi"; daftar batasan tertulis; jalur darurat 119; panduan internal untuk ahli gizi; tinjauan hukum |
| R-13 | Nomor WhatsApp publik menjadi sasaran spam atau penyalahgunaan | Sedang | Sedang | Gunakan WhatsApp Business bernomor khusus; jangan tulis nomor sebagai teks (hanya tautan `wa.me`); siap ganti nomor lewat `system_settings` tanpa deploy |
| R-14 | Permintaan konsultasi tidak terukur karena tidak dicatat | Rendah | Tinggi | Lacak klik tombol sebagai event analitik — cukup untuk memutuskan apakah formulir/booking layak dibangun di fase 2 |
| R-08 | Nilai di-*farming* | **Hilang** | — | Tidak ada pengulangan, jadi tidak ada yang bisa di-farming (§6.3.1) |
| R-09 | Drop-off karena tersangkut quiz | **Hilang** | — | Tidak ada gerbang kelulusan; user selalu bisa lanjut (§6.3.1) |
| R-15 | **User kehilangan satu-satunya kesempatan karena masalah teknis** (koneksi putus, salah buka, baterai habis) | **Tinggi** | **Sedang** | Layar konfirmasi wajib (QZ-18) + auto-save andal (QZ-09) + reset attempt oleh admin (QZ-19) + tautan bantuan di halaman hasil. Lihat §6.3.2 |
| R-16 | Soal ambigu merusak nilai user secara permanen | Sedang | Sedang | Review ahli gizi; analitik butir soal (QZ-16); reset attempt untuk user terdampak bila soal terbukti keliru (§6.3.4) |
| R-17 | Soal & pembahasan disebarkan antar user (screenshot) | Rendah | Sedang | Dampak rendah karena tanpa sertifikat tidak ada taruhan. Question bank di fase 2 bila jadi masalah |
| R-18 | **Kode buatan AI lolos verifikasi dengan celah keamanan yang tidak terlihat dari UI** | **Sangat tinggi** | **Tinggi** | Checklist §12.6 dijalankan sebagai prosedur wajib tiap akhir sprint, bukan pemeriksaan ad hoc. Tes E2E untuk alur quiz & akses materi |
| R-19 | **Inkonsistensi UI antar layar** karena tiap sesi AI menghasilkan gaya berbeda | Sedang | Sedang | Bangun design system di Claude Design sebagai artefak pertama dan rujuk di setiap sesi; arahkan ke repositori setelah Fase 0; token juga dicantumkan di CLAUDE.md (§13.5) |
| R-22 | **State kosong, error, dan gagal-simpan tidak dibuat** karena AI hanya menghasilkan happy path | Sedang | **Sangat tinggi** | Tabel state wajib (§13.5) disertakan dalam setiap permintaan desain layar, bukan sebagai tindak lanjut |
| R-23 | Desain dibuat desktop-first lalu dikecilkan, sehingga tampilan mobile terasa sisa | Sedang | Tinggi | Tinjau di 360px lebih dulu, bukan terakhir; instruksi mobile-first eksplisit di CLAUDE.md (§1, §13.5) |
| R-20 | **AI menghasilkan klaim gizi yang salah atau tidak berlaku di Indonesia** | **Sangat tinggi** | **Tinggi** | Konten kesehatan tidak boleh dihasilkan AI tanpa verifikasi. `reviewer_id` wajib terisi sebelum publish (§13.4) |
| R-21 | Satu orang menjadi titik kegagalan tunggal (pengarah sekaligus pemverifikasi) | Tinggi | Sedang | Checklist §12.6 dibuat sebagai prosedur konkret yang dapat dijalankan orang lain; tes E2E sebagai jaring pengaman otomatis |
| R-10 | Supabase free tanpa backup otomatis → kehilangan data | **Tinggi** | Rendah | Cron `pg_dump` harian ke R2 + uji restore bulanan (wajib, bukan opsional) |
| R-11 | Kepatuhan UU PDP | Sedang | Sedang | Persetujuan eksplisit saat registrasi, hak akses & hapus, retensi terdefinisi. Risiko turun karena data kesehatan tidak masuk sistem |
| R-12 | Scope creep sebelum MVP rilis | Tinggi | Tinggi | Backlog fase 2 & 3 tertulis; penambahan harus menggeser item lain |

### Catatan R-01 (perlu perhatian Anda)

Rencana "6 kategori × 1 artikel" menciptakan masalah struktural, bukan sekadar masalah jumlah:

1. **Halaman kategori akan terlihat kosong.** Membuka `/artikel/kehamilan` dan menemukan satu artikel memberi kesan platform belum jadi.
2. **Google memberi sedikit trafik pada situs dengan 6 halaman konten.** Otoritas topikal terbentuk dari kedalaman, bukan keluasan.
3. **Fitur "Artikel Terkait" tidak akan punya bahan** — tidak ada artikel lain dalam kategori yang sama.

**Rekomendasi alternatif dengan jumlah tulisan yang sama:**

| | Rencana Anda | Usulan saya |
|---|---|---|
| Kategori | 6 | **3** |
| Artikel per kategori | 1 | **2** |
| Total artikel | 6 | **6** (sama) |
| Halaman kategori | Terlihat kosong | Terisi wajar |
| Artikel Terkait | Kosong | Berfungsi |
| Otoritas topikal | Menyebar tipis | Terfokus |

Beban kerja identik — hanya distribusinya yang berbeda. Tiga kategori sisanya dapat ditambahkan di bulan ke-2 setelah masing-masing punya 2–3 artikel. Struktur database tetap mendukung berapa pun jumlah kategori, jadi ini murni keputusan konten.

---

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

---

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
