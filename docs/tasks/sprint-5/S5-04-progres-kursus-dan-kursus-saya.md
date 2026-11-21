# S5-04 · Progres kursus `/belajar/{kursus}` + Kursus Saya `/belajar/kursus-saya`: status per materi, Final Quiz, ringkasan nilai, daftar kursus yang diikuti

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | **S5-03** (PR #148): `formatWibDate`, pola halaman `/belajar/nilai`, `MyGrades`. **S5-02**: `finalQuizHref`, status `enrollments`. **S5-01**: dasbor (`selectEnrolledCourses`, `selectAvailableCourses`, `StartCourseButton`, `CoverBlock`, `BadgeStatus`). **S2-01/S2-02**: outline, gerbang, `formatPlaybackClock`. Semua sudah di `main` |
| **Target** | A4 rencana UAT internal 11 Des (STATUS 19 Nov). Perkiraan ±2 hari |
| **Branch** | `s5/s5-04-progres-dan-kursus-saya` |

> **Dibuat 21 Nov 2026** di Claude chat terhadap `main` `1acd84d` (#148). Pohonnya identik dengan head PR `2c38f87` yang diukur di sandbox. Fakta kode yang dirujuk ada di "Catatan tinjauan 21 Nov" di akhir kartu.
>
> **Keputusan teknis kartu** (usulan Claude chat, disetujui bersama kartu):
>
> 1. **Tanpa migrasi, tanpa dependensi baru, tanpa token warna baru, CSP tidak berubah, tanpa route API baru.** Kedua halaman adalah GET murni.
> 2. **Semua data dari modul `progress`.** Bobot nilai dibaca halaman lewat `getScoreWeights` (modul `quiz`) lalu dioper ke komponen, pola halaman dasbor yang merangkai dua service. Modul `progress` tetap tidak mengimpor modul `quiz` (komentar `FinalScoreWeights` di `progress/service.ts`). Modul `attempt` tidak disentuh.
> 3. **Lima status per materi.** Empat dari PRD PRG-10 (Terkunci, Sedang dipelajari, Quiz belum dikerjakan, Selesai), ditambah "Belum mulai" dari 8c untuk materi terbuka yang belum pernah dibuka (tanpa ini materi di kursus tidak berurutan akan salah label). Aturannya, urut prioritas:
>    1. `status = COMPLETED` → **selesai** (menang atas gerbang, pola outline S2-01);
>    2. tidak lolos `isLessonUnlocked` → **terkunci**;
>    3. `quiz_attempted` tetapi belum `COMPLETED` (video belum cukup) → **sedang dipelajari**;
>    4. sudah dibuka (`status` ada dan ≠ `NOT_STARTED`) **dan** `isQuizEligible` → **quiz belum dikerjakan**;
>    5. sudah dibuka → **sedang dipelajari**;
>    6. selain itu → **belum mulai**.
> 4. **Final Quiz di halaman progres** dibaca dari data tersimpan, tanpa membaca attempt:
>    - `enrollments.status ≠ IN_PROGRESS` → **sudah dikerjakan** (aturan `finalQuizDone` S3-02);
>    - `allLessonsCompleted` → **terbuka**;
>    - selain itu → **terkunci**.
>
>    Nilai Final tidak ditampilkan di halaman ini; Nilai Akhir (tersimpan) ada di ringkasan, dan nilai Final ada di hasil Final dan Nilai Saya.
> 5. **"Kerjakan quiz" menuju halaman materi**, bukan langsung ke halaman quiz, supaya dialog konfirmasi S3-01 (langkah pertama QZ-18) tetap dilalui.
> 6. **Peserta yang belum terdaftar** membuka `/belajar/{kursus}` → dialihkan ke materi 1 (panel "Mulai materi 1"), pola `kembali` halaman Final. Kursus tidak ada / tidak terbit / tanpa materi → 404.
> 7. **Kursus Saya:** urutan `enrollments.updated_at desc, courses.id asc` (urutan "Kursus saya" dasbor; indeks PRD §11.3), hanya kursus `PUBLISHED` yang punya materi (sama dengan dasbor).
> 8. **Tidak dibangun** (putaran 2 atau kartu lain):
>    - chip filter "Semua / Sedang berjalan / Selesai / Belum dimulai" (13b) — paling banyak tiga kursus saat UAT;
>    - "Ulangi kursus" (CRS-12, kartu B3) dan kotak penjelasannya di 13b;
>    - kartu "Waktu belajar" 8c: `enrollments.total_seconds_spent` tidak pernah ditulis kode mana pun;
>    - kalimat proyeksi 8c "Kalau Final Quiz 90, Nilai Akhir jadi 86";
>    - posisi video di baris Kursus Saya ("01:24 / 04:38", 13b) — baris itu cukup menyebut judul materi terakhir;
>    - tab horizontal tablet 8t/13t (D-07);
>    - "+ 2 materi lagi" 8c (penyingkat mockup; semua materi tampil).
> 9. **Nilai Akhir di Kursus Saya** tampil di baris meta ("· Nilai Akhir 68"), bukan di dalam pil seperti 13b. `BadgeStatus` adalah komponen bersama satu-label dan tidak diubah.
> 10. **Keadaan kosong 13c:** daftar kursus tersedia memakai `StartCourseButton` "Mulai materi 1" (pola "Kursus lainnya" dasbor), bukan "Lihat →" ke `/kursus/{slug}`, karena halaman detail kursus baru ada di A5. Kalimat 13c "Materi pertama bisa ditonton dulu sebelum Anda memutuskan ikut" tidak dipakai: preview tanpa daftar (B2) belum ada.
> 11. **Tanggal absolut WIB** (`formatWibDate`), bukan "2 hari lalu" (keputusan 8 S5-03).
> 12. **State menu akun tidak diubah:** `/belajar/{kursus}` tetap menyalakan "Dashboard" (`getActiveAccountItem`, perilaku A-14b). Ditinjau ulang bersama D-07.
> 13. **Keadaan kosong Nilai Saya:** tombol "Lanjutkan kursus saya" kini menuju `/belajar/kursus-saya` (catatan A4 di kartu S5-03).

## Tujuan
Peserta membuka "Kursus Saya" dari menu akun atau nav bawah dan melihat setiap kursus yang diikutinya: status PRG-06, jumlah materi selesai, tanggal, dan aksi yang sesuai (Lanjutkan, Lihat progress, Lihat nilai, Mulai materi 1). Dari sana, "Lihat progress" membuka halaman progres kursus yang menampilkan status setiap materi beserta nilainya (PRG-07, PRG-10), keadaan Final Quiz, dan ringkasan nilai. Peserta tanpa kursus melihat keadaan kosong 13c dengan kursus yang bisa dimulai.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD:
  - `docs/prd/sections/06-4-progress-nilai-saya-menggantikan-sertifi.md` (PRG-06, PRG-07, PRG-10);
  - `06-2-kursus-materi.md` (definisi "Materi Selesai", "Kursus Selesai & Lulus", CRS-08).
- Desain:
  - progres: `docs/design/screens/8c.md` + `.png` (buka `8c.html` untuk ukuran);
  - Kursus Saya: `13b.md` + `.png` (desktop), `13t.png` (tablet: aksi turun ke bawah kartu, dua tombol selebar setengah), `13d.png` bagian kanan (360);
  - kosong: `13c.md` + `.png`.
- Kode:
  - `src/modules/progress/{policy,queries,serializer,service}.ts` (`selectEnrolledCourses`, `selectAvailableCourses`, `selectPublishedCourseBySlug`, `selectEnrollmentForCourse`, `selectOutlineRows`, `selectOpenLessonQuiz` (pola hitung soal), `firstLessonSlugSql`, `hasLessonsSql`, `isLessonUnlocked`, `isQuizEligible`, `allLessonsCompleted`, `badgeOf`, `lessonHref`, `finalQuizHref`, `loadFinalQuizContext`) + `lesson-page.integration.test.ts`, `serializer.test.ts`;
  - `src/modules/quiz/service.ts` (`getScoreWeights`);
  - `src/app/(learn)/belajar/(dashboard)/page.tsx`, `nilai/page.tsx`, `[slug]/final-quiz/page.tsx` (pola halaman dan `kembali`);
  - `src/components/learn/{learn-dashboard,my-grades,start-course-button,playback-clock}.tsx|ts` + tes `my-grades`; `src/components/ui/{badge-status,progress-bar,button-variants}.tsx`; `src/lib/datetime.ts`;
  - `src/lib/learn-route-structure.test.ts`.
- E2E: `e2e/belajar-nilai.spec.ts` (helper lokal jawab/kumpul lewat API, `courseSection`, `expectCourseBoxFits` — salin polanya), `e2e/layout/helpers.ts` (`createPublishedCourseViaApi`, `attachVideoInE2eDb`, `expectTouchTarget`, `maybeScreenshot`), `e2e/layout/axe.spec.ts`, `e2e/README.md`.

## Kerjakan

### 1. Modul `progress`: data
**Queries** (nama bebas, sebut di rencana). Pembatas `user_id` aktor ada di setiap kueri; fragmen `sql` menulis nama tabel luar dengan tangan (pelajaran 10 Nov no. 1); tanpa `Date` mentah di fragmen `sql` (pelajaran 19 Nov no. 3).
1. **Kursus Saya:** baris kursus yang diikuti aktor, pola `selectEnrolledCourses` (`PUBLISHED`, `hasLessonsSql`, `enrollments.user_id = aktor`) ditambah kolom:
   - `enrollments.final_score_percent`, `completed_at`, `enrolled_at`, `updated_at`;
   - judul materi terakhir: subquery `last_lesson_id` yang dibatasi `course_id` kursus itu (pola `lastLessonSlug` dasbor);
   - `courses.estimated_minutes`.

   Urutan `enrollments.updated_at desc, courses.id asc`. Kueri **baru**; `selectEnrolledCourses` dan DTO dasbor tidak diubah.
2. **Baris materi untuk progres:** pola `selectOutlineRows` (urutan `order_index asc, id asc`, `lesson_progress.user_id = aktor` **di klausa ON**) ditambah `lesson_progress.quiz_is_passed` dan `lessons.video_duration_seconds`. Kueri **baru** atau perluasan `selectOutlineRows`; bila diperluas, sebut di rencana setiap tes/fixture yang terdampak.
3. **Final Quiz kursus:** `quizzes.duration_minutes` dan jumlah soal (subquery ber-alias, pola `selectOpenLessonQuiz`) untuk `courses.final_quiz_id`.
4. **Enrollment untuk progres:** `status`, `final_score_percent`, `updated_at` milik aktor untuk kursus itu (perluas atau kueri baru; sebut di rencana).

**Service — dua ekspor baru:**

**A. `getMyCoursesPage(actor): Promise<MyCoursesPageDTO>`** — `assertMemberRole`, lalu kueri 1. Bila kosong, `selectAvailableCourses` (kursus yang bisa dimulai, untuk 13c).
```ts
export type MyCourseDTO = {
  id: string;
  slug: string;
  title: string;
  badge: "belum-dimulai" | "sedang-berjalan" | "selesai" | "lulus"; // badgeOf yang sama dengan dasbor
  lessonCount: number;
  completedLessonCount: number;
  meta: { kind: "terakhir-dibuka" | "selesai" | "diikuti"; at: string }; // ISO
  finalScorePercent: number | null;     // Math.round; hanya selesai/lulus
  lastLessonTitle: string | null;       // hanya sedang-berjalan
  estimatedMinutes: number | null;      // hanya belum-dimulai
  continueHref: string;                 // lessonHref(last ?? first) — aturan action dasbor
  progressHref: string;                 // /belajar/{slug}
};
export type MyCoursesPageDTO = {
  courses: MyCourseDTO[];
  available: LearnerCourseDTO[];        // hanya diisi bila courses kosong
};
```
`meta`: `sedang-berjalan` → `terakhir-dibuka` (`updated_at`); `selesai`/`lulus` → `selesai` (`completed_at`, cadangan `updated_at`); `belum-dimulai` → `diikuti` (`enrolled_at`).

**B. `getCourseProgressPage(actor, courseSlug): Promise<CourseProgressPageDTO>`** — `assertMemberRole`, kursus `PUBLISHED` lewat slug (tidak ada / tidak terbit → `NotFoundError`), enrollment aktor (tidak terdaftar → `{ state: "kembali", href: lessonHref(slug, materi 1) }`), baris materi (kosong → `NotFoundError`), Final Quiz.
```ts
export type CourseLessonStatus =
  "selesai" | "terkunci" | "quiz-belum" | "sedang-dipelajari" | "belum-mulai";
export type CourseProgressLessonDTO = {
  position: number;
  title: string;
  status: CourseLessonStatus;            // keputusan 3, satu fungsi murni di policy.ts
  href: string | null;                   // null hanya untuk terkunci
  hasVideo: boolean;                     // READY
  scorePercent: number | null;           // Math.floor; hanya bila quiz dikerjakan
  isPassed: boolean | null;              // quiz_is_passed tersimpan
  video: { positionSeconds: number; durationSeconds: number } | null; // hanya sedang-dipelajari + READY + durasi > 0
};
export type CourseProgressPageDTO =
  | { state: "kembali"; href: string }
  | {
      state: "progres";
      course: { id: string; title: string };
      badge: "belum-dimulai" | "sedang-berjalan" | "selesai" | "lulus";
      lessonCount: number;
      completedLessonCount: number;
      lastActivityAt: string;            // enrollments.updated_at, ISO
      lessons: CourseProgressLessonDTO[];
      final: {
        status: "terkunci" | "terbuka" | "selesai"; // keputusan 4
        href: string;                    // finalQuizHref
        questionCount: number;
        durationMinutes: number;
      } | null;                          // kursus tanpa Final Quiz (tidak terjangkau dengan data sah)
      lessonAveragePercent: number | null; // Math.round atas materi ber-nilai
      gradedLessonCount: number;
      hasFailedLesson: boolean;          // ada materi ber-nilai dengan isPassed === false
      finalScorePercent: number | null;  // Math.round; hanya bila status ≠ IN_PROGRESS
    };
```
`badge` (di kedua DTO) dihitung dengan `badgeOf` yang sama dengan dasbor. Fungsi itu kini menerima `EnrolledRow`; tipe parameternya boleh dilonggarkan menjadi `Pick<…, "enrollmentStatus" | "lastLessonId" | "completedLessonCount">` tanpa mengubah isinya. Jangan membuat salinan aturan badge. Tidak ada id materi, id quiz, jawaban, atau kunci di DTO (allowlist `Object.keys` dites).

### 2. Halaman
- `src/app/(learn)/belajar/kursus-saya/page.tsx` (baru): `requireRole("MEMBER")` → `getMyCoursesPage` → `<PageContainer className="pt-8"><MyCourses …/></PageContainer>`. Tanpa `loading.tsx`.
- `src/app/(learn)/belajar/[slug]/page.tsx` (baru): `requireRole("MEMBER")` → `Promise.all([getCourseProgressPage(actor, slug), getScoreWeights()])`. `NotFoundError` → `notFound()`; `kembali` → `redirect`. Tanpa `loading.tsx` di `[slug]/` (tes struktur sudah menjaganya). Segmen statis `nilai`, `kursus-saya`, dan `final-quiz` tetap menang; slug `nilai`/`kursus-saya` sudah ditolak CMS.
- `learn-route-structure.test.ts`: kedua halaman ada; tidak ada `loading.tsx` di `belajar/kursus-saya/`.

### 3. Komponen `MyCourses` (`src/components/learn/my-courses.tsx`, baru) — 13b/13t/13d, kosong 13c
Server component (tanpa `"use client"`), kecuali `StartCourseButton` yang sudah klien. Satu h1. `CoverBlock` dari `learn-dashboard.tsx` boleh **diekspor** (perubahan satu kata, tanpa perubahan perilaku); jangan membuat salinan kedua.

**Kepala:**
- eyebrow mono "Belajar / Kursus Saya";
- h1 "Kursus Saya";
- bila ada kursus: paragraf "{n} kursus yang Anda ikuti. Progress tersimpan otomatis — boleh dilanjut kapan saja." *(usulan; bagian "dan kursus yang selesai boleh diulang" dibuang, keputusan 8)*;
- tautan bergaya tombol `secondary` "Jelajahi kursus lain" → `/kursus` (≥ 1024 di kanan kepala, 13b).

**Kartu per kursus** (`<article aria-labelledby>`, `rounded-card border`):
- `CoverBlock` (≥ 640 kotak kiri 96–120 px; < 640 di atas kartu, 13d);
- `BadgeStatus` + meta mono:
  - sedang berjalan: "{x}/{y} materi · terakhir dibuka {tanggal}";
  - selesai/lulus: "{x}/{y} materi · selesai {tanggal} · Nilai Akhir {n}" (keputusan 9);
  - belum dimulai: "0/{y} materi · diikuti {tanggal}";
- **h2** judul (`wrap-anywhere`);
- baris bawah judul:
  - sedang berjalan + ada judul terakhir: "Terakhir dibuka: {judul materi}" *(usulan)*;
  - belum dimulai: "Belum ada materi yang dibuka" + " · {m} menit total" bila `estimatedMinutes`;
  - selesai/lulus: tidak ada;
- `ProgressBar` `completedLessonCount`/`lessonCount`: `primary` untuk sedang berjalan dan belum dimulai, `success` untuk selesai/lulus (13b);
- **aksi** (≥ 1024 kolom kanan bertumpuk; 640–1023 di bawah kartu, dua tombol selebar setengah, 13t; < 640 penuh, 13d; semua ≥ 44 px):
  - sedang berjalan: `primary` "Lanjutkan" → `continueHref`; `secondary` "Lihat progress" → `progressHref`;
  - selesai/lulus: `secondary` "Lihat nilai" → `/belajar/nilai`; `secondary` "Lihat progress" → `progressHref` *(usulan, menggantikan "Ulangi kursus")*;
  - belum dimulai: `dark` "Mulai materi 1" → `continueHref`.

  Nama aksesibel tombol menyebut judul kursus (`aria-describedby` ke h2, pola dasbor), karena labelnya berulang di setiap kartu.

**Kosong — 13c:**
- kotak `border-dashed border-border-dashed bg-surface-2`;
- eyebrow "Belum ada kursus";
- **h2** "Anda belum mengikuti kursus apa pun";
- paragraf: `available` tidak kosong → "{n} kursus tersedia dan semuanya gratis." *(usulan)*; kosong → "Belum ada kursus yang bisa diikuti saat ini." *(usulan)*;
- daftar `available`: judul, mono "{n} materi" + " · {m} menit" bila ada, `StartCourseButton` "Mulai materi 1" (keputusan 10);
- tautan bergaya tombol `primary` "Jelajahi semua kursus" → `/kursus`.

### 4. Komponen `CourseProgress` (`src/components/learn/course-progress.tsx`, baru) — 8c
Server component. Satu h1. Props: DTO `progres` + `weights`.

**Kepala:**
- eyebrow mono "Belajar / Kursus Saya" *(usulan; 8c memakai judul singkat yang tidak ada di data)*;
- **h1** judul kursus (`wrap-anywhere`);
- `ProgressBar` + mono "{pct}% · {x}/{y} materi" (`pct` = `Math.round(x / y × 100)`); tone `success` bila status kursus ≠ `IN_PROGRESS`, selain itu `primary` (8c).

**Daftar materi** (≥ 1024 kolom kiri, ringkasan di kanan ±320 px; < 1024 ringkasan di bawah daftar). Satu baris per materi, `rounded-card border`, tinggi ≥ 56 px. Judul "{posisi} · {judul}" menjadi tautan ke halaman materi kecuali terkunci. Per status (copy mono huruf besar lewat CSS; teks DOM huruf biasa):

| Status | Ikon (dekoratif, `aria-hidden`) | Baris status | Latar | Aksi |
|---|---|---|---|---|
| selesai | lingkaran `success` + centang | "Selesai · Nilai {n}" (`text-success`); `isPassed === false` → "Selesai · Nilai {n} · Belum lulus" (`text-danger`) | `surface` | tautan teks "Tonton ulang" (ada video) / "Buka materi" (tanpa video) → materi |
| quiz-belum | lingkaran `warning` + "!" | "Video selesai · Quiz belum dikerjakan" (ada video) / "Quiz belum dikerjakan" (tanpa video) — `text-warning-tint-text` | `warning-tint`, garis `warning-tint-line` | `dark` "Kerjakan quiz" → **materi** (keputusan 5) |
| sedang-dipelajari | cincin `primary` | "Sedang dipelajari" + " · {posisi} / {durasi}" bila `video` (`formatPlaybackClock`) — `text-primary-deep` | `primary-tint` | `primary` "Lanjutkan" → materi |
| belum-mulai | lingkaran `fill` | — (label "Belum mulai" mono di kanan) | `surface-2` | — (judul tetap tautan) |
| terkunci | gembok | "Terkunci" *(usulan)* `text-text-subtle` | `surface-2` | — (judul bukan tautan) |

Status juga tersedia untuk pembaca layar sebagai teks (baris status adalah teks, bukan hanya warna/ikon).

**Baris Final Quiz** (di bawah daftar, gembok bila terkunci):
- terkunci: "Final Quiz · {q} soal" + "Terbuka setelah {y} materi selesai · {d} menit · bobot {final}%";
- terbuka: "Terbuka · {d} menit · bobot {final}%" *(usulan)* + `dark` "Kerjakan Final Quiz" → `href`;
- selesai: "Sudah dikerjakan" *(usulan)* + tautan "Lihat hasil" → `href`.

**Ringkasan** (kotak `rounded-card border bg-surface-2`, 8c kanan):
- judul kecil "Ringkasan nilai"; angka mono besar `lessonAveragePercent` ("—" bila null); label "rata-rata {k} quiz materi";
- status ≠ `IN_PROGRESS`: "Nilai Akhir {n} · {Lulus|Selesai}" *(usulan)* + tautan "Lihat di Nilai Saya" → `/belajar/nilai`;
- `IN_PROGRESS`: "Nilai Akhir = {rata} × {lesson}% + Final Quiz × {final}%." (bobot dari props; kalimat proyeksi tidak dibangun, keputusan 8);
- `hasFailedLesson`: kotak kedua "Nilai di bawah batas lulus tidak mengunci apa pun — materi tetap tercatat selesai dan Anda boleh lanjut. Nilai itu permanen karena quiz hanya sekali." *(usulan, dari 8c tanpa angka)*;
- "Terakhir diakses {tanggal}" (`formatWibDate`) di bawah ringkasan.

**Kontras yang sudah dihitung** ada di "Catatan tinjauan". Teks tidak pernah memakai `primary`; `success` hanya di latar `surface`/`surface-2`/`fill-soft` (di `fill` 4,32:1).

### 5. Nilai Saya: tombol keadaan kosong (keputusan 13)
`my-grades.tsx`: href "Lanjutkan kursus saya" `/belajar` → `MEMBER_HREFS.kursusSaya`. Tes `my-grades.test.tsx` dan `e2e/belajar-nilai.spec.ts` (tes 2, `toHaveAttribute("href", "/belajar")`) ikut diubah. Tidak ada perubahan lain di berkas itu.

## Bukan lingkup tugas ini
- Semua butir keputusan 8. Perapian S5-03 (pita baris Final selebar kotak, `wrap-anywhere` judul materi di Nilai Saya, lebar kolom tetap), judul kursus di Nilai Saya sebagai tautan.
- Katalog dan detail kursus `/kursus/{slug}` (A5). Statistik dasbor. Baris "Kursus saya" dasbor tidak diubah.
- **Tidak diubah:** `src/db/**`, `package.json`, `package-lock.json`, `src/lib/rbac.ts`, `src/proxy.ts`, `next.config.ts`, `.github/**`, `src/app/api/**`, `src/modules/attempt/**`, `src/modules/quiz/**`, `src/components/shared/**`, `src/components/ui/**`, `src/components/learn/quiz/**`, `src/styles/tokens.css`. `learn-dashboard.tsx` hanya `export` pada `CoverBlock`.
- **Jangan menjalankan `next upgrade`.** Pengingat keamanan Next 16.4.1 menghentikan `next build`/`next dev` sekali saat mendeteksi agent; jalankan ulang perintah yang sama.

Pekerjaan di luar lingkup → **berhenti dan tanyakan.**

## Berkas yang boleh dibuat/diubah
- `src/modules/progress/{policy,queries,serializer,service}.ts` + `serializer.test.ts`, `policy.test.ts`, dan satu berkas tes integrasi **baru** `src/modules/progress/my-courses.integration.test.ts` (PGlite, harness pola `lesson-page.integration.test.ts`, aktor baru per tes). Tes progres lama hanya diubah bila `selectOutlineRows` diperluas (sebut di rencana).
- `src/app/(learn)/belajar/kursus-saya/page.tsx`, `src/app/(learn)/belajar/[slug]/page.tsx` (baru)
- `src/components/learn/{my-courses,course-progress}.tsx` + tesnya (baru)
- `src/components/learn/learn-dashboard.tsx` (hanya `export` `CoverBlock`)
- `src/components/learn/my-grades.tsx` + `my-grades.test.tsx` (hanya bagian 5)
- `src/lib/learn-route-structure.test.ts`
- `e2e/belajar-kursus-saya.spec.ts` (baru), `e2e/belajar-nilai.spec.ts` (hanya asersi href tes 2), `e2e/layout/axe.spec.ts` (langkah di tes yang sudah ada, tanpa tes baru)

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- hash basis (`1acd84d` + PR docs kartu ini) dan baseline Vitest **yang diukur**. Claude chat mengukur **130 berkas / 1567 tes** pada pohon yang sama. Bila angkamu berbeda, berhenti dan laporkan;
- kueri baru (kolom, join, filter, urutan) dan pilihan "kueri baru atau perluas" untuk kueri 2 dan 4;
- fungsi murni status materi (keputusan 3) dan tabel kebenarannya;
- daftar tes lama yang berubah, satu per satu, dengan alasannya (yang sudah diketahui: href tombol kosong Nilai Saya di tes komponen dan e2e tes 2). Cari juga asersi keadaan lain yang berubah karena halaman baru (pelajaran 14 Nov no. 3), mis. tes yang mengasersi `/belajar/{kursus}` atau `/belajar/kursus-saya` 404;
- urutan commit;
- **tabel mutasi dengan prediksi per baris**.

## Selesai jika
Data uji memenuhi semua syarat kecuali yang sedang diuji (pelajaran 14 Nov no. 6). Setiap tes integrasi memakai aktor baru sendiri (pelajaran tinjauan rencana S5-03).

- [ ] **Policy (murni):** status materi untuk setiap baris tabel keputusan 3, termasuk `COMPLETED` yang gerbangnya terkunci lagi → selesai, dan `quiz_attempted` tanpa `COMPLETED` → sedang dipelajari.
- [ ] **Integrasi** (PGlite, `my-courses.integration.test.ts`):
  - **Kursus Saya:**
    - tidak terdaftar → `courses: []`, `available` berisi kursus terbit;
    - tiga kursus dengan `updated_at` diisi eksplisit → urutan `updated_at desc`; badge `lulus` / `sedang-berjalan` / `belum-dimulai`;
    - `final_score_percent` `67.50` → 68 (tersimpan, `Math.round`);
    - `lastLessonTitle` dari `last_lesson_id` kursus itu; `last_lesson_id` yang menunjuk materi kursus lain → `null`;
    - kursus `DRAFT`/`ARCHIVED` dengan pendaftaran → tidak muncul;
    - peserta lain terdaftar di kursus lain → tidak muncul.
  - **Progres:**
    - kursus tidak berurutan dengan lima materi berisi kelima status (selesai lulus, selesai belum lulus, quiz-belum tanpa video, sedang-dipelajari dengan video 40 %, belum-mulai);
    - kursus berurutan: materi 1 selesai, materi 2 belum mulai, materi 3 terkunci (`href: null`);
    - `isPassed` dari `quiz_is_passed` tersimpan (`false` dengan skor 80 → "belum lulus");
    - peserta lain punya progres di materi yang belum dibuka aktor → status aktor tidak berubah (ambil DTO sebelum dan sesudah, `toEqual`);
    - Final: terkunci (satu materi belum selesai), terbuka (semua `COMPLETED`, status `IN_PROGRESS`), selesai (status `PASSED`/`COMPLETED`); dua kursus dengan Final 5 dan 10 soal → `questionCount` benar;
    - tidak terdaftar → `kembali` ke materi 1; slug tidak ada / kursus `DRAFT` → `NotFoundError`.
- [ ] **Serializer:** allowlist `Object.keys` untuk `MyCourseDTO`, `MyCoursesPageDTO`, `CourseProgressLessonDTO`, DTO `progres`; `meta` per badge; `scorePercent` floor, rata-rata dan Nilai Akhir round; `video` hanya untuk sedang-dipelajari dengan durasi > 0.
- [ ] **Komponen** (jsdom):
  - `MyCourses`: satu h1, h2 per kursus; aksi per badge (label + href); meta per badge termasuk "· Nilai Akhir 68"; keadaan kosong dengan dan tanpa `available`; nama aksesibel aksi menyebut judul;
  - `CourseProgress`: satu h1; kelima status (baris status, href, aksi; terkunci tanpa tautan); ketiga keadaan Final; ringkasan dengan bobot **70/30** dari props; kotak `hasFailedLesson`; "—" bila belum ada nilai;
  - `MyGrades`: tombol kosong → `/belajar/kursus-saya`.
- [ ] **Struktur:** bagian 2.
- [ ] **E2E** `e2e/belajar-kursus-saya.spec.ts` (proyek `chromium`, **paling banyak 2 tes**):
  1. **Terisi + progres.** Kursus X (2 materi), Y (3 materi), Z (2 materi) dari `createPublishedCourseViaApi`; MEMBER A mendaftar ketiganya.
     - X: materi 1 7/10, materi 2 5/10, Final 8/10 (lewat API) → Lulus, Nilai Akhir 68.
     - Y: `is_sequential = false` lewat `withE2eDb`; materi 1 9/10; `attachVideoInE2eDb(materi 2, …, 100)` + `POST /api/progress/lessons/{id}/open` + `POST /api/progress/video` `{ lessonId, positionSeconds: 40, durationSeconds: 100 }`; materi 3 dibuka tanpa video.
     - Z: tidak disentuh.
     - `updated_at` ketiga pendaftaran diisi eksplisit lewat `withE2eDb` (Y terbaru, lalu X, lalu Z).
     - `/belajar/kursus-saya`: urutan Y, X, Z; badge dan aksi per kartu; meta X memuat "Nilai Akhir 68"; "Lihat progress" Y → `/belajar/{Y}`.
     - Progres Y: materi 1 "Selesai · Nilai 90", materi 2 "Sedang dipelajari · 00:40 / 01:40" + "Lanjutkan", materi 3 "Quiz belum dikerjakan" + "Kerjakan quiz" (href halaman materi), Final terkunci; ringkasan 90.
     - Progres X: materi 2 "Belum lulus", Final "Sudah dikerjakan" + "Lihat hasil" → hasil Final, ringkasan "Nilai Akhir 68".
     - Progres Z: materi 1 belum mulai (judul tautan), materi 2 terkunci (tanpa tautan).
     - Lebar 360, 768, 1024, 1280 untuk Kursus Saya dan progres Y: tanpa gulir samping (dokumen **dan** setiap kotak kartu, pola `expectCourseBoxFits`), aksi pertama ≥ 44 × 44 di 360; screenshot.
  2. **Kosong + kembali + tamu + 404:** MEMBER baru → `/belajar/kursus-saya` keadaan kosong (minimal satu "Mulai materi 1" bila ada kursus terbit di DB bersama — **jangan** mengasersikan jumlah, pelajaran 9 Nov no. 9), screenshot 360 dan 1280. Satu kursus kecil (1 materi) → `/belajar/{slug}` tanpa pendaftaran → mendarat di halaman materi 1. Konteks tanpa sesi → `/belajar/kursus-saya` → `/masuk?next=%2Fbelajar%2Fkursus-saya`. Slug acak → 404.

  Pencocokan teks dibatasi ke baris/kartu yang tepat dengan `exact: true` (pelajaran 20 Nov no. 4). Tunggu h1 sebelum mengukur atau memotret. Ukur durasi tes 1; bila > 45 dtk, `test.setTimeout` dengan alasan yang benar.
- [ ] **axe** (`axe.spec.ts`, w360 + w1280; langkah di tes yang sudah ada, tanpa membuat kursus baru):
  - tes "MEMBER: /belajar keadaan A lalu B…": `/belajar/kursus-saya` kosong setelah keadaan A; `/belajar/kursus-saya` terisi dan `/belajar/{kursus}` (materi belum mulai) setelah keadaan B;
  - tes "MEMBER: Final Quiz aturan & hasil (S5-02)": `/belajar/{kursus}` setelah "final hasil".
- [ ] **E2E lain tetap hijau.**
- [ ] **Screenshot** — `E2E_SCREENSHOT_DIR=~/binzi-s5-04-screenshots` (kosongkan folder dulu), jalankan **hanya** `belajar-kursus-saya.spec.ts`. Harapan **10 berkas**: `kursus-saya-terisi-{360,768,1024,1280}`, `progres-berjalan-{360,768,1024,1280}`, `kursus-saya-kosong-{360,1280}`. Diambil sebelum ubahan SQL apa pun yang mengubah angka. Sebut jumlahnya di PR.
- [ ] **Uji mutasi** — commit lokal dulu dan `git status` bersih sebelum mutasi pertama; kembalikan dengan `git restore`. Laporkan per mutasi nama tes yang merah + pesannya; mutasi yang dijalankan harus persis yang tertulis (catatan mutasi 19 S5-03):
  1. Kueri baris materi progres tanpa `lesson_progress.user_id` di ON.
  2. Kueri Kursus Saya tanpa `enrollments.user_id`.
  3. Filter `PUBLISHED` Kursus Saya dihapus.
  4. Urutan Kursus Saya `updated_at asc`.
  5. Subquery judul materi terakhir tanpa batas `course_id`.
  6. Nilai Akhir Kursus Saya `Math.floor`.
  7. Status: prioritas `COMPLETED` dipindah ke bawah gerbang (selesai yang terkunci ulang menjadi terkunci).
  8. Status: `quiz-belum` tanpa syarat `isQuizEligible` (video 40 % menjadi "Quiz belum dikerjakan").
  9. Status: `isLessonUnlocked` selalu `true`.
  10. `isPassed` progres dihitung dari skor ≥ 70, bukan `quiz_is_passed`.
  11. Final "selesai" dari `allLessonsCompleted`, bukan `enrollments.status`.
  12. Peserta belum terdaftar → `NotFoundError` (bukan `kembali`).
  13. Subquery jumlah soal Final memakai nama kolom tanpa alias/tabel luar (pelajaran 10 Nov no. 1).
  14. Bobot ringkasan ditulis langsung 60/40 di komponen.
  15. "Kerjakan quiz" menuju halaman quiz, bukan halaman materi.
  16. Tombol kosong Nilai Saya kembali ke `/belajar`.

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR. Harapan `0 excused / 0 blocking / OK` (21 info/low/moderate di sandbox 21 Nov). Temuan high/critical baru → berhenti dan tempel output lengkapnya.
- **Build dan rute:** `npm run build` — rute baru `/belajar/kursus-saya` ƒ dan `/belajar/[slug]` ƒ. `curl -sI` keduanya tanpa cookie → 307 ke `/masuk?next=…`.
- **Prettier:** berkas yang sudah ada tetap apa adanya (catatan PR 148); berkas baru boleh dirapikan.
- **`lint:hex`** menolak `#` diikuti 3/6 karakter hex di `src/`, termasuk komentar — tulis "PR 148", bukan "PR #148".
- **Anotasi desain:** grep perubahan untuk `\([A-Z]{1,4}-[0-9]+\)` dan `§` di teks yang dirender (`CLAUDE.md`).
- **`npm run e2e` penuh** sebelum PR. Bila satu tes gagal dengan `UNKNOWN_ERROR` dari siteverify Turnstile, salin blok galatnya sebelum menjalankan ulang (butir "Kandidat tes flaky" di STATUS) dan laporkan di PR.
- **`npm run check` di commit akhir:** tempel 5 baris terakhir output di PR.
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas (`AGENTS.md` tetap untracked).
- **"Keputusan & asumsi" di PR** memuat keputusan 1–13, semua copy *(usulan)*, dan keputusan yang diambil tanpa bertanya.
- **Setelah push:** buat PR segera begitu e2e lokal hijau, lalu kerjakan mutasi selagi CI berjalan. Perbarui isi PR dengan tabel mutasi. Cek CI (`gh pr checks`, job `ci` dan `e2e`), lalu laporkan durasi job `e2e` dibanding PR 148 (11m5s).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`
- Baseline + jumlah tes baru; tes lama yang berubah disebut satu per satu.
- `git diff --stat main -- package-lock.json package.json src/db src/lib/rbac.ts src/proxy.ts next.config.ts .github src/app/api src/modules/attempt src/modules/quiz src/components/shared src/components/ui src/components/learn/quiz src/styles` kosong.

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Screenshot `~/binzi-s5-04-screenshots` (10 berkas) diunggah ke Claude chat untuk ditinjau terhadap 8c/13b/13t/13d/13c.
- [ ] Lokal (Docker menyala):
  ```bash
  cd ~/Project/React/binzi-new && git fetch origin && git switch s5/s5-04-progres-dan-kursus-saya && git pull --ff-only && npm run dev:db && npm run dev
  ```
  1. MEMBER baru, jendela privat → menu akun "Kursus Saya" → keadaan kosong → "Mulai materi 1" pada satu kursus → kembali ke Kursus Saya → kartu "Sedang berjalan" atau "Belum dimulai".
  2. "Lihat progress" → status materi sesuai yang sudah dikerjakan; materi terkunci tanpa tautan.
  3. Kerjakan quiz materi 1 → kembali ke progres → "Selesai · Nilai …".
  4. Keadaan kosong Nilai Saya (akun lain tanpa nilai) → "Lanjutkan kursus saya" → Kursus Saya.
  5. DevTools 360: kartu utuh, aksi bisa diketuk, nav bawah "Quiz" (tujuan sementara Kursus Saya) aktif di `/belajar/kursus-saya`.
- [ ] **binzi-dev:** kartu ini tanpa migrasi.

## Catatan jadwal
- **Urutan commit yang disarankan:**
  1. `progress`: policy status materi + kueri + `getMyCoursesPage` + `getCourseProgressPage` + tes policy/serializer/integrasi;
  2. Kursus Saya: halaman + `MyCourses` + ekspor `CoverBlock` + tes;
  3. progres: halaman + `CourseProgress` + tes + tes struktur;
  4. tombol kosong Nilai Saya;
  5. e2e + axe + screenshot.

  Commit + push di antara bagian.
- **Bila terlambat**, yang dipotong lebih dulu:
  1. kotak `hasFailedLesson`;
  2. lebar 1024 di e2e (360/768/1280 tetap);
  3. baris bawah judul Kursus Saya ("Terakhir dibuka: …", menit total).

  **Tidak dipotong:** kelima status + Final, aksi per badge, keadaan kosong, `kembali`/404, e2e no. 1–2, axe.

## Catatan untuk kartu berikutnya
- **A5 (katalog + detail):** daftar 13c beralih ke "Lihat →" `/kursus/{slug}` begitu detail ada. Peserta belum terdaftar di `/belajar/{kursus}` boleh dialihkan ke `/kursus/{slug}` alih-alih materi 1.
- **Putaran 2:** chip filter 13b (`ChipFilter` sudah ada di `src/components/ui/`), "Ulangi kursus" (B3), waktu belajar (butuh penulis `total_seconds_spent`), state menu akun untuk `/belajar/{kursus}` (D-07).

## Catatan tinjauan 21 Nov (fakta kode di `1acd84d`)
| Klaim | Cara dicek | Hasil |
|---|---|---|
| Basis | `git diff --stat 2c38f87 1acd84d` | Kosong: `main` = isi head PR 148 |
| Baseline | `npm run check` di sandbox pada `2c38f87` | 130 berkas / 1567 tes |
| Gate audit | `node scripts/check-audit.mjs` pada `1acd84d` | 0 excused / 0 blocking / OK, 21 info/low/moderate |
| Rute | `find src/app/(learn)` | `/belajar/kursus-saya` dan `/belajar/[slug]` belum punya `page.tsx` → 404 hari ini |
| Pintu masuk | `nav-items.ts:96`, `:141`, `:190` | Menu akun "Kursus Saya" dan nav bawah "Quiz" (tujuan sementara D-07) sudah menuju `/belajar/kursus-saya`; state aktif dites di `nav-items.test.ts` |
| Slug cadangan | `course/schema.ts:56–57`, `lesson/queries.ts:183` | `kursus-saya`, `nilai`, `final-quiz` sudah ditolak |
| Badge | `progress/serializer.ts` `badgeOf` | `PASSED` → lulus, `COMPLETED` → selesai, tanpa `last_lesson_id` dan tanpa materi selesai → belum-dimulai, sisanya sedang-berjalan |
| Outline | `progress/queries.ts` `selectOutlineRows` | Tidak membaca `quiz_is_passed` dan `video_duration_seconds` |
| Gerbang | `progress/policy.ts` `isLessonUnlocked`, `isQuizEligible` (≥ 90 % atau tanpa video READY), `allLessonsCompleted` | Dipakai ulang apa adanya |
| Waktu belajar | `grep totalSecondsSpent src` | Hanya di skema; tidak ada kode yang menulisnya |
| Bobot | `quiz/service.ts:97` `getScoreWeights` | Tanpa executor; gagal tertutup |
| Komponen | `learn-dashboard.tsx:38` `CoverBlock` (lokal), `start-course-button.tsx`, `progress-bar.tsx` (tone `success`/`primary`), `badge-status.tsx` (satu label), `playback-clock.ts` `formatPlaybackClock` | Dipakai ulang; hanya `CoverBlock` yang perlu diekspor |
| Helper e2e | `e2e/layout/helpers.ts:685` `attachVideoInE2eDb(lessonId, videoId, durasi)`; `e2e/belajar-materi.spec.ts:248` POST `…/open` | Tersedia untuk keadaan "sedang dipelajari" |
| Kontras (dihitung di sandbox) | rumus WCAG atas `tokens.css` | `warning-tint-text` di `warning-tint` 6,37 · `primary-deep` di `primary-tint` 4,85 · `success` di `surface` 4,96 · `danger` di `surface` 6,54 · `text-subtle` di `surface-2` 5,13 |
| axe | `playwright.config.ts` | `axe.spec.ts` hanya w360 + w1280 |
| Anggaran CI | PR 148 | `timeout-minutes: 30`; job `e2e` terakhir 11m5s |

Yang **belum** dicek dari sandbox: tampilan dengan font Lato asli dan Safari iOS (verifikasi pemilik).

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
