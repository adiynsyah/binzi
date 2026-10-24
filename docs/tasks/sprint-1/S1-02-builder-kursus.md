# S1-02 · CMS: builder kursus — pengaturan, outline materi, syarat terbit

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | S1-01 |
| **Branch** | `s1/s1-02-builder-kursus` |

> **Dibuat 24 Okt 2026** di Claude chat, terhadap `main` `9468120` + rancangan S1-01. **Tinjau ulang kartu ini terhadap kode S1-01 yang di-merge sebelum sesi dimulai** (pelajaran (y)).

## Tujuan
Builder kursus menjadi tempat kerja utama: mengubah isian kursus, menyusun outline materi (tambah, urutkan, hapus), dan melihat syarat terbit yang belum terpenuhi di tempat kerjanya sendiri (prinsip desain 21a). Fungsi checklist yang dibuat di sini dipakai lagi oleh daftar 21e dan gerbang kirim/terbit S1-08.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/06-2-kursus-materi.md` (CRS-01, 02, 06, 08, 09), `06-7-cms.md` (CMS-02, CMS-06, CMS-12), `06-3-quiz-sistem-penilaian.md` (QZ-02), `11-model-data.md` (§11.2 `lessons`, `quizzes`; §11.4 no. 3–4)
- `docs/design/screens/21a.md + .png`, `21d.md + .png`, `21g.md + .png`, `21h.md + .png`, `21e.md` (kolom kuning)
- Kode S1-01: `src/modules/course/*`, route & halaman kursus, komponen builder kosong
- `src/db/schema/course.ts`, `src/db/schema/quiz.ts`, `src/db/seed.ts` (`quiz.min_questions`)

## Kerjakan

### 1. Isian kursus (panel kanan 21a/21g)
- Bisa diubah: judul, ringkasan, slug (aturan S1-01: unik, kata terlarang), level, "Urutan — Wajib berurutan" (`is_sequential`), "Preview — Materi 1 gratis".
- Satu tombol **"Simpan"** di topbar menyimpan panel (21a): `PATCH /api/cms/courses/{id}`, audit `course.update` dengan `before`/`after`.
- Belum ada di kartu ini: deskripsi (S1-04), sampul (S1-07). Durasi tetap teks "Dihitung otomatis dari video".
- **Preview gratis** mengikuti posisi: hanya materi berurutan pertama yang boleh `is_free_preview = true` (CRS-09). Saat urutan berubah, server menjaga invarian ini dalam transaksi yang sama.

### 2. Outline materi
- **Baris (21a):** pegangan seret, nomor · judul, lalu dua penanda syarat:
  - "VIDEO ✓" atau "BELUM ADA VIDEO" (dari `video_status`).
  - "QUIZ n SOAL ✓" atau "QUIZ BELUM DIBUAT" (n = jumlah soal; ✓ hanya bila ≥ `quiz.min_questions`).
  - Materi tanpa teks isi ditandai "KOSONG".
  - Tautan "Sunting" ke `/cms/kursus/{id}/materi/{lessonId}`.
- **Halaman editor materi** dibuat sebagai placeholder pola A-15: judul materi + "Segera hadir.", ber-guard EDITOR+. Isinya milik S1-04.
- **Tambah materi (21h):**
  - Dialog berisi judul (≤ 80) dan "Letakkan": "Di akhir — jadi materi n" atau "Setelah materi…".
  - Satu transaksi: materi dengan dokumen TipTap kosong yang valid, satu quiz `LESSON` kosong (`duration_minutes` 10, `passing_score_percent` 70, `max_attempts` 1 — PRD §11.4 no. 9), urutan disisipkan, audit.
  - Slug materi dari judul, unik per kursus, kata terlarang `final-quiz`.
  - Sukses → editor materi.
  - Builder kosong 21g mendapat tombol "+ Tambah materi pertama".
- **Urutkan ulang:**
  - Seret **dan** keyboard (fokus pegangan → Spasi → panah → Spasi), dengan pengumuman pembaca layar berbahasa Indonesia.
  - `PUT /api/cms/courses/{id}/lessons/order` dengan daftar ID lengkap. Server menolak (400) bila himpunannya beda dengan materi kursus itu, lalu menulis `order_index` dalam satu transaksi + audit.
- **Hapus materi:** dialog konfirmasi (copy usulan, sebut di PR) → hapus materi beserta quiz-nya, rapatkan urutan, audit.
- **Hapus kursus:** di panel pengaturan. Hanya bila `DRAFT` **dan** `enrollment_count = 0` (21g: "Kursus draf yang kosong bisa dihapus; setelah punya peserta hanya bisa diarsipkan"). Konfirmasi → hapus kursus, materi, dan quiz-nya dalam satu transaksi + audit → kembali ke `/cms/kursus`.

### 3. Syarat terbit (CMS-06)
Fungsi murni di modul `course`, bisa dites tanpa DB, mengembalikan butir 21g "Syarat sebelum dikirim n / 7":
1. Judul & level
2. Ringkasan
3. Slug unik
4. Deskripsi lengkap (belum terpenuhi sampai S1-04)
5. Sampul + teks alternatif (belum terpenuhi sampai S1-07)
6. Minimal 1 materi lengkap: teks isi tidak kosong **dan** quiz ≥ `quiz.min_questions`
7. Final Quiz ≥ `quiz.min_questions`

Fungsi itu juga mengembalikan daftar kekurangan per materi untuk blok "n syarat belum lengkap" di 21a ("Materi 3 belum punya quiz", "Materi 4 belum punya video", "Final Quiz baru n dari 20 soal").

Video **bukan** syarat (CRS-03: video opsional). "Belum ada video" tetap ditampilkan sebagai informasi. `min_questions` dibaca dari `system_settings`, bukan ditanam di kode.

Pakai fungsi ini di daftar `/cms/kursus`: kolom kuning (21e "Kolom kuning = belum boleh dikirim untuk persetujuan") dan "n materi · n kosong". Gerbang server untuk kirim/terbit dipasang di S1-08 memakai fungsi yang sama.

### 4. Kunci status
Builder hanya bisa diubah saat kursus `DRAFT`. Untuk status lain:
- Panel dan outline tampil baca saja dengan satu baris keterangan (copy usulan, sebut di PR).
- Setiap endpoint ubah mengembalikan 409.

Aturan mengubah kursus yang sudah terbit masih menunggu keputusan pemilik sebelum S1-08 — jangan dirancang di kartu ini.

### 5. Lebar layar
- **Tablet (21d):** panel pengaturan menjadi panel lipat di atas outline ("Pengaturan kursus · n belum lengkap ▾"), dan baris materi menyusut.
- **Ponsel:** builder tampil baca saja dengan satu baris keterangan "Buka di tablet atau laptop untuk menyunting." (copy usulan — sejalan dengan 20e "di ponsel editor tidak dibuka").

### 6. Dependensi
Untuk seret-urutkan dengan dukungan keyboard, usulkan `@dnd-kit/core` + `@dnd-kit/sortable` (+ `@dnd-kit/utilities` bila perlu), atau alternatif tanpa dependensi, di rencana. Bila memakai paket: pin eksak, `npm install … --before=<hari ini − 14>`, dan tanggal rilisnya di PR (aturan soak `CLAUDE.md`).

## Bukan lingkup tugas ini
- Isi editor materi, video, teks, deskripsi (S1-03/S1-04/S1-05).
- Sampul & media (S1-06/S1-07).
- Kirim, pratinjau, terbitkan, arsip, `NEEDS_REVISION` (S1-08).
- Isi quiz (S3).
- `sections` (UI disembunyikan di MVP, CRS-02).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/modules/course/*`, `src/modules/lesson/*` (+ fungsi kecil di `src/modules/quiz/` sesuai pola S1-01)
- `src/app/api/cms/courses/**`
- `src/app/(cms)/cms/kursus/**`
- `src/components/cms/**`
- `e2e/**`
- `package.json`/`package-lock.json` (hanya bila dependensi seret disetujui)

## Selesai jika
- [ ] **Tes unit** fungsi syarat terbit: tiap butir, termasuk `min_questions` dari setting dan materi "kosong".
- [ ] **Tes integrasi PGlite:**
  - Tambah materi → materi + quiz LESSON + audit dalam satu transaksi.
  - Urutan dengan ID hilang atau berlebih → 400, urutan tidak berubah.
  - Setelah urutan berubah, hanya materi pertama yang boleh preview.
  - Ubah kursus non-DRAFT → 409.
  - Hapus kursus ber-peserta atau non-DRAFT → 409.
  - Slug materi `final-quiz` → 400.
- [ ] **E2E:**
  - EDITOR tambah tiga materi → urutkan ulang **dengan keyboard** → urutan bertahan setelah muat ulang.
  - Ubah dan simpan pengaturan.
  - Hapus materi.
  - Hapus kursus draf kosong.
  - Builder & daftar di spesifikasi A-19b (semua lebar, axe).
- [ ] **Uji mutasi**, merah lalu dikembalikan:
  - Lewati validasi himpunan ID pada urutan.
  - Lewati kunci DRAFT.
  - Syarat 6 tanpa cek jumlah soal.
  - Preview tidak ikut dijaga saat urutan berubah.

## Sebelum membuka PR
- DB lokal C-05 saja.
- `E2E_SCREENSHOT_DIR=~/binzi-s1-02-screenshots`: builder berisi (dengan syarat belum lengkap), dialog tambah materi, panel tablet terlipat & terbuka, ponsel. Sebut jumlah berkasnya di PR.
- Setelah push: cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e` (dua kali berturut-turut)

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Unggah screenshot ke Claude chat (bandingkan dengan 21a/21d/21g/21h).
- [ ] Lokal: susun ulang materi **hanya dengan keyboard**, lalu muat ulang halaman.

## Catatan keputusan
- Quiz LESSON dibuat bersama materi, sesuai 21h ("otomatis punya satu quiz kosong", CRS-06). 10 menit hanya nilai bawaan; S3 menyediakan pengubahnya.
- Video tidak masuk syarat terbit karena opsional di PRD. Desain hanya menampilkannya sebagai penanda baris.
