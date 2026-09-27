# Daftar Layar — BINZI MVP

Satu baris = satu route/layar. **Utama** = layar acuan desktop. Kolom state berisi ID layar yang menggambar state tersebut. Lihat `../screens/<ID>.md` dan `../screens/<ID>.png` (atau buka `../source/Binzi Landing Hero.dc.html#<ID>` di browser).

Singkatan varian: **m** = mobile 360, **t** = tablet 768.

## Referensi lintas layar (baca sebelum layar mana pun)
| ID | Isi |
|---|---|
| 17a | Token warna, tipografi, spasi |
| 17b | Komponen + 5 state wajib (default, hover, focus, disabled, loading) |
| 17c | Breakpoint & grid |
| 17d | Checklist state per layar & aksesibilitas — pakai sebagai definisi "selesai" |
| 16c | Sistem badge status kursus (PRG-06 + siklus) |
| 16d · 16e | Aturan tablet 768 · satu layar di tiga lebar |
| 10a | Peta alur UX — hubungan antar layar |
| 28d | Pola memuat (skeleton) & gagal memuat — **berlaku untuk semua daftar** |
| 28e | Pola hasil filter kosong — berlaku untuk katalog & artikel |

## Publik
| Route | Utama | m / t | State | PRD |
|---|---|---|---|---|
| `/` Beranda | 1a (hero pakai ilustrasi **6b**/6a, bukan kartu video) | 1d / 1t | section `#tanya-ahli-gizi` ada di 1a & 1d | §7.3, KSL-01…14 |
| `/kursus` | 7a | 7f / 7t · 16e | memuat & gagal 28d · filter kosong 28e-1, 28g-2 | CRS, SRC-02 |
| `/kursus/{slug}` | 7b | 7m / 7t | outline terkunci (dalam 7b) · 404 → 14a | CRS-03, CRS-11 |
| `/kursus/{slug}/preview/{materi}` | 7c | 7m | gerbang daftar setelah preview habis (dalam 7c) | CRS-09, §7.4 A |
| `/artikel` | 5a | 5c / 5t | memuat & gagal 28d · filter kosong 28e-2 | ART-05, SRC-03 |
| `/artikel/{kategori}` | 5e | 5f | 2–5 artikel 5g/5i · 6+ artikel + paginasi 5h/5j | ART-05 |
| `/artikel/{kategori}/{slug}` | 5b | 5d / 5t | 404 → 14a | ART-01…08 |
| `/tentang` | 4a | 4b / 4t | formulir kontak (dalam 4a/4b) | ABT-01…06 |
| `/cari` | 11a | 11b / 11t | hasil kosong 11c | SRC-01 |
| `/kebijakan-privasi` | 12c | 12f / 12t | — | §8.4 |
| `/syarat-ketentuan` | 12d | 12f / 12t | — | — |
| `/disclaimer` | 12e | 12f / 12t | — | §5.5 |
| `/masuk` | 2a | 2d / 2t | error field, gagal, terkunci 5×, berhasil 2b · modal di tengah alur 2c | AUTH-01…10 |
| `/daftar` + verifikasi | 3a | 3d / 3t | state tepi 3c (error, tautan kedaluwarsa, akun Google tertaut) | AUTH-01…05, AUTH-10 |
| `/lupa-password` | 3b | — | tautan kedaluwarsa 3c, 15b-2 | AUTH-04 |
| 404 / 500 | 14a | 14b / 14t | — | — |
| Email transaksional | 15a (verifikasi, reset, selamat datang) | 15b | tautan kedaluwarsa 15b-2 | NTF-01 |

## Member (wajib login)
| Route | Utama | m / t | State | PRD |
|---|---|---|---|---|
| Menu akun (header) | 13a | 13d-1 | — | §7.1 |
| `/belajar` Dashboard | 8a (pengguna aktif) | 8e / 8t | **pengguna baru 28a / 28b** | PRG-02, PRG-03 |
| `/belajar/kursus-saya` | 13b | 13d-2 / 13t | kosong 13c · memuat/gagal 28d | PRG-06 |
| `/belajar/nilai` Nilai Saya | 8b | 8e / 8t | kosong 8f · riwayat siklus 16b | PRG-04, PRG-05, QZ-20 |
| `/belajar/{slug}` progress kursus | 8c | — | status per materi (dalam 8c) | PRG-07, PRG-10 |
| `/belajar/{slug}/{materi}` Player | 7d | 7f · 29b / 7t | diputar + kontrol 29a · memuat & selesai 28f · gagal dimuat 7d · selesai (m) 28g-3 · konfirmasi mulai quiz (dialog di 7d) | CRS-03, CRS-10, PRG-01 |
| `…/{materi}/quiz` Quiz materi | 7e | 7f / 7u | **auto-save gagal 28c, 28g-1** · ditunda 7j · sisa < 2 mnt & waktu habis (dalam 7e/7g) · hasil + pembahasan (dalam 7e) | QZ-01…12, QZ-21 |
| `/belajar/{slug}/final-quiz` | 7g (interaktif) | 7n / 7u | konfirmasi & hasil + Nilai Akhir 7h · auto-save gagal pakai pola 28c | QZ-13, PRG-05 |
| Lapor gangguan quiz | 7i | 7l | 3 langkah: lapor · menunggu · hasil | QZ-19 |
| Kursus selesai + Ulangi | 7k | 7l | konfirmasi ulangi & sesudah reset 16a | CRS-12, §6.3.3 |
| `/profil` | 9c | 9d · 9e / 9t | ubah data, password, sesi aktif, hapus akun, unduh data (9e) | AUTH-06, AUTH-09, §8.4 |

## CMS (`/cms`, staf — sidebar terpisah dari nav publik)
Peran mengikuti **18d**: ahli gizi (EDITOR) menggarap konten, admin menyetujui & menerbitkan. Menu tanpa hak akses **tidak ditampilkan**.

| Route | Utama | t / m | State | PRD |
|---|---|---|---|---|
| `/cms` Ringkasan | 19b (admin) · 19a (ahli gizi) | 19e | — | CMS-01 |
| Daftar konten | 19c | 19e | — | CMS-05 |
| Keputusan terbit | 19d | — | pratinjau + checklist + 3 aksi | CMS-05, CMS-06, CMS-11 |
| Editor artikel | 20a | 20e (ponsel: tidak dibuka) | tolak node video 20b · simpan: menyimpan/tersimpan/gagal/konflik 20c · kirim persetujuan 20d | CRS-04, CRS-05, CMS-03 |
| `/cms/kursus` | 21e | — | kursus baru (dialog) 21f → 21g | CMS-02 |
| Builder kursus | 21a | 21d | — | CMS-02 |
| Editor materi | 21b | — | tambah materi 21h · kosong 21i · unggah video (4 state) 21c | CMS-03 |
| Daftar quiz | 22f | — | beda quiz materi vs final 22g | — |
| Editor quiz | 22a · 22h (quiz materi) | 22e | satu soal 22b · impor CSV 22c · penjaga < 10 soal & sudah dikerjakan 22d | CMS-04, QZ-02…04 |
| `/cms/kategori` | 23a | 23t | hapus ditolak 23b · pindah massal 23c · tab tag 23d | CMS-07 |
| `/cms/media` | 24a | 24t | hapus ditolak/konfirmasi 24b · unggah 24c · pemilih media 24d | CMS-08 |
| `/cms/pengguna` | 25a | 25t | detail 25b · ubah peran 25c · nonaktifkan 25d | CMS-09 |
| `/cms/reset-attempt` | 26a | 26t | tinjau laporan 26b · reset tanpa laporan 26c | CMS-10, QZ-19 |
| `/cms/pengaturan` | 27a (Super admin) | — | tinjau & simpan 27b | KSL-08 |
| `/cms/audit-log` | 27c | 27t | — | CMS-12 |

## Tidak dibangun di MVP
Analitik konten (`/cms/analitik`, CMS-13), versioning (CMS-14), jadwal terbit (CMS-15), email pengingat (NTF-03), notifikasi in-app (NTF-04), serta semua item PRD §4.2. Menu "Terjadwal" di sidebar 19b termasuk CMS-15 — sembunyikan di MVP.
