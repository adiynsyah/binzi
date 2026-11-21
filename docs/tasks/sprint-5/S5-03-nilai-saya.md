# S5-03 · Nilai Saya `/belajar/nilai`: tabel nilai per kursus, Nilai Akhir 60/40, tautan pembahasan, keadaan kosong

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | **S5-02** (PR #140): `loadFinalQuizContext`, `recordFinalQuizResult`, `getEnrollmentFinalResult`, halaman hasil Final. **S3-02** (PR #145): nilai quiz dibulatkan ke bawah, `reviewAccess`, `finalQuizDone`. **S5-01**: badge PRG-06 (`BadgeStatus`). **S1-09**: `getScoreWeights`. Semua sudah di `main` |
| **Target** | A3 rencana UAT internal 11 Des (STATUS 19 Nov). Perkiraan ±2 hari |
| **Branch** | `s5/s5-03-nilai-saya` |

> **Dibuat 21 Nov 2026** di Claude chat terhadap `main` `2aa1bd2` (#146, docs). Kodenya sama dengan `cd82860` (#145). Setiap fakta kode yang dirujuk sudah dicek di sana; lihat "Catatan tinjauan 21 Nov" di akhir kartu.
>
> **Keputusan teknis kartu** (usulan Claude chat, disetujui bersama kartu):
>
> 1. **Tanpa migrasi, tanpa dependensi baru, tanpa token warna baru, CSP tidak berubah, tanpa route API baru.** Halaman server murni; GET tidak menulis apa pun.
> 2. **Satu angka, satu sumber: sumber yang sama dengan layar yang sudah menampilkan angka itu.**
>    - Nilai quiz materi, lulus/belum, tanggal → `lesson_progress` (`quiz_score_percent`, `quiz_is_passed`, `quiz_submitted_at`). Sama dengan Daftar materi, dan sama dengan masukan Nilai Akhir di `recordFinalQuizResult`.
>    - Nilai Final, lulus/belum, tanggal → attempt Final yang hidup (`reset_at IS NULL`, status `SUBMITTED`/`EXPIRED`). Sama dengan halaman hasil Final.
>    - Nilai Akhir dan status kursus (badge) → `enrollments.final_score_percent` dan `enrollments.status`. **Tidak dihitung ulang** (pelajaran 19 Nov no. 2).
>    - Rata-rata quiz materi → rata-rata `quiz_score_percent` materi yang sudah dikerjakan. Untuk kursus yang Final-nya sudah dikerjakan, angkanya sama dengan `lessonAveragePercent` di hasil Final.
>    - Pembulatan: nilai quiz materi dan Final **ke bawah** (`Math.floor`); Nilai Akhir dan rata-rata **biasa** (`Math.round`). Persis aturan S3-02 dan hasil Final, jadi kedua halaman tidak pernah berbeda angka.
> 3. **Kursus yang tampil:** peserta terdaftar, kursus `PUBLISHED`, punya materi, dan **minimal satu quiz** (materi atau Final) sudah dikerjakan. Tanpa kursus seperti itu → keadaan kosong 8f.
>    - Urutan: `enrollments.enrolled_at` naik, `courses.id` sebagai pemecah seri. Transkrip harus stabil; urutan "aktivitas terakhir" (dasbor) berubah setiap kali materi dibuka.
>    - Kursus yang tidak lagi `PUBLISHED` tidak tampil (sama dengan dasbor S5-01). Tautan pembahasannya pasti 404, dan saat ini tidak ada jalur UI untuk menarik kursus terbit.
> 4. **Baris per kursus:**
>    - setiap materi yang quiz-nya sudah dikerjakan **atau** sudah terbuka (gerbang `isLessonUnlocked` yang sama dengan halaman materi); materi terbuka yang belum dikerjakan bertanda "belum";
>    - materi terkunci tanpa nilai digabung menjadi satu baris "+ {n} materi terkunci" (8b);
>    - baris "+ 3 materi lain · semua quiz sudah dikerjakan" di 8b adalah penyingkat mockup dan **tidak** dibangun. Semua materi tampil, karena QZ-20 butuh tautan di setiap quiz;
>    - baris Final "Final Quiz · {n} soal" selalu ada untuk kursus yang punya Final Quiz.
> 5. **Kolom per lebar:**
>    - ≥ 1024: empat kolom, tautan teks "Lihat" (8b);
>    - 640–1023: empat kolom, kolom Pembahasan berisi tautan ikon ↗ (8t);
>    - < 640: tiga kolom (nama, nilai, ↗); kolom tanggal dan baris kepala tabel disembunyikan secara visual (8e). Kepala tabel tetap ada untuk pembaca layar.
>
>    Kartu kursus yang sudah selesai di ponsel **tidak** diringkas seperti 8e (yang hanya menampilkan rumus). Barisnya tetap tampil supaya pembahasan setiap quiz terjangkau (QZ-20). Kepala kolom "Pembahasan" dipakai di semua lebar; "BAHAS" di 8t tidak dipakai.
> 6. **Tautan pembahasan = halaman quiz yang sudah ada:** `/belajar/{kursus}/{materi}/quiz` dan `/belajar/{kursus}/final-quiz`. Keduanya sudah menampilkan hasil + pembahasan untuk attempt yang selesai.
>    - Teks yang terlihat: "Lihat" di semua keadaan.
>    - Nama aksesibel mengikuti `reviewAccess` (aturan 20 Nov): `ALWAYS`/`PASSED` → "Lihat pembahasan …"; `HIDDEN_*` → "Lihat jawaban Anda, …" (tanpa kata "pembahasan").
> 7. **Bobot dari `getScoreWeights`** (gagal tertutup, tanpa cadangan 60/40): di kalimat pengantar, di rumus setiap kursus, dan di keadaan kosong. Rumus memakai bobot yang berlaku sekarang, sama dengan hasil Final; snapshot bobot = keputusan putaran 2.
> 8. **Tanggal hanya tanggal, WIB, "24 Agu 2026"**, lewat fungsi baru `formatWibDate` di `src/lib/datetime.ts`, dirender di server.
>    - Baris meta kursus: "{n} materi · selesai {tanggal}" (`completed_at`) atau "{n} materi · terakhir diakses {tanggal}" (`enrollments.updated_at`).
>    - Tanggal absolut, bukan "2 hari lalu" seperti 8b: waktu relatif butuh jam "sekarang" dan zona waktu klien.
> 9. **Tidak dibangun:** "Ekspor transkrip PDF" (PRG-08, prioritas C), tab horizontal tablet 8t (isu D-07), riwayat siklus 16b (CRS-12, kartu B3), tautan judul kursus ke `/belajar/{kursus}` (A4).
> 10. **Keadaan kosong 8f dibangun langsung**, bukan dengan `EmptyState` (komponen itu `"use client"`, mewajibkan dua aksi, dan judulnya h3). Tombol "Lanjutkan kursus saya" → `/belajar` (dasbor), karena `/belajar/kursus-saya` baru ada di A4.
> 11. **Hasil Final: "Ke Belajar" menjadi "Ke Nilai Saya"** → `/belajar/nilai` (copy 7h). Tombol ini dipotong 14 Nov hanya karena halamannya belum ada.
> 12. **Warna angka:**
>    - nilai quiz lulus `text-success`, belum lulus `text-danger` (8b), ditambah teks sr-only "lulus" / "belum lulus" supaya status tidak hanya dibawa warna;
>    - baris Final berlatar `fill-soft`, **bukan** `fill`: `success` di `fill` hanya 4,32:1;
>    - angka Nilai Akhir `text-success` hanya bila status kursus Lulus (aturan S3-02).
> 13. **Modul:** halaman milik modul `attempt` (`getGradesPage`). Konteks kursus diambil dari `progress` lewat ekspor baru `loadGradeCourses` — arah satu, `attempt` → `progress`, pola `loadFinalQuizContext`. `reviewAccess` dihitung oleh **satu** fungsi murni yang dikeluarkan dari `toQuizReviewDTO`, tanpa salinan kedua.

## Tujuan
Peserta membuka "Nilai Saya" dari menu akun, nav bawah ("Progress"), footer, atau tombol "Ke Nilai Saya" di hasil Final. Halaman menampilkan setiap kursus yang sudah ada nilainya: nilai tiap quiz materi, nilai Final Quiz, Nilai Akhir, status Lulus/Selesai/Sedang berjalan, tanggal pengerjaan, dan tautan ke hasil & pembahasan (PRG-04, PRG-05, QZ-20). Semua angka sama dengan yang tampil di Daftar materi dan halaman hasil. Peserta tanpa nilai melihat keadaan kosong 8f.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD:
  - `docs/prd/sections/06-4-progress-nilai-saya-menggantikan-sertifi.md` (PRG-04, PRG-05, PRG-06);
  - `06-3-quiz-sistem-penilaian.md` (QZ-10, QZ-11, QZ-20);
  - `06-2-kursus-materi.md` (definisi "Kursus Selesai" dan "Kursus Lulus").
- Desain:
  - `docs/design/screens/8b.md` + `.png` (desktop; buka `8b.html` untuk ukuran);
  - `8t.png` (tablet, bagian kanan: ikon ↗);
  - `8e.png` (360, bagian kanan);
  - `8f.md` + `.png` (keadaan kosong);
  - `7h.md` (copy "Ke Nilai Saya").
- Kode:
  - `src/modules/progress/{policy,queries,serializer,service}.ts` (`selectOutlineRows`, `selectEnrolledCourses`, `hasLessonsSql`, `isLessonUnlocked`, `allLessonsCompleted`, `loadFinalQuizContext`, `quizHref`, `finalQuizHref`);
  - `src/modules/attempt/{queries,serializer,service}.ts` (`selectAttemptByQuizAndUser`, `toQuizReviewDTO`, `getFinalQuizPage`) + `quiz-attempt.integration.test.ts` (helper baris 1149–1376), `serializer.test.ts`;
  - `src/modules/quiz/service.ts` (`getScoreWeights`);
  - `src/lib/datetime.ts` + tes, `src/lib/learn-route-structure.test.ts`;
  - `src/app/(learn)/belajar/(dashboard)/page.tsx` dan `[slug]/final-quiz/page.tsx` (pola halaman);
  - `src/components/learn/learn-dashboard.tsx` (pola server component), `src/components/learn/quiz/{quiz-result,final-quiz-result}.tsx` (`reviewReveals`, "Ke Belajar"), `src/components/ui/{badge-status,button-variants}.tsx`, `src/components/shared/{nav-items,page-container}.tsx`.
- E2E: `e2e/belajar-final-quiz.spec.ts` (helper lokal `attemptViaApi`, `answerViaApi`, `optionsFromDb`, `startFinalViaApi`, `expectOutermostBoxFits` — salin polanya), `e2e/layout/helpers.ts` (`createPublishedCourseViaApi` menerima `{ lessons }`, `maybeScreenshot`, `expectTouchTarget`, `expectNoHorizontalScroll`), `e2e/layout/axe.spec.ts`, `e2e/README.md` (`E2E_SCREENSHOT_DIR`).

## Kerjakan

### 1. Modul `progress`: konteks kursus untuk Nilai Saya
**Queries** (nama bebas, sebut di rencana). Pembatas `user_id` aktor ada di setiap kueri:
1. **Pendaftaran:** `enrollments` ⨝ `courses`; `enrollments.user_id = aktor`, `courses.status = 'PUBLISHED'`, `hasLessonsSql`. Kolom:
   - kursus: `id`, `slug`, `title`, `is_sequential`, `final_quiz_id`;
   - pendaftaran: `status`, `final_score_percent`, `completed_at`, `updated_at`.

   Urutan `enrollments.enrolled_at asc, courses.id asc`.
2. **Baris materi semua kursus itu** dalam satu kueri: `lessons` (`course_id` di daftar id; daftar kosong → lewati kueri) **LEFT JOIN** `lesson_progress` dengan `lesson_progress.user_id = aktor` **di klausa ON**, sama seperti `selectOutlineRows`. Tanpa itu baris peserta lain ikut. Kolom:
   - materi: `id`, `course_id`, `slug`, `title`, `quiz_id`;
   - progres: `status`, `quiz_attempted`, `quiz_score_percent`, `quiz_is_passed`, `quiz_submitted_at`.

   Urutan `lessons.course_id`, lalu `order_index asc, id asc` — urutan yang sama dengan `selectOutlineRows`, jadi "Quiz Materi {n}" di sini sama dengan "Materi N · Hasil Quiz" di halaman hasil.

Builder bertipe. Bila ada fragmen `sql`, nama tabel luar ditulis tangan (pelajaran 10 Nov no. 1). Tanpa `Date` mentah di fragmen `sql` (pelajaran 19 Nov no. 3).

**Service — ekspor baru** `loadGradeCourses(executor: DbOrTx, actorId: string): Promise<GradeCourseContext[]>`:
- tanpa cek role (dipanggil `attempt` setelah `assertMemberRole`, pola `loadFinalQuizContext`);
- per kursus:
  - `courseId`, `courseTitle`, `lessonCount`;
  - `enrollmentStatus`;
  - `finalScorePercent` (string NUMERIC mentah atau `null`; pembulatan di serializer `attempt`);
  - `completedAt`, `lastActivityAt` (`Date`);
  - `finalQuizId` dan `finalQuizHref` (`finalQuizHref(slug)` bila `finalQuizId`, selain itu `null`);
  - `allLessonsCompleted` (fungsi policy yang ada);
- per materi: `position`, `title`, `quizId`, `quizHref` (`quizHref(courseSlug, lessonSlug)`), `unlocked` (`isLessonUnlocked(position, gateRows, isSequential)` atas baris kursus itu), dan `result`:
  - `{ scorePercent: string; isPassed: boolean | null; submittedAt: Date | null }` bila `quiz_attempted` **dan** `quiz_score_percent` tidak null;
  - selain itu `null`.

Ekspor tipe `GradeCourseContext` lewat `service.ts`.

### 2. Modul `attempt`: `getGradesPage`
**Serializer — refaktor tanpa mengubah perilaku:** keluarkan rantai `reviewAccess` dari `toQuizReviewDTO` (`serializer.ts:431–438`) ke fungsi murni `reviewAccessOf(policy: ExplanationPolicy, isPassed: boolean): QuizReviewAccess`. `toQuizReviewDTO` memanggilnya. Semua tes serializer dan integrasi S3-01/S5-02/S3-02 tetap hijau **tanpa diubah** — itu buktinya.

**Queries:**
1. Pengaturan quiz untuk daftar `quizId`: `quizzes.id`, `explanation_policy`, dan jumlah soal lewat subquery ber-alias, pola `selectOpenLessonQuiz` (`progress/queries.ts:546–548`): `(select count(*) from questions as q where q.quiz_id = quizzes.id)`.
2. Attempt Final yang selesai dan hidup untuk daftar `quizId` milik aktor: `user_id = aktor`, `reset_at IS NULL`, status `SUBMITTED`/`EXPIRED`. Kolom: `quiz_id`, `score_percent`, `is_passed`, `submitted_at`. Bila ada lebih dari satu per quiz (tidak terjangkau dengan data sah), ambil `attempt_number` terbesar.

**Service** `getGradesPage(actor): Promise<GradesPageDTO>` — GET murni, tanpa transaksi:
1. `assertMemberRole(actor)`.
2. `loadGradeCourses(db, actor.id)`.
3. Bersamaan:
   - pengaturan quiz untuk semua `quizId` materi yang punya `result` + semua `finalQuizId`;
   - attempt Final selesai untuk semua `finalQuizId`;
   - `getScoreWeights()` (membaca lewat `db`, di luar transaksi; pelajaran 19 Nov no. 4).
4. `toGradesPageDTO(…)`.

Pengaturan quiz yang hilang untuk `quizId` yang dirujuk tidak terjangkau dengan data sah (FK) → lempar `Error`, pola S5-02.

**DTO** (ekspor lewat `service.ts`):
```ts
export type GradeResultDTO = {
  scorePercent: number;           // Math.floor
  isPassed: boolean;              // nilai tersimpan; null di DB → false
  submittedAt: string | null;     // ISO
  reviewHref: string;
  reviewAccess: QuizReviewAccess; // reviewAccessOf(policy, isPassed)
};
export type GradeLessonRowDTO = {
  position: number;
  title: string;
  result: GradeResultDTO | null;  // null = "belum"
};
export type GradeCourseDTO = {
  id: string;
  title: string;
  lessonCount: number;
  badge: "sedang-berjalan" | "selesai" | "lulus"; // dari enrollments.status
  meta: { kind: "selesai" | "terakhir-diakses"; at: string }; // ISO
  finalScorePercent: number | null;     // Math.round; null bila IN_PROGRESS atau kolom null
  lessonAveragePercent: number | null;  // Math.round atas baris ber-result; null bila tidak ada
  lessons: GradeLessonRowDTO[];         // ber-result ATAU unlocked
  lockedCount: number;                  // tidak unlocked DAN tanpa result
  final: { questionCount: number; result: GradeResultDTO | null } | null; // null bila tanpa Final Quiz
  nextStep: "materi" | "final" | null;  // hanya IN_PROGRESS; "final" = allLessonsCompleted
};
export type GradesPageDTO = {
  weights: { lessonPercent: number; finalPercent: number };
  courses: GradeCourseDTO[];            // kosong → 8f
};
```
Aturan serializer:
- Kursus tanpa satu pun `result` (materi maupun Final) tidak masuk `courses` (keputusan 3).
- `meta`: `selesai` bila status ≠ `IN_PROGRESS` (`completedAt`; bila null, `lastActivityAt`), selain itu `terakhir-diakses` (`lastActivityAt`).
- `finalScorePercent` hanya bila status ≠ `IN_PROGRESS`.
- Tidak ada field lain: tidak ada id materi/quiz/attempt, jawaban, atau kunci. Ini diperiksa lewat allowlist `Object.keys`.

### 3. Halaman `/belajar/nilai`
`src/app/(learn)/belajar/nilai/page.tsx` (baru):
- `requireRole("MEMBER")` → `getGradesPage(actor)` → `<PageContainer className="pt-8"><MyGrades data={data} /></PageContainer>`;
- segmen statis `nilai` mengalahkan `[slug]`; slug kursus `nilai` sudah ditolak (`course/schema.ts:56–57`);
- **tanpa `loading.tsx`**, di luar grup `(dashboard)`: skeleton dasbor bukan bentuk halaman ini, dan halaman ini tidak butuh fallback. `learn-route-structure.test.ts` ditambah: halaman ada di `belajar/nilai/page.tsx`, dan tidak ada `loading.tsx` di `belajar/nilai/`.

Pintu masuk sudah ada dan tidak diubah: `MEMBER_HREFS.nilai` dipakai menu akun (`nav-items.ts:142`), nav bawah "Progress" (`:191`), dan footer. State aktif keduanya sudah dites (`nav-items.test.ts:145`, `:177`).

### 4. Komponen `MyGrades` (`src/components/learn/my-grades.tsx`, baru)
**Server component** (tanpa `"use client"`), render murni atas DTO. Jangan mengimpor **nilai** dari modul `"use client"` (pelajaran 3 Nov). `reviewReveals` dari `quiz/quiz-result.tsx` boleh dipakai (server component). Satu h1 di halaman.

**Kepala halaman** (8b):
- eyebrow `<p>` mono 11 px `uppercase` `text-subtle`: "Belajar / Nilai Saya";
- h1 "Nilai Saya";
- hanya bila ada kursus: paragraf "Setiap quiz dikerjakan satu kali, jadi nilai di bawah bersifat final. **Nilai Akhir Kursus = rata-rata quiz materi × {lesson}% + Final Quiz × {final}%.** Ini transkrip nilai, bukan sertifikat."

**A. Kosong — 8f** (copy final; dipakai versi desktop di semua lebar):
- kotak `rounded-card border border-dashed border-border-dashed bg-surface-2`;
- eyebrow mono "Belum ada nilai" (`uppercase`, `text-meta`);
- **h2** "Belum ada quiz yang dikerjakan";
- paragraf "Nilai muncul di sini setiap kali Anda menyelesaikan satu quiz materi. Nilai Akhir kursus baru dihitung setelah Final Quiz.";
- kotak putih bergaris: "Rumusnya: **rata-rata quiz materi × {lesson}% + Final Quiz × {final}%**.";
- tautan bergaya tombol `buttonVariants({ variant: "dark", size: "lg" })` "Lanjutkan kursus saya" → `/belajar` (keputusan 10), `w-full sm:w-auto`. `size` ditulis eksplisit: bawaan `buttonVariants` adalah `md` (48 px), sedangkan tombol `dark` di 8f setinggi pita `lg` (pelajaran 20 Nov no. 3).

**B. Terisi — satu `<section aria-labelledby>` per kursus** (8b ≥ 1024, 8t 640–1023, 8e < 640):
- **Kepala kartu:**
  - **h2** judul kursus (`wrap-anywhere`) + meta "{n} materi · selesai {tanggal}" / "{n} materi · terakhir diakses {tanggal}" *(usulan)*;
  - `BadgeStatus` (`lulus` / `selesai` / `sedang-berjalan`);
  - blok Nilai Akhir: angka mono 30 px (`text-success` hanya bila `lulus`, selain itu `text-text`; "—" bila null) dengan label "Nilai Akhir" di bawahnya. Di DOM label ditulis **sebelum** angka (mis. `flex-col-reverse`), supaya terbaca "Nilai Akhir 68".
  - ≥ 640: judul + meta di kiri, badge + Nilai Akhir di kanan (8b/8t). < 640: judul, lalu baris badge kiri + Nilai Akhir kanan (8e).
- **Tabel** `<table>` dengan `<caption className="sr-only">` "Nilai quiz {judul kursus}" *(usulan)*:
  - kepala: "Materi / Quiz", "Nilai", "Tanggal", "Pembahasan" (mono 11 px `uppercase`, `text-subtle`); `sr-only` di < 640 (keputusan 5);
  - baris materi: sel pertama `<th scope="row">` "{posisi} · {judul materi}";
    - ada `result`: nilai mono + sr-only "lulus" / "belum lulus" *(usulan)*; tanggal `formatWibDate`; tautan pembahasan;
    - tanpa `result`: "belum" (`text-muted`, tebal) di kolom Nilai; "—" di Tanggal dan Pembahasan;
  - baris terkunci, bila `lockedCount > 0`: satu sel `colSpan` "+ {n} materi terkunci" (`text-muted`);
  - baris Final (`bg-fill-soft`, tebal): "Final Quiz · {n} soal", lalu sel seperti baris materi;
  - kolom Tanggal: `hidden sm:table-cell` (th **dan** td);
  - wadah tabel `relative`: elemen `sr-only` (caption, kepala tabel di < 640) di dalam wadah ber-`overflow` tanpa leluhur berposisi lolos dari klip dan melebarkan halaman (pelajaran 4 Nov). e2e "tanpa gulir samping" di 360 menjaganya.
- **Tautan pembahasan:**
  - `<Link href={reviewHref}>` dengan `aria-label`:
    - materi: "Lihat pembahasan Quiz Materi {n} · {judul}" / "Lihat jawaban Anda, Quiz Materi {n} · {judul}";
    - Final: "Lihat pembahasan Final Quiz · {judul kursus}" / "Lihat jawaban Anda, Final Quiz · {judul kursus}" *(usulan)*;
  - isi terlihat: ≥ 1024 teks "Lihat" (`text-primary-deep`, tebal 13 px); < 1024 ikon `ArrowUpRight` (lucide, `aria-hidden`, `shrink-0`);
  - area sentuh ≥ 44 × 44 di < 1024 (`inline-flex size-11 items-center justify-center`), dan tinggi ≥ 44 di ≥ 1024.
- **Baris rumus** di bawah tabel (`bg-fill-soft`, mono 12,5 px `uppercase`, `text-muted`). Teks DOM huruf biasa; huruf besar lewat CSS:
  - status ≠ `IN_PROGRESS`: "Rata-rata quiz materi {rata} × {lesson}% + Final Quiz {final} × {final%}% = {akhir}";
  - `IN_PROGRESS`: "Rata-rata quiz materi sementara {rata} · Nilai Akhir belum dihitung", lalu teks biasa (bukan mono/uppercase):
    - `nextStep === "materi"`: "Selesaikan semua materi lalu kerjakan Final Quiz." (8b);
    - `nextStep === "final"` *(usulan)*: "Semua materi selesai." + tautan "Kerjakan Final Quiz" → `finalQuizHref` (`text-primary-deep`, bergaris bawah).
  - Bila `lessonAveragePercent` null (hanya Final yang ada nilainya — tidak terjangkau dengan data sah), "{rata}" tampil "—".
- **Warna** (keputusan 12): nilai lulus `text-success`, belum lulus `text-danger`; "belum" `text-muted`. Kontras sudah dihitung di "Catatan tinjauan".

### 5. Hasil Final: "Ke Nilai Saya" (keputusan 11)
`final-quiz-result.tsx:151`: label "Ke Belajar" → "Ke Nilai Saya", href `/belajar` → `MEMBER_HREFS.nilai`. Tidak ada perubahan lain di berkas itu. Tes komponennya (`final-quiz-result.test.tsx:173–180`) dan akhir e2e `belajar-final-quiz.spec.ts` tes 1 (baris 349–352) ikut berubah (bagian E2E).

### 6. `formatWibDate` (`src/lib/datetime.ts`)
`formatWibDate(date: Date): string` → "24 Agu 2026" (`id-ID`, `day: "numeric"`, `month: "short"`, `year: "numeric"`, `timeZone: "Asia/Jakarta"`). Tiga tes dengan instan tetap, pola tes `formatWib`, termasuk pergantian hari: `2026-08-23T18:30:00Z` → "24 Agu 2026" (dicek di Node 22 sandbox).

## Bukan lingkup tugas ini
- Ekspor PDF (PRG-08), tab tablet 8t (D-07), riwayat siklus 16b dan ulangi kursus (CRS-12, B3), halaman progres kursus `/belajar/{kursus}` dan Kursus Saya (A4), tautan judul kursus.
- Statistik dasbor ("rata-rata nilai quiz", 8t kiri) dan kotak "Nilai Saya masih kosong" di dasbor (tidak diubah).
- Snapshot bobot Nilai Akhir (putaran 2). Lapor gangguan / reset attempt (A7).
- **Tidak diubah:** `src/db/**`, `package.json`, `package-lock.json`, `src/lib/rbac.ts`, `src/proxy.ts`, `next.config.ts`, `.github/**`, `src/app/api/**`, `src/components/shared/**`, `src/components/learn/learn-dashboard.tsx`, `src/components/learn/quiz/` selain `final-quiz-result.tsx` + tesnya, `src/styles/tokens.css`.
- **Jangan menjalankan `next upgrade`.** Pengingat keamanan Next 16.4.1 menghentikan `next build`/`next dev` sekali saat mendeteksi agent; jalankan ulang perintah yang sama.

Pekerjaan di luar lingkup → **berhenti dan tanyakan.**

## Berkas yang boleh dibuat/diubah
- `src/modules/progress/{queries,service}.ts`
- `src/modules/attempt/{queries,serializer,service}.ts` + `serializer.test.ts`, dan tes integrasi: tambah `describe` di `quiz-attempt.integration.test.ts` (helper `completeLessonWithScore` boleh mendapat parameter opsional `quizIsPassed`/`quizSubmittedAt` tanpa mengubah pemanggil lama) **atau** berkas baru `grades-page.integration.test.ts`. Pilih satu dan sebut di rencana.
- `src/lib/datetime.ts` + `datetime.test.ts`, `src/lib/learn-route-structure.test.ts`
- `src/app/(learn)/belajar/nilai/page.tsx` (baru)
- `src/components/learn/my-grades.tsx` + `my-grades.test.tsx` (baru)
- `src/components/learn/quiz/final-quiz-result.tsx` + `final-quiz-result.test.tsx` (hanya bagian 5)
- `e2e/belajar-nilai.spec.ts` (baru), `e2e/belajar-final-quiz.spec.ts` (hanya akhir tes 1), `e2e/layout/axe.spec.ts` (dua langkah di tes yang sudah ada, tanpa tes baru)

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- hash basis (`2aa1bd2` + PR docs kartu ini) dan baseline Vitest **yang diukur**. Claude chat mengukur **129 berkas / 1532 tes** pada `2aa1bd2`. Bila angkamu berbeda, berhenti dan laporkan;
- signature `loadGradeCourses`, kedua kueri baru per modul (kolom, join, filter, urutan), dan bentuk `GradeCourseContext`;
- daftar tes lama yang berubah, satu per satu, dengan alasannya. Yang sudah diketahui: tes "Ke Belajar" di `final-quiz-result.test.tsx` dan akhir tes 1 `belajar-final-quiz.spec.ts`. Cari juga asersi keadaan lain yang berubah (pelajaran 14 Nov no. 3);
- urutan commit;
- **tabel mutasi dengan prediksi per baris**: merah atau hijau, tes mana, dan alasannya.

## Selesai jika
Data uji memenuhi semua syarat kecuali yang sedang diuji (pelajaran 14 Nov no. 6).

- [ ] **Integrasi** (PGlite):
  - **kosong:** tidak terdaftar → `courses: []`; terdaftar tanpa nilai → `courses: []`; `weights` mengikuti `system_settings` (seed **70/30** → 70/30, bukan 60/40);
  - **kursus A Lulus:** materi 70 dan 50, Final 80 → `badge: "lulus"`, `finalScorePercent: 68`, `lessonAveragePercent: 60`, `final.result.scorePercent: 80`, `meta.kind: "selesai"`, `nextStep: null`. Angka-angka ini **sama dengan DTO `getFinalQuizPage` hasil-final** untuk data yang sama (`lessonAveragePercent`, `scorePercent`, `finalScorePercent`) — dites dalam satu tes;
  - **kursus B berjalan** (3 materi, berurutan): materi 1 dikerjakan → baris [1 ber-result, 2 "belum"], `lockedCount: 1`, `final.result: null`, `nextStep: "materi"`. Varian tidak berurutan → 3 baris, `lockedCount: 0`. Varian semua materi `COMPLETED` tanpa Final → `nextStep: "final"`;
  - **peserta lain** di kursus yang sama dengan nilai berbeda (materi 100, Final 20, `enrollments` sendiri) → DTO aktor tidak berubah. Kursus yang **hanya** diikuti peserta lain tidak muncul;
  - **dua kursus dengan Final berbeda jumlah soal** (mis. 5 dan 10) → `questionCount` masing-masing benar (pelajaran 10 Nov no. 1);
  - **nilai tersimpan** (diubah langsung di DB):
    - `final_score_percent` `91.40` → 91; `67.50` → 68;
    - `quiz_score_percent` `69.99` → 69;
    - `quiz_is_passed = false` dengan skor 80 → `isPassed: false`;
    - `enrollments.status = COMPLETED` walau attempt Final `is_passed = true` → `badge: "selesai"`;
  - **attempt Final:** attempt ter-reset (skor 10, `reset_at` terisi) + attempt hidup (skor 80) → 80; hanya attempt `IN_PROGRESS` → `final.result: null`;
  - **visibilitas:** kursus `DRAFT`/`ARCHIVED` dengan pendaftaran + nilai → tidak muncul; urutan mengikuti `enrolled_at` (diisi eksplisit, terbalik dari urutan pembuatan);
  - **`reviewAccess`:** quiz materi `NEVER` → `HIDDEN_NEVER`; `ON_PASS_ONLY` + tidak lulus → `HIDDEN_NOT_PASSED`; `ON_PASS_ONLY` + lulus → `PASSED`; Final `ALWAYS` → `ALWAYS`;
  - **`reviewHref`:** materi = `quizHref(kursus, materi)`, Final = `finalQuizHref(kursus)`;
  - bobot tidak sah → `getGradesPage` melempar (gagal tertutup, sama dengan halaman Final).
- [ ] **Serializer:** allowlist `Object.keys` untuk `GradesPageDTO`, `GradeCourseDTO`, `GradeLessonRowDTO`, `GradeResultDTO`; `reviewAccessOf` empat cabang; floor/round sesuai keputusan 2; `meta` dan `nextStep` per status.
- [ ] **`formatWibDate`:** tiga tes (bagian 6).
- [ ] **Komponen** (jsdom):
  - kosong: copy 8f, h2 (bukan h3), rumus dengan bobot 70/30 dari props, tautan "Lanjutkan kursus saya" → `/belajar`;
  - terisi:
    - satu h1; h2 per kursus;
    - teks badge;
    - Nilai Akhir: kelas `text-success` hanya untuk `lulus`, "—" saat null;
    - baris "belum", "+ 1 materi terkunci", "Final Quiz · 10 soal";
    - kedua varian rumus, dan tautan "Kerjakan Final Quiz" saat `nextStep: "final"`;
    - nama aksesibel dan `href` tautan (tampil vs tersembunyi);
    - tanggal WIB dari ISO tetap;
    - teks sr-only "lulus" / "belum lulus";
  - hasil Final: tautan "Ke Nilai Saya" → `/belajar/nilai`.
- [ ] **Struktur:** `learn-route-structure.test.ts` (bagian 3).
- [ ] **E2E** `e2e/belajar-nilai.spec.ts` (proyek `chromium`, **paling banyak 2 tes** — anggaran CI):
  1. **Isi, tautan, nilai tersimpan, lebar.** Kursus X (2 materi) dan Y (3 materi) dari `createPublishedCourseViaApi`; MEMBER A mendaftar X lalu Y.
     - Sebelum ada quiz dikerjakan: `/belajar/nilai` → keadaan kosong (terdaftar tanpa nilai).
     - Siapkan data:
       - MEMBER B (konteks peramban kedua) mendaftar X dan mengerjakan materi 1 X dengan 10/10;
       - `explanation_policy` quiz materi 1 Y diubah ke `NEVER` lewat `withE2eDb`;
       - A mengerjakan lewat API: X materi 1 7/10, materi 2 5/10, Final 8/10; Y materi 1 9/10.
     - `/belajar/nilai`:
       - urutan X lalu Y;
       - X: "Lulus", Nilai Akhir 68, baris 70 dan 50, Final 80, rumus "Rata-rata quiz materi 60 × 60% + Final Quiz 80 × 40% = 68";
       - sel nilai baris materi 1 X **tepat** "70", bukan 100 milik B, dan kartu X punya tepat 2 baris materi. Jangan mengasersikan "tidak ada 100 di kartu": judul bertoken acak bisa memuat angka itu (pelajaran 19 Nov no. 1);
       - Y: "Sedang berjalan", "—", 90, "belum", "+ 1 materi terkunci", Final "belum", rumus sementara;
       - meta cocok `/^\d+ materi · (selesai|terakhir diakses) \d{1,2} \S{3} \d{4}$/`;
       - nama tautan materi 1 Y "Lihat jawaban Anda, …".
     - Klik tautan materi 1 X → URL `/quiz`, h1 "Materi 1 · Hasil Quiz". Kembali. Tautan Final X → "Lulus kursus".
     - SQL lewat `withE2eDb`: `final_score_percent = 91.40` (A, X) dan `quiz_score_percent = 69.99` (A, X materi 1) → muat ulang → 91, baris 69, rumus "= 91".
     - Lebar 360, 700, 768, 1024, 1280:
       - tanpa gulir samping (dokumen **dan** kartu terluar);
       - di 360 sel tanggal pertama `toBeHidden()`, dan tautan pembahasan pertama ≥ 44 × 44 (`expectTouchTarget` pada `<a>`-nya, bukan sel atau barisnya — pelajaran 20 Nov no. 1);
       - di 1280 teks "Lihat" terlihat;
       - screenshot `nilai-terisi-{lebar}`.
  2. **Kosong + tamu:** MEMBER baru tanpa pendaftaran → keadaan kosong di 360 dan 1280 (screenshot `nilai-kosong-360`, `nilai-kosong-1280`), tautan "Lanjutkan kursus saya" ber-`href` `/belajar`. Konteks tanpa sesi → `/belajar/nilai` mendarat di `/masuk?next=%2Fbelajar%2Fnilai`.

  Pencocokan teks: Playwright `getByText`/`getByRole` mencocokkan sebagian teks tanpa membedakan huruf besar-kecil. Angka diasersikan di dalam `row`/`cell` yang tepat dengan `exact: true` (pelajaran 20 Nov no. 4). Tunggu h1 sebelum mengukur atau memotret.

  **`belajar-final-quiz.spec.ts` tes 1** (akhir saja): "Ke Nilai Saya" → kartu kursus itu menampilkan "Lulus" dan 68 → `page.goto("/belajar")` → badge "Lulus" tetap diasersikan seperti sekarang.
- [ ] **axe** (`axe.spec.ts`, hanya w360 + w1280; langkah di tes yang sudah ada, tanpa membuat kursus baru):
  - tes "MEMBER: /belajar keadaan A lalu B…": langkah `/belajar/nilai` kosong, setelah keadaan A;
  - tes "MEMBER: Final Quiz aturan & hasil (S5-02)": langkah `/belajar/nilai` terisi, setelah "final hasil".
- [ ] **E2E lain tetap hijau**, termasuk tes S5-02 dan S3-02.
- [ ] **Screenshot** — `E2E_SCREENSHOT_DIR=~/binzi-s5-03-screenshots` (kosongkan folder dulu), jalankan `belajar-nilai.spec.ts` + `belajar-final-quiz.spec.ts`. Harapan **12 berkas**: 5 S5-02 lama + `nilai-terisi-{360,700,768,1024,1280}` + `nilai-kosong-{360,1280}`. Sebut jumlahnya di PR.
- [ ] **Uji mutasi** — commit lokal dulu dan `git status` bersih sebelum mutasi pertama; kembalikan dengan `git restore`. Laporkan per mutasi nama tes yang merah + pesannya:
  1. Kueri baris materi tanpa `lesson_progress.user_id` di ON.
  2. Kueri pendaftaran tanpa `enrollments.user_id`.
  3. Kueri attempt Final tanpa `user_id`.
  4. Kueri attempt Final tanpa `reset_at IS NULL`.
  5. Kueri attempt Final menerima `IN_PROGRESS`.
  6. Nilai Akhir dihitung ulang dari rata-rata × bobot + Final × bobot, bukan dibaca tersimpan.
  7. Nilai Akhir `Math.floor`.
  8. Nilai quiz materi `Math.round`.
  9. `isPassed` materi dihitung dari skor ≥ ambang, bukan `quiz_is_passed`.
  10. Badge dari `is_passed` attempt Final, bukan `enrollments.status`.
  11. Filter `PUBLISHED` dihapus.
  12. Filter "minimal satu nilai" dihapus.
  13. Urutan `enrolled_at desc`.
  14. `unlocked` selalu `true` (`lockedCount` selalu 0).
  15. `reviewAccessOf`: `NEVER` → `ALWAYS`.
  16. Bobot ditulis langsung 60/40 di komponen.
  17. Subquery jumlah soal memakai nama kolom tanpa alias/tabel luar (pelajaran 10 Nov no. 1).
  18. Kolom tanggal tanpa `hidden sm:table-cell` — harus merah di e2e tes 1 (360); laporkan dari daftar tes gagal reporter (pelajaran (zz)).
  19. Baris Final `bg-fill` — harus merah di axe (`color-contrast`).
  20. "Ke Nilai Saya" kembali ke `/belajar`.

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR. Harapan `0 excused / 0 blocking / OK` (21 info/low/moderate di sandbox 21 Nov; yang menentukan 0/0). Temuan high/critical baru → berhenti dan tempel output lengkapnya.
- **Build dan rute:** `npm run build` — rute baru `/belajar/nilai` ƒ. `curl -sI` `/belajar/nilai` tanpa cookie → 307 ke `/masuk?next=%2Fbelajar%2Fnilai`.
- **Prettier:** berkas yang sudah ada tetap apa adanya; berkas baru boleh dirapikan.
- **`lint:hex`** menolak `#` diikuti 3/6 karakter hex di `src/`, termasuk komentar — tulis "PR 140", bukan "PR #140".
- **Anotasi desain:** grep perubahan untuk `\([A-Z]{1,4}-[0-9]+\)` dan `§` di teks yang dirender (`CLAUDE.md`).
- **`npm run e2e` penuh** sebelum PR.
- **`npm run check` di commit akhir:** tempel 5 baris terakhir output di PR.
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas.
- **"Keputusan & asumsi" di PR** memuat keputusan 1–13, semua copy *(usulan)*, dan keputusan yang diambil tanpa bertanya.
- **Setelah push:** buat PR segera begitu e2e lokal hijau, lalu kerjakan mutasi selagi CI berjalan. Perbarui isi PR dengan tabel mutasi. Cek CI (`gh pr checks`, job `ci` dan `e2e`), lalu laporkan durasi job `e2e` dibanding PR 145 (9m29s).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`
- Baseline + jumlah tes baru; tes lama yang berubah disebut satu per satu.
- `git diff --stat main -- package-lock.json package.json src/db src/lib/rbac.ts src/proxy.ts next.config.ts .github src/app/api src/styles src/components/shared src/components/learn/learn-dashboard.tsx` kosong.

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Screenshot `~/binzi-s5-03-screenshots` (12 berkas) diunggah ke Claude chat untuk ditinjau terhadap 8b/8t/8e/8f.
- [ ] Lokal (Docker menyala):
  ```bash
  cd ~/Project/React/binzi-new && git fetch origin && git switch s5/s5-03-nilai-saya && git pull --ff-only && npm run dev:db && npm run dev
  ```
  1. MEMBER baru, jendela privat → menu akun → "Nilai Saya" → keadaan kosong; "Lanjutkan kursus saya" → dasbor.
  2. Ikuti kursus demo lokal, kerjakan quiz materi 1 → "Nilai Saya": kursus tampil "Sedang berjalan", nilai sama dengan Daftar materi, materi 2 "belum".
  3. "Lihat" di baris materi 1 → hasil & pembahasan quiz itu.
  4. Bila sempat menyelesaikan kursus: hasil Final → "Ke Nilai Saya" → "Lulus"/"Selesai" dan Nilai Akhir sama dengan halaman hasil Final.
  5. DevTools 360: tanpa gulir samping, ikon ↗ bisa diketuk, nav bawah "Progress" aktif.
- [ ] **binzi-dev:** kartu ini tanpa migrasi, jadi tidak ada langkah binzi-dev sebelum merge.

## Catatan jadwal
- **Urutan commit yang disarankan:**
  1. `formatWibDate` + `reviewAccessOf` (refaktor, tes lama tidak berubah);
  2. `progress` (`loadGradeCourses` + kueri);
  3. `attempt` (`getGradesPage`, kueri, serializer) + tes integrasi + serializer;
  4. halaman + `MyGrades` + tes komponen + tes struktur;
  5. "Ke Nilai Saya";
  6. e2e + axe + screenshot.

  Commit + push di antara bagian.
- **Bila terlambat**, yang dipotong lebih dulu:
  1. lebar 700 dan 1024 di e2e tes 1 (360/768/1280 tetap);
  2. tautan "Kerjakan Final Quiz" pada `nextStep: "final"` (kalimatnya tetap);
  3. langkah axe keadaan kosong.

  **Tidak dipotong:** sumber angka (keputusan 2), filter aktor/terbit/reset, tautan pembahasan, keadaan kosong, e2e no. 1–2, axe keadaan terisi.

## Catatan untuk kartu A4 (S5-04)
- `loadGradeCourses` sudah memuat outline + nilai per materi untuk semua kursus aktor. Halaman `/belajar/{kursus}` (8c) bisa memakai bentuk yang sama per kursus. Bila A4 mengubah bentuknya, Nilai Saya ikut dites ulang.
- Setelah A4: judul kursus di Nilai Saya boleh menjadi tautan ke `/belajar/{kursus}`, dan tombol keadaan kosong boleh diarahkan ke `/belajar/kursus-saya`.

## Catatan tinjauan 21 Nov (fakta kode di `2aa1bd2`)
| Klaim | Cara dicek | Hasil |
|---|---|---|
| Baseline | `npm run check` penuh di sandbox pada `2aa1bd2` | 129 berkas / 1532 tes; `tsc`, `eslint`, `lint:hex` hijau |
| Gate audit | `node scripts/check-audit.mjs` di sandbox | 0 excused / 0 blocking / OK, 21 info/low/moderate |
| Rute | `find src/app/(learn)` | `/belajar/nilai` belum ada → 404 hari ini (tidak ada `[slug]/page.tsx`) |
| Pintu masuk | `nav-items.ts:97`, `:142`, `:191`; `site-footer.tsx:25` | Menu akun, nav bawah "Progress", dan footer sudah menuju `/belajar/nilai`; state aktif dites di `nav-items.test.ts:145`, `:177` |
| Slug cadangan | `course/schema.ts:56–57` + tes integrasi course | `kursus-saya` dan `nilai` sudah ditolak sejak S1-01. Butir "Pekerjaan kecil" STATUS tentang slug ini sudah selesai |
| Nilai materi | `src/db/schema/progress.ts`; `recordLessonQuizResult` | `quiz_score_percent`, `quiz_is_passed`, `quiz_submitted_at` ditulis di transaksi kumpulkan; SQL reset gladi (STATUS 19 Nov) mengosongkannya |
| Nilai Final | `attempt/queries.ts:137` `selectAttemptByQuizAndUser` | Halaman hasil memakai attempt `reset_at IS NULL`; Nilai Akhir + status dari `enrollments` (`getEnrollmentFinalResult`, `Math.round`) |
| Rata-rata di hasil Final | `progress/service.ts:493–500` | `Math.round` rata-rata `quiz_score_percent` semua materi |
| `reviewAccess` | `attempt/serializer.ts:431–438` | Rantai inline di `toQuizReviewDTO`; `reviewReveals` di `quiz-result.tsx:21` (server component) |
| Gerbang materi | `progress/policy.ts:36` `isLessonUnlocked` | Pendahulu langsung `quiz_attempted`; kursus tidak berurutan selalu terbuka |
| Jumlah soal | `progress/queries.ts:546–548` | Pola subquery ber-alias `q` + `quizzes.id` ditulis tangan |
| `inArray([])` | `drizzle-orm/sql/expressions/conditions.js:73` | Daftar kosong → `false` (tidak melempar); kartu tetap meminta kueri dilewati |
| `getScoreWeights` | `quiz/service.ts:97` | Tanpa parameter executor, membaca lewat `db`; gagal tertutup |
| Tanggal | `src/lib/datetime.ts`; Node 22 sandbox | Hanya `formatWib` (tanggal + jam). `Intl` `id-ID` `month: "short"` → "24 Agu 2026" untuk `2026-08-23T18:30:00Z` |
| `EmptyState` | `src/components/ui/empty-state.tsx` | `"use client"`, dua aksi wajib, judul h3 → 8f dibangun langsung |
| "Ke Belajar" | `final-quiz-result.tsx:151`, tes `:173–180`, e2e `belajar-final-quiz.spec.ts:349–352` | 7h: "Ke Nilai Saya" |
| Kontras (dihitung di sandbox) | rumus WCAG atas `tokens.css` | `success`: `surface` 4,96 · `surface-2` 4,76 · `fill-soft` 4,56 · **`fill` 4,32**. `danger` ≥ 5,70 di keempat latar. `primary-deep` di `fill-soft` 5,16. `text-subtle` di `fill-soft` 4,92 |
| Helper integrasi | `quiz-attempt.integration.test.ts:1149–1376` | `seedScoreWeights`, `finalCourse`, `completeLessonWithScore` (tidak mengisi `quiz_is_passed`/`quiz_submitted_at`), `answerFinalAttempt` |
| Helper e2e | `e2e/layout/helpers.ts:537` | `createPublishedCourseViaApi(…, { lessons })` → `lessons[].{id, slug, quizId}`, `finalQuizId`; 10 soal per quiz |
| Tabel di 360 | Prototipe HTML polos di Chromium sandbox: 3 kolom, kepala `sr-only`, kolom tanggal `display: none`, judul 44 karakter tanpa spasi | Tanpa gulir samping; kolom nama 202 px; tautan ikon 44 × 44; kepala `sr-only` tetap terbaca sebagai `columnheader` |
| axe | `playwright.config.ts` | `axe.spec.ts` hanya w360 + w1280 |
| Anggaran CI | `.github/workflows/ci.yml:90`; PR 145 | `timeout-minutes: 30`; job `e2e` terakhir 9m29s |

Yang **belum** dicek dari sandbox: tampilan dengan font Lato asli dan perilaku di Safari iOS (verifikasi pemilik).

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
