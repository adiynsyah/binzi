# S5-02 · Final Quiz (versi demo): gerbang semua materi selesai, aturan 7h, kerjakan dengan mesin S3-01, hasil + Nilai Akhir 60/40

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | **S3-01** (PR #138, `fb7a70c`): modul `attempt` (`startLessonQuiz`, `saveQuizAnswer`, `submitQuizAttempt`, serializer `orderOptions`/`toQuizResultDTO`), `QuizRunner`, `answer-save-queue`, `QuizExpiredSubmit`, `QuizResult`, `loadLessonQuizContext`, `recordLessonQuizResult`, `isQuizEligible`. **S1-09**: `getScoreWeights` (`src/modules/quiz/service.ts`, gagal tertutup). **S5-01**: badge dasbor sudah memetakan `PASSED` → "Lulus" dan `COMPLETED` → "Selesai". **S1-08**: kursus terbit wajib punya Final Quiz ≥ 10 soal |
| **Target** | Kam 19 Nov malam. Langkah terakhir kode jalur demo 20 Nov |
| **Branch** | `s5/s5-02-final-quiz` |

> **Dibuat 19 Nov 2026** di Claude chat terhadap `main` `fb7a70c` (pohonnya identik dengan `18557d0`, head terakhir PR #138). Fakta kode yang dirujuk sudah dicek di sana (lihat "Catatan tinjauan 19 Nov").
>
> **Keputusan pemilik 19 Nov** (tercantum di "Keputusan & asumsi" PR):
>
> 1. **Final Quiz tetap masuk demo**, walaupun titik cek usulan Rab 18 pukul 12.00 terlewat. **Batas potong:** bila PR ini belum di-merge 3 jam sebelum demo, demo berjalan tanpa Final Quiz. Data demo tetap memuat 10 soal Final Quiz karena syarat terbit memintanya.
> 2. **Penonton demo internal.** Kursus demo diketik pemilik lewat CMS di Production (bukan kartu seed).
>
> **Keputusan teknis kartu** (usulan Claude chat, disetujui bersama kartu):
>
> 3. **Mesin S3-01 dipakai apa adanya.** `saveQuizAnswer`, rute PUT jawaban, rute kumpulkan, `QuizRunner`, antrean simpan, ringkasan, dan `QuizExpiredSubmit` tidak diubah. Yang baru hanya konteks **mulai** Final Quiz dan **efek samping kumpulkan** Final Quiz (catatan akhir kartu S3-01).
> 4. **"Lulus kursus" = nilai Final Quiz ≥ `passing_score_percent` Final Quiz** (PRD §6.2 "LULUS = SELESAI DAN final_quiz.is_passed", §7.4 B). Kalimat 7h "Lulus kursus di Nilai Akhir ≥ 70" **tidak dipakai**: bila desain dan PRD bertentangan soal aturan, PRD menang (pelajaran 4 Nov). Copy 7h yang menyebut batas lulus disesuaikan (bagian 4).
> 5. **Nilai Akhir dihitung di setiap kumpulkan Final Quiz** (Lulus atau tidak), dalam transaksi kumpulkan, lalu disimpan di `enrollments.final_score_percent`:
>    `round2(rata-rata quiz_score_percent SEMUA materi kursus × lesson_weight / 100 + score_percent Final × final_weight / 100)`.
>    Bobot dari `getScoreWeights` (gagal tertutup, tanpa cadangan 60/40). `enrollments.status` = `PASSED` bila Final lulus, selain itu `COMPLETED`; `completed_at` hanya bila masih null. Halaman hasil **membaca nilai tersimpan**, tidak menghitung ulang.
> 6. **Gerbang Final Quiz = semua materi kursus berstatus `COMPLETED`** di `lesson_progress` (definisi "Materi Selesai" PRD §6.2, QZ-13, CRS-07). Attempt Final yang sudah ada **mengalahkan gerbang** (pola S3-01 butir 5): halaman hasil dan "Lanjutkan" tidak pernah dikunci balik.
> 7. **Tanpa dialog konfirmasi tambahan.** Halaman aturan Final (7h kiri) adalah layar konfirmasi QZ-18: memuat "satu kesempatan" dan "nilai tercatat permanen".
> 8. **Pintu masuk Final Quiz** (dua, keduanya hanya bila semua materi `COMPLETED`): tombol di penutup hasil quiz materi, dan tombol di bar bawah halaman materi yang quiz-nya sudah dikerjakan. Baris "Final Quiz" di Daftar materi dan pintu di dasbor **tidak** dibangun.
> 9. **Tanpa migrasi, tanpa dependensi baru, CSP tidak berubah.**

## Tujuan
Peserta yang sudah menyelesaikan semua materi (video ≥ 90 % atau tanpa video, quiz dikerjakan) membuka Final Quiz dari hasil quiz materi terakhir atau dari bar bawah materi. Halaman aturan menampilkan rata-rata quiz materi dan bobot 60/40. Final Quiz dikerjakan dengan runner S3-01 (timer server, simpan otomatis, ringkasan). Setelah dikumpulkan, halaman hasil menampilkan nilai Final Quiz, label "Lulus kursus"/"Belum lulus", Nilai Akhir beserta rumusnya, dan pembahasan. Status kursus di dasbor berubah menjadi "Lulus" atau "Selesai". Kunci jawaban tidak pernah sampai ke klien sebelum dikumpulkan.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD:
  - `docs/prd/sections/06-2-kursus-materi.md` (definisi "Materi Selesai", "Kursus Selesai & Lulus", CRS-07);
  - `06-3-quiz-sistem-penilaian.md` (QZ-13, QZ-18);
  - `06-4-progress-nilai-saya-menggantikan-sertifi.md` (PRG-05, PRG-06);
  - `07-navigasi-information-architecture.md` (§7.4 B, rute `/belajar/{slug}/final-quiz`);
  - `11-model-data.md` (`enrollments`: `status`, `completed_at`, `final_score_percent`; `courses.final_quiz_id`).
- Desain: `docs/design/screens/7h.md` + `.png` (aturan + hasil Final), `7g.png`/`7n.png` (runner, sudah dibangun S3-01).
- Kode:
  - `src/modules/attempt/{schema,policy,queries,serializer,service}.ts` + `quiz-attempt.integration.test.ts`, `serializer.test.ts`;
  - `src/modules/progress/{policy,queries,serializer,service}.ts` (`loadUnlockedLessonContext`, `loadLessonQuizContext`, `recordLessonQuizResult`, `selectOutlineRows`, `findLessonInPublishedCourse`, `selectPublishedCourseBySlug`, `toLessonPageDTO`, `badgeOf`);
  - `src/modules/quiz/service.ts` (`getScoreWeights`) + `serializer.ts` (`ScoreWeights`);
  - `src/components/learn/quiz/*`, `src/components/learn/{lesson-page,quiz-start-button}.tsx`, `src/components/ui/progress-bar.tsx`;
  - `src/app/(learn)/belajar/[slug]/[materi]/quiz/page.tsx` (pola halaman), `src/app/api/quiz/lessons/[lessonId]/attempt/route.ts` (pola route);
  - `src/lib/learn-route-structure.test.ts`.
- E2E: `e2e/belajar-quiz.spec.ts` (helper lokal `attemptViaApi`, `answerViaApi`, `optionsFromDb` — salin polanya ke spec baru; `belajar-quiz.spec.ts` tidak diubah), `e2e/layout/helpers.ts` (`createPublishedCourseViaApi` mengembalikan `finalQuizId` + 10 soal Final berkunci "Opsi satu …"; `deleteCoursesInE2eDb` sudah menghapus attempt Final), `e2e/layout/axe.spec.ts` (hanya w360 + w1280), `e2e/README.md` (`E2E_SCREENSHOT_DIR`).

## Kerjakan

### 1. Modul `progress` (server)
- `selectPublishedCourseBySlug` dan `findLessonInPublishedCourse` ikut membaca `courses.final_quiz_id` (`finalQuizId: string | null`). Tes `toEqual` atas baris/DTO yang berubah didaftar di rencana.
- `policy.ts`: `allLessonsCompleted(outline)` = outline tidak kosong **dan** setiap baris `status === "COMPLETED"`.
- `serializer.ts`: `finalQuizHref(courseSlug)` = `/belajar/{slug}/final-quiz` (saudara `quizHref`).
- **Pintu masuk** (keputusan 8), aturan yang sama di dua tempat:
  - DTO `open` mendapat `finalQuizHref: string | null` — terisi bila `allLessonsCompleted(outline)` **dan** `course.finalQuizId !== null`;
  - `LessonQuizContext` mendapat `finalQuizHref` dengan aturan yang sama.
- **Ekspor baru `loadFinalQuizContext(executor, actorId, target: { courseId } | { courseSlug })`** (dipakai `attempt`, bukan sebaliknya; halaman memakai slug, API memakai id). Kursus `PUBLISHED` dengan `final_quiz_id` → enrollment aktor → outline (`selectOutlineRows`). Kembaliannya union:
  - `{ enrolled: false; firstLessonHref }` — aktor belum terdaftar. API memetakannya ke 404 seragam; halaman ke `kembali` (bagian 2);
  - `{ enrolled: true; … }` dengan:
    - `enrollmentId`, `courseId`, `quizId` (= `final_quiz_id`), `courseSlug`, `courseTitle`;
    - `allCompleted: boolean`;
    - `firstIncompleteHref: string | null` (materi pertama yang bukan `COMPLETED`), `lastLessonHref`;
    - `lessonAveragePercent: number | null` — rata-rata `quiz_score_percent` **semua** materi kursus; `null` bila ada materi tanpa nilai.
  - Kursus tidak ada / tidak terbit / tanpa `final_quiz_id` → `NotFoundError`.
- **Ekspor baru `recordFinalQuizResult(tx, { actorId, courseId, enrollmentId, finalScorePercent, isPassed, weights, submittedAt })`** → `{ finalScorePercent: number; courseStatus: "COMPLETED" | "PASSED" }`:
  1. Dengan statement terpisah di `tx`, baca `quiz_score_percent` semua materi **kursus ini** milik aktor (join `lessons.course_id`; nama tabel ditulis lengkap, pelajaran 10 Nov no. 1).
  2. Nilai Akhir = `round2(avg × weights.lessonPercent / 100 + finalScorePercent × weights.finalPercent / 100)`.
  3. Update `enrollments` baris `enrollmentId` + `user_id = aktor`: `final_score_percent`, `status` (`PASSED` bila `isPassed`, selain itu `COMPLETED`), `completed_at = coalesce(completed_at, submittedAt)`.
  4. `lesson_progress` dan `courses` tidak disentuh.

### 2. Modul `attempt` (server)
- `selectQuizSettings` ikut membaca `quizzes.type`.
- **Refaktor tanpa mengubah perilaku:** langkah 3–6 `startLessonQuiz` (ambil soal, acak `question_order`, `attempt_number`, insert `on conflict do nothing`, select pemenang) dipindah ke satu fungsi internal modul, mis. `insertAttemptInTx(tx, { quizId, actorId, enrollmentId })`. `startLessonQuiz` memanggilnya. Semua tes S3-01 tetap hijau **tanpa diubah** — itu buktinya.
- **`startFinalQuiz(actor, { courseId })`** (satu transaksi): konteks `loadFinalQuizContext` (`enrolled: false` → 404 seragam) → attempt Final aktor (`reset_at IS NULL`): `IN_PROGRESS` → `{ created: false }`; `SUBMITTED`/`EXPIRED` → 409 *(usulan)* "Final Quiz ini sudah dikerjakan." → baru gerbang: `!allCompleted` → 409 *(usulan)* "Selesaikan semua materi untuk membuka Final Quiz." → `insertAttemptInTx`.
- **`getFinalQuizPage(actor, courseSlug)` — GET murni.** Keadaan:
  - `kembali` (`{ href }`): tidak terdaftar → `firstLessonHref` (halaman materi menampilkan panel "Mulai materi 1"); belum semua `COMPLETED` **dan belum ada attempt** → `firstIncompleteHref`.
  - `aturan-final`: `courseId`, `courseTitle`, `questionCount`, `durationMinutes`, `passingScorePercent`, `lessonAveragePercent` (dibulatkan), `weights`, `lastLessonHref`.
  - `berjalan`: `QuizRunningDTO` S3-01 apa adanya (pemindaian kunci rekursif tetap berlaku).
  - `kedaluwarsa`: `{ attemptId }` (beacon S3-01).
  - `hasil-final` (bagian 4.C).
- **`submitQuizAttempt` bercabang menurut `quizzes.type`** setelah kunci dan penilaian (langkah 1–4 S3-01 tidak berubah):
  - `LESSON` → jalur S3-01 apa adanya. **Tidak pernah memanggil `getScoreWeights`** (tidak ada mode gagal baru untuk quiz materi).
  - `FINAL` → `courseId` lewat `courses.final_quiz_id = quiz_id` → `weights = await getScoreWeights()` → `recordFinalQuizResult(tx, …)` di transaksi yang sama. Bobot gagal → seluruh transaksi batal, attempt tetap `IN_PROGRESS` (500, tanpa catatan setengah jadi).
- **Serializer:** keluarkan pembangun item pembahasan + hitungan benar/salah/tidak dijawab + durasi dari `toQuizResultDTO` ke satu fungsi murni bersama (mis. `toQuizReviewDTO`). `toQuizResultDTO` (materi) dan `toFinalQuizResultDTO` memakainya. Tes serializer S3-01 tetap hijau **tanpa diubah**.

### 3. API
| Route | Jawaban |
|---|---|
| `POST /api/quiz/courses/[courseId]/final-attempt` | 201 `{ data: { attemptId, created: true } }` · 200 attempt berjalan · 400 bukan UUID · 404 · 409 (belum semua materi selesai / sudah dikerjakan) |

Pola route S3-01: `requireApiRole("MEMBER", request)` dulu, `courseId` lewat `z.uuid()` di `attempt/schema.ts`, `console.error` hanya untuk 5xx. PUT jawaban dan POST kumpulkan memakai route S3-01 yang sudah ada.

### 4. Halaman `/belajar/[slug]/final-quiz`
`src/app/(learn)/belajar/[slug]/final-quiz/page.tsx`, pola halaman quiz S3-01 (`requireRole("MEMBER")`, `NotFoundError` → `notFound()`, `kembali` → `redirect`). **Tanpa `loading.tsx`** (tes struktur ditambah). Segmen statis `final-quiz` mengalahkan `[materi]`; slug materi `final-quiz` sudah ditolak (`lesson/queries.ts:183`).

**A. Aturan — 7h kiri.** Komponen baru di `src/components/learn/quiz/` (boleh berbagi logika tombol mulai dengan `QuizRules`: `inFlight`, `loading`, 201/200/409 → `router.refresh()`, fokus kembali ke tombol saat gagal). Copy dari 7h tanpa anotasi desain ("(QZ-21)"):
- eyebrow mono "FINAL QUIZ · {JUDUL KURSUS}";
- h1 "Final Quiz menentukan {final}% Nilai Akhir";
- paragraf "{n} soal dari seluruh materi kursus. Sama seperti quiz materi: **satu kesempatan**, nilai tercatat permanen.";
- daftar bernomor 01–04:
  - "Rata-rata quiz materi Anda sekarang **{rata-rata}** (bobot {lesson}%)";
  - "**Waktu {m} menit** — timer dihitung server dan terus berjalan meski tab ditutup; habis waktu berarti auto-submit";
  - "Jawaban tersimpan otomatis tiap soal";
  - *(usulan, menggantikan "Lulus kursus di Nilai Akhir ≥ 70" — keputusan 4)* "Lulus kursus bila nilai Final Quiz ≥ {passing}";
- tombol `primary` "Saya siap, mulai Final Quiz" (POST bagian 3; galat jaringan → `Banner` `error` *(usulan)* "Final Quiz belum dimulai. Periksa koneksi lalu coba lagi.") dan tautan `secondary` "Ulas materi dulu" → `lastLessonHref`.
- Kotak bawah 7h ("Belum semua materi selesai?…") **tidak** dibangun: keadaan itu dialihkan (`kembali`).

**B. Mengerjakan:** `QuizRunner` S3-01 apa adanya, `key={attemptId}`. **C. Kedaluwarsa:** `QuizExpiredSubmit` apa adanya.

**D. Hasil — 7h kanan.** DTO `hasil-final` = bagian bersama dari `toQuizReviewDTO` (nilai, benar/salah/tidak dijawab, durasi, items) ditambah:
```ts
final: {
  durationLimitSeconds: number;      // duration_minutes × 60
  passingScorePercent: number;       // passing Final Quiz
  lessonAveragePercent: number;      // dibulatkan, dibaca ulang dari lesson_progress
  weights: { lessonPercent: number; finalPercent: number };
  finalScorePercent: number;         // enrollments.final_score_percent, dibulatkan untuk tampil
  courseStatus: "COMPLETED" | "PASSED";
}
```
Tampilan:
- **h1** bergaya eyebrow "FINAL QUIZ · HASIL" + pil "TERKUNCI PERMANEN" (halaman ini punya h1; temuan tinjauan S3-01);
- kartu nilai: angka nilai Final besar; pil "Lulus kursus" (`success`) / "Belum lulus" (pola `VerdictPill`); "{x} dari {n} soal benar · waktu pengerjaan {mm:ss} dari {MM}:00" (fungsi murni mm:ss, dites); "Nilai Final Quiz sudah tercatat permanen."; `EXPIRED` → kalimat waktu habis S3-01;
- kartu "Nilai Akhir Kursus" (h2): angka besar `text-success`, rumus mono "= {rata-rata} × {lesson}%" / "+ {final quiz} × {final}%", `ProgressBar` tone `success` bernilai Nilai Akhir, lalu *(usulan)*:
  - `PASSED`: "Status kursus: **Lulus** — nilai Final Quiz mencapai batas {passing}.";
  - `COMPLETED`: "Status kursus: **Selesai** — nilai Final Quiz di bawah batas {passing}. Nilai ini tetap tercatat.";
- tombol: `primary` "Lihat pembahasan {n} soal" = tautan ke `#pembahasan` (h2 "Pembahasan lengkap" ber-`id` + `tabIndex={-1}`), `secondary` *(usulan, "Ke Nilai Saya" dipotong 14 Nov)* "Ke Belajar" → `/belajar`;
- di bawahnya h2 "Pembahasan lengkap" + daftar item pembahasan S3-01 (komponen item diekspor dari `quiz-result.tsx`, tampilannya tidak berubah).
- Kotak CRS-12 7h **tidak** dibangun.

### 5. Halaman materi + hasil quiz materi (pintu masuk, keputusan 8)
- **Penutup hasil quiz materi** (`QuizResult`), DTO `hasil` mendapat `finalQuizHref: string | null`. Bila terisi, menggantikan cabang "materi berikutnya":
  - "Materi {n} ditandai selesai. Final Quiz sekarang terbuka." *(usulan)*;
  - tautan `primary` "Lanjut ke Final Quiz" → href; "Kembali ke materi" tetap.
- **Bar bawah halaman materi**, keadaan quiz `selesai`: bila `finalQuizHref` terisi, tambah tautan `primary` "Final Quiz" + panah sesudah "Lihat Hasil & Pembahasan" (logika "Materi berikutnya" S2-01 tetap).
- Ikon panah di tombol/tautan yang kamu tambah atau sentuh memakai `shrink-0` (temuan screenshot S3-01: panah gepeng di 360).

### 6. Struktur
- `learn-route-structure.test.ts`: tidak ada `loading.tsx` di `[slug]/final-quiz/`.
- **CI:** job `e2e` S3-01 sudah 15m27s dari batas `timeout-minutes: 20`. Kartu ini **mengizinkan satu baris** di `.github/workflows/ci.yml`: `timeout-minutes: 20` → `30` untuk job `e2e`, dan tidak ada perubahan lain di berkas itu. Laporkan durasi job `e2e` di PR.

## Bukan lingkup tugas ini
- Halaman "Nilai Saya" (dipotong 14 Nov), baris Final Quiz di Daftar materi, pintu Final di dasbor, tautan "Ada kendala teknis?" (QZ-19), reset attempt Final, ulangi kursus (CRS-12).
- "bobot 40%" yang ditulis langsung di blok Final Quiz builder (STATUS 4 Nov) — setelah demo.
- Perapian S3-01 (jam perangkat di banner 28c, beacon tanpa coba ulang, kebijakan pembahasan tersembunyi, 404 peserta belum terdaftar di quiz materi, penyimpangan 7e/7u, panah gepeng di runner).
- **Tidak diubah:** `src/db/**` (skema & migrasi), `package.json`, `package-lock.json`, `src/lib/rbac.ts`, `src/proxy.ts`, `next.config.ts`, `.github/audit-exceptions.json`, editor quiz CMS, route PUT jawaban dan POST kumpulkan, `QuizRunner`, `answer-save-queue.ts`, `quiz-expired-submit.tsx`.
- **Jangan menjalankan `next upgrade`.** Pengingat keamanan bawaan Next 16.4.1 menghentikan `next build`/`next dev` sekali saat mendeteksi agent; jalankan ulang perintah yang sama. Upgrade Next adalah chore setelah demo (keputusan pemilik 19 Nov).

Pekerjaan di luar lingkup → **berhenti dan tanyakan.**

## Berkas yang boleh dibuat/diubah
- `src/modules/attempt/{schema,queries,serializer,service}.ts` + `quiz-attempt.integration.test.ts`, `serializer.test.ts`, tes integrasi baru untuk Final Quiz
- `src/modules/progress/{policy,queries,serializer,service}.ts` + `serializer.test.ts`, `lesson-page.integration.test.ts`
- `src/app/api/quiz/courses/[courseId]/final-attempt/route.ts` (baru)
- `src/app/(learn)/belajar/[slug]/final-quiz/page.tsx` (baru)
- `src/components/learn/quiz/*` (komponen Final baru; `quiz-result.tsx` hanya ekspor item + penutup Final, `quiz-rules.tsx` hanya bila logika tombol mulai dibagi) + tes
- `src/components/learn/lesson-page.tsx` + tes
- `src/lib/learn-route-structure.test.ts`
- `e2e/belajar-final-quiz.spec.ts` (baru), `e2e/layout/axe.spec.ts` (satu tes baru), `e2e/layout/helpers.ts` (hanya bila helper bersama dibutuhkan)
- `.github/workflows/ci.yml` (hanya baris `timeout-minutes` job `e2e`)

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- hash basis (`fb7a70c` + PR docs kartu ini) dan baseline Vitest **yang diukur**. Claude chat mengukur **127 berkas / 1446 tes** pada pohon `fb7a70c`; bila angkamu berbeda, berhenti dan laporkan;
- signature setiap ekspor baru dan DTO per keadaan halaman Final;
- urutan statement `startFinalQuiz` dan cabang `FINAL` di `submitQuizAttempt` (mana yang dikunci, mana yang dibaca sesudahnya, kapan `getScoreWeights` dipanggil);
- daftar tes lama yang berubah, satu per satu, dengan alasannya — terutama `toEqual` atas `LessonGateLookup`, baris kursus, DTO `open`, DTO `hasil`, dan `LessonQuizContext`. Cari juga asersi keadaan yang berubah karena perilaku baru (pelajaran 14 Nov no. 3): penutup hasil materi terakhir, bar bawah materi, badge dasbor;
- urutan commit (lihat "Catatan jadwal");
- tabel mutasi: setiap baris jelas merah atau hijau beserta alasannya.

## Selesai jika
- [ ] **Integrasi** (PGlite). Data uji memenuhi semua syarat kecuali yang diuji (pelajaran 14 Nov no. 6):
  - `getFinalQuizPage`:
    - tidak terdaftar → `kembali` ke materi 1; 1 dari 2 materi `COMPLETED` tanpa attempt → `kembali` ke materi 2; semua `COMPLETED` → `aturan-final` dengan rata-rata 60 (materi 70 dan 50) dan bobot 60/40;
    - kursus tanpa `final_quiz_id` / tidak terbit / slug lain → 404;
    - attempt kedaluwarsa → `kedaluwarsa` dan baris **tetap** `IN_PROGRESS` (GET tidak menulis);
  - `startFinalQuiz`: belum semua selesai → 409; 201; mulai kedua → 200 `attemptId` sama; setelah dikumpulkan → 409 "Final Quiz ini sudah dikerjakan.";
  - `submitQuizAttempt` FINAL:
    - **data A** — materi 70 dan 50 (rata-rata 60), Final 80 %, ambang 70: `final_score_percent = 68.00`, `status = PASSED` (Final lulus walau Nilai Akhir < 70 — keputusan 4), `completed_at` terisi;
    - **data B** — materi 100 dan 50 (rata-rata 75), Final 60 %: `final_score_percent = 69.00`, `status = COMPLETED`;
    - kumpulkan kedua → hasil sama, `enrollments` tidak berubah;
    - aktor yang sama terdaftar di **kursus lain** dengan nilai materi 0 → Nilai Akhir kursus ini tidak berubah (filter kursus, pelajaran 10 Nov no. 1);
    - bobot tidak sah → `submitQuizAttempt` FINAL gagal, attempt tetap `IN_PROGRESS`, `enrollments` tidak berubah;
    - bobot tidak sah → `submitQuizAttempt` **LESSON** tetap berhasil;
  - `finalQuizHref` di DTO `open` dan `hasil` materi: terisi bila semua `COMPLETED`, `null` bila satu materi belum.
- [ ] **Serializer:** `toFinalQuizResultDTO` (angka rumus, `courseStatus`); `Object.keys` DTO `aturan-final` = allowlist; DTO `berjalan` Final lolos pemindaian kunci rekursif; fungsi mm:ss.
- [ ] **Komponen** (jsdom):
  - aturan Final: copy, POST ke `/api/quiz/courses/{courseId}/final-attempt`, `refresh` pada 201/200/409, banner saat galat jaringan;
  - hasil Final: `PASSED` vs `COMPLETED`, rumus, tautan `#pembahasan`, "Ke Belajar", satu h1;
  - penutup hasil materi dengan `finalQuizHref`; bar bawah materi dengan tautan Final.
- [ ] **E2E** `e2e/belajar-final-quiz.spec.ts` (proyek `chromium`, **paling banyak 3 tes** — anggaran CI), kursus dari `createPublishedCourseViaApi` (2 materi). Materi diselesaikan lewat API (pola `attemptViaApi` + `answerViaApi` + submit): materi 1 7 benar (70), materi 2 5 benar (50).
  1. **Alur utuh:** halaman hasil quiz materi 2 → "Final Quiz sekarang terbuka" → "Lanjut ke Final Quiz" → aturan ("Rata-rata quiz materi Anda sekarang 60", "bobot 60%", h1 "Final Quiz menentukan 40% Nilai Akhir") → "Saya siap, mulai Final Quiz" → soal 1 tampil → 8 jawaban benar lewat API, muat ulang, ringkasan lewat UI → "Kumpulkan sekarang" → hasil: 80, "Lulus kursus", Nilai Akhir 68, "= 60 × 60%", "+ 80 × 40%" → "Ke Belajar" → badge "Lulus" di dasbor.
  2. **Gerbang + API:** setelah materi 1 saja: `/final-quiz` → dialihkan ke materi 2; POST mulai → 409; bar bawah materi 1 tanpa tautan Final. Setelah materi 2: POST mulai → 201, lagi → 200 dengan id sama; kumpulkan dua kali → 200 dan `enrollments.final_score_percent` (SQL) tidak berubah; POST mulai setelahnya → 409.
  3. **Lebar:** aturan dan hasil di 360 dan 1280 tanpa gulir samping (dokumen **dan** kartu terluar, pelajaran S3-01); screenshot.
- [ ] **axe** (satu tes baru di `axe.spec.ts`, w360 + w1280): aturan Final dan hasil Final.
- [ ] **Screenshot** — `E2E_SCREENSHOT_DIR=~/binzi-s5-02-screenshots` (kosongkan folder dulu), `animations: "disabled"`, setelah isi terlihat; sebut jumlah berkas di PR:
  - `final-aturan-360`, `final-aturan-1280`
  - `final-hasil-360`, `final-hasil-1280`
  - `materi-hasil-ke-final-360` (penutup hasil quiz materi 2 dengan tombol Final)
- [ ] **E2E S3-01 tetap hijau**, termasuk `belajar-quiz.spec.ts` dan tes axe quiz.
- [ ] **Uji mutasi** — commit lokal dulu dan `git status` bersih sebelum mutasi pertama; kembalikan dengan `git restore`. Laporkan per mutasi nama tes yang merah + pesannya:
  1. `startFinalQuiz` tanpa gerbang semua materi.
  2. `startFinalQuiz` membuat attempt baru setelah `SUBMITTED`.
  3. Rata-rata materi tanpa filter kursus.
  4. Bobot tertukar (rata-rata × final_weight, Final × lesson_weight).
  5. `PASSED` ditentukan Nilai Akhir ≥ ambang, bukan `is_passed` Final.
  6. Cabang `FINAL` di `submitQuizAttempt` dilewati (jatuh ke jalur `LESSON`).
  7. `getScoreWeights` memakai cadangan 60/40 saat setting tidak sah.
  8. `submitQuizAttempt` `LESSON` memanggil `getScoreWeights`.
  9. `finalQuizHref` terisi walau satu materi belum `COMPLETED`.
  10. `getFinalQuizPage` memfinalisasi attempt kedaluwarsa (GET menulis).
  11. `completed_at` ditimpa (tanpa `coalesce`).

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR. Harapan `0 excused / 0 blocking / OK` **dengan** catatan empat entri tidak terpakai (picomatch, minimatch, 2× @vitest/mocker). Jangan menyentuh `.github/audit-exceptions.json` (penghapusannya chore setelah demo). Temuan high/critical baru → berhenti dan tempel output lengkapnya.
- **Build dan rute:** `npm run build` (rute baru: `/belajar/[slug]/final-quiz` ƒ + satu API). `curl -sI` halaman Final tanpa cookie → 307 ke `/masuk?next=…`.
- **Prettier:** berkas yang sudah ada tetap apa adanya; berkas baru boleh dirapikan.
- **`lint:hex`** menolak `#` diikuti 3/6 karakter hex di `src/`, termasuk komentar ("PR #138" pernah merah) — tulis "PR 138".
- **`npm run check` di commit akhir:** tempel 5 baris terakhir output di PR.
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas.
- **"Keputusan & asumsi" di PR** memuat keputusan 1–9, semua copy *(usulan)*, dan keputusan yang diambil tanpa bertanya.
- **Setelah push:** cek CI (`gh pr checks`, job `ci` dan `e2e`), lalu laporkan durasi job `e2e` dibanding run terakhir PR #138 (15m27s).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`
- Baseline + jumlah tes baru; tes lama yang berubah disebut satu per satu.
- `git diff --stat main -- package-lock.json package.json src/db src/lib/rbac.ts src/proxy.ts next.config.ts .github/audit-exceptions.json src/components/learn/quiz/quiz-runner.tsx src/components/learn/quiz/answer-save-queue.ts src/components/learn/quiz/quiz-expired-submit.tsx 'src/app/api/quiz/attempts'` kosong.

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Lokal (Docker menyala):
  ```bash
  cd ~/Project/React/binzi-new && git fetch origin && git switch s5/s5-02-final-quiz && git pull --ff-only && npm run dev:db && npm run dev
  ```
  Masuk sebagai MEMBER yang mengikuti "[DEMO] Kursus contoh 3" (terbitkan dulu bila belum, langkah 1–4 kartu S1-08):
  1. Selesaikan semua materi (video ≥ 90 % bila ada, quiz dikerjakan). Di hasil quiz materi terakhir: "Final Quiz sekarang terbuka" + "Lanjut ke Final Quiz".
  2. Aturan: rata-rata quiz materi dan bobot 60/40 benar.
  3. Kerjakan, muat ulang di tengah, kumpulkan → nilai Final, label kursus, Nilai Akhir + rumus, pembahasan.
  4. "Ke Belajar" → badge "Lulus" atau "Selesai" sesuai nilai Final.
  5. Sekilas di HP atau DevTools 360.
- [ ] **binzi-dev:** kartu ini tanpa migrasi, jadi tidak ada langkah binzi-dev sebelum merge.

## Catatan jadwal
- Sesi dimulai setelah PR docs kartu ini masuk `main`, Kam 19 sore.
- **Urutan commit yang disarankan:**
  1. `progress` (finalQuizId, `allLessonsCompleted`, `loadFinalQuizContext`, `recordFinalQuizResult`, `finalQuizHref`) + tes;
  2. `attempt` (refaktor insert, `startFinalQuiz`, `getFinalQuizPage`, cabang FINAL, serializer bersama) + tes;
  3. API + halaman Final (aturan, hasil);
  4. pintu masuk (penutup hasil materi, bar bawah);
  5. e2e + axe + screenshot + `ci.yml`.
  Commit + push di antara bagian.
- **Bila terlambat**, yang dipotong lebih dulu:
  1. tautan Final di bar bawah materi (penutup hasil materi tetap);
  2. tes axe Final;
  3. e2e no. 3 (lebar) — screenshot diambil di e2e no. 1;
  4. fungsi mm:ss (pakai `formatQuizDuration` S3-01).

  **Tidak dipotong:** gerbang, cabang FINAL + Nilai Akhir + status kursus, aturan, hasil, penutup hasil materi, kunci tidak bocor, e2e no. 1–2.
- **Batas potong demo (keputusan 1):** bila PR belum di-merge 3 jam sebelum demo, demo berjalan tanpa Final Quiz.

## Catatan tinjauan 19 Nov
| Klaim | Cara dicek | Hasil |
|---|---|---|
| Baseline | Vitest penuh di sandbox pada `18557d0` (pohon = `fb7a70c`) | 127 berkas / 1446 tes |
| Lulus kursus | PRD `06-2` baris 34–44, `07` baris 134–135 | Lulus = Final Quiz `is_passed`; 7h "Nilai Akhir ≥ 70" bertentangan → PRD menang |
| Rumus | PRD `06-4` PRG-05 | (rata-rata quiz materi × 60%) + (Final × 40%), bobot di `system_settings` |
| Bobot di binzi-dev | SQL Editor pemilik, 19 Nov | `quiz.min_questions` 10, `score.lesson_weight` 60, `score.final_weight` 40 |
| `getScoreWeights` | `src/modules/quiz/service.ts:97` | Gagal tertutup (hilang, bukan bulat, di luar 0–100, jumlah ≠ 100); `ScoreWeights = { lessonPercent, finalPercent }`; membaca lewat `db`, bukan `tx` |
| Kolom enrollments | `src/db/schema/progress.ts` | `status` (`IN_PROGRESS`/`COMPLETED`/`PASSED`), `completed_at`, `final_score_percent` NUMERIC(5,2) — tanpa migrasi |
| Final Quiz bawaan | `quiz/queries.ts` `insertEmptyFinalQuiz` | 20 menit, 70 %, `ALWAYS`; acak soal/opsi bawaan skema `true` |
| Badge dasbor | `progress/serializer.ts:452–457` | `PASSED` → "lulus", `COMPLETED` → "selesai" — dasbor tidak perlu diubah |
| Slug `final-quiz` | `lesson/queries.ts:183` | Sudah dicadangkan, tidak bisa jadi slug materi |
| Kumpulkan Final hari ini | `attempt/service.ts` `submitQuizAttempt` | `selectLessonIdByQuizId` → `undefined` → `Error` (500): titik cabang kartu ini |
| Helper e2e | `e2e/layout/helpers.ts` | `createPublishedCourseViaApi` mengembalikan `finalQuizId` (10 soal, kunci "Opsi satu"); `deleteCoursesInE2eDb` menghapus attempt quiz materi **dan** Final |
| axe | `e2e/layout/axe.spec.ts` | Hanya w360 + w1280 — satu tes baru = 2 run |
| Anggaran CI | Run PR #138 terakhir | Job `e2e` 15m27s dari `timeout-minutes: 20` |
| Rute | `src/proxy.ts`, `src/lib/rbac.ts` | `/belajar/:path*` sudah di matcher proxy dan MEMBER+ — tanpa baris baru |

Yang **belum** dicek dari sandbox: durasi job `e2e` setelah kartu ini, dan tampilan 7h di Safari iOS (gladi).

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
