# S1-09 · Editor quiz CMS: daftar soal (22a) dan form satu soal (22b)

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | S1-04 sudah merge (`ContentDocBreadcrumb`, halaman editor materi), S1-02 (quiz `LESSON` kosong per materi, Final Quiz kosong per kursus, `getMinQuestions`), S1-03a (`validateContentDoc`, `RichContent`) |
| **Target** | Minggu 8 Nov. Langkah keenam jalur demo 20 Nov |
| **Branch** | `s1/s1-09-editor-quiz` |

> **Dibuat 7 Nov 2026** di Claude chat, ditinjau terhadap `main` `9125ed1`. Semua berkas dan simbol yang dirujuk ada dengan nama yang sama.
>
> **Disetujui pemilik 7 Nov** (dicantumkan di "Keputusan & asumsi" PR sebagai keputusan yang sudah disetujui, bersama semua copy bertanda *(usulan)* di kartu ini):
> 1. Satu rute untuk kedua jenis quiz: `/cms/quiz/{quizId}` (sudah ada di matriks RBAC sebagai prefix EDITOR+).
> 2. Form satu soal (22b) dibuka sebagai **dialog** A-06 dari daftar soal, bukan halaman sendiri.
> 3. Pertanyaan dan pembahasan diketik di **textarea teks biasa** (tanpa toolbar), disimpan sebagai `ContentDoc` berisi paragraf. Teks kaya untuk soal menyusul setelah demo.
> 4. Pilihan ganda **tepat 4 opsi** (PRD QZ-04, Q40): tombol "+ Tambah opsi" di 22b tidak dipakai.
> 5. Minimum soal untuk kedua jenis = `quiz.min_questions` (10), sesuai keputusan 4 Nov no. 2; **tanpa batas maksimum** (QZ-02). Copy "batas 5–10" dan "masih bisa 5 lagi" di 22h tidak dipakai.
> 6. Panel "Aturan quiz" **hanya baca** untuk demo. Mengubah durasi, ambang lulus, dan acak soal/opsi menyusul setelah demo.
> 7. Daftar "Bukan lingkup tugas ini" di bawah.

## Tujuan
Ahli gizi bisa mengisi soal Final Quiz dan quiz setiap materi lewat CMS, satu per satu, dengan aturan soal PRD (QZ-03, QZ-04) ditegakkan di klien **dan** server. Dengan begitu syarat terbit "Final Quiz ≥ 10 soal" dan bagian quiz dari syarat "Semua materi lengkap (teks + quiz)" bisa dipenuhi tanpa seed. Aturan soal dibangun sekali di sini dan dipakai lagi oleh impor CSV (Sen 9).

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD: `docs/prd/sections/06-3-quiz-sistem-penilaian.md` (QZ-01…QZ-04), `06-7-cms.md` (CMS-04), `06-2-kursus-materi.md` (CRS-06, CRS-07)
- Desain:
  - `docs/design/screens/22a.md` + `.png` + `.html`: editor quiz (Final Quiz), daftar soal, panel aturan, "Belum lengkap".
  - `22h.md` + `.png`: varian quiz materi ("← Materi 2", breadcrumb).
  - `22b.md` + `.png` + `.html`: form satu soal.
  - `22g.md`: beda quiz materi dan Final Quiz.
  - `21i.md` + `.png`: blok "Quiz materi" di halaman editor materi.
- Kode:
  - `src/modules/quiz/{service,queries}.ts` (`getMinQuestions`, pola `DbTx`);
  - `src/modules/lesson/queries.ts` (`createLessonWithQuiz`, `updateLessonContentIfDraft`: urutan kunci, sentuh kursus, audit ringkasan);
  - `src/modules/course/{serializer,errors}.ts` (`finalQuiz`, `NOT_DRAFT_MESSAGE`), `src/modules/course/checklist.ts`;
  - `src/app/api/cms/courses/[id]/lessons/[lessonId]/route.ts` (pola route S1-04), `src/lib/request-body.ts`;
  - `src/components/cms/content-doc-form.tsx` (`ContentDocBreadcrumb`, penjaga breadcrumb), `src/components/cms/lesson-outline.tsx` (blok Final Quiz), `src/app/(cms)/cms/kursus/[id]/materi/[lessonId]/page.tsx`;
  - `src/components/cms/add-lesson-dialog.tsx` (pola dialog + `inFlight` + fokus galat);
  - `src/lib/content-doc.ts`, `src/db/schema/quiz.ts`.
- E2E: `e2e/cms-materi-editor.spec.ts` (pola), `e2e/rbac.spec.ts` (tabel cakupan), `e2e/layout/axe.spec.ts`.

## Kerjakan

### 1. Aturan soal bersama — `src/modules/quiz/schema.ts` (baru)
Client-safe (Zod dan modul murni saja), karena dipakai form klien, route, dan impor CSV (Sen 9).

```ts
export const QUESTION_LIMITS = { textMax: 2_000, explanationMax: 5_000, optionMax: 500 } as const;
export const TRUE_FALSE_OPTIONS = ["Benar", "Salah"] as const;
export const questionInput = /* z.discriminatedUnion("type", …) */;
export type QuestionInput = z.infer<typeof questionInput>;
```

Bentuk input: `{ type: "SINGLE_CHOICE" | "TRUE_FALSE", text: string, explanation: string, options: { text: string; isCorrect: boolean }[] }`, `z.strictObject` di setiap tingkat.

| Aturan | Path galat | Pesan *(usulan)* |
|---|---|---|
| `text` dipangkas, tidak kosong | `text` | Pertanyaan wajib diisi. |
| `text` ≤ 2.000 karakter | `text` | Pertanyaan maksimal 2.000 karakter. |
| `explanation` dipangkas, tidak kosong (QZ-04: pembahasan wajib) | `explanation` | Pembahasan wajib diisi. |
| `explanation` ≤ 5.000 karakter | `explanation` | Pembahasan maksimal 5.000 karakter. |
| `SINGLE_CHOICE`: tepat 4 opsi | `options` | Pilihan ganda harus punya tepat 4 opsi. |
| Teks opsi dipangkas, tidak kosong, ≤ 500 karakter | `options.{i}.text` | Opsi {A–D} wajib diisi. / Opsi {A–D} maksimal 500 karakter. |
| Teks opsi tidak kembar (dibandingkan setelah dipangkas, tanpa beda huruf besar/kecil) | `options.{i}.text` (yang kedua) | Opsi {A–D} sama dengan opsi lain. |
| `TRUE_FALSE`: tepat 2 opsi, teksnya persis `"Benar"`, `"Salah"`, berurutan | `options` | Soal benar/salah harus berisi opsi Benar dan Salah. |
| Tepat satu `isCorrect: true` | `options` | Tandai tepat satu kunci jawaban. |

Keluaran `parse`: string yang sudah dipangkas. Huruf A–D diturunkan dari urutan, bukan disimpan.

**Konversi teks ↔ dokumen** — tambahkan di `src/lib/content-doc.ts`:
- `plainTextToDoc(text: string): ContentDoc` — `\r\n` → `\n`; setiap baris tidak kosong menjadi satu `paragraph` berisi satu node `text`; baris kosong beruntun dilewati. Keluarannya lolos `validateContentDoc`.
- `docToPlainText(doc: unknown): string` — kebalikannya: teks paragraf digabung `\n`, `hardBreak` → `\n`, node lain diambil teksnya saja. Untuk dokumen hasil `plainTextToDoc`, bolak-baliknya persis.

### 2. API simpan soal
Dua route baru dengan pola route S1-04: `requireApiRole("EDITOR")` **sebelum** body dibaca → ID wajib UUID (bila tidak → 404) → `readJsonBody(request, MAX_QUESTION_BODY_BYTES)` (64 KiB, konstanta baru di `request-body.ts`) → service → galat domain (< 500, `ZodError`) tidak di-log.

| Route | Berkas | Respons sukses |
|---|---|---|
| `POST /api/cms/quizzes/{quizId}/questions` | `src/app/api/cms/quizzes/[quizId]/questions/route.ts` | 201 `{ data: QuestionSummaryDTO }` |
| `PATCH /api/cms/quizzes/{quizId}/questions/{questionId}` | `src/app/api/cms/quizzes/[quizId]/questions/[questionId]/route.ts` | 200 `{ data: QuestionSummaryDTO }` |

`QuestionSummaryDTO = { id, orderIndex, type, updatedAt }` — teks soal, opsi, dan kunci tidak dikirim balik.

**Service** (`src/modules/quiz/service.ts`): `createQuestion(actor, { quizId }, input)` dan `updateQuestion(actor, { quizId, questionId }, input)`. Cek peran dulu (`assertCanManageQuizzes`, `src/modules/quiz/policy.ts` baru, matriks sama dengan `assertCanManageCourses`: EDITOR+), baru `questionInput.parse`.

**Query** — satu transaksi masing-masing (`src/modules/quiz/queries.ts`):
1. **Cari kursus pemilik quiz**: `courses.final_quiz_id = quizId`, atau `lessons.quiz_id = quizId` → `lessons.course_id`. Tidak ketemu → 404 "Quiz tidak ditemukan".
2. **Kunci baris kursus** `SELECT … FOR UPDATE` (`{ of: courses }` bila memakai join). Status ≠ `DRAFT` → 409 dengan konstanta baru `QUIZ_NOT_DRAFT_MESSAGE` *(usulan: "Kursus sudah bukan draf — soal quiz terkunci.")*.
3. **Buat**: `order_index = max + 1` (mulai 1) dihitung di bawah kunci; insert soal (`text` dan `explanation` lewat `plainTextToDoc`, `points` 1, `imageUrl` null) lalu opsinya (`order_index` 1…n).
4. **Ubah**: kunci baris soal dengan `id = questionId AND quiz_id = quizId` → tidak ada → 404 (termasuk soal milik quiz lain, bentuk anti-IDOR). Update soal, lalu **ganti** opsinya (hapus lalu insert di transaksi yang sama). Aman karena hanya kursus `DRAFT` yang bisa diubah, sehingga belum ada attempt yang merujuk opsi.
5. **Sentuh kursus** (`set({ updatedBy })`, seperti `createLessonWithQuiz`).
6. **Satu baris audit**: `question.create` / `question.update`, `entityType: "question"`. `before`/`after` hanya ringkasan `{ quizId, type, orderIndex, optionCount }`, **tanpa** teks soal, opsi, kunci, maupun pembahasan (aturan tinjauan S1-02 2a).

### 3. Halaman editor quiz — `src/app/(cms)/cms/quiz/[quizId]/page.tsx` (baru)
- **Penjaga:** EDITOR+ (`requireRole`), `quizId` UUID, quiz tanpa kursus pemilik → 404.
- **Data:** satu panggilan `getQuizEditor(actor, { quizId })` →
  ```ts
  {
    quiz: { id, type, durationMinutes, passingScorePercent, shuffleQuestions, shuffleOptions },
    owner: { courseId, courseTitle, courseStatus, lesson: { id, orderIndex, title } | null },
    questions: { id, orderIndex, type, text, explanation, options: { text, isCorrect }[], hasKey, hasExplanation }[],
    minQuestions,          // getMinQuestions()
    finalWeightPercent,    // system_settings score.final_weight (40)
  }
  ```
  `text` dan `explanation` dikirim sebagai teks biasa (`docToPlainText`). `hasKey` = tepat satu opsi benar; `hasExplanation` = pembahasan tidak kosong. Data kunci aman di sini karena halaman ini khusus staf.
- **Tata letak (22a, 22h)** di dalam padding layout CMS, tanpa bar kedua (pelajaran S1-04):
  - Baris kepala: `ContentDocBreadcrumb` (tanpa penjaga).
    - Final Quiz: `KURSUS / {judul kursus} / FINAL QUIZ`.
    - Quiz materi: `KURSUS / {judul kursus} / MATERI {n} / QUIZ`, ditambah tautan "← Materi {n}" ke editor materinya (22h).
  - Label jenis: pil gelap "Final Quiz" atau "Quiz materi", lalu mono "MILIK KURSUS · JENIS TIDAK BISA DIUBAH" / "MILIK MATERI {n} · JENIS TIDAK BISA DIUBAH".
  - `h1`: judul kursus (Final Quiz) atau judul materi (quiz materi), gaya `CONTENT_DOC_HEADING_CLASS`.
  - Pil jumlah *(usulan)*: Final Quiz "{n} dari 20 soal" (target yang sudah tampil di builder), quiz materi "{n} soal". Di sebelahnya mono "MINIMUM PUBLISH {min} SOAL · SUDAH TERPENUHI" atau "MINIMUM PUBLISH {min} SOAL · KURANG {k}".
  - "Daftar soal" (h2) + tombol "+ Tambah soal" (secondary) yang membuka dialog bagian 4.
  - Baris soal: nomor dua digit mono, pertanyaan satu baris (terpotong, `title` berisi teks lengkap), penanda mono "PG · KUNCI ✓ · PEMBAHASAN ✓" (`success`), "B/S · …" untuk benar/salah, tombol "Sunting" (`text-primary-deep`) yang membuka dialog berisi soal itu. Baris dengan kunci atau pembahasan kosong (hanya mungkin dari data lama) memakai latar `danger-tint`, garis `danger-tint-line`, dan penanda `KUNCI KOSONG` / `PEMBAHASAN KOSONG` berwarna `danger`. Pegangan seret ⋮⋮ **tidak** ditampilkan (urutkan ulang belum ada).
  - Kosong: "Belum ada soal." *(usulan)* + tombol "+ Tambah soal".
- **Kolom kanan (≥ 1024 px; di bawahnya ditumpuk setelah daftar)** — "ATURAN QUIZ", hanya baca:
  - Durasi "{d} menit", Ambang lulus "{p}%", Kesempatan "1 — terkunci", Acak soal "Ya"/"Tidak", Acak opsi "Ya"/"Tidak";
  - Bobot: Final Quiz "{w}% Nilai Akhir", quiz materi "bagian dari {100 − w}%" (22f);
  - catatan 22a: "Jumlah kesempatan tidak bisa diubah. Satu kesempatan adalah keputusan produk (K-04), bukan setelan per quiz.";
  - blok "BELUM LENGKAP" hanya bila ada kekurangan: "· Soal {nn} belum ada pembahasan", "· Soal {nn} belum ada kunci", "· Kurang {k} soal dari minimum {min}" *(baris terakhir usulan; 22a memakai "target 20")*.
- **Kursus bukan `DRAFT`:** banner info `LOCKED_NOTICE` (S1-02), tanpa "+ Tambah soal" dan tanpa "Sunting". Daftar soal tetap tampil.
- **Setelah simpan berhasil**, daftar diperbarui dengan `router.refresh()`.

### 4. Dialog satu soal (22b) — `src/components/cms/question-dialog.tsx` (baru)
Dialog A-06 selebar 760 px (desain 22b), satu formulir tanpa react-hook-form.

- **Judul dialog:** "Soal {nn} dari {total}". Untuk soal baru, `{nn}` = jumlah soal + 1 dan `{total}` ikut bertambah satu.
- **Tipe soal:** `<select>` "Pilihan ganda" / "Benar/salah" di kanan atas (22b "Pilihan ganda ▾").
  - Pindah ke Benar/salah: opsi menjadi dua baris tetap "Benar" dan "Salah" (tanpa isian), kunci dikosongkan.
  - Pindah ke Pilihan ganda: empat isian opsi kembali, berisi teks yang sebelumnya diketik di dialog ini.
- **"PERTANYAAN":** textarea, `maxLength` sesuai `QUESTION_LIMITS`.
- **"OPSI JAWABAN · KLIK LINGKARAN UNTUK MENANDAI KUNCI":**
  - Satu `radiogroup` bernama "Kunci jawaban". Setiap baris: lingkaran radio, isian teks opsi (nama aksesibel "Opsi A"…"Opsi D"), dan label huruf di kanan. Baris kunci memakai garis `success`, latar `success-tint`, lingkaran ✓, dan label "KUNCI".
  - Benar/salah: teks "Benar"/"Salah" statis, bukan isian.
- **"PEMBAHASAN"** + tag "Wajib" (`danger-tint` / `danger`): textarea.
- **Tombol:** "Simpan & tambah soal" (secondary) dan "Simpan soal" (dark), lebar sama di ≥ 640 px.
- **Alur simpan:**
  - Validasi klien dengan `questionInput` dulu. Galat tampil di bawah isiannya (`aria-describedby`, `aria-invalid`), lalu fokus ke isian pertama yang salah. Tidak ada request.
  - Penjaga `inFlight` (pola S1-02). Tes submit ganda memakai submit formulir kedua, bukan klik tombol (tombol `loading` memasang `disabled` native — pelajaran 7 Nov no. 6).
  - **201/200 + "Simpan soal"** → dialog tertutup, fokus kembali ke tombol yang membukanya, `router.refresh()`.
  - **201/200 + "Simpan & tambah soal"** → dialog tetap terbuka sebagai soal baru: tipe dipertahankan, isian dikosongkan, judul naik ("Soal {n+1} dari {n+1}"), fokus ke "Pertanyaan", `router.refresh()`.
  - **400** → `fields` dipetakan ke isian berdasarkan path (`text`, `explanation`, `options`, `options.{i}.text`); path lain → pesan umum di dialog.
  - **409** → banner galat di dialog berisi pesan server, lalu `router.refresh()`.
  - **Galat lain atau jaringan putus** → "Soal belum tersimpan — periksa koneksi lalu coba lagi." *(usulan)* di dialog. Isian tetap utuh.
- **Menutup dialog** (✕ atau Esc) membuang perubahan tanpa konfirmasi *(usulan untuk demo; dicatat di PR)*.

### 5. Pintu masuk editor quiz
- **Builder, blok Final Quiz** (`lesson-outline.tsx`, komentar "Sunting Final Quiz … deliberately not rendered"): tambahkan tautan "Sunting Final Quiz" ke `/cms/quiz/{finalQuiz.id}`. Ditampilkan untuk semua status kursus (halaman quiz sendiri menangani tampilan terkunci).
- **Halaman editor materi** — blok "Quiz materi" seperti 21i, di bawah editor:
  - judul "Quiz materi", pil "{n} dari min. {min} soal", teks "Sudah dibuat otomatis · wajib dikerjakan user agar materi selesai" *(usulan; 21i: "Sudah dibuat otomatis & kosong…")*, tautan "Isi quiz →" bila `n = 0`, "Sunting quiz →" bila `n > 0` *(usulan)*, menuju `/cms/quiz/{quizId}`;
  - **tautan ini lewat penjaga perubahan belum disimpan yang sama dengan breadcrumb**: `ContentDocForm` mendapat prop opsional `quizBlock?: { href: string; questionCount: number; minQuestions: number }` dan merender blok itu sendiri dengan `onBreadcrumbClick` yang sudah ada;
  - `getLessonEditor` ditambah `lesson.quizId` dan `lesson.quizQuestionCount`, plus `minQuestions`;
  - tampilan terkunci materi: blok yang sama tanpa penjaga, dengan tautan "Lihat quiz →".

### 6. Tabel cakupan RBAC dan aksesibilitas
- `e2e/rbac.spec.ts`: tambah baris `/cms/quiz/[quizId]` (MEMBER 403, EDITOR+ 200) dengan substitusi ID quiz nyata, seperti baris deskripsi di S1-04.
- `e2e/layout/axe.spec.ts`: halaman editor quiz (Final Quiz terisi dua soal) dan dialog soal terbuka, pada w360 dan w1280.

## Bukan lingkup tugas ini
- **Setelah demo:** hapus soal, urutkan ulang (seret dan keyboard), ubah setelan quiz (durasi, ambang, acak), judul/instruksi quiz, gambar soal, bobot poin selain 1, teks kaya untuk soal, "Pratinjau sebagai peserta", daftar quiz 22f (`/cms/quiz` tetap placeholder), penjaga "sudah dikerjakan" 22d (baru relevan setelah terbit), tata letak tablet 22e.
- **Kartu impor CSV (Sen 9):** tombol "Impor CSV" dan seluruh alur 22c. Kartu itu memakai `questionInput`, `plainTextToDoc`, dan query buat soal dari kartu ini.
- **Diketahui, tidak diubah:** baris "bobot 40% Nilai Akhir" di blok Final Quiz builder masih ditulis langsung di kode (catatan STATUS 4 Nov); halaman editor quiz membaca `score.final_weight`.

Pekerjaan di luar lingkup → **berhenti dan tanyakan.**

## Berkas yang boleh dibuat/diubah
- `src/modules/quiz/{schema,policy}.ts` (baru) + tes; `src/modules/quiz/{service,queries}.ts` + tes integrasi; `src/modules/quiz/serializer.ts` (baru) + tes
- `src/lib/content-doc.ts` (dua fungsi baru) + tesnya; `src/lib/request-body.ts` (satu konstanta `MAX_QUESTION_BODY_BYTES`)
- `src/app/api/cms/quizzes/[quizId]/questions/route.ts`, `src/app/api/cms/quizzes/[quizId]/questions/[questionId]/route.ts` (baru)
- `src/app/(cms)/cms/quiz/[quizId]/page.tsx` (baru)
- `src/components/cms/quiz-editor.tsx`, `src/components/cms/question-dialog.tsx` (baru) + tes komponen
- `src/components/cms/lesson-outline.tsx` + tes builder yang menyentuh blok Final Quiz
- `src/components/cms/content-doc-form.tsx` (prop `quizBlock`) + tesnya; `src/app/(cms)/cms/kursus/[id]/materi/[lessonId]/page.tsx`
- `src/modules/lesson/{service,queries,serializer}.ts` (data blok quiz untuk editor materi) + tes serializer
- `e2e/cms-quiz-editor.spec.ts` (baru), `e2e/rbac.spec.ts` (satu baris), `e2e/layout/axe.spec.ts` (halaman quiz)

Tanpa migrasi, tanpa dependensi baru, dan tanpa perubahan `package.json`/`package-lock.json`.

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- **hash basis branch** (`git log --oneline -1`), yang harus sama dengan `main` terbaru;
- daftar berkas, signature setiap ekspor baru, dan bentuk DTO;
- urutan langkah di kedua transaksi, termasuk cara mencari kursus pemilik quiz;
- pemetaan respons ke tampilan dialog;
- daftar tes per bagian "Selesai jika";
- untuk setiap mutasi: tes yang diharapkan merah, beserta tes yang diperkirakan tetap hijau karena tertutup lapis lain.

## Selesai jika
- [ ] **Tes skema** (`questionInput`, node): setiap baris tabel bagian 1 punya kasus lolos dan gagal dengan path yang benar; `strictObject` menolak key tambahan; keluaran sudah dipangkas.
- [ ] **Tes `plainTextToDoc` / `docToPlainText`:** bolak-balik persis untuk teks satu baris, banyak baris, dan baris kosong beruntun; keluaran `plainTextToDoc` lolos `validateContentDoc`.
- [ ] **Tes integrasi** (PGlite, pola `src/modules/{course,lesson}/service.integration.test.ts`; `updated_at` di-pin ke 2020 sebelum asersi "bergerak"):
  - **Buat:** soal Final Quiz dan soal quiz materi tersimpan dengan `order_index` berurutan 1, 2, 3; opsi 4 (PG) atau 2 (B/S) dengan tepat satu benar; teks tersimpan sebagai dokumen yang lolos validator; kursus tersentuh; satu baris audit berisi ringkasan saja (JSON audit tidak memuat teks soal maupun opsi).
  - **Ubah:** opsi lama terganti; ganti tipe PG → B/S menghasilkan tepat 2 opsi.
  - **Penjagaan:** kursus `IN_REVIEW` → 409 dan tidak ada yang ditulis; quiz tidak dikenal → 404; soal milik quiz lain → 404; peran di bawah EDITOR → 403 **sebelum** input diparse.
  - **Aturan server:** PG 3 opsi, dua kunci, B/S dengan teks "Ya"/"Tidak", dan pembahasan kosong → `ZodError` dengan path yang benar, DB tidak berubah.
- [ ] **Tes komponen** (`question-dialog.test.tsx`, jsdom):
  - judul "Soal 03 dari 12", tipe, isian, dan radio kunci terisi dari soal yang disunting;
  - pindah tipe PG → B/S → PG mempertahankan teks opsi PG;
  - galat klien: tanpa `fetch`, pesan di bawah isian, `aria-invalid`, fokus ke isian salah pertama;
  - "Simpan soal" → satu `fetch` dengan method, URL, dan body yang benar, dialog tertutup, fokus kembali ke pembuka;
  - "Simpan & tambah soal" → dialog tetap terbuka, isian kosong, tipe tetap, judul naik, fokus ke "Pertanyaan";
  - submit ganda (submit formulir kedua saat `fetch` pertama tertunda, jeda tetap) → satu `fetch`;
  - 400 dengan `fields[0].path = "options.2.text"` → pesan di bawah "Opsi C"; 409 → banner + `router.refresh`; jaringan gagal → pesan, isian utuh.
- [ ] **Tes komponen halaman** (`quiz-editor.test.tsx`): penanda baris (lengkap, kunci kosong, pembahasan kosong), pil jumlah dan baris minimum untuk kedua jenis, blok "BELUM LENGKAP" muncul hanya bila ada kekurangan, tampilan terkunci tanpa tombol ubah.
- [ ] **Tes builder:** tautan "Sunting Final Quiz" menuju `/cms/quiz/{id}`.
- [ ] **Tes `ContentDocForm`:** blok quiz tampil dengan label sesuai jumlah soal, dan klik tautannya saat belum disimpan membuka dialog penjaga.
- [ ] **E2E** (`cms-quiz-editor.spec.ts`, EDITOR):
  1. Builder → "Sunting Final Quiz" → halaman editor dengan breadcrumb dan "0 dari 20 soal".
  2. "+ Tambah soal" → isi PG (kunci B) + pembahasan → "Simpan & tambah soal" → dialog kosong untuk soal 2 → isi B/S (kunci Salah) → "Simpan soal" → dua baris dengan penanda lengkap, "2 dari 20 soal", "KURANG 8".
  3. Muat ulang → kedua soal bertahan; "Sunting" soal 1 → isian terisi.
  4. Editor materi → blok "Quiz materi" → "Isi quiz →" → halaman quiz materi dengan "← Materi 1".
  5. **API:** PG 3 opsi → 400 path `options`; soal milik quiz lain → 404; MEMBER → 403 (termasuk body 100 KiB, peran dicek sebelum body).
  6. Kursus `IN_REVIEW` → halaman quiz terkunci tanpa "+ Tambah soal"; API → 409.
  7. Lebar 360 → halaman quiz dan dialog tidak menggulir ke samping.
- [ ] **RBAC dan axe:** bagian 6.
- [ ] **Uji mutasi** — commit lokal dulu dan `git status` bersih sebelum mutasi pertama; kembalikan setiap mutasi dengan `git restore`. Laporkan per mutasi nama tes yang merah beserta pesannya. Mutasi yang hanya tertangkap E2E dijalankan dengan `npx playwright test --grep …` sungguhan.
  1. Aturan "tepat satu kunci" dihapus dari `questionInput`.
  2. Aturan "tepat 4 opsi" untuk PG dihapus.
  3. Server memakai teks opsi B/S dari klien (aturan "Benar"/"Salah" dihapus).
  4. Cek `DRAFT` di transaksi buat soal dihapus.
  5. Filter `quiz_id` pada kunci baris soal (ubah) dihapus.
  6. `order_index` diisi konstanta, bukan max + 1.
  7. Audit menyimpan teks soal.
  8. Peran dicek setelah `readJsonBody`.
  9. Penjaga `inFlight` di dialog dihapus.
  10. "Simpan & tambah soal" tidak mengosongkan isian.
  11. Tautan blok quiz di editor materi tidak lewat penjaga perubahan.

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`. `main` sudah memuat S1-04.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR. Harapan: 0 excused / 0 blocking / 23 (dikonfirmasi di `main` `9125ed1`). Angka lain atau temuan blocking baru → berhenti dan tempel output lengkapnya.
- **Prettier:** berkas yang sudah ada tetap apa adanya, sehingga diff sebatas lingkup. Berkas baru boleh dirapikan.
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas.
- **"Keputusan & asumsi" di PR** memuat semua copy usulan dan keputusan yang diambil tanpa bertanya.
- **Screenshot** halaman quiz (Final Quiz dan quiz materi) dan dialog (PG, B/S, galat) di w1280 dan w768, diambil lokal dengan `E2E_SCREENSHOT_DIR` (konvensi A-19b), `animations: "disabled"`.
- **Setelah push:** cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`
- `git diff --stat main -- package.json package-lock.json src/db` kosong

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Lokal (`npm run dev:db`, lalu `npm run dev`), sebagai akun EDITOR:
  1. Buka kursus draf → "Sunting Final Quiz" → tambah satu soal pilihan ganda dan satu benar/salah, memakai "Simpan & tambah soal".
  2. Muat ulang: kedua soal bertahan; sunting satu soal, ubah kuncinya, simpan.
  3. Buka editor materi → "Isi quiz →" → tambah satu soal → "← Materi 1" kembali ke editor materi.
  4. Di builder, penanda quiz materi dan baris Final Quiz memperlihatkan jumlah soal yang baru.
- [ ] Unggah screenshot halaman quiz dan dialog (w1280) ke Claude chat untuk dibandingkan dengan 22a, 22h, dan 22b.

## Catatan jadwal
- Sesi dimulai setelah kartu ini disetujui dan masuk `main` lewat PR docs.
- **Bila terlambat**, yang dipotong lebih dulu: blok "Quiz materi" di editor materi diganti tautan teks biasa (penjaga tetap wajib), lalu varian 22h ("← Materi n") dirender sama dengan Final Quiz. Aturan soal, API, daftar soal, dan dialog tidak dipotong.

## Catatan keputusan
- **Satu rute untuk dua jenis quiz.** Editornya sama (22g); yang beda hanya pemilik dan copy. `/cms/quiz/{quizId}` sudah ada di matriks RBAC, dan kursus pemiliknya dicari dari `final_quiz_id` atau `lessons.quiz_id` di server.
- **Dialog, bukan halaman.** 22b selebar 760 px dan punya "Simpan & tambah soal", yang paling wajar sebagai dialog di atas daftar: penulis langsung melihat soal bertambah tanpa pindah halaman.
- **Teks biasa untuk soal.** Kolom `questions.text` dan `explanation` sudah `jsonb` (`ContentDoc`), sehingga teks kaya bisa menyusul tanpa migrasi. Impor CSV (Sen 9) juga menghasilkan teks biasa, jadi keduanya memakai konversi yang sama.
- **Minimum 10 untuk kedua jenis.** Keputusan 4 Nov no. 2 mengikat syarat "Semua materi lengkap (teks + quiz)" ke `quiz.min_questions`; batas "5–10" di 22h/22g lebih lama dan bertentangan dengan QZ-02 (tanpa maksimum).
- **Ganti opsi saat ubah soal** (hapus lalu insert) aman karena hanya kursus `DRAFT` yang bisa diubah. Setelah terbit, perubahan soal mengikuti penjaga 22d dan butuh desain sendiri.
- **Aturan soal di satu tempat** (`questionInput`), karena impor CSV Sen 9 harus menolak baris dengan alasan yang sama persis dengan form.
