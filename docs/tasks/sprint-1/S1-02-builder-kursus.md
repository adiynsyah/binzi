# S1-02 · CMS: builder kursus — pengaturan, tambah materi, syarat terbit

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | S1-01 (PR #106) sudah di-merge |
| **Target** | Merge Kamis 5 Nov. Langkah kedua jalur demo 20 Nov |
| **Branch** | `s1/s1-02-builder-kursus` |

> **Dibuat 24 Okt 2026** di Claude chat terhadap `main` `9468120` + rancangan S1-01.
>
> **Direvisi 4 Nov 2026** di Claude chat terhadap kode S1-01 final (branch PR #106, `2dbb46c`). Perubahan:
> 1. **Lingkup dipotong untuk demo 20 Nov** (keputusan pemilik 4 Nov). Urutkan ulang (seret + keyboard, `@dnd-kit`), "Setelah materi…", hapus materi, hapus kursus, panel lipat tablet 21d, keterangan ponsel, kolom kuning di daftar, dan tombol preview pindah ke **S1-02b** (setelah demo). Kartu ini tanpa dependensi baru.
> 2. **Syarat sampul disembunyikan** dari daftar syarat sampai S1-07 (keputusan 3 Nov). Penyebutnya menjadi `n / 6`.
> 3. **Syarat 6 menjadi "Semua materi lengkap (teks + quiz)"**: minimal satu materi, dan setiap materi punya teks isi dan quiz ≥ `quiz.min_questions` (keputusan 4 Nov; CRS-03, QZ-02, CRS-08). Copy menyimpang dari 21g.
> 4. **Deskripsi tetap syarat 4.** Editornya masuk S1-04 (keputusan 4 Nov).
> 5. **`quiz.min_questions` fail-closed**: baris setting tidak ada atau nilainya tidak sah → galat 500, tanpa angka cadangan.
> 6. **Preview otomatis**: materi urutan 1 selalu `is_free_preview = true` (21g "Materi pertama otomatis jadi preview gratis").
> 7. Membawa pelajaran S1-01: konstanta bersama server/klien di modul biasa, `sr-only` di dalam wadah `overflow-*`, urutan galat isian, tes guard klik-ganda.
> 8. Dua perapian kecil dari cek screenshot S1-01 (bagian 8).

## Tujuan
Ahli gizi bisa mengubah pengaturan kursus draf, menambah materi (masing-masing otomatis punya satu quiz kosong), dan melihat syarat terbit yang belum terpenuhi langsung di builder (prinsip 21a). Fungsi syarat terbit yang dibuat di sini menjadi gerbang server "Kirim & terbitkan" di S1-08 (Selasa 10 Nov).

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD: `docs/prd/sections/06-2-kursus-materi.md` (CRS-01, 02, 03, 06, 08, 09), `06-7-cms.md` (CMS-02, CMS-06, CMS-12), `06-3-quiz-sistem-penilaian.md` (QZ-01, QZ-02), `11-model-data.md` (§11.2 `lessons`, `quizzes`, `system_settings`; §11.4 no. 3 dan 9)
- Desain: `docs/design/screens/21a.md + .png`, `21g.md + .png`, `21h.md + .png`
- Kode S1-01: `src/modules/course/*`, `src/modules/quiz/*`, `src/app/api/cms/courses/route.ts`, `src/app/(cms)/cms/kursus/[id]/page.tsx`, `src/components/cms/create-course-dialog.tsx` (pola form, guard, fokus), `src/components/cms/course-status.ts`, `src/components/cms/cms-pages.tsx` (`CmsPlaceholderPage`)
- `src/lib/errors.ts`, `src/components/ui/toggle.tsx`, `src/components/ui/button.tsx`
- `src/db/schema/course.ts`, `quiz.ts`, `system.ts`; `src/db/seed.ts` (`SETTINGS`); `src/db/seed-demo.ts` (bentuk dokumen TipTap, `order_index` mulai 1)
- `e2e/cms-kursus.spec.ts`, `e2e/layout/` (pola lebar & axe)

## Kerjakan

### 1. Modul & arah impor
- **Modul baru `src/modules/lesson/`** dengan pola lima berkas (`src/modules/README.md`). Modul ini memiliki semua query tabel `lessons`.
- **Arah impor satu jalur: `course` → `lesson` → `quiz`**, selalu lewat `service.ts`. `lesson` membaca status kursus langsung dari tabel `courses` di query-nya sendiri, jadi tidak mengimpor modul `course`.
- **`src/lib/content-doc.ts` (baru, murni):** `isDocEmpty(doc)` — `true` bila `doc` null, bukan dokumen TipTap, atau tidak punya satu pun node `text` dengan isi selain spasi (dicari rekursif). Dipakai untuk teks materi **dan** deskripsi kursus. S1-03 memperluasnya (gambar, tabel) dan boleh memindahkannya.
- **`EMPTY_DOC`** di berkas yang sama: `{ type: "doc", content: [{ type: "paragraph" }] }` — isi materi baru. Validator dokumen S1-03 wajib menerimanya.
- **Quiz (`src/modules/quiz/service.ts`):**
  - `createEmptyLessonQuiz(tx, { title })` → quiz `LESSON`: `duration_minutes` 10, `passing_score_percent` 70, `max_attempts` 1, `explanation_policy` `ALWAYS`, `title` = judul materi saat dibuat.
  - `getMinQuestions()` membaca `system_settings` `quiz.min_questions`. Nilainya harus bilangan bulat ≥ 1. Baris tidak ada atau nilai tidak sah → `Error` (500) yang menyebut kuncinya dan `npm run db:seed`.

### 2. Pengaturan kursus (panel kanan)
- **Isian yang bisa diubah**, berurutan: Judul (1–80), Ringkasan (1–160, `Textarea`), Slug (dengan awalan `/kursus/`), Level, Urutan "Wajib berurutan" (`is_sequential`, komponen `Toggle`).
- **Level** memakai kontrol segmen yang sama dengan dialog 21f. Ekstrak dari `create-course-dialog.tsx` ke satu komponen di `src/components/cms/`, lalu pakai di dialog dan panel; tampilannya identik dengan dialog setelah perbaikan terakhir PR #106.
- **Baris baca saja:** Preview "Materi 1 gratis", Durasi "Dihitung otomatis dari video", Penggarap, Deskripsi "Belum diisi" atau "Sudah diisi" (copy usulan; editornya S1-04).
- **Blok SAMPUL tidak dirender** sampai S1-07.
- **Panel berupa form**, padahal 21a menggambarnya sebagai daftar nilai. Ini penyimpangan sadar karena desain tidak menggambar cara mengubahnya; sebut di PR.
- **Tombol "Simpan"** (varian `secondary`, 21a) ada di baris judul halaman, di sisi kanan, dan terhubung ke form panel lewat atribut `form`.
  - "Pratinjau" dan "Kirim untuk persetujuan" milik S1-08 dan tidak dirender.
- **Kontrak:** `UpdateCourseInput` di `schema.ts` memakai ulang aturan isian `CreateCourseInput` (judul, slug termasuk slug terlarang, level, ringkasan) ditambah `isSequential`. Satu sumber aturan; tidak ada salinan.
- **`PATCH /api/cms/courses/{id}`**, pola route S1-01: `requireApiRole("EDITOR")` dulu, ID bukan UUID atau tidak ada → 404. Service menjalankan satu transaksi:
  1. Kunci baris kursus (`SELECT … FOR UPDATE`).
  2. Status bukan `DRAFT` → 409 (langkah 5).
  3. Galat isian, urutannya mengikuti form: skema Zod, lalu judul mirip kursus **lain** (kecualikan dirinya sendiri), lalu slug dipakai kursus **lain**. Pelanggaran unik `courses_slug_unique` saat update dipetakan ke galat slug yang sama (`isUniqueViolation`).
  4. Tidak ada isian yang berubah → 200 dengan DTO sekarang, tanpa menulis dan tanpa audit.
  5. Ada yang berubah → update + `updated_by` aktor + audit `course.update` dengan `before`/`after` berupa DTO.
- **Perilaku klien:**
  - Pola form dialog S1-01: React Hook Form + skema bersama, galat server lewat `setError`, fokus ke isian pertama yang salah sesuai urutan form.
  - Tombol `softDisabled` + `loading` selama request, guard klik-ganda di handler.
  - **Fokus kembali ke tombol "Simpan"** setelah respons yang tidak memindahkan fokus ke isian. `loading` memasang atribut `disabled` native (`button.tsx:74`), sehingga fokus keyboard terlepas saat tombol nonaktif.
  - Sukses → `Banner` tone `success` "Pengaturan tersimpan." (copy usulan), form di-`reset` ke nilai tersimpan, lalu `router.refresh()` agar judul, badge, dan syarat ikut terbarui.
  - 409 → banner galat (copy usulan) lalu `router.refresh()`, sehingga halaman tampil baca saja.
  - Galat lain → banner galat umum; isian tetap.
- **Dua penyunting bersamaan:** yang terakhir menyimpan menang. Tidak ada cek versi di kartu ini; sebut di PR.

### 3. Outline materi
- **Kepala:** "Materi" + meta mono "n MATERI", ditambah "· WAJIB BERURUTAN" bila `is_sequential`. Total menit menunggu data video.
- **Daftar** memakai `<ol>`, satu baris per materi (21a), urut `order_index`:
  - **Kotak kiri:** `video_status = READY` dan durasi ada → kotak berlatar `--video-bg` berisi durasi `m:ss` (token itu gradien: pakai sebagai `background-image`, lihat komentarnya di `tokens.css`). Selain itu → kotak `fill` bertuliskan "KOSONG". Ini arti "KOSONG" di 21a: slot video kosong.
  - **Judul:** "n · judul".
  - **Baris penanda (mono):**
    - Video: "VIDEO ✓" atau "BELUM ADA VIDEO" (`UPLOADING`/`FAILED` juga "BELUM ADA VIDEO").
    - Teks: "TEKS BELUM DIISI" bila `isDocEmpty(content)` (copy usulan).
    - Quiz: "QUIZ n SOAL ✓" bila n ≥ min; "QUIZ n SOAL" bila 0 < n < min (copy usulan); "QUIZ BELUM DIBUAT" bila 0.
    - Warna seluruh baris: `success` bila materi memenuhi syarat (teks + quiz), `pending-tint-text` bila belum. Teks penanda yang membawa arti; warna hanya penegas.
  - **Tautan "Sunting"** (`buttonVariants` secondary) ke `/cms/kursus/{id}/materi/{lessonId}`. Nama aksesibelnya memuat judul materi lewat span `sr-only`; wadah daftar diberi leluhur ber-posisi (`relative`) supaya span itu tidak melebarkan halaman (pelajaran S1-01).
- **Tanpa pegangan seret, tanpa "+ n materi lain", tanpa "seret untuk mengurutkan".** Semua materi tampil.
- **Tombol tambah:** "+ Tambah materi" (secondary) di kepala Materi, dan "+ Tambah materi pertama" di state kosong 21g.
- **Blok Final Quiz:**
  - 0 soal → copy 21g, dengan angka "10" diganti nilai `min_questions`.
  - Lebih dari 0 soal → "n soal · d menit · bobot 40% Nilai Akhir · satu kesempatan" (21a).
  - "Sunting Final Quiz" milik kartu editor quiz dan tidak dirender.
- **DTO outline** (allowlist): id, title, orderIndex, isContentEmpty, videoReady, videoDurationSeconds, quizQuestionCount, isFreePreview. Isi dokumen TipTap **tidak** dikirim ke klien.

### 4. Tambah materi (21h)
- **Dialog A-06**, isian dan copy 21h:
  - Eyebrow "{judul kursus} · Materi baru" (mono, huruf besar, satu baris terpotong).
  - Judul "Tambah materi", isian "Judul materi" dengan penghitung `/ 80`.
  - "Letakkan" sebagai teks tetap "Di akhir — jadi materi n".
  - Catatan "Setelah dibuat, materi ini otomatis punya satu quiz kosong." Kode "(CRS-06)" di desain adalah anotasi, bukan copy (aturan `CLAUDE.md`).
  - Tombol "Batal" dan "Buat & buka editor →".
- **Dua kalimat 21h tidak ditampilkan** karena belum benar: "Urutan tetap bisa diseret di outline kapan saja." (urutkan ulang ada di S1-02b) dan "Kursus yang sudah terbit tidak ikut berubah…" (builder terkunci di luar `DRAFT`). Sebut di PR.
- **`POST /api/cms/courses/{id}/lessons`**, body `{ title }` (strict, 1–80 dipangkas). Satu transaksi di service `lesson`:
  1. Kunci baris kursus (`FOR UPDATE`); bukan `DRAFT` → 409; tidak ada → 404.
  2. `order_index` = maksimum + 1. Mulai dari 1 dan rapat, seperti seed demo.
  3. Slug otomatis dari judul dengan fungsi slugify yang sama dengan kursus (pindahkan ke `src/lib/` bila dipakai dua modul). Dasar slug kosong → `materi`. Dasar slug `final-quiz` atau sudah dipakai di kursus ini → tambah `-2`, `-3`, … sampai unik. Maksimal 80 karakter. Slug materi tidak pernah menjadi galat bagi pengguna.
  4. Quiz LESSON lewat `createEmptyLessonQuiz(tx, …)`, lalu materi dengan `content = EMPTY_DOC`, `quiz_id`, dan `is_free_preview = (order_index === 1)`.
  5. Sentuh `courses.updated_by`/`updated_at`, supaya urutan "terakhir diubah" di daftar ikut berubah.
  6. Audit `lesson.create`, `after` = DTO materi.
- **Klien:** pola dialog S1-01 — fokus ke isian salah, `softDisabled` + `loading`, guard, tetap loading setelah 201 sampai navigasi. Sukses → `/cms/kursus/{id}/materi/{lessonId}`.
- **Halaman editor materi** `/cms/kursus/[id]/materi/[lessonId]` adalah placeholder `CmsPlaceholderPage` dengan judul materi + "Segera hadir.", ber-guard EDITOR+.
  - Kedua ID harus UUID, dan materi harus milik kursus itu; selain itu → 404.
  - Isinya milik S1-04.

### 5. Syarat terbit (CMS-06)
- **Fungsi murni** `evaluatePublishChecklist(input, options?)` di `src/modules/course/checklist.ts`: tanpa DB, tanpa `server-only`, bisa dites langsung.
- **Masukan:** isian kursus, `isDocEmpty(description)`, daftar materi (urutan, teks kosong atau tidak, jumlah soal quiz), jumlah soal Final Quiz, dan `minQuestions`.
- **Butir, label persis seperti ini:**
  1. "Judul & level"
  2. "Ringkasan"
  3. "Slug unik" — terpenuhi bila slug terisi; keunikan dijamin constraint, tulis alasannya di komentar.
  4. "Deskripsi lengkap" — `description` tidak kosong (`isDocEmpty`).
  5. "Sampul + teks alternatif" — **disembunyikan** selama `COVER_REQUIREMENT_ENABLED = false` (konstanta bernama di berkas yang sama, dengan komentar "dinyalakan di S1-07, keputusan 3 Nov"). Saat disembunyikan, butir tidak dikembalikan dan total menjadi 6. `options.coverRequired` menimpa konstanta khusus untuk tes.
  6. "Semua materi lengkap (teks + quiz)" — minimal satu materi, **dan setiap** materi teksnya tidak kosong **dan** quiz-nya ≥ `minQuestions`.
  7. "Final Quiz ≥ {minQuestions} soal"
- **Kekurangan** untuk blok "n syarat belum lengkap" (21a), copy usulan kecuali yang dari 21a:
  - "Belum ada materi"
  - "Materi n belum punya teks isi"
  - "Materi n belum punya quiz" (0 soal)
  - "Quiz materi n baru k dari {min} soal"
  - "Final Quiz baru n dari {min} soal"
  - "Deskripsi kursus belum diisi"

  Video tidak masuk daftar ini (video opsional, CRS-03; tampil hanya sebagai penanda baris). Ini menyimpang dari 21a; sebut di PR.
- **Tampilan di panel**, di bawah isian:
  - Judul "Syarat sebelum dikirim" + "m / 6" (21g).
  - Daftar `<ul>`, tiap butir berikon ✓ atau ○ **dan** teks sr-only "terpenuhi"/"belum terpenuhi" (arti tidak dibawa warna saja).
  - Di bawahnya blok kekurangan bila ada.
- **Kolom kuning di daftar `/cms/kursus`** tidak dibuat di kartu ini (S1-02b).
- **Service:** `getCourseBuilder(actor, { courseId })` di modul `course` mengembalikan DTO kursus (ditambah `isSequential` dan `isDescriptionEmpty`), outline materi, hasil checklist, dan `minQuestions`. Halaman builder hanya memanggil fungsi ini.

### 6. Kunci status
- **Setiap endpoint ubah** (`PATCH` kursus, `POST` materi) memeriksa status di dalam transaksi, setelah baris terkunci. Status bukan `DRAFT` → `ConflictError` 409 dengan pesan copy usulan.
- **Komentar di `src/modules/course/errors.ts`** yang menyebut 409 "dicadangkan untuk konflik versi S1-04" diperbarui.
- **Builder di luar `DRAFT`:**
  - Panel tampil sebagai daftar nilai baca saja (pola S1-01), tanpa "Simpan", "+ Tambah materi", dan "Sunting".
  - Ada satu baris keterangan (copy usulan).
  - Syarat terbit tetap tampil.
- **Aturan mengubah kursus yang sudah terbit** masih menunggu keputusan pemilik dan tidak dirancang di kartu ini.

### 7. Lebar layar
- **Susunan S1-01 tetap:** ≥ 1024 dua kolom; di bawahnya satu kolom dengan urutan DOM yang sama (outline, lalu panel).
- **Panel lipat 21d dan keterangan ponsel** milik S1-02b.
- **Tanpa scroll horizontal di semua lebar**, termasuk judul materi 80 karakter tanpa spasi.
- **Target sentuh ≥ 44 px di w360.**

### 8. Perapian kecil dari cek screenshot S1-01
- **Screenshot tanpa animasi.** `maybeScreenshot` (`e2e/layout/helpers.ts`) memanggil `page.screenshot` tanpa `animations: "disabled"`. Akibatnya dialog yang baru dibuka terekam di tengah animasi masuk 200 ms: tembus pandang dan belum di posisi akhir (`cms-kursus-dialog-normal`). Tambahkan opsi itu.
- **Judul panjang tanpa spasi di daftar `/cms/kursus`.** Sel judul memakai `break-words`, yang tidak mengecilkan lebar min-content kolom tabel. Satu judul 80 karakter tanpa spasi melebarkan tabel di w1280 sampai kolom PESERTA dan AKSI ("Buka") tergeser keluar wadah untuk semua baris. Ganti dengan `wrap-anywhere` (Tailwind 4.3), lalu cek komentar kepala `course-list.tsx` yang menyebut `break-words`.

## Bukan lingkup tugas ini
- **S1-02b (setelah demo):** urutkan ulang, "Setelah materi…", hapus materi, hapus kursus, panel lipat 21d, keterangan ponsel, kolom kuning daftar, tombol preview, penjaga perubahan belum disimpan.
- Isi editor materi dan editor deskripsi (S1-03/S1-04); video (kartu player); sampul (S1-07); pratinjau, kirim, terbitkan (S1-08); editor quiz; `sections`.

Pekerjaan di luar lingkup → **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/modules/course/*`, `src/modules/lesson/*` (baru), `src/modules/quiz/*` (dua fungsi di atas)
- `src/lib/content-doc.ts` (baru) dan, bila slugify dipindah, `src/lib/slug.ts` (baru) — beserta tesnya
- `src/app/api/cms/courses/**`, `src/app/(cms)/cms/kursus/**`
- `src/components/cms/**`
- `e2e/**`

Tanpa migrasi (semua kolom sudah ada) dan tanpa perubahan `package.json`/`package-lock.json`.

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- daftar berkas yang akan dibuat atau diubah;
- letak fungsi per modul dan arah impornya;
- bentuk ketiga DTO;
- letak tombol "Simpan" dan cara menghubungkannya ke form;
- urutan langkah setiap transaksi;
- daftar tes per bagian "Selesai jika";
- untuk setiap mutasi, tes yang diharapkan merah.

## Selesai jika
- [ ] **Tes unit:**
  - `evaluatePublishChecklist`:
    - setiap butir, terpenuhi dan tidak;
    - total 6 saat sampul disembunyikan, 7 dengan `coverRequired: true`;
    - nol materi;
    - satu dari dua materi belum lengkap → butir 6 tidak terpenuhi;
    - quiz `min − 1` soal → tidak terpenuhi;
    - label Final Quiz memakai `minQuestions`;
    - setiap pesan kekurangan.
  - `isDocEmpty`: `null`, `EMPTY_DOC`, teks berisi spasi saja, teks bersarang dalam list, dan bentuk tidak sah.
  - Komponen builder baca saja (status `IN_REVIEW`): tanpa "Simpan", "+ Tambah materi", dan "Sunting"; keterangan tampil.
  - Guard klik-ganda dialog tambah materi setelah 201, diuji dengan `fireEvent.submit(form)` lalu jeda tetap sebelum asersi jumlah `fetch`. Jangan memakai `waitFor` untuk asersi "tidak terjadi lagi": `waitFor` lulus di polling pertama.
- [ ] **Tes integrasi PGlite** (setiap berkas memasang baris `quiz.min_questions` di setup):
  - **PATCH:**
    - semua isian tersimpan + satu audit `course.update` dengan `before`/`after`;
    - tanpa perubahan → tanpa audit;
    - slug milik kursus lain → 400 `slug`;
    - judul mirip kursus lain → 400 `title`;
    - judul dan slug sendiri tidak berubah → 200;
    - slug terlarang → 400;
    - non-`DRAFT` → 409 dan baris tidak berubah;
    - MEMBER → 403 sebelum input diparse.
  - **Tambah materi:**
    - satu materi + satu quiz `LESSON` (10/70/1/`ALWAYS`) + satu audit + `courses.updated_at` berubah;
    - tiga kali tambah → `order_index` 1, 2, 3, dan hanya materi 1 yang preview;
    - judul "Final Quiz" → slug bukan `final-quiz`;
    - dua judul sama → slug berbeda;
    - non-`DRAFT` → 409, dan jumlah `lessons`, `quizzes`, `audit_logs` tidak berubah;
    - kursus tidak ada → 404.
  - **`getMinQuestions`:** baris tidak ada → galat; nilai `"10"` (string) atau `0` → galat.
  - **`getCourseBuilder`:** DTO tanpa kolom di luar allowlist, dan tanpa isi dokumen materi.
  - **Catatan:** `Promise.all` di PGlite tidak menguji balapan (satu koneksi). Kebenaran `FOR UPDATE` dibuktikan lewat tinjauan kode, jadi jangan klaim tes membuktikannya.
- [ ] **E2E:**
  - **EDITOR menyimpan pengaturan:** ubah judul, ringkasan, level, dan urutan → "Simpan" → banner sukses → muat ulang → nilai bertahan.
  - **Galat simpan:** ringkasan kosong → pesan + fokus di Ringkasan.
  - **Tambah materi:** "+ Tambah materi pertama" → dialog → mendarat di placeholder editor dengan judul materi → kembali ke builder → baris "1 · judul" dengan "KOSONG", "BELUM ADA VIDEO", "TEKS BELUM DIISI", "QUIZ BELUM DIBUAT".
  - **Materi kedua:** tambah lewat "+ Tambah materi" → "2 · judul".
  - **Syarat terbit kursus baru:** "3 / 6", dengan Deskripsi, Semua materi, dan Final Quiz belum terpenuhi.
  - **Placeholder editor:** materi milik kursus lain → 404; ID bukan UUID → 404.
  - **A-19b:** builder berisi dua materi + dialog tambah materi di semua project lebar; tanpa scroll horizontal; axe tanpa temuan `serious`/`critical`.
  - **Daftar di w1280 dengan judul 80 karakter tanpa spasi:** tautan "Buka" di baris itu `toBeInViewport()`.
- [ ] **Uji mutasi** (merah, lalu dikembalikan dengan `git restore`):
  1. Lewati kunci `DRAFT` di `POST` materi.
  2. Lewati kunci `DRAFT` di `PATCH`.
  3. Butir 6 memakai "ada satu materi lengkap" (`some`) alih-alih setiap materi (`every`).
  4. Butir 6 tanpa cek jumlah soal.
  5. `is_free_preview = true` untuk setiap materi baru.
  6. Materi dibuat tanpa quiz `LESSON`.
  7. `getMinQuestions` jatuh ke angka 10 saat baris tidak ada.
  8. Cek judul mirip saat update tidak mengecualikan kursus itu sendiri.

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`. Yang dipakai hanya DB lokal C-05 dan DB e2e.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR. Harapan per 3 Nov: 5 excused / 0 blocking. Angka lain atau temuan blocking baru → berhenti dan tempel output lengkapnya.
- **Prettier:** berkas yang sudah ada tetap apa adanya (80 berkas `src/` belum rapi Prettier, diff harus sebatas lingkup). Berkas baru boleh dirapikan satu per satu.
- **Uji mutasi:** commit lokal dulu, lalu kembalikan setiap mutasi dengan `git restore`.
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas.
- **Screenshot:** `E2E_SCREENSHOT_DIR=~/binzi-s1-02-screenshots`, dikosongkan sebelum run final.
  - Isinya: builder kosong (dengan "+ Tambah materi pertama"), builder berisi dua materi dengan syarat belum lengkap, panel dengan galat slug dari server, dialog tambah materi, dan placeholder editor.
  - Lebar w360/w768/w1280. Sebut jumlah berkasnya di PR.
- **"Keputusan & asumsi" di PR** wajib memuat copy yang tidak berasal dari desain dan keputusan yang diambil tanpa bertanya.
- **Setelah push:** cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e` (sekali di lokal; CI menjalankannya lagi)
- `git diff --stat main -- package.json package-lock.json src/db` kosong

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Unggah screenshot ke Claude chat untuk dibandingkan dengan 21a/21g/21h.
- [ ] Lokal (`npm run dev:db`, akun EDITOR): buat kursus, tambah dua materi, ubah pengaturan **hanya dengan keyboard**. Lalu cek di `npm run db:studio`:
  - `lessons` urutan 1 dan 2, hanya materi 1 yang preview;
  - dua quiz `LESSON`;
  - audit `course.update` dan `lesson.create`.

## Catatan keputusan
- **Quiz LESSON dibuat bersama materi**, sesuai 21h dan CRS-06. Nilai bawaannya (10 menit, 70%, satu kesempatan — §11.4 no. 9) diubah di editor quiz.
- **Butir 6 mewajibkan setiap materi lengkap** (keputusan 4 Nov). Dengan "Wajib berurutan" (CRS-08), satu quiz tanpa soal membuat materi berikutnya tidak pernah terbuka bagi peserta.
- **Sampul disembunyikan, bukan dihitung sebagai belum terpenuhi** (keputusan 3 Nov). Dengan begitu kursus bisa terbit di demo tanpa fitur gambar. S1-07 menyalakannya lewat satu konstanta.
- **Lingkup dipotong demi demo 20 Nov** (keputusan 4 Nov). Desain dan aturan bagian yang dipotong tetap utuh di S1-02b.
