# S2-01 · Halaman materi peserta + progres: gerbang akses, "materi dibuka", simpan posisi video

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | **S5-01** (PR #131, `acdad2c`): modul `progress` — `assertMemberRole` (`policy.ts`), `firstLessonSlugSql` (`queries.ts`), `lessonHref` (diekspor ulang `service.ts`); `StartCourseButton` (`src/components/learn/`); `POST /api/progress/courses/{id}/enroll`; helper e2e `createEditorAdminContexts`, `createPublishableCourseViaApi`, `createPublishedCourseViaApi` (`e2e/layout/helpers.ts`). Juga S1-03a (`RichContent`), A-14b (layout area belajar) |
| **Target** | Kamis 12 Nov. Langkah kesembilan jalur demo 20 Nov |
| **Branch** | `s2/s2-01-halaman-materi` |

> **Dibuat 11 Nov 2026** di Claude chat terhadap `e56e597` dan rencana S5-01, lalu **ditinjau ulang sore harinya terhadap `main` `acdad2c`** (S5-01 sudah di-merge): nama ekspor, helper e2e, dan tes struktur di kartu ini kini nama yang benar-benar ada di `main`. Klaim teknis di bawah sudah dijalankan di sandbox (Next 16.4.1 minimal; PGlite dengan migrasi repo; drizzle-orm 0.45.3). Buktinya ada di "Catatan tinjauan 11 Nov".
>
> **Keputusan pemilik 11 Nov** (disetujui; dicantumkan di "Keputusan & asumsi" PR sebagai keputusan yang sudah disetujui, bersama semua copy bertanda *(usulan)*):
>
> 1. **Header tetap header member.** Layout `(learn)` tidak diubah. Bar kursus di dalam halaman menggantikan header fokus 7d/7f/7t (logo + judul kursus + progres, tanpa menu). Header fokus butuh layout terpisah untuk rute materi; ditunda ke setelah demo.
> 2. **Semua materi di `/belajar` mewajibkan pendaftaran**, termasuk materi `is_free_preview`. Ini lebih ketat daripada rumus §12.1 (`isFreePreview || …`). Preview gratis untuk tamu tetap di `/kursus/{slug}/preview/{materi}` (S6).
> 3. **Materi terkunci dan "belum mengikuti kursus" menjawab 200 dengan panel, tanpa isi materi.** Kursus atau materi yang tidak ada atau tidak terbit menjawab 404.
> 4. **"Materi dibuka" dicatat lewat POST dari klien setelah halaman tampil**, tidak pernah saat GET.
> 5. **Persen tonton = posisi terjauh yang pernah dicapai** (tidak turun saat peserta memutar mundur), dihitung terhadap `lessons.video_duration_seconds` bila terisi.
> 6. **Bar bawah materi:** "← Materi sebelumnya" dan "Materi berikutnya →" (bila terbuka), atau catatan bahwa materi berikutnya terbuka setelah quiz. Tombol "Tandai selesai & mulai quiz" milik kartu quiz (Sab 14).
> 7. **Tanpa `loading.tsx` untuk rute materi** — tidak ada skeleton saat membuka materi. Alasannya: berkas itu mengubah status 404 dan 307 di halaman ini menjadi 200 (dicek, lihat catatan tinjauan).

## Tujuan
Peserta yang sudah mendaftar membuka materi dari dasbor dan membaca isinya di `/belajar/{kursus}/{materi}`. Server menegakkan gerbang akses (terbit, terdaftar, materi berurutan — §12.1, CRS-08, §11.4 no. 7, V-06). Progres materi tercatat: baris `lesson_progress`, `first_accessed_at`, dan `enrollments.last_lesson_id`. Setelah itu dasbor S5-01 otomatis menampilkan "Sedang berjalan" dan "Lanjutkan". Endpoint permanen `POST /api/progress/video` (rencana video bagian 2) siap dipakai pemutar Jum 13.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD:
  - `docs/prd/sections/06-2-kursus-materi.md`: CRS-08, CRS-09, CRS-11, definisi "Materi Selesai";
  - `06-4-progress-nilai-saya-menggantikan-sertifi.md`: PRG-01, PRG-02, PRG-10;
  - `07-navigasi-information-architecture.md`: §7.4 B;
  - `11-model-data.md`: §11.2 `lesson_progress`, §11.4 no. 7;
  - `12-keamanan.md`: §12.1 cek akses materi, V-05, V-06.
- `docs/decisions/video-sumber.md`: bagian 2 dan 9 saja.
- Desain (`docs/design/screens/`):
  - `7d.md` + `.png` + `.html`: utama 1280 — bar kursus, judul, isi, bar bawah, "Daftar materi" (ukuran dari `.html`);
  - `7t.png`: panel ketiga (768) — "Daftar materi" sebagai panel lipat di bawah isi;
  - `7f.png`: panel kedua (360);
  - `13d.png` dan `28a.html`: pola kotak kosong bergaris putus.
- Kode:
  - `src/modules/progress/*` (S5-01): pola, `lessonHref`, fragmen materi pertama;
  - `src/modules/lesson/queries.ts`: pola subquery bernama tabel eksplisit, `selectOutlineRows`;
  - `src/app/api/progress/courses/[courseId]/enroll/route.ts` (S5-01): pola route;
  - `src/lib/rbac.ts`, `src/lib/errors.ts`, `src/lib/request-body.ts` (`readJsonBody`);
  - `src/components/shared/rich-content.tsx`, `src/components/shared/page-container.tsx`;
  - `src/components/ui/{button-variants,progress-bar,empty-state}.ts(x)`;
  - `src/components/learn/start-course-button.tsx` (S5-01);
  - `src/app/(learn)/layout.tsx`: dibaca saja, tidak diubah;
  - `src/lib/learn-route-structure.test.ts` (S5-01);
  - `src/db/schema/progress.ts`, `src/db/schema/course.ts`.
- E2E: `e2e/fixtures.ts`, `e2e/layout/helpers.ts`, `e2e/belajar-dasbor.spec.ts` (S5-01), `e2e/layout/{axe,touch-targets,no-horizontal-scroll}.spec.ts`.

## Kerjakan

### 1. Modul `progress`: data halaman materi dan gerbang
Perluas modul S5-01, tetap dengan pola `policy → queries → serializer → service`. Modul ini membaca tabel `courses`, `lessons`, `enrollments`, dan `lesson_progress` sendiri, **tanpa** mengimpor modul course atau lesson. Pengecualiannya sama dengan S5-01 (berkas skema `@/modules/course/schema`) ditambah `@/lib/content-doc` (tipe dokumen).

**`getLessonPage(actor, courseSlug, lessonSlug)`** — GET murni: hanya SELECT, tanpa transaksi, tanpa tulis apa pun. Peran dicek lebih dulu (`roleAtLeast(actor.role, "MEMBER")`, gagal → 403). Urutannya:
1. Kursus `PUBLISHED` dengan slug itu: `id`, `slug`, `title`, `is_sequential`. Tidak ada → `NotFoundError`. Ini mencakup DRAFT, IN_REVIEW, ARCHIVED, dan slug tak dikenal.
2. Enrollment milik `actor.id` untuk kursus itu: `id`, `last_lesson_id`.
3. **Outline**: semua materi kursus (`id`, `slug`, `title`) dengan `LEFT JOIN lesson_progress ON lesson_progress.lesson_id = lessons.id AND lesson_progress.user_id = actor.id`, untuk mengambil `status`, `quiz_attempted`, `video_last_position_seconds`, dan `video_watched_percent`.
   - Urutannya **`order_index`, lalu `id`** — aturan yang sama dengan `firstLessonSlugSql` S5-01. Fragmen itu sendiri adalah subquery yang memilih slug, jadi outline cukup `.orderBy(asc(lessons.orderIndex), asc(lessons.id))`. Materi posisi 1 di halaman ini harus selalu materi yang dituju "Mulai materi 1" di dasbor (ada tesnya).
   - Posisi "Materi n" = indeks 1..m dalam urutan ini, **bukan** nilai `order_index` (nilainya bisa bercelah).
   - Syarat `user_id` di `ON` wajib. Tanpanya, baris peserta lain ikut dan materi tampil ganda (dicek).
4. Materi tujuan = item outline dengan slug itu. Tidak ada → `NotFoundError`, termasuk slug materi milik kursus lain.
5. **Hanya bila keadaannya `open`**: `SELECT content FROM lessons WHERE id = …` sebagai statement terpisah. Isi materi tidak pernah dibaca untuk keadaan `locked` atau `not-enrolled`.

**Gerbang (fungsi murni di `policy.ts`, dites per baris):**
- `isLessonUnlocked(position, outline, isSequential)`: kursus tidak berurutan → selalu terbuka; posisi 1 → terbuka; selain itu terbuka **hanya bila** `quiz_attempted = true` pada materi posisi sebelumnya (§11.4 no. 7 — pendahulu langsung, bukan semua materi sebelumnya).
- `firstOpenUnattempted(outline, isSequential)`: posisi terkecil yang terbuka dan quiz-nya belum dikerjakan. Ini tujuan "Buka materi {k}" di panel terkunci. Bila tidak ada, `null`.
- Keadaan halaman:
  - tidak terdaftar → `not-enrolled`;
  - terdaftar tetapi terkunci → `locked`;
  - selain itu `open`.

**Status per item outline** (serializer, urutan prioritas):
1. `kini` — materi yang sedang dibuka;
2. `selesai` — `lesson_progress.status = 'COMPLETED'`;
3. `terkunci` — gerbang menutupnya;
4. `terbuka` — sisanya.

"Quiz belum dikerjakan" (PRG-10) dan nilai per materi belum dibangun (kartu quiz dan nilai).

**DTO** (`serializer.ts`, field eksplisit, union per keadaan):
```ts
type LessonOutlineItemDTO = {
  position: number;
  title: string;
  state: "kini" | "selesai" | "terbuka" | "terkunci";
  href: string | null;               // null untuk "terkunci"
};

type LessonCourseDTO = {
  slug: string;
  title: string;
  lessonCount: number;
  completedLessonCount: number;
};

type LessonPageDTO =
  | {
      state: "open";
      course: LessonCourseDTO;
      lesson: { id: string; title: string; position: number; content: unknown; hasVideo: boolean };
      progress: { videoLastPositionSeconds: number; videoWatchedPercent: number } | null;
      outline: LessonOutlineItemDTO[];
      prevHref: string | null;
      next: { kind: "link"; href: string } | { kind: "terkunci"; position: number } | null;
    }
  | {
      state: "locked";
      course: LessonCourseDTO;
      lesson: { title: string; position: number };
      unlock: { position: number; href: string } | null;
      outline: LessonOutlineItemDTO[];
    }
  | {
      state: "not-enrolled";
      course: { id: string; title: string };
      lesson: { title: string; position: number };
    };
```

Catatan bentuk DTO:
- `hasVideo` = `video_status = 'READY'`. Jum 13 mengganti atau melengkapinya dengan `PlaybackDTO`.
- `videoWatchedPercent` keluar dari driver sebagai string (`'50.00'`, kolom NUMERIC), lalu dijadikan `Number` di serializer.
- Keadaan `locked` dan `not-enrolled` tidak punya `content` maupun `progress`.
- Semua href dibangun dengan `lessonHref`.

### 2. `POST /api/progress/lessons/{lessonId}/open` — "materi dibuka"
1. **Route:** `requireApiRole("MEMBER", request)` lebih dulu. `lessonId` bukan UUID (`UUID_PATTERN`) → 404. Tanpa body. Jawab **204** tanpa isi. Pola error sama dengan route S5-01.
2. **Service `openLesson(actor, lessonId)`** — peran dicek, lalu satu transaksi:
   1. Materi dengan id itu beserta kursusnya, kursus harus `PUBLISHED`. Tidak ada → `NotFoundError`.
   2. Enrollment `actor` di kursus itu. Tidak ada → `NotFoundError`.
   3. Outline + gerbang dengan query dan fungsi yang **sama** dengan bagian 1 (executor `db`/`tx`, pola `selectOutlineRows`). Terkunci → `ConflictError` *(usulan)* "Materi ini masih terkunci."
   4. Upsert `lesson_progress` (bentuk ini sudah dicek):
      ```sql
      insert into lesson_progress (user_id, lesson_id, enrollment_id, status, first_accessed_at)
      values ($actor, $lesson, $enrollment, 'IN_PROGRESS', now())
      on conflict (user_id, lesson_id) do update set
        status = case when lesson_progress.status = 'NOT_STARTED'
                      then 'IN_PROGRESS'::progress_status
                      else lesson_progress.status end,
        first_accessed_at = coalesce(lesson_progress.first_accessed_at, excluded.first_accessed_at)
      ```
      Status `COMPLETED` tidak pernah turun, dan `first_accessed_at` tidak pernah ditimpa.
   5. `update enrollments set last_lesson_id = $lesson where id = $enrollment`. Drizzle ikut menulis `updated_at` lewat `$onUpdate` — **sengaja**, karena urutan "Kursus saya" dan PRG-02 "terakhir diakses" bergantung padanya.
   6. Tabel `courses` **tidak disentuh** (pelajaran S5-01: `updated_at` kursus menentukan urutan "Terakhir diubah" di CMS).
3. Klien: **`LessonOpenBeacon`** (`"use client"`, merender `null`) memanggil endpoint ini **sekali per `lessonId`** di `useEffect`. Penjaga `ref` dipakai supaya efek ganda StrictMode tidak mengirim dua kali. Kegagalan diabaikan diam-diam, karena membaca tidak boleh terhalang pencatatan. Beacon hanya dirender di keadaan `open`.

### 3. `POST /api/progress/video` — simpan posisi video (permanen, rencana video bagian 2)
1. **Route:** `requireApiRole("MEMBER", request)` → `readJsonBody(request, 4096)` → `videoProgressInput.parse` → service. Jawab `200 { data: { positionSeconds, watchedPercent } }`.
2. **`videoProgressInput`** (`src/modules/progress/schema.ts`, Zod, strict):
   - `lessonId` UUID;
   - `positionSeconds` bilangan bulat 0–86400;
   - `durationSeconds` bilangan bulat 1–86400;
   - `positionSeconds ≤ durationSeconds + 5`. Toleransi 5 detik untuk pembulatan mesin pemutar; di atas itu → 400 dengan path `positionSeconds`.
3. **Service `recordVideoProgress(actor, input)`** — peran dicek, lalu satu transaksi:
   - langkah 1–3 sama dengan `openLesson`, ditambah syarat `video_status = 'READY'`. Tidak terpenuhi → `ConflictError` *(usulan)* "Materi ini tidak punya video.";
   - persen = `min(100, round2(position / (lessons.video_duration_seconds ?? input.durationSeconds) × 100))`;
   - upsert seperti bagian 2, ditambah:
     - `video_last_position_seconds = excluded.video_last_position_seconds`;
     - `video_watched_percent = greatest(lesson_progress.video_watched_percent, excluded.video_watched_percent)` — monoton (dicek: 50 lalu 20 → tetap 50, posisi 20);
   - `last_lesson_id` diisi seperti bagian 2;
   - nilai yang dikembalikan adalah nilai **tersimpan** (`returning`), bukan nilai masukan.
4. Tanpa rate limit untuk demo. Kontrol Jum 13 memanggil tiap 10 detik, saat jeda, dan saat selesai. Endpoint ini tidak tahu sumber video.

### 4. Halaman `/belajar/{kursus}/{materi}`
**Letak:** `src/app/(learn)/belajar/[slug]/[materi]/page.tsx`. **Tanpa `loading.tsx`** di `belajar/[slug]/` maupun `belajar/[slug]/[materi]/` (keputusan 7; lihat catatan tinjauan). Layout `(learn)` tidak diubah.

**Halaman:**
- `requireRole("MEMBER")` (pertahanan berlapis), lalu `getLessonPage`.
- `NotFoundError` → `notFound()`. Galat lain dibiarkan naik.
- Lalu `<LessonPage data={…} />`.
- Tanpa `generateMetadata` (judul tab mengikuti bawaan; ditunda).

**`LessonPage`** (server component, `src/components/learn/`), di dalam `PageContainer`:

**A. Bar kursus** (`LessonCourseBar`, semua keadaan):
- Tautan "← Belajar" ke `/belajar`: ikon `ArrowLeft` + teks, tinggi ≥ 44, `text-sm font-semibold`.
- Judul kursus: `<p>` tebal 14,5 px, `wrap-anywhere`.
- Di keadaan `open` dan `locked`, di kanan: `ProgressBar` (lebar 176 px, `value` = materi selesai, `max` = jumlah materi, label *(usulan)* "Progress kursus {judul}", tone bawaan `success` seperti 7d), lalu meta mono *(usulan)* "{selesai}/{total} SELESAI".
- Di bawah 640: bar menumpuk, baris tautan + judul lalu baris progres.
- Garis bawah `border-border-soft`.
- Bar ini menggantikan header fokus 7d/7f/7t (keputusan 1). Posisi "n/m" di 7d/7f tidak diulang karena sudah ada di h1.

**B. Keadaan `open`** — 7d:
- Grid ≥ 1024: `lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8` (7d). Di bawah 1024 satu kolom.
- Kolom utama:
  - h1 "Materi {n} · {judul}" — `text-[22px] sm:text-[26px] font-black leading-[1.22] tracking-[-0.02em] wrap-anywhere`;
  - `RichContent` (`mt-4`);
  - **bar bawah** (`mt-8 border-t border-border-soft pt-5`, flex, `flex-wrap`, gap 12):
    - kiri: tautan bergaya tombol `secondary` "← Materi sebelumnya" bila ada;
    - kanan (`ml-auto`): tautan `secondary` "Materi berikutnya →" bila materi berikutnya terbuka;
    - bila materi berikutnya terkunci: teks *(usulan)* "Materi {n+1} terbuka setelah quiz materi ini dikerjakan." (`text-sm text-text-meta`);
    - materi terakhir: kosong (Final Quiz menyusul).
  - Tautan bergaya tombol memakai `cn(buttonVariants({ variant: "secondary" }), …)`.
- `LessonOpenBeacon lessonId`.
- **"Daftar materi"**:
  - ≥ 1024: kolom kanan `<nav aria-label="Daftar materi">`, kartu `bg-surface-2 border border-border rounded-card p-5`, judul `<h2>` 13 px tebal "Daftar materi".
  - < 1024: `<details>` setelah bar bawah, `<summary>` "Daftar materi" + mono *(usulan)* "{s} SELESAI · {t} TERKUNCI" (7t), tinggi summary ≥ 44.
  - Isinya satu komponen `LessonOutlineNav` yang dirender di dua tempat (`hidden lg:block` / `lg:hidden`).
  - Isi: `<ol>`, satu `<li>` per materi, baris `min-h-11 rounded-control border border-border-soft bg-surface px-3`:
    - ikon bulat 22 px: `selesai` = `bg-success` + `Check` putih; `kini` = cincin `border-2 border-primary` (bukan teks — boleh `primary`); `terbuka` = `bg-fill`; `terkunci` = `bg-fill` + `Lock` 12 px `text-text-meta`;
    - label "{n} · {judul}" (`text-[13.5px] font-semibold`, `wrap-anywhere`; `terkunci` dan `terbuka` memakai `text-text-muted`);
    - baris `kini`: `bg-primary-tint border-[1.5px] border-primary/30`, label tebal, label kanan *(usulan)* "kini" (`text-xs font-semibold text-primary-deep`), `aria-current="page"`;
    - `selesai`/`kini`/`terbuka` = `<Link>`; `terkunci` = teks biasa + `<span className="sr-only"> (terkunci)</span>`.
  - **Tidak dibangun:** baris "+ n materi · lalu Final Quiz", kotak "Nilai sementara", nilai per materi.

**C. Keadaan `locked`:**
- h1 "Materi {n} · {judul}" (judul materi memang terlihat di outline — CRS-03).
- `EmptyState`:
  - label *(usulan)* "MATERI {n} · TERKUNCI";
  - judul "Materi ini belum terbuka";
  - deskripsi "Kerjakan quiz materi {k} lebih dulu. Lulus atau tidak, materi berikutnya langsung terbuka.";
  - aksi utama "Buka materi {k}" → `unlock.href`; aksi lain "Kembali ke Belajar" → `/belajar`.
- Bila `unlock` null (tidak terjadi dengan data sah): aksi utama "Kembali ke Belajar", aksi lain "Ke Beranda" → `/`.
- "Daftar materi" seperti bagian B. Tanpa isi, tanpa beacon.

**D. Keadaan `not-enrolled`:**
- h1 "Materi {n} · {judul}".
- Kotak bergaris putus (`rounded-card border border-dashed border-border-dashed bg-surface-2 p-6`), isinya:
  - label mono *(usulan)* "KURSUS · BELUM DIIKUTI";
  - `<h2>` "Anda belum mengikuti kursus ini";
  - paragraf "Mulai kursus untuk membuka materi dan menyimpan progress Anda.";
  - `StartCourseButton` S5-01 (varian `primary`, "Mulai materi 1", `aria-describedby` ke h2);
  - tautan "Kembali ke Belajar".
- Tanpa outline, isi, maupun beacon.
- `StartCourseButton` membawa peserta ke `startHref`. Bila itu URL yang sedang dibuka, halaman harus berganti ke keadaan `open` — buktikan di e2e no. 5. Bila tidak berganti, laporkan sebelum menambah `router.refresh()`.

**Aksesibilitas:** satu h1 per keadaan. `<nav>` hanya ada di DOM yang terlihat per lebar (yang lain `hidden`, jadi keluar dari pohon aksesibilitas). Semua tautan bergaya tombol ≥ 44 px.

**Pelajaran tampilan S5-01:** elemen pil atau label pendek yang menjadi item grid ikut meregang selebar kolom (`justify-self` bawaan = stretch). Ikon bulat dan label "kini" di baris outline diberi ukuran tetap atau `justify-self-start`/`justify-self-end`. Tes jsdom tidak bisa menangkap ini — hanya screenshot.

### 5. Tes struktur
Perluas `src/lib/learn-route-structure.test.ts` (S5-01):
- `src/app/(learn)/belajar/[slug]/loading.tsx` dan `src/app/(learn)/belajar/[slug]/[materi]/loading.tsx` **tidak ada**;
- `src/app/(learn)/belajar/[slug]/[materi]/page.tsx` ada.

Komentar kepala menyebut hasil uji 11 Nov (bagian catatan tinjauan).

## Bukan lingkup tugas ini
- **Jum 13 (S2-02):**
  - pemutar video (`LessonVideoPlayer`, kontrol 29a, mesin YouTube);
  - migrasi kolom sumber video, `PlaybackDTO`, CSP, skrip pasang video;
  - slot video di atas h1 dan pesan "Melanjutkan dari …".
- **Sab 14 – Min 15 (quiz):**
  - tombol "Tandai selesai & mulai quiz" dan dialog konfirmasinya;
  - halaman quiz;
  - pengisian `quiz_attempted` dan status `COMPLETED`;
  - status outline "Quiz belum dikerjakan".
- **Sen 16 dan setelah demo:**
  - nilai per materi, kotak "Nilai sementara", baris Final Quiz di outline;
  - tab Ringkasan/Rujukan;
  - header fokus 7d/7f/7t dan bottom nav Materi/Quiz/Progress (D-07);
  - halaman progres kursus `/belajar/{slug}` (8c);
  - halaman 404 berdesain (14a);
  - preview gratis tamu (S6);
  - rate limit progres video;
  - judul tab per materi;
  - ulangi kursus.
- **Tidak diubah:** `src/app/(learn)/layout.tsx`, `src/app/(learn)/belajar/(dashboard)/*`, `src/lib/rbac.ts`, `src/proxy.ts`, `next.config.ts`, skema DB. Tanpa migrasi.

Pekerjaan di luar lingkup → **berhenti dan tanyakan.**

## Berkas yang boleh dibuat/diubah
- `src/modules/progress/schema.ts` (baru) + `schema.test.ts`
- `src/modules/progress/{policy,queries,serializer,service}.ts` (diperluas) + `policy.test.ts` (baru), `serializer.test.ts`, `lesson-page.integration.test.ts` (baru)
- `src/app/api/progress/lessons/[lessonId]/open/route.ts` (baru)
- `src/app/api/progress/video/route.ts` (baru)
- `src/app/(learn)/belajar/[slug]/[materi]/page.tsx` (baru)
- `src/components/learn/{lesson-page,lesson-course-bar,lesson-outline-nav,lesson-open-beacon,lesson-not-enrolled}.tsx` + tes masing-masing (baru); hapus `src/components/learn/.gitkeep` bila masih ada
- `src/lib/learn-route-structure.test.ts`
- `e2e/belajar-materi.spec.ts` (baru); `e2e/layout/helpers.ts` (opsi jumlah materi pada helper kursus + helper pembersih bersama); `e2e/belajar-dasbor.spec.ts` (hanya mengganti pembersihan `afterAll` yang tertulis langsung dengan helper bersama); `e2e/layout/{axe,touch-targets,no-horizontal-scroll}.spec.ts`

Tanpa migrasi, tanpa dependensi baru, dan tanpa perubahan `package.json`/`package-lock.json`.

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- hash basis branch (= `main` terbaru, minimal `acdad2c` + PR docs kartu ini) dan baseline Vitest **yang diukur** di basis itu (`npm test`), bukan disalin. Claude chat mengukur **107 berkas / 1138 tes** di `acdad2c`; bila angkamu berbeda, berhenti dan laporkan;
- nama ekspor S5-01 yang benar-benar ada di `main` (fragmen materi pertama, `lessonHref`, helper e2e) dan cara kartu ini memakainya;
- SQL ketiga query `getLessonPage` dan SQL kedua upsert, dengan nama tabel luar ditulis tangan di setiap fragmen `sql` (pelajaran 10 Nov no. 1);
- signature setiap ekspor baru dan bentuk DTO;
- struktur DOM keadaan `open` (bar kursus, h1, bar bawah, kedua tempat "Daftar materi"), `locked`, dan `not-enrolled`;
- kelas responsif per lebar: 360, 640, 768, 1024, 1280;
- daftar tes lama yang berubah, satu per satu;
- daftar tes per butir "Selesai jika";
- tabel mutasi: setiap baris jelas merah atau hijau beserta alasannya, tanpa baris ragu.

## Selesai jika
- [ ] **Tes `policy`** (node) — tabel gerbang:
  - kursus tidak berurutan → semua terbuka;
  - berurutan: posisi 1 terbuka; posisi 2 terkunci sampai `quiz_attempted` posisi 1;
  - posisi 3 hanya bergantung pada posisi 2 (pendahulu langsung);
  - `firstOpenUnattempted` untuk outline 3 materi dengan 0, 1, 2, dan 3 quiz dikerjakan.
- [ ] **Tes `serializer`**:
  - prioritas status `kini` > `selesai` > `terkunci` > `terbuka`;
  - href `null` hanya untuk `terkunci`;
  - persen string → angka;
  - keadaan `locked`/`not-enrolled` tanpa `content` dan `progress` (`"content" in …` → false);
  - `next` tiga bentuk; `prevHref` null di posisi 1.
- [ ] **Tes `schema`**: 0 dan 86400 sah; −1, 86401, 1,5, dan string ditolak; `position = duration + 5` sah, `+ 6` ditolak dengan path `positionSeconds`; `lessonId` bukan UUID ditolak; field liar ditolak (strict).
- [ ] **Tes integrasi** (PGlite, `vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 })`):
  - **404:** slug kursus tak dikenal; kursus DRAFT, IN_REVIEW, ARCHIVED; slug materi tak dikenal; slug materi milik kursus lain.
  - **`not-enrolled`:** tanpa isi.
  - **Berurutan:**
    - materi 2 → `locked` dengan `unlock.position = 1`;
    - setelah `quiz_attempted = true` pada materi 1 (SQL) → `open`;
    - materi 3 terbuka **hanya** bila materi 2 dikerjakan.
  - **Tidak berurutan:** semua `open`.
  - **Posisi:** `order_index` 30/10/20 disisipkan tidak berurutan → posisi 1/2/3 sesuai urutan `order_index`.
  - **Konsisten dengan dasbor:** untuk kursus yang sama, materi posisi 1 dari `getLessonPage` = materi yang dituju `startHref` `getLearnerDashboard` (termasuk saat dua materi berbagi `order_index` yang sama — pemecah seri `id`).
  - **Progres peserta lain tidak tercampur:** dua peserta, peserta B `COMPLETED` di materi 1 → outline peserta A tanpa `selesai` dan tanpa baris ganda.
  - **`openLesson`:**
    - pertama → satu baris `IN_PROGRESS`, `first_accessed_at` terisi, `last_lesson_id` = materi, `enrollments.updated_at` naik, `courses.updated_at` **tetap**;
    - kedua → `first_accessed_at` sama, tetap satu baris;
    - baris `COMPLETED` tidak turun;
    - terkunci → `ConflictError` tanpa baris;
    - tidak terdaftar, atau terdaftar di kursus lain → `NotFoundError`.
  - **`recordVideoProgress`:**
    - 50% lalu 20% → persen tetap 50, posisi 20;
    - memakai `video_duration_seconds` bila terisi; dibatasi 100;
    - `video_status ≠ READY` → `ConflictError`; terkunci → `ConflictError`;
    - nilai kembali = nilai tersimpan.
- [ ] **Tes komponen** (jsdom):
  - `LessonPage` ketiga keadaan; satu h1 di masing-masing.
  - Bar bawah: tiga bentuk `next`.
  - `LessonOutlineNav`: `aria-current="page"` hanya di `kini`; `terkunci` bukan tautan dan punya teks sr-only.
  - Summary `<details>` memuat hitungan.
  - `LessonOpenBeacon`: tepat satu POST ke path yang benar, juga setelah render ulang dan efek ganda (`<StrictMode>`); `lessonId` berganti → satu POST baru; galat tidak dilempar.
- [ ] **Tes struktur** (bagian 5).
- [ ] **E2E** `e2e/belajar-materi.spec.ts` (proyek `chromium`; lebar lain lewat `page.setViewportSize`).
  - Kursus dibuat per tes lewat helper S5-01 dengan judul bertoken. `createPublishableCourseViaApi` dan `createPublishedCourseViaApi` mendapat argumen opsional `{ lessons?: number }` (bawaan 1, jadi pemanggil lama tidak berubah). Setiap materi `"{judul} materi {n}"` berisi paragraf netral bertoken + 10 soal PG, supaya lolos gerbang terbit. Nilai kembali ditambah `lessons: { id, slug, quizId }[]` berurutan; field lama tetap.
  - Akun EDITOR/ADMIN dibuat sekali per berkas (`createEditorAdminContexts` di `beforeAll`).
  - **Pembersihan wajib.** `belajar-materi.spec.ts` berjalan alfabetis sebelum `cms-kursus.spec.ts`, yang mengasersi daftar kursus global kosong (sama seperti `belajar-dasbor`). Pindahkan pembersihan `afterAll` `belajar-dasbor.spec.ts` ke helper bersama `deleteCoursesInE2eDb(courseIds)` di `e2e/layout/helpers.ts`, dipakai kedua spec. Helper itu juga menghapus quiz materi beserta soal dan opsinya (kini tertinggal sebagai baris yatim; komentar lama "tidak ada quiz materi" keliru) serta baris `lesson_progress`.
  - Setiap tes menunggu isi halaman (h1 atau teks bertoken) sebelum mengukur atau memotret (pelajaran 11 Nov: tes yang mengukur halaman kosong lulus tanpa memeriksa apa pun).
  - Hanya kursus milik tes yang diasersi (data bersama — pelajaran 9 Nov no. 9).

  1. MEMBER mendaftar lewat API → buka materi 1 → h1 "Materi 1 · …" dan teks isi bertoken terlihat. `waitForResponse` POST `/open` = 204. DB: satu baris `IN_PROGRESS`, `first_accessed_at` terisi, `last_lesson_id` = materi 1.
  2. `page.goto("/belajar")` → baris "Kursus saya" kursus itu: badge "Sedang berjalan" dan tautan "Lanjutkan" ke materi 1.
  3. **GET tanpa efek tulis:** MEMBER baru, daftar lewat API, lalu `page.context().request.get(url materi 1)` → 200 dan HTML memuat judul materi. DB: **tidak ada** baris `lesson_progress`, `last_lesson_id` NULL. Lalu buka `/belajar` (tautan materi terlihat, prefetch berjalan), jeda tetap ±1 s → DB tetap sama.
  4. **Gerbang**, kursus 2 materi:
     - materi 2 → panel "Materi ini belum terbuka" dengan "Buka materi 1" ke href materi 1;
     - teks isi bertoken materi 2 **tidak ada** di HTML (`request.get` + pencarian teks);
     - `POST /open` materi 2 → 409;
     - SQL `quiz_attempted = true` di materi 1 → muat ulang → isi materi 2 terlihat;
     - materi 1 kini menampilkan "Materi berikutnya →".
  5. **Belum terdaftar:** MEMBER membuka URL materi 1 → panel "Anda belum mengikuti kursus ini", tanpa teks isi. Klik "Mulai materi 1" → halaman berganti ke keadaan `open` dengan isi. DB: satu baris `enrollments`.
  6. **Status HTTP 404** (`response.status()`): slug kursus tak dikenal, slug materi tak dikenal, slug materi milik kursus lain, kursus DRAFT bertoken.
  7. **API:**
     - `/open`: tamu → 401; tamu + id bukan UUID → 401 (peran sebelum id); MEMBER + id bukan UUID → 404.
     - `/video`: tamu → 401; tidak terdaftar → 404; `video_status` bukan READY → 409; body tak sah → 400.
     - `/video` setelah `video_status = 'READY'` + durasi 100 (SQL): 50 → 200 dan DB 50/50; lalu 20 → persen tetap 50, posisi 20; materi terkunci → 409.
  8. **Lebar:** kursus berjudul `noSpaceTitle(…).slice(0, 70)` → tanpa gulir samping (`expectNoHorizontalScroll`) di 360, 640, 1024, dan 1280, untuk keadaan `open` dan `locked`, dengan `<details>` terbuka di bawah 1024.
- [ ] **axe** (`axe.spec.ts`, w360 dan w1280): keadaan `open` (w360 dengan `<details>` terbuka), `locked`, dan `not-enrolled`. Tes membuat kursusnya sendiri.
- [ ] **Target sentuh** (`touch-targets.spec.ts`, w360): "← Belajar", "← Materi sebelumnya", "Materi berikutnya →", summary "Daftar materi", satu tautan materi di dalam `<details>`.
- [ ] **Uji mutasi** — commit lokal dulu dan `git status` bersih sebelum mutasi pertama; kembalikan setiap mutasi dengan `git restore`. Laporkan per mutasi nama tes yang merah beserta pesannya. Mutasi yang hanya tertangkap E2E dijalankan dengan `npx playwright test --grep …` sungguhan.
  1. Filter `PUBLISHED` dihapus dari query kursus `getLessonPage`.
  2. Cek enrollment dihapus (keadaan `not-enrolled` tidak pernah terjadi).
  3. Gerbang selalu terbuka.
  4. Gerbang memeriksa materi posisi 1, bukan pendahulu langsung.
  5. Isi materi ikut dibaca dan diserialisasi di keadaan `locked`.
  6. `user_id` dihapus dari `ON` join outline.
  7. Halaman memanggil `openLesson` saat render (GET menulis).
  8. Penjaga `ref` beacon dihapus.
  9. `first_accessed_at` ditimpa setiap kali dibuka.
  10. `greatest(...)` diganti nilai baru (persen tidak monoton).
  11. Batas `position ≤ duration + 5` dihapus.
  12. Cek gerbang dihapus dari `recordVideoProgress`.
  13. `loading.tsx` ditambahkan di `belajar/[slug]/[materi]/`.
  14. Syarat materi milik kursus itu dihapus (materi kursus lain bisa dibuka lewat slug).
  15. Posisi memakai nilai `order_index` mentah.

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`. `main` memuat S5-01.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR. Harapan 0 excused / 0 blocking / OK. Angka di bawah high dicatat apa adanya beserta daftar paketnya. Temuan high/critical baru → berhenti dan tempel output lengkapnya.
- **Build dan rute:** `npm run build` mencantumkan `/belajar/[slug]/[materi]` sebagai ƒ. Lalu `npm run start`, buka materi sebagai MEMBER (ketiga keadaan). `curl -s -o /dev/null -w "%{http_code}"`:
  - `POST /api/progress/video` tanpa sesi → 401;
  - `POST /api/progress/lessons/bukan-uuid/open` tanpa sesi → 401;
  - `GET /belajar/x/y` tanpa sesi → 307 (proxy ke `/masuk`).
- **Prettier:** berkas yang sudah ada tetap apa adanya. Berkas baru boleh dirapikan.
- **`npm run check` di commit akhir:** tempel 5 baris terakhir output di PR. `check` sudah memuat `lint:hex` (pelajaran 11 Nov).
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas.
- **"Keputusan & asumsi" di PR** memuat:
  - keputusan pemilik 1–7 dan semua copy usulan;
  - penyimpangan dari 7d/7t/7f: bar kursus pengganti header fokus; tanpa tab Ringkasan/Rujukan, kotak "Nilai sementara", baris Final Quiz, nilai per materi; sidebar sebagai kartu, bukan panel setinggi halaman;
  - keputusan yang diambil tanpa bertanya.
- **Screenshot**, diambil lokal dengan `E2E_SCREENSHOT_DIR` (konvensi A-19b), `animations: "disabled"`:
  - keadaan `open` di 360, 640, 768, 1024, 1280 (di bawah 1024 dengan `<details>` tertutup dan terbuka);
  - `locked` dan `not-enrolled` di 360 dan 1280.
- **Setelah push:** cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya beserta durasi job e2e dibanding `main`.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`
- Baseline Vitest = angka yang diukur di basis sesi. PR melaporkan baseline + jumlah tes baru; tes lama yang berubah disebut satu per satu.
- `git diff --stat main -- package.json package-lock.json src/db/migrations src/db/schema 'src/app/(learn)/layout.tsx' 'src/app/(learn)/belajar/(dashboard)' src/lib/rbac.ts src/proxy.ts next.config.ts` kosong.

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Lokal: Docker menyala, lalu jalankan:
  ```bash
  cd ~/Project/React/binzi-new && npm run dev:db && npm run db:seed:demo
  ```
  Bila "[DEMO] Kursus contoh 3" belum terbit di DB lokal, terbitkan lewat langkah 1–4 "Verifikasi oleh kamu" kartu S1-08. Lalu `npm run dev`, dan daftar akun MEMBER baru di jendela privat.
  1. `/belajar` → "Mulai materi 1" → "Materi 1 · …" dengan teks "[DEMO] …". "Daftar materi": materi 1 "kini", materi 2 dan 3 terkunci.
  2. Klik "← Belajar" → baris "Kursus saya": "Sedang berjalan" dan "Lanjutkan".
  3. Ubah URL ke materi 2 (`…/demo-materi-2`) → panel "Materi ini belum terbuka" dengan "Buka materi 1".
  4. `npm run db:studio` → tabel `lesson_progress`, baris milik akun ini di materi 1 → `quiz_attempted` = true → simpan. Muat ulang materi 2 → isinya tampil. Di materi 1 muncul "Materi berikutnya →".
  5. Jendela privat lain dengan MEMBER baru yang belum mendaftar: buka URL materi 1 langsung → panel "Anda belum mengikuti kursus ini" → "Mulai materi 1" → isi materi tampil.
  6. HP atau DevTools 360 px: bar kursus menumpuk, "Daftar materi" bisa dibuka-tutup, tanpa gulir samping.
- [ ] Unggah folder screenshot ke Claude chat untuk dibandingkan dengan 7d, 7t, dan 7f.
- [ ] **Pasca-merge:** tanpa migrasi. Di Production halaman materi baru bisa dicoba setelah ada kursus terbit di binzi-dev (gladi resik).

## Catatan jadwal
- Kartu ini masuk `main` lewat PR docs 11 Nov bersama STATUS 11 Nov, setelah S5-01 merge (aturan STATUS: docs hanya di antara PR). Sesi dimulai Kamis 12 Nov dari `main` yang memuat PR docs itu.
- **Bila terlambat**, yang dipotong lebih dulu:
  1. `<details>` di bawah 1024 (daftar materi hanya di kolom kanan ≥ 1024);
  2. hitungan di summary;
  3. teks catatan "Materi {n+1} terbuka setelah…".

  Modul `progress`, gerbang, kedua endpoint, ketiga keadaan halaman, dan tes "GET tanpa efek tulis" tidak dipotong.

## Catatan keputusan
- **GET tanpa efek tulis.** `<Link>` di dasbor memuat halaman tujuan lebih dulu (prefetch). Pencatatan saat GET akan menandai materi "dibuka" hanya karena tautannya terlihat. Karena itu pencatatan lewat POST dari efek klien, yang tidak pernah berjalan saat prefetch. E2E no. 3 membuktikannya dengan `request.get` (tanpa JavaScript), bukan hanya dengan prefetch.
- **Isi materi tidak dibaca untuk keadaan terkunci** (statement terpisah, hanya di keadaan `open`), bukan hanya disembunyikan di serializer. V-06: "harus ditolak server".
- **409 untuk materi terkunci di API**, sesuai tabel `src/modules/README.md` ("pelanggaran state"). Halaman menjawab 200 dengan panel karena judul materi memang publik di outline (CRS-03).
- **Pendahulu langsung** (§11.4 no. 7), bukan "semua materi sebelumnya". Panel terkunci tetap menunjuk materi terbuka pertama yang quiz-nya belum dikerjakan, supaya peserta yang melompat ke materi 5 diarahkan ke langkah yang benar.
- **Persen tonton = posisi terjauh.** Peserta yang menggeser video ke akhir mendapat 100%. Diterima untuk demo. Penutupnya (pelacakan segmen yang benar-benar ditonton) dicatat untuk setelah demo, sebelum gerbang "video ≥ 90%" dipakai peserta nyata.
- **`enrollments.updated_at` naik setiap kali materi dibuka; `courses.updated_at` tidak pernah.**
- **Tanpa `loading.tsx`.** Rute materi butuh 404 dan 307 yang benar. Setelah region fungsi dipindah ke sin1, jeda navigasi diperkirakan ratusan milidetik. Skeleton materi bisa ditambahkan nanti di dalam halaman (`<Suspense>` setelah gerbang), bukan lewat `loading.tsx`.

## Catatan untuk kartu Jum 13 (pemutar video, S2-02)
- Slot pemutar ada di keadaan `open`, di atas h1. `hasVideo` dan `progress.videoLastPositionSeconds`/`videoWatchedPercent` sudah ada di DTO untuk "Melanjutkan dari mm:ss".
- `POST /api/progress/video` sudah ada dan mewajibkan `video_status = 'READY'`. Skrip pasang video mengisi `READY` dan `video_duration_seconds`; persen dihitung terhadap durasi itu.
- Migrasi kolom sumber video (`video_provider`, `video_external_id`) tidak memengaruhi endpoint ini.
- Kontrol memanggil endpoint tiap 10 detik, saat jeda, dan saat selesai (posisi = durasi → 100%).

## Catatan untuk kartu quiz (Sab 14 – Min 15)
- Slot kanan bar bawah menjadi tombol "Tandai selesai & mulai quiz" (7d), aktif bila video ≥ 90% atau materi tanpa video (§6.2, §7.4 B). "Materi berikutnya →" tetap untuk materi yang sudah terbuka.
- Transaksi submit quiz mengisi `quiz_attempted = true`, dan `status = 'COMPLETED'` bila definisi "Materi Selesai" §6.2 terpenuhi. Gerbang kartu ini sudah membaca `quiz_attempted`, jadi materi berikutnya terbuka tanpa perubahan di sini.
- Rute quiz `/belajar/[slug]/[materi]/quiz` berada di bawah folder `[materi]`. `loading.tsx` di `[materi]` akan ikut membungkusnya — tes struktur kartu ini sudah melarangnya.
- Status outline "Quiz belum dikerjakan" (PRG-10) ditambahkan di serializer outline.

## Catatan tinjauan 11 Nov
| Klaim | Cara dicek | Hasil |
|---|---|---|
| `loading.tsx` di folder halaman materi itu sendiri | Aplikasi Next 16.4.1 minimal (versi repo), layout dan halaman memanggil `headers()`, `next build` + `next start` + `curl` ke `/belajar/k/{ada,tidak-ada,pindah}` | Dengan `belajar/[slug]/[materi]/loading.jsx`: **200 / 200 / 200**. Tanpa: **200 / 404 / 307** |
| Upsert "materi dibuka" | PGlite + `0000_initial_schema.sql`, `onConflictDoUpdate` drizzle | Panggilan kedua: `first_accessed_at` sama, tetap satu baris; baris `COMPLETED` tetap `COMPLETED`. Drizzle ikut menulis `updated_at` di cabang konflik ($onUpdate) |
| Persen tonton monoton | `greatest(video_watched_percent, $1::numeric)` | 50 lalu 20 → `'50.00'` (string), posisi 20 |
| `last_lesson_id` menaikkan `updated_at` enrollment | `toSQL()` | `update "enrollments" set "last_lesson_id" = $1, "updated_at" = $2 …` — diinginkan |
| Outline per peserta | `LEFT JOIN … ON lesson_id AND user_id`, dua peserta | Benar: 3 baris. Tanpa `user_id`: 4 baris (materi 1 ganda) — mutasi 6 tertangkap dengan data dua peserta |
| Urutan dan posisi | `order_index` 30/10/20 disisipkan tidak berurutan, urut `order_index, id` | m10, m20, m30 |
| Baseline Vitest `e56e597` | `npx vitest run` di sandbox | 101 berkas / 1092 tes (sebelum S5-01) |
| Baseline Vitest `acdad2c` | `npm run check` di sandbox pada `c8eaa5c` (pohonnya identik dengan `acdad2c`, `git diff` kosong) | 107 berkas / 1138 tes, `lint:hex` bersih |
| Ekspor S5-01 yang dipakai kartu ini | `grep export src/modules/progress/*.ts`, `e2e/layout/helpers.ts`, `src/lib/learn-route-structure.test.ts` di `acdad2c` | `assertMemberRole`, `firstLessonSlugSql`, `lessonHref` (lewat service), `createEditorAdminContexts`, `createPublishableCourseViaApi(context, title)`, `createPublishedCourseViaApi(editor, admin, title)` ada. Tes struktur `learn-route-structure.test.ts` ada dan siap diperluas. Isi materi helper = `"Isi materi netral {judul} untuk tes e2e."` (bertoken) |
| Token dan komponen | `tokens.css`, `progress-bar.tsx`, `empty-state.tsx`, `request-body.ts` | `border-soft`, `success`, `primary-tint`, `fill`, `text-meta`, `border-dashed`, `surface-2` ada. `ProgressBar` tone bawaan `success` (= 7d). `EmptyState` mewajibkan dua aksi. `readJsonBody(request, maxBytes)` |
| Data demo | `src/db/seed-demo.ts` | Kursus contoh 3: tiga materi `demo-materi-1…3`, `is_sequential` bawaan true |

Yang **belum** dicek dari sandbox: tampilan di Chromium (butuh login + DB) dan perilaku `router.push` ke URL yang sama setelah pendaftaran (e2e no. 5).

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
