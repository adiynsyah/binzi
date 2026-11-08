# S1-09 · Editor quiz CMS: daftar soal (22a) dan form satu soal (22b)

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | S1-04 sudah merge (`ContentDocBreadcrumb`, halaman editor materi), S1-02 (quiz `LESSON` kosong per materi, Final Quiz kosong per kursus, `getMinQuestions`), S1-03a (`validateContentDoc`, `RichContent`) |
| **Target** | Minggu 8 Nov. Langkah keenam jalur demo 20 Nov |
| **Branch** | `s1/s1-09-editor-quiz` |

> **Dibuat 7 Nov 2026** di Claude chat, ditinjau terhadap `main` `9125ed1`. Semua berkas dan simbol yang dirujuk ada dengan nama yang sama.
>
> **Direvisi 8 Nov 2026** di Claude chat, ditinjau terhadap `main` `0922046` (kode identik dengan `5e13a0f`). Temuan tinjauan dijalankan di sandbox — validator dokumen asli, zod 4.6.6, jsdom 29, Chromium 153, build Next 16.4.1 minimal — dan diterapkan di bagian 1, 3, 4, 5, 6, "Selesai jika", dan "Bukan lingkup". Ringkasan dan buktinya di "Catatan revisi 8 Nov" paling bawah.
>
> **Disetujui pemilik 7 Nov** (dicantumkan di "Keputusan & asumsi" PR sebagai keputusan yang sudah disetujui, bersama semua copy bertanda *(usulan)* di kartu ini):
> 1. Satu rute untuk kedua jenis quiz: `/cms/quiz/{quizId}` (sudah ada di matriks RBAC sebagai prefix EDITOR+).
> 2. Form satu soal (22b) dibuka sebagai **dialog** A-06 dari daftar soal, bukan halaman sendiri.
> 3. Pertanyaan dan pembahasan diketik di **textarea teks biasa** (tanpa toolbar), disimpan sebagai `ContentDoc` berisi paragraf. Teks kaya untuk soal menyusul setelah demo.
> 4. Pilihan ganda **tepat 4 opsi** (PRD QZ-04, Q40): tombol "+ Tambah opsi" di 22b tidak dipakai.
> 5. Minimum soal untuk kedua jenis = `quiz.min_questions` (10), sesuai keputusan 4 Nov no. 2; **tanpa batas maksimum** (QZ-02). Copy "batas 5–10" dan "masih bisa 5 lagi" di 22h tidak dipakai.
> 6. Panel "Aturan quiz" **hanya baca** untuk demo. Mengubah durasi, ambang lulus, dan acak soal/opsi menyusul setelah demo.
> 7. Daftar "Bukan lingkup tugas ini" di bawah.
>
> **Usulan revisi 8 Nov** (disetujui pemilik dengan me-merge PR revisi ini; dicantumkan di PR sesi sebagai keputusan yang sudah disetujui):
> 8. Tata letak 1024–1279: kolom kanan 288 px, baris soal dua lapis lewat container query (bagian 3).
> 9. Bobot nilai dibaca dari `score.final_weight` **dan** `score.lesson_weight`, gagal tertutup seperti `getMinQuestions` (bagian 3).
> 10. Saat tipe dipindah B/S → PG, kunci PG terakhir di dialog ikut kembali, bukan hanya teks opsinya (bagian 4).

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
  - `src/components/ui/dialog.tsx` (✕ absolut di kanan atas, `sm:max-w-[560px]` bawaan, judul `pr-11`);
  - `src/db/seed.ts` (`score.lesson_weight` 60, `score.final_weight` 40);
  - `src/lib/content-doc.ts`, `src/db/schema/quiz.ts`.
- E2E: `e2e/cms-materi-editor.spec.ts` (pola, termasuk kursus terkunci lewat SQL), `e2e/rbac.spec.ts` (tabel cakupan), `e2e/layout/axe.spec.ts`, `e2e/layout/touch-targets.spec.ts` (pola builder S1-02).

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
- `plainTextToDoc(text: string): ContentDoc` — `\r\n` dan `\r` → `\n`; setiap baris dipangkas; baris yang kosong setelah dipangkas dibuang; setiap baris tersisa menjadi satu `paragraph` berisi satu node `text`. Input yang tidak menyisakan satu baris pun → `throw new Error(…)`: dokumen `{ type: "doc", content: [] }` **ditolak** validator (`INVALID_STRUCTURE`, dicek 8 Nov), dan pemanggil selalu lewat `questionInput`, yang menolak teks kosong lebih dulu. Keluarannya lolos `validateContentDoc`.
- `docToPlainText(doc: unknown): string` — kebalikannya: teks paragraf digabung `\n`, `hardBreak` → `\n`, node lain diambil teksnya saja; `null`/bukan dokumen → `""`.
- **Arah bolak-balik yang persis hanya dokumen → teks → dokumen** (untuk dokumen hasil `plainTextToDoc`). Arah teks → dokumen → teks menghasilkan **bentuk normal**: `"a\n\n\nb"` → `"a\nb"`, `"x\r\ny"` → `"x\ny"`, `"  a  \n   \nb"` → `"a\nb"`. Akibatnya baris kosong di antara paragraf hilang setelah simpan — keterbatasan teks biasa, dicatat di PR.

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
    weights,               // getScoreWeights() → { lessonPercent, finalPercent }
  }
  ```
  `text` dan `explanation` dikirim sebagai teks biasa (`docToPlainText`). `hasKey` = tepat satu opsi benar; `hasExplanation` = pembahasan tidak kosong. Data kunci aman di sini karena halaman ini khusus staf: aturan `CLAUDE.md` "`is_correct` & pembahasan tidak pernah dikirim sebelum submit" berlaku untuk jalur peserta, bukan editor CMS EDITOR+. Jalur peserta (Sab 14) tidak boleh memakai DTO ini.
- **Konstanta dari modul `"use client"` di halaman server** (`CONTENT_DOC_HEADING_CLASS`, `LOCKED_NOTICE`): **hanya dioper langsung** sebagai prop, seperti halaman S1-04. Jangan diolah di server (`cn(…)`, template string, lookup peta, `typeof`). Diuji 8 Nov di build Next 16.4.1: di server nilainya `typeof` = `"function"` (client reference), tetapi `<h1 className={X}>` tetap ter-render dengan kelas yang benar karena referensinya diselesaikan saat SSR (pelajaran 3 Nov).
- **Bobot nilai — `getScoreWeights()`** (baru, `src/modules/quiz/service.ts` + query di `queries.ts`): membaca `score.lesson_weight` dan `score.final_weight` sebagai `::text` lalu di-parse sekali (pola `selectMinQuestionsText`). **Gagal tertutup** seperti `getMinQuestions`: baris hilang, bukan bilangan bulat, di luar 0–100, atau jumlah keduanya ≠ 100 → `Error` yang menyebut kedua kunci dan `npm run db:seed`. Tidak ada angka cadangan. Kartu hasil & nilai (Sen 16) memakai fungsi yang sama.
- **Tata letak (22a, 22h)** di dalam padding layout CMS, tanpa bar kedua (pelajaran S1-04):
  - Baris kepala: `ContentDocBreadcrumb` (tanpa penjaga).
    - Final Quiz: `KURSUS / {judul kursus} / FINAL QUIZ`.
    - Quiz materi: `KURSUS / {judul kursus} / MATERI {n} / QUIZ`, ditambah tautan "← Materi {n}" ke editor materinya (22h).
  - Label jenis: Final Quiz = pil gelap (`bg-text`, teks `surface`, 22a); Quiz materi = pil terang (`bg-fill`, teks `text-muted`, 22h). Lalu mono "MILIK KURSUS · JENIS TIDAK BISA DIUBAH" / "MILIK MATERI {n} · JENIS TIDAK BISA DIUBAH".
  - `h1`: judul kursus (Final Quiz) atau judul materi (quiz materi), gaya `CONTENT_DOC_HEADING_CLASS`.
  - Pil jumlah *(usulan)*: Final Quiz "{n} dari 20 soal" selama n < 20, lalu "{n} soal" (QZ-02 tanpa maksimum, jadi tidak pernah "25 dari 20"); quiz materi "{n} soal". Warna: `pending-tint` + `pending-tint-text` selama belum mencapai target (Final Quiz 20, quiz materi `min`), `success-tint` + `success-tint-text` setelahnya (22a vs 22h). Di sebelahnya mono "MINIMUM PUBLISH {min} SOAL · SUDAH TERPENUHI" atau "MINIMUM PUBLISH {min} SOAL · KURANG {k}".
  - "Daftar soal" (h2) + tombol "+ Tambah soal" (secondary) yang membuka dialog bagian 4.
  - Baris soal: nomor dua digit mono, pertanyaan satu baris (terpotong, `title` berisi teks lengkap), penanda mono "PG · KUNCI ✓ · PEMBAHASAN ✓" (`success`, 4,96:1 di putih), "B/S · …" untuk benar/salah, tombol "Sunting" (`text-primary-deep`) yang membuka dialog berisi soal itu. Nama aksesibel tombol unik: "Sunting soal {nn}" (sufiks lewat `sr-only`; baris `relative` agar span `sr-only` tidak melebarkan halaman — pelajaran S1-01). Target sentuh ≥ 44 px. Baris dengan kunci atau pembahasan kosong (hanya mungkin dari data lama) memakai latar `danger-tint`, garis `danger-tint-line`, dan penanda `KUNCI KOSONG` / `PEMBAHASAN KOSONG` berwarna `danger` (5,92:1 di `danger-tint`). Pegangan seret ⋮⋮ **tidak** ditampilkan (urutkan ulang belum ada), dan **semua** soal dirender — tanpa "+ n soal lain · seret untuk mengurutkan".
  - **Tata baris (revisi 8 Nov).** Pembungkus daftar memakai `@container`. Di bawah lebar wadah 560 px, baris dua lapis: lapis 1 = nomor + pertanyaan selebar baris; lapis 2 = penanda + "Sunting". Mulai `@min-[560px]:` satu lapis seperti 22a (nomor · pertanyaan · penanda · Sunting). Kelas `@container` dan `@min-[560px]:…` dihasilkan Tailwind 4.3.3 repo ini (dicek 8 Nov); ini tidak menambah ambang viewport baru di `CLAUDE.md`.
  - Kosong: "Belum ada soal." *(usulan)* + tombol "+ Tambah soal".
- **Kolom kanan (≥ 1024 px; di bawahnya ditumpuk setelah daftar)** — grid `lg:grid-cols-[minmax(0,1fr)_288px]` dengan jarak 24 px. **Bukan** 360 px seperti builder: dengan pola builder (kolom kanan 360, baris selalu satu lapis), prototipe di Chromium memberi teks soal **14 px** di 1024 dan 7 px di 360. Dengan 288 px + baris dua lapis di atas: teks soal 250 px (360), 329 px (1024), 405 px (1100), 342 px (1280), 502 px (1440), tanpa gulir samping. Isi kolom "ATURAN QUIZ", hanya baca:
  - Durasi "{d} menit", Ambang lulus "{p}%" (quiz materi ditambah keterangan 22h "Hanya label — lulus atau tidak, materi tetap selesai"), Kesempatan "1 — terkunci", Acak soal "Ya"/"Tidak", Acak opsi "Ya"/"Tidak";
  - Bobot dari `getScoreWeights()`: Final Quiz "{finalPercent}% Nilai Akhir"; quiz materi "Bagian dari {lessonPercent}%" + keterangan "Rata-rata semua quiz materi di kursus ini" (22h);
  - catatan 22a: "Jumlah kesempatan tidak bisa diubah. Satu kesempatan adalah keputusan produk (K-04), bukan setelan per quiz.";
  - blok "BELUM LENGKAP" hanya bila ada kekurangan: "· Soal {nn} belum ada pembahasan", "· Soal {nn} belum ada kunci", "· Kurang {k} soal dari minimum {min}" *(baris terakhir usulan; 22a memakai "target 20")*.
- **Kursus bukan `DRAFT`:** banner info `LOCKED_NOTICE` (S1-02), tanpa "+ Tambah soal" dan tanpa "Sunting". Daftar soal tetap tampil.
- **Setelah simpan berhasil**, daftar diperbarui dengan `router.refresh()`.

### 4. Dialog satu soal (22b) — `src/components/cms/question-dialog.tsx` (baru)
Dialog A-06 selebar 760 px (desain 22b), satu formulir tanpa react-hook-form. `DialogContent` membatasi `sm:max-w-[560px]`, jadi lebar 760 diberikan lewat `className="sm:max-w-[760px]"`.

- **Judul dialog** (prop `title` `DialogContent`): "Soal {nn} dari {total}". Untuk soal baru, `{nn}` = jumlah soal + 1 dan `{total}` ikut bertambah satu. 22b menulisnya sebagai eyebrow mono; di sini memakai judul tebal A-06 — penyimpangan sadar, dicatat di PR.
- **Tipe soal:** `<select>` "Pilihan ganda" / "Benar/salah" (22b "Pilihan ganda ▾") dengan nama aksesibel "Tipe soal", target sentuh ≥ 44 px. **Tidak** di kanan atas seperti 22b: posisi itu milik ✕ `DialogContent` (`absolute right-3 top-3`, judul `pr-11`). Select menjadi baris pertama formulir, di bawah judul, rata kanan mulai 640 px (pelajaran 7 Nov no. 7).
  - Pindah ke Benar/salah: opsi menjadi dua baris tetap "Benar" dan "Salah" (tanpa isian), kunci dikosongkan.
  - Pindah ke Pilihan ganda: empat isian opsi kembali, berisi teks **dan kunci** terakhir yang dipilih untuk pilihan ganda di dialog ini *(usulan revisi 8 Nov no. 10)*.
- **"PERTANYAAN":** textarea, `maxLength` sesuai `QUESTION_LIMITS`.
- **"OPSI JAWABAN · KLIK LINGKARAN UNTUK MENANDAI KUNCI":**
  - Satu grup radio bernama "Kunci jawaban" (`fieldset` + `legend`, atau `role="radiogroup"` + `aria-label`). Setiap baris: lingkaran radio, isian teks opsi, dan label huruf di kanan.
  - **Nama aksesibel dibedakan** agar locator e2e tidak ambigu: isian "Opsi A"…"Opsi D"; radio "Kunci: opsi A"…"Kunci: opsi D" (B/S: "Kunci: Benar", "Kunci: Salah"). Radio native `sr-only` di dalam `<label>` lingkaran dengan area klik ≥ 44 × 44 px (pola pil Level S1-01); mengeklik isian teks **tidak** memilih kunci.
  - Baris kunci memakai garis `success`, latar `success-tint`, lingkaran ✓ (isi `success`, centang putih), dan label "KUNCI" berwarna **`success-tint-text`**. Bukan `success`: `#157f5f` di atas `success-tint` hanya **4,35:1** (di bawah 4,5, axe `serious`); `success-tint-text` 6,70:1 (aturan `TOKENS.md`: teks di atas `*-tint` memakai pasangan gelapnya).
  - Benar/salah: teks "Benar"/"Salah" statis, bukan isian.
- **"PEMBAHASAN"** + tag "Wajib" (`danger-tint` / `danger`): textarea.
- **Tombol:** "Simpan & tambah soal" (secondary) dan "Simpan soal" (dark), lebar sama di ≥ 640 px.
  - **Urutan DOM: "Simpan soal" lebih dulu**, lalu urutan tampilan dibalik (`sm:flex-row-reverse`) agar tetap seperti 22b. Alasannya implicit submission: Enter di isian (mis. "Opsi A") mengeklik tombol submit **pertama** di DOM. Dengan urutan 22b apa adanya, Enter di "Opsi A" menjalankan "Simpan & tambah soal" — soal tersimpan dan formulir kosong saat penulis masih mengetik (dibuktikan di Chromium 153, 8 Nov). Di bawah 640 px tombol bertumpuk dengan "Simpan soal" di atas.
  - **Mode simpan dari `event.nativeEvent.submitter`:** hanya tombol "Simpan & tambah soal" yang memberi mode "tambah". Selain itu — termasuk `submitter === null` (`form.requestSubmit()` tanpa argumen, `fireEvent.submit` di jsdom 29, dicek 8 Nov) — mode "Simpan soal".
  - Enter di textarea menambah baris, tidak menyimpan.
- **Alur simpan:**
  - Validasi klien dengan `questionInput` dulu. Galat tampil di bawah isiannya (`aria-describedby`, `aria-invalid`), lalu fokus ke isian pertama yang salah. Tidak ada request. Galat ber-path `options` (jumlah opsi, kunci, B/S) tampil di bawah grup "Kunci jawaban" dan fokus ke radio kunci pertama; galat `options.{i}.text` ke isian opsi itu. Urutan "pertama" mengikuti urutan formulir: pertanyaan → opsi → kunci → pembahasan.
  - Penjaga `inFlight` (pola S1-02). Tes submit ganda memakai submit formulir kedua, bukan klik tombol (tombol `loading` memasang `disabled` native — pelajaran 7 Nov no. 6).
  - **201/200 + "Simpan soal"** → dialog tertutup, fokus kembali ke tombol yang membukanya, `router.refresh()`.
  - **201/200 + "Simpan & tambah soal"** → dialog tetap terbuka sebagai soal baru: tipe dipertahankan, isian dikosongkan, judul naik ("Soal {n+1} dari {n+1}"), fokus ke "Pertanyaan", `router.refresh()`.
  - **400** → `fields` dipetakan ke isian berdasarkan path (`text`, `explanation`, `options`, `options.{i}.text`); path lain → pesan umum di dialog.
  - **409** → banner galat di dialog berisi pesan server, kedua tombol simpan disembunyikan, isian **tetap utuh** (penulis masih bisa menyalin teksnya), lalu `router.refresh()`. State dialog tinggal di komponen editor quiz yang dirender di **kedua** keadaan (draf dan terkunci), jadi dialog tetap terbuka setelah halaman berganti ke tampilan terkunci. Pembukanya ("Sunting soal nn" / "+ Tambah soal") sudah hilang di tampilan terkunci, jadi saat dialog ditutup fokus dipindah ke `h1` halaman (`tabIndex={-1}`, lewat `onCloseAutoFocus`), bukan jatuh ke `body` (masalah yang sama dicatat STATUS untuk S1-08).
  - **Galat lain atau jaringan putus** → "Soal belum tersimpan — periksa koneksi lalu coba lagi." *(usulan)* di dialog. Isian tetap utuh.
- **Menutup dialog** (✕ atau Esc) membuang perubahan tanpa konfirmasi *(usulan untuk demo; dicatat di PR)*.

### 5. Pintu masuk editor quiz
- **Builder, blok Final Quiz** (`lesson-outline.tsx`, komentar "Sunting Final Quiz … deliberately not rendered"): tambahkan tautan "Sunting Final Quiz" ke `/cms/quiz/{finalQuiz.id}` bergaya tombol sekunder (`buttonVariants({ variant: "secondary" })`, sama dengan "Sunting" di baris materi) di kanan judul "Final Quiz", seperti 21a/21g (desain 40 px → 44 px aturan target sentuh). Ditampilkan untuk semua status kursus (halaman quiz sendiri menangani tampilan terkunci), dan **tidak** dirender bila `finalQuiz === null` (kolom `final_quiz_id` nullable).
- **Halaman editor materi** — blok "Quiz materi" seperti 21i, di bawah editor:
  - judul "Quiz materi", pil "{n} dari min. {min} soal", teks "Sudah dibuat otomatis · wajib dikerjakan user agar materi selesai" *(usulan; 21i: "Sudah dibuat otomatis & kosong…")*, tautan "Isi quiz →" bila `n = 0`, "Sunting quiz →" bila `n > 0` *(usulan)*, menuju `/cms/quiz/{quizId}`;
  - pil jumlah memakai warna yang sama dengan halaman quiz: `pending-tint` selama n < min, `success-tint` setelahnya; target sentuh tautan ≥ 44 px;
  - **komponen blok diekspor** dari `content-doc-form.tsx` (pola `ContentDocBreadcrumb`) dengan prop penjaga opsional, supaya ketiga cabang halaman editor materi memakai blok yang sama;
  - **tautan ini lewat penjaga perubahan belum disimpan yang sama dengan breadcrumb**: `ContentDocForm` mendapat prop opsional `quizBlock?: { href: string; questionCount: number; minQuestions: number }` dan merender blok itu dengan `onBreadcrumbClick` yang sudah ada;
  - `getLessonEditor` ditambah `lesson.quizId` dan `lesson.quizQuestionCount`, plus `minQuestions`. `lessons.quiz_id` nullable: bila `null`, blok tidak dirender;
  - tampilan terkunci materi **dan** cabang "Isi materi ini tidak bisa dibuka editor.": blok yang sama tanpa penjaga, dengan tautan "Lihat quiz →" (terkunci) atau label biasa (cabang tak terbaca).

### 6. Tabel cakupan RBAC, target sentuh, aksesibilitas, dan lebar
- `e2e/rbac.spec.ts`:
  - tambah baris `/cms/quiz/[quizId]` (MEMBER 403 dengan literal `[quizId]`, EDITOR+ 200). ID nyata = `data.quizId` dari respons `POST …/lessons` yang sudah dipanggil di setup baris materi (`CreatedLessonDTO.quizId`);
  - **perbaiki bug baris deskripsi S1-04:** substitusinya sekarang `realCoursePath` (path builder), sehingga `/cms/kursus/{id}/deskripsi` **tidak pernah diminta** (baris 196–199 di `0922046`). Substitusi yang benar `${realCoursePath}/deskripsi`. Jangan meniru pola lama untuk baris quiz.
- `e2e/layout/touch-targets.spec.ts` — satu tes baru di w360 (pola tes builder S1-02, `expectTouchTarget`): "Sunting Final Quiz" (builder), "+ Tambah soal", "Sunting soal 01", "Isi quiz →" (editor materi), dan di dialog: "Tipe soal", keempat area kunci, kedua tombol simpan, ✕. `expectTouchTarget` mengukur `boundingBox` locator, sehingga radio native `sr-only` (1 × 1 px) selalu gagal: yang diukur `<label>` pembungkusnya, mis. `dialog.locator("label", { has: page.getByRole("radio", { name: "Kunci: opsi A" }) })`.
- `e2e/layout/axe.spec.ts`: halaman editor quiz (Final Quiz terisi dua soal) dan **dialog sunting soal 1** (punya kunci, jadi baris "KUNCI" ikut diperiksa — dialog soal baru tidak punya baris kunci), pada w360 dan w1280.
- **Lebar teks soal** (di `cms-quiz-editor.spec.ts`, project `chromium` dengan `page.setViewportSize`): pada viewport 360, 1024, dan 1280, lebar kotak teks soal baris pertama ≥ 240 px (`boundingBox`) dan `scrollWidth ≤ innerWidth`. 1024 tidak ada di `widths.ts`, jadi diukur di sini.

## Bukan lingkup tugas ini
- **Setelah demo:** hapus soal, urutkan ulang (seret dan keyboard), ubah setelan quiz (durasi, ambang, acak), judul/instruksi quiz, gambar soal, bobot poin selain 1, teks kaya untuk soal, "Pratinjau sebagai peserta", daftar quiz 22f (`/cms/quiz` tetap placeholder), penjaga "sudah dikerjakan" 22d (baru relevan setelah terbit), tata letak tablet 22e.
- **Kartu impor CSV (Sen 9):** tombol "Impor CSV" dan seluruh alur 22c. Kartu itu memakai `questionInput`, `plainTextToDoc`, dan query buat soal dari kartu ini.
- **Tidak dirender dari 22a/22h:** tombol "Simpan" di kepala halaman (tidak ada yang perlu disimpan di level halaman selama aturan hanya baca; setiap soal disimpan dari dialog), "Pratinjau"/"Pratinjau sebagai peserta" (di atas), "+ n soal lain · seret untuk mengurutkan", dan catatan "Bedanya dengan Final Quiz…" 22h (menyebut batas 5–10 yang tidak dipakai).
- **Ctrl+S / ⌘S di halaman quiz dan dialog** tidak dipakai (S1-04 hanya untuk editor dokumen).
- **Diketahui, tidak diubah:** baris "bobot 40% Nilai Akhir" di blok Final Quiz builder masih ditulis langsung di kode (catatan STATUS 4 Nov); halaman editor quiz membaca `getScoreWeights()`.

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
- `e2e/cms-quiz-editor.spec.ts` (baru), `e2e/rbac.spec.ts` (satu baris + substitusinya + perbaikan substitusi baris deskripsi), `e2e/layout/axe.spec.ts` (halaman quiz + dialog sunting), `e2e/layout/touch-targets.spec.ts` (satu tes baru)

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
- [ ] **Tes `plainTextToDoc` / `docToPlainText`:** (a) dokumen → teks → dokumen persis untuk keluaran `plainTextToDoc` (satu baris, banyak baris); (b) teks → dokumen → teks memberi bentuk normal persis seperti contoh di bagian 1 (`"a\n\n\nb"` → `"a\nb"`, `"x\r\ny"` → `"x\ny"`, `"  a  \n   \nb"` → `"a\nb"`); (c) `plainTextToDoc("")` dan `plainTextToDoc("  \n  ")` melempar; (d) setiap keluaran lolos `validateContentDoc`; (e) `docToPlainText(null)` → `""`.
- [ ] **Tes `getScoreWeights`** (integrasi PGlite, pola tes `getMinQuestions`): hasil seed → `{ lessonPercent: 60, finalPercent: 40 }`; baris hilang, string `"40"`, `150`, dan jumlah 99 → `Error` yang menyebut kedua kunci.
- [ ] **Tes integrasi** (PGlite, pola `src/modules/{course,lesson}/service.integration.test.ts`; `updated_at` di-pin ke 2020 sebelum asersi "bergerak"):
  - **Buat:** soal Final Quiz dan soal quiz materi tersimpan dengan `order_index` berurutan 1, 2, 3; opsi 4 (PG) atau 2 (B/S) dengan tepat satu benar; teks tersimpan sebagai dokumen yang lolos validator; kursus tersentuh; satu baris audit berisi ringkasan saja (JSON audit tidak memuat teks soal maupun opsi).
  - **Ubah:** opsi lama terganti; ganti tipe PG → B/S menghasilkan tepat 2 opsi.
  - **Penjagaan:** kursus `IN_REVIEW` → 409 dan tidak ada yang ditulis; quiz tidak dikenal → 404; soal milik quiz lain → 404; peran di bawah EDITOR → 403 **sebelum** input diparse.
  - **Aturan server:** PG 3 opsi, dua kunci, B/S dengan teks "Ya"/"Tidak", dan pembahasan kosong → `ZodError` dengan path yang benar, DB tidak berubah.
- [ ] **Tes komponen** (`question-dialog.test.tsx`, jsdom):
  - judul "Soal 03 dari 12", tipe, isian, dan radio kunci terisi dari soal yang disunting;
  - nama aksesibel: isian "Opsi A"…"Opsi D" dan radio "Kunci: opsi A"…"Kunci: opsi D" masing-masing tepat satu elemen;
  - pindah tipe PG → B/S → PG mempertahankan teks opsi PG **dan** kunci PG; PG → B/S mengosongkan kunci;
  - `fireEvent.submit(form)` tanpa submitter (formulir lengkap) → satu `fetch`, mode "Simpan soal" (dialog tertutup);
  - galat `options` (tanpa kunci) → pesan di bawah grup "Kunci jawaban", fokus ke "Kunci: opsi A";
  - 409 → banner berisi pesan server, tombol simpan tidak ada, isian utuh; setelah ditutup fokus di `h1` halaman (tes komponen halaman);
  - galat klien: tanpa `fetch`, pesan di bawah isian, `aria-invalid`, fokus ke isian salah pertama;
  - "Simpan soal" → satu `fetch` dengan method, URL, dan body yang benar, dialog tertutup, fokus kembali ke pembuka;
  - "Simpan & tambah soal" → dialog tetap terbuka, isian kosong, tipe tetap, judul naik, fokus ke "Pertanyaan";
  - submit ganda (submit formulir kedua saat `fetch` pertama tertunda, jeda tetap) → satu `fetch`;
  - 400 dengan `fields[0].path = "options.2.text"` → pesan di bawah "Opsi C"; 409 → banner + `router.refresh`; jaringan gagal → pesan, isian utuh.
- [ ] **Tes komponen halaman** (`quiz-editor.test.tsx`): penanda baris (lengkap, kunci kosong, pembahasan kosong), pil jumlah (teks dan warna, termasuk Final Quiz 19 → "19 dari 20 soal" dan 21 → "21 soal") dan baris minimum untuk kedua jenis, pil jenis gelap/terang, bobot dari props, nama "Sunting soal 01" unik per baris, blok "BELUM LENGKAP" muncul hanya bila ada kekurangan, tampilan terkunci tanpa tombol ubah.
- [ ] **Tes builder:** tautan "Sunting Final Quiz" menuju `/cms/quiz/{id}`; tanpa tautan bila `finalQuiz` null.
- [ ] **Tes `ContentDocForm`:** blok quiz tampil dengan label sesuai jumlah soal, dan klik tautannya saat belum disimpan membuka dialog penjaga.
- [ ] **E2E** (`cms-quiz-editor.spec.ts`, EDITOR):
  1. Builder → "Sunting Final Quiz" → halaman editor dengan breadcrumb dan "0 dari 20 soal".
  2. "+ Tambah soal" → isi PG (kunci B) + pembahasan → "Simpan & tambah soal" → dialog kosong untuk soal 2 → isi B/S (kunci Salah) → "Simpan soal" → dua baris dengan penanda lengkap, "2 dari 20 soal", "KURANG 8".
  3. Muat ulang → kedua soal bertahan; "Sunting" soal 1 → isian terisi.
  4. Editor materi → blok "Quiz materi" → "Isi quiz →" → halaman quiz materi dengan "← Materi 1".
  5. **API:** PG 3 opsi → 400 path `options`; soal milik quiz lain → 404; MEMBER → 403 (termasuk body 100 KiB, peran dicek sebelum body).
  6. Kursus `IN_REVIEW` → halaman quiz terkunci tanpa "+ Tambah soal"; API → 409.
  7. Lebar 360 → halaman quiz dan dialog tidak menggulir ke samping; ukuran teks soal di 360, 1024, 1280 (bagian 6).
  8. **Enter di "Opsi A"** pada formulir PG lengkap → dialog tertutup dan jumlah soal bertambah satu (mode "Simpan soal", bukan "tambah").
- [ ] **RBAC (termasuk perbaikan baris deskripsi), target sentuh, dan axe:** bagian 6.
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
  12. "Simpan & tambah soal" dikembalikan ke urutan DOM pertama → E2E no. 8 merah.
  13. `getScoreWeights` mengembalikan 60/40 cadangan saat baris hilang → tes integrasi merah.
  14. Label "KUNCI" memakai `text-success` → axe merah di w360 dan w1280 (dialog sunting).

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`. `main` sudah memuat S1-04.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR. Harapan: 0 excused / 0 blocking / 23 (dikonfirmasi di `main` `0922046`, 8 Nov). Angka lain atau temuan blocking baru → berhenti dan tempel output lengkapnya.
- **Prettier:** berkas yang sudah ada tetap apa adanya, sehingga diff sebatas lingkup. Berkas baru boleh dirapikan.
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas.
- **"Keputusan & asumsi" di PR** memuat semua copy usulan dan keputusan yang diambil tanpa bertanya.
- **Screenshot** halaman quiz (Final Quiz dan quiz materi) di w1280, **w1024**, w768, dan w360; dialog (PG baru, PG sunting dengan kunci, B/S, galat) di w1280 dan w360. Diambil lokal dengan `E2E_SCREENSHOT_DIR` (konvensi A-19b), `animations: "disabled"`.
- **Setelah push:** cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`
- Baseline Vitest di `0922046`: **88 berkas / 910 tes** (dijalankan di sandbox 8 Nov). PR melaporkan 910 + jumlah tes baru; tes lama yang berubah disebut satu per satu.
- `git diff --stat main -- package.json package-lock.json src/db` kosong

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Lokal (`npm run dev:db`, lalu `npm run dev`), sebagai akun EDITOR:
  1. Buka kursus draf → "Sunting Final Quiz" → tambah satu soal pilihan ganda dan satu benar/salah, memakai "Simpan & tambah soal".
  2. Muat ulang: kedua soal bertahan; sunting satu soal, ubah kuncinya, simpan.
  3. Buka editor materi → "Isi quiz →" → tambah satu soal → "← Materi 1" kembali ke editor materi.
  4. Di builder, penanda quiz materi dan baris Final Quiz memperlihatkan jumlah soal yang baru.
- [ ] Unggah folder screenshot ke Claude chat untuk dibandingkan dengan 22a, 22h, dan 22b (termasuk w1024: baris dua lapis).

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

## Catatan revisi 8 Nov
Tinjauan terhadap `main` `0922046` sebelum sesi. Bukti dijalankan di sandbox Claude chat; berkas probe tidak masuk repo.

| No. | Temuan | Bukti | Perubahan kartu |
|---|---|---|---|
| 1 | Enter di isian opsi menjalankan "Simpan & tambah soal" | Chromium 153: Enter di "Opsi A" → `submitter` = tombol submit pertama di DOM; dengan "Simpan soal" pertama + `flex-row-reverse` → "Simpan soal". jsdom 29: `fireEvent.submit` → `submitter` null | Bagian 4 (urutan DOM, aturan mode), tes dialog, E2E no. 8, mutasi 12 |
| 2 | Tes "bolak-balik persis untuk baris kosong beruntun" mustahil lulus | Dengan aturan kartu lama `"a\n\n\nb"` kembali sebagai `"a\nb"`; `{ type: "doc", content: [] }` ditolak `validateContentDoc` (`INVALID_STRUCTURE`) | Bagian 1 (arah persis, bentuk normal, lempar pada input kosong), tes konversi |
| 3 | Label "KUNCI" `success` di `success-tint` 4,35:1 | Hitung kontras token `tokens.css` | Bagian 4 (`success-tint-text`), axe di dialog sunting, mutasi 14 |
| 4 | Select tipe di kanan atas bertabrakan dengan ✕ | `dialog.tsx`: ✕ `absolute right-3 top-3`, judul `pr-11` | Bagian 4 |
| 5 | Nama aksesibel radio dan isian bisa sama ("Opsi A") | — | Bagian 4, tes dialog |
| 6 | Pil "Quiz materi" di 22h terang | `22h.html`: `background: #f2efe9; color: #5b554f` | Bagian 3 |
| 7 | Dua kolom di 1024 menyisakan teks soal ±14 px bila meniru builder | Prototipe Chromium (sidebar 249, padding 28): pola builder 14 px (1024), 7 px (360); usulan 288 px + container query 250–502 px di 360–1440 | Bagian 3, tes lebar, screenshot w1024 |
| 8 | Target sentuh tidak diatur | `touch-targets.spec.ts` sudah memuat builder S1-02 | Bagian 3–6, tes baru |
| 9 | Baris deskripsi di `rbac.spec.ts` meminta path builder | Substitusi `realCoursePath` untuk `/cms/kursus/[id]/deskripsi` | Bagian 6 |
| 10 | Bobot nilai tanpa pembaca dan tanpa aturan gagal | Hanya `getMinQuestions` yang ada; `score.lesson_weight` 60 di seed | Bagian 3 (`getScoreWeights`), tes, mutasi 13 |

Putaran kedua (8 Nov, sebelum PR revisi di-merge): konstanta modul `"use client"` di halaman server (diuji di build Next 16.4.1 minimal), aturan `is_correct` `CLAUDE.md` vs editor staf, pengukuran target sentuh radio `sr-only` (`expectTouchTarget` = `boundingBox`), fokus untuk galat `options`, perilaku dialog setelah 409 dan fokus saat pembuka hilang, gaya "Sunting Final Quiz" (21a/21g), baseline Vitest 910, dan 22g (cocok dengan kartu; 22g menyebut "5–10 soal" untuk quiz materi, digantikan keputusan no. 5).

Juga: `finalQuiz`/`lessons.quiz_id` null, cabang dokumen tak terbaca, pil "{n} dari 20" setelah 20, kunci saat pindah tipe, lebar dialog 760 vs bawaan 560, dan isi 22a/22h yang tidak dirender. Yang dicek cocok: semua rujukan berkas dan simbol, matriks RBAC `/cms/quiz` prefix EDITOR+, sidebar "Quiz" aktif untuk `/cms/quiz/{id}`, tidak ada tes lama yang merah, zod 4.6.6 `discriminatedUnion` + `superRefine` mengumpulkan semua galat dengan path yang benar (dan melewati refine saat galat tipe), path galat 400 digabung `.` (cocok dengan `options.2.text`), aturan soal = QZ-04 / §11.4 no. 12, gate 0 / 0 / 23.
