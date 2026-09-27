# Komponen — BINZI

Bangun **sekali** di Fase 0 (kecuali yang ditandai fase lain), lalu dipakai ulang. Kolom "Contoh" = ID layar tempat komponen terlihat paling jelas. Semua kendali wajib punya 5 state: default · hover · focus · disabled · loading (17b).

## Dasar (`components/ui` — turunan shadcn)
| Komponen | Varian | Contoh | Catatan |
|---|---|---|---|
| Button | primary · secondary (garis) · dark · ghost · danger | 17b, 7d, 28a | Tinggi 50–54 / 46–48; loading = label kata kerja + terkunci; disabled warna padat |
| Input / Field | default · terisi · error · disabled | 17b, 2b, 3c | Tinggi 52; pesan error per field di bawah input |
| Password field | + syarat hidup | 3a, 3d | Syarat tampil sebagai pil di mobile |
| Checkbox / Toggle | — | 3a, 9c | Toggle 48×28 |
| Chip filter | aktif · diam · dengan ✕ | 7a, 5a, 28e | Tinggi 38–40, radius 999 |
| Badge status | Belum dimulai · Sedang berjalan · Selesai · Lulus · Siklus ke-n · Menunggu persetujuan | 16c, 13b, 19b | Satu bentuk untuk semua layar |
| Tabs (garis bawah) | — | 7d, 23a | Aktif = garis 2px primary |
| Dialog | modal 560 · sheet bawah (mobile) | 7d, 16a, 25d, 29b | Sheet di < 640px |
| Dropdown / Menu | — | 13a, 29a | Bayangan menu |
| Banner | info (kuning) · error (merah) · sukses (hijau) | 7d, 20c, 28c | `role="alert"` untuk error, `role="status"` untuk sukses; sukses hilang sendiri 4 dtk (28c-3). Tidak ada komponen toast terpisah |
| Skeleton | kartu · baris | 28d | Muncul setelah 300 ms; bentuk meniru kartu asli |
| Empty state | kosong · filter kosong · gagal memuat | 13c, 8f, 11c, 28d, 28e | Selalu ada 1 aksi utama + 1 alternatif |
| Progress bar | tipis 7–8px | 8a, 7d | Hijau = progress kursus, primary = sedang berjalan |
| Pagination | — | 5h | 9 per halaman |
| Avatar | inisial · foto | 13a, 5b | Radius 999 |

## Kerangka layout (`components/shared`)
| Komponen | Contoh | Catatan |
|---|---|---|
| Header publik (tamu) | 7a | Logo · Beranda · Kursus · Artikel · Konsultasi (scroll) · Tentang · Cari · Masuk · Daftar Gratis |
| Header member | 8a, 13a | "Belajar" menggantikan Beranda; avatar + menu akun |
| Header mode fokus (player/quiz) | 7d, 29a | Logo mark + judul kursus + progress |
| Drawer mobile | 1d, 13d | Menutup otomatis setelah item diklik |
| Bottom nav area belajar | 8e, 28g, 29b | Materi · Quiz · Progress, hanya < 768px |
| Footer | 1a | Navigasi lengkap + legal |
| Sidebar CMS | 19a, 19b, 19e | 248px; isi berbeda per peran; tablet = rel ikon, ponsel = drawer |
| Halaman legal (daftar isi menempel) | 12c, 12f | Isi maks 72 karakter |

## Domain — publik & member (`components/public`, `components/learn`)
| Komponen | Contoh | Fase |
|---|---|---|
| Kartu kursus | 7a, 1a | S6 |
| Kartu artikel (besar & baris) | 5a, 5g | S4 |
| Blok peninjau ahli gizi | 5b, 7b | S4 |
| Outline materi (terkunci / status per materi) | 7b, 8c | S2 |
| Kartu "Lanjutkan belajar" | 8a, 28a | S5 |
| Kartu statistik (angka mono + label) | 8a, 19b | S5 |
| Video player + kontrol (kecepatan, CC, layar penuh, resume) | 29a, 29b, 28f, 7d | S2 |
| Daftar materi samping player | 7d | S2 |
| Dialog konfirmasi satu kesempatan | 7d, 7h | S3 |
| Timer quiz (normal · < 2 menit) | 7g | S3 |
| Pager soal (dijawab · aktif · kosong · ragu · belum tersimpan) | 7g, 28c | S3 |
| Opsi jawaban | 7e, 7g | S3 |
| Indikator & banner auto-save | 28c | S3 |
| Hasil quiz + pembahasan | 7e, 7h | S3 |
| Tabel Nilai Saya (+ riwayat siklus) | 8b, 16b | S5 |
| Section Tanya Ahli Gizi (profil, batasan, jam, disclaimer + 119, tombol WhatsApp) | 1a, 1d | S6 |
| Tombol WhatsApp | 1a, 1d | S6 — terang netral, hover oranye; **bukan** hijau WhatsApp (keputusan produk, lihat README) |
| Kotak disclaimer / jalur darurat 119 | 12e, 1a | S6 |
| Kotak pencarian + hasil gabungan | 11a | S6 |

## Domain — CMS (`components/cms`)
| Komponen | Contoh | Fase |
|---|---|---|
| Tabel data (filter status, cari, baris ke detail) | 19c, 25a, 27c | S1 |
| Kartu antrean persetujuan | 19b, 19d | S1 |
| Checklist validasi pra-terbit | 19d, 20d | S1 |
| Editor TipTap + toolbar satu baris | 20a | S1 |
| Indikator simpan (menyimpan · tersimpan · gagal · konflik) | 20c | S1 |
| Outline seret (drag & drop) | 21a, 23a | S1 |
| Unggah file (progres per file, galat per file) | 21c, 24c | S1 |
| Kartu aset media (+ jumlah pemakaian) | 24a | S1 |
| Pemilih media | 24d | S1 |
| Editor soal (kunci di opsi, pembahasan wajib) | 22b | S3 |
| Impor CSV + laporan baris gagal | 22c | S3 |
| Tampilan sebelum → sesudah | 27b, 27c | S5 |
