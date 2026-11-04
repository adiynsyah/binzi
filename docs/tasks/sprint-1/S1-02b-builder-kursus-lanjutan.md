# S1-02b · CMS: builder kursus lanjutan — urutkan ulang, hapus, tablet & ponsel

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | S1-02, S1-08 (aturan status), demo 20 Nov selesai |
| **Target** | Setelah 20 Nov |
| **Branch** | `s1/s1-02b-builder-lanjutan` |

> **Dibuat 4 Nov 2026** di Claude chat dari bagian kartu S1-02 versi 24 Okt yang ditunda demi demo 20 Nov (keputusan pemilik 4 Nov). **Ini kartu cadangan, belum siap dikerjakan.** Kartu ini ditulis ulang terhadap kode `main` terbaru sebelum sesinya. Pada saat itu S1-02, S1-03, S1-04, dan S1-08 sudah mengubah builder.

## Tujuan
Melengkapi builder 21a/21d sesuai PRD CMS-02 ("reorder materi drag & drop"): menyusun ulang dan menghapus materi, menghapus kursus draf kosong, serta tata letak tablet dan ponsel. Daftar `/cms/kursus` juga mendapat penanda kelengkapan.

## Isi yang ditunda dari S1-02

### 1. Urutkan ulang materi
- **Seret dan keyboard** (fokus pegangan → Spasi → panah → Spasi), dengan pengumuman pembaca layar berbahasa Indonesia. Pegangan "⋮⋮" tampil di setiap baris (21a).
- **Dependensi:** usulkan `@dnd-kit/core` + `@dnd-kit/sortable` (+ `@dnd-kit/utilities` bila perlu), atau alternatif tanpa dependensi, di rencana. Bila memakai paket: pin eksak, `npm install … --before=<hari ini − 14>`, tanggal rilis setiap entri lockfile baru di PR, dan gate audit dijalankan sebelum dan sesudah.
- **`PUT /api/cms/courses/{id}/lessons/order`** dengan daftar ID lengkap. Himpunannya berbeda dengan materi kursus → 400. Server menulis ulang `order_index` (1…n, rapat) dalam satu transaksi + audit.
- **Preview ikut posisi** (CRS-09): setelah urutan berubah, hanya materi urutan 1 yang `is_free_preview`. Aturan ini dijaga server di transaksi yang sama.
- **Copy 21h** "Urutan tetap bisa diseret di outline kapan saja." ditampilkan kembali. Ringkasan "+ n materi lain · seret untuk mengurutkan" (21a) ikut diputuskan di sini.

### 2. "Setelah materi…" di dialog tambah (21h)
Pilihan "Letakkan": "Di akhir — jadi materi n" atau "Setelah materi… pilih ▾". Sisipan menggeser `order_index` materi sesudahnya di transaksi yang sama.

### 3. Hapus materi
Dialog konfirmasi (copy usulan) → materi dan quiz-nya dihapus, urutan dirapatkan, preview pindah ke materi urutan 1 yang baru, lalu audit. Hanya untuk kursus `DRAFT`.

### 4. Hapus kursus
- Tersedia di panel pengaturan, hanya bila `DRAFT` **dan** `enrollment_count = 0` (21g: "Kursus draf yang kosong bisa dihapus; setelah punya peserta hanya bisa diarsipkan"; §11.4 no. 4).
- Konfirmasi → kursus, materi, semua quiz-nya, dan Final Quiz dihapus dalam satu transaksi + audit → kembali ke `/cms/kursus`.

### 5. Tablet & ponsel
- **Tablet (21d):** panel pengaturan menjadi panel lipat di atas outline ("Pengaturan kursus · n belum lengkap ▾"), dan baris materi menyusut.
- **Ponsel:** builder tampil baca saja dengan keterangan "Buka di tablet atau laptop untuk menyunting." (copy usulan, sejalan dengan 20e).
- Urutan DOM dan urutan fokus ditinjau ulang bersama perubahan ini.

### 6. Daftar `/cms/kursus`
- Kolom kuning (21e "Kolom kuning = belum boleh dikirim untuk persetujuan") memakai `evaluatePublishChecklist` S1-02.
- "n materi · n kosong". Catatan 21e: materi tanpa teks isi atau tanpa quiz dihitung "kosong". Samakan dengan butir 6 checklist S1-02, yaitu materi yang teksnya kosong **atau** quiz-nya di bawah `quiz.min_questions`.
- Query daftar menghitung kelengkapan setiap materi tanpa N+1.

### 7. Lainnya
- **Tombol preview** di panel (CRS-09 "dapat ditandai"), bila pemilik ingin preview bisa dimatikan. Di S1-02 preview otomatis.
- **Penjaga perubahan belum disimpan** di panel pengaturan (S1-02 menyimpan manual tanpa penjaga).
- **Video di blok kekurangan:** 21a menampilkan "Materi 4 belum punya video" di antara syarat, sedangkan S1-02 menaruh video hanya sebagai penanda baris. Putuskan ulang bersama desain.
- **Kalimat 21h tentang kursus terbit** ("Kursus yang sudah terbit tidak ikut berubah…") mengikuti keputusan "mengubah kursus yang sudah terbit".

## Uji mutasi (bawaan kartu 24 Okt)
1. Lewati validasi himpunan ID pada urutan.
2. Preview tidak ikut dijaga saat urutan berubah.
3. Hapus kursus ber-peserta atau non-`DRAFT` tidak ditolak.
4. Hapus materi tanpa merapatkan urutan.

## E2E (bawaan kartu 24 Okt)
- EDITOR menambah tiga materi → urutkan ulang **dengan keyboard** → urutan bertahan setelah muat ulang.
- Hapus materi. Hapus kursus draf kosong.
- Panel lipat tablet terbuka dan tertutup; ponsel baca saja.
- Screenshot: panel tablet terlipat dan terbuka, ponsel.
