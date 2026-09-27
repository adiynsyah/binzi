> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

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
