# S1-01 · CMS: daftar kursus, kursus baru, builder kosong

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | C-05 (DB lokal), C-06 (alias `@/`, batas impor DB) |
| **Branch** | `s1/s1-01-daftar-kursus` |

> **Dibuat 24 Okt 2026** di Claude chat, ditinjau terhadap `main` `9468120`. Kartu fitur pertama S1 dan route API fitur pertama BINZI. Rencana agent ditinjau di Claude chat sebelum disetujui.

## Tujuan
Ahli gizi dan admin bisa melihat semua kursus di `/cms/kursus` dan membuat kursus baru lewat dialog singkat. Setelah dibuat, kursus langsung terbuka di builder dalam keadaan kosong. Kartu ini juga menetapkan pola modul fitur (kontrak → service → route → UI) yang dipakai kartu S1 berikutnya.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/06-2-kursus-materi.md` (CRS-01, CRS-02), `06-7-cms.md` (CMS-02, CMS-12), `03-persona-role.md` (§3.2), `11-model-data.md` (§11.2 `courses`, `quizzes`, `audit_logs`; §11.4 no. 3–4)
- `docs/design/screens/21e.md + .png`, `21f.md + .png`, `21g.md + .png`; `19e.md + .png` (pola daftar di tablet & ponsel)
- `src/modules/README.md` dan modul contoh `src/modules/user/*`
- `src/lib/rbac.ts`, `src/lib/errors.ts`, `src/app/api/cms/ping/route.ts`, `src/components/cms/cms-pages.tsx`, `src/components/cms/cms-nav.ts`, `src/app/(cms)/cms/kursus/page.tsx`
- `src/db/schema/course.ts`, `src/db/schema/quiz.ts`, `src/db/schema/system.ts`
- `e2e/fixtures.ts`, `e2e/layout/widths.ts`, satu spesifikasi di `e2e/layout/` (pola lebar & axe)

## Kerjakan

### 1. Kontrak (`src/modules/course/schema.ts`)
`CreateCourseInput`:
- `title` wajib, 1–80 karakter (dipangkas).
- `slug` kebab-case `^[a-z0-9]+(-[a-z0-9]+)*$`, maks 80. Klien mengisinya otomatis dari judul (huruf kecil, buang tanda baca, spasi → `-`), dan bisa diubah lewat "Ubah".
- `level`: `BEGINNER` | `INTERMEDIATE` | `ADVANCED`.
- `summary` wajib, 1–160 karakter.

Slug yang bentrok dengan rute statis area belajar **ditolak**: `kursus-saya`, `nilai` (item `STATUS.md`). Daftar ini menjadi konstanta di modul.

Kontrak daftar: filter `status` (semua status `content_status`), `q` (cari judul), urutan default "terakhir diubah".

### 2. Service & policy (`src/modules/course/`)
- **Akses:** EDITOR ke atas melihat **dan** mengubah **semua** kursus, siapa pun pembuatnya (keputusan pemilik 24 Okt; menyimpang dari catatan desain 19a "ahli gizi hanya melihat konten miliknya" — sebut di PR). Role dicek **sebelum** parse input.
- **`createCourse`, satu transaksi:**
  1. Insert kursus `DRAFT` (`created_by` = `updated_by` = aktor).
  2. Insert quiz `FINAL` kosong dengan nilai bawaan: `duration_minutes` 20, `passing_score_percent` 70, `max_attempts` 1, `explanation_policy` `ALWAYS`, judul "Final Quiz". Set `courses.final_quiz_id` (desain 21g: "Sudah disiapkan kosong").
  3. Insert satu baris `audit_logs` (`action` `course.create`, `entity_type` `course`, `after` = DTO kursus — bukan baris mentah).

  Kartu ini tidak boleh mengimpor `queries.ts` modul lain. Cara menulis quiz di transaksi yang sama (fungsi di service `quiz` yang menerima `tx`, atau insert langsung di query `course`) diputuskan di rencana dan dijelaskan.
- **Galat:**
  - Slug sudah dipakai → `ConflictError` (409), field `slug`.
  - Slug terlarang → 400, field `slug`.
  - Judul terlalu mirip (21f) → 400, field `title`. Aturan: judul baru yang dinormalisasi (huruf kecil, spasi rapat) adalah awalan judul kursus lain, atau sebaliknya. Pesannya memakai copy 21f dengan nama kursus pembandingnya.
- **DTO** (`serializer.ts`, allowlist eksplisit, tanggal ISO):
  - `CmsCourseListItemDTO`: id, title, slug, level, status, lessonCount, finalQuizQuestionCount, enrollmentCount, penggarap (nama tampilan pembuat), updatedAt.
  - `CmsCourseDetailDTO` untuk builder: field CRS-01 yang ada + finalQuiz `{ id, questionCount }`.

### 3. API — tanpa Server Actions
- `GET /api/cms/courses` (daftar + ringkasan jumlah per status) dan `POST /api/cms/courses`.
- Pola `src/app/api/cms/ping/route.ts`: `requireApiRole("EDITOR")` dulu, `console.error` error asli sebelum `toErrorResponse()` (aturan sementara sampai Sentry terpasang).
- **Jangan** memakai `"use server"`/Server Actions. Konsistensi pola, sekaligus menjaga permukaan GHSA-p3m5 tetap tertutup sampai C-02 merge.

### 4. Daftar `/cms/kursus` (21e)
- Ringkasan "n terbit · n menunggu persetujuan · n draf", kotak cari "Cari kursus…", tombol "+ Kursus baru".
- Tab status dengan jumlah: Semua, Terbit, Menunggu, Draf, Arsip. Urutan "Terakhir diubah".
- Kolom: KURSUS (judul + "Level · penggarap"), MATERI ("n materi"), FINAL QUIZ ("n / 20 soal"), STATUS, PESERTA, AKSI ("Buka" → `/cms/kursus/{id}`).
- Penanda kolom kuning dan "n kosong" menunggu checklist di S1-02 — **jangan** dibuat di sini.
- Tablet & ponsel memakai pola 19e (baris menjadi kartu, tanpa scroll horizontal).
- Daftar kosong: `EmptyState` dengan copy usulan "Belum ada kursus." dan aksi "+ Kursus baru". Desain tidak menggambar state ini, jadi copy-nya wajib disebut di PR.

### 5. Dialog "Kursus baru" (21f)
- Memakai `Dialog` A-06. Isian dan copy persis 21f: penghitung karakter, pratinjau `/kursus/{slug}` dengan "Ubah", Level, Ringkasan, catatan "Disimpan sebagai Draf · penggarap: Anda", tombol "Batal" dan "Buat & lanjut isi materi →".
- **Level menampilkan tiga pilihan** (Pemula, Menengah, Lanjutan) karena PRD punya tiga nilai, sementara desain menggambar dua. Sebut di PR.
- Galat baru muncul **setelah** tombol ditekan, dan fokus pindah ke isian pertama yang salah. Tombol **tidak pernah** dinonaktifkan diam-diam (catatan 21f, pelajaran (ggg)).
- Sukses → navigasi ke `/cms/kursus/{id}`.

### 6. Builder kosong `/cms/kursus/[id]` (21g, baca saja)
- Judul, ringkasan, status "Draf", bagian Materi "Belum ada materi" dengan teks penjelas 21g, blok Final Quiz ("Sudah disiapkan kosong…"), dan panel pengaturan **baca saja**: Slug, Level, Durasi "Dihitung otomatis dari video", Penggarap.
- **Belum ada tombol aksi.** "+ Tambah materi pertama", "Sunting Final Quiz", "Pratinjau", dan "Kirim untuk persetujuan" milik kartu berikutnya — jangan dirender sebagai tombol mati.
- ID tidak ada atau bukan UUID → 404 (bukan 500).
- Breadcrumb mengikuti pola A-15.

## Bukan lingkup tugas ini
- Mengubah isian kursus, materi, urutan, hapus kursus, checklist syarat terbit (S1-02).
- Editor teks dan deskripsi (S1-03/S1-04); sampul & media (S1-06/S1-07); pratinjau, kirim, terbitkan, arsip (S1-08); editor quiz (S3).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/modules/course/*` (+ fungsi kecil di `src/modules/quiz/` bila dipilih di rencana)
- `src/app/api/cms/courses/route.ts`
- `src/app/(cms)/cms/kursus/page.tsx`, `src/app/(cms)/cms/kursus/[id]/page.tsx`
- Komponen baru di `src/components/cms/` (+ tesnya)
- `e2e/` (spesifikasi baru + penambahan rute di spesifikasi `e2e/layout/`)

## Selesai jika
- [ ] Tes integrasi PGlite untuk service:
  - Buat kursus → satu baris kursus + satu quiz FINAL + satu baris audit dalam satu transaksi.
  - Slug duplikat → 409; slug terlarang → 400; judul mirip → 400.
  - MEMBER → 403 sebelum input diparse.
  - DTO tidak membawa kolom di luar allowlist.
- [ ] E2E:
  - EDITOR membuat kursus lewat dialog → mendarat di builder kosong.
  - Kirim dialog dengan ringkasan kosong → pesan 21f + fokus di isian Ringkasan.
  - MEMBER: `/cms/kursus` → 403 halaman, `GET`/`POST /api/cms/courses` → 403 JSON.
- [ ] `/cms/kursus` dan `/cms/kursus/{id}` masuk spesifikasi A-19b (tanpa scroll horizontal, axe tanpa temuan `serious`/`critical` baru) di semua project lebar.
- [ ] Uji mutasi, semuanya merah lalu dikembalikan:
  - Hapus cek slug terlarang.
  - Lewati `requireApiRole` di `POST`.
  - Hapus insert audit.
  - Buat kursus tanpa quiz FINAL.

## Sebelum membuka PR
- Jalankan dengan DB lokal C-05 — **jangan** pernah memakai binzi-dev.
- `E2E_SCREENSHOT_DIR=~/binzi-s1-01-screenshots`: daftar (berisi & kosong), dialog (normal & galat), builder kosong, di w360/w768/w1280. Sebut jumlah berkasnya di PR.
- Copy yang tidak berasal dari desain dan keputusan tanpa bertanya **wajib** masuk "Keputusan & asumsi".
- Setelah push: cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e` (dua kali berturut-turut)

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Unggah screenshot ke Claude chat untuk dibandingkan dengan 21e/21f/21g/19e.
- [ ] Lokal (DB lokal): buat kursus sebagai EDITOR → di `db:studio` ada baris `courses`, `quizzes` (FINAL), dan `audit_logs`.

## Catatan keputusan
- Quiz FINAL dibuat bersama kursus, sesuai desain 21g. Nilai bawaannya (20 menit, 70%, satu kesempatan) bisa diubah di editor quiz S3. Angka 20 menit diambil dari 21a ("20 soal · 20 menit").
- Daftar menampilkan semua kursus untuk EDITOR dan ADMIN (keputusan 24 Okt). Tab "Perlu revisi" baru muncul setelah S1-08 menambah status `NEEDS_REVISION`.
