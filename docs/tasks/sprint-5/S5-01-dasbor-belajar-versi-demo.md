# S5-01 · Dasbor belajar versi demo: kursus terbit + mulai kursus

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | S1-08 (di-merge #129, `1898ab6`: kursus bisa terbit, endpoint kirim & terbitkan, helper e2e kursus lengkap), S6-01 (`ComingSoon`), A-14b (layout area belajar) — semuanya sudah di `main` |
| **Target** | Rabu 11 Nov. Langkah kedelapan jalur demo 20 Nov |
| **Branch** | `s5/s5-01-dasbor-belajar` |

> **Dibuat 10 Nov 2026** di Claude chat terhadap `main` `5b546ab`, lalu **ditinjau ulang terhadap `1898ab6`** (setelah S1-08 merge): helper e2e `createPublishableCourseViaApi`, kursus contoh 3 di seed demo (peninjau terisi), pola `quizQuestionCountSql` yang sudah diperbaiki di `lesson/queries.ts`, dan gate audit 0 excused / 0 blocking / OK / 23 di sandbox — semuanya cocok. Klaim teknis di kartu ini dijalankan dulu di sandbox (Next 16.4.1 minimal, Postgres 16 dengan migrasi repo, drizzle-orm 0.45.3); buktinya di "Catatan tinjauan 10 Nov" paling bawah.
>
> **Keputusan pemilik 10 Nov** (dicantumkan di "Keputusan & asumsi" PR sebagai keputusan yang sudah disetujui, bersama semua copy bertanda *(usulan)*):
>
> 1. **Pendaftaran tersirat lewat "Mulai materi 1"**, tanpa tombol "Ikut kursus" (desain 28a/28b/13b, PRD §7.4 A). Selalu lewat `POST`, tidak pernah saat halaman dibuka. Idempoten: 201 bila baru, 200 bila sudah terdaftar. Hanya kursus `PUBLISHED`. Setelah berhasil, peserta dibawa ke materi pertama (halamannya dibangun Kam 12).
> 2. **Dasbor versi demo:** peserta baru mengikuti 28a/28b tanpa pil "Paling banyak diikuti" dan tanpa "Lihat semua kursus"; peserta aktif hanya mendapat baris "Kursus saya" dari 8a; "Kursus lainnya" tampil di kedua keadaan dengan tombol mulai di setiap baris.
> 3. **Skeleton:** `loading.tsx` di route group `(dashboard)`, dengan jeda 300 ms komponen Skeleton.
> 4. **Halaman legal "Segera hadir":** Kebijakan Privasi, Syarat & Ketentuan, Disclaimer medis — supaya tautan footer tidak 404 saat demo.
> 5. **Badge dan tombol:** badge memetakan keempat status PRG-06; tombol menjadi "Lanjutkan" begitu `last_lesson_id` terisi (diisi Kam 12).
> 6. **`cache()` untuk sesi dan profil ditunda ke setelah demo** (STATUS 9 Nov rencana C dibatalkan setelah pengukuran 10 Nov; lihat "Catatan keputusan").

## Tujuan
Peserta yang masuk melihat kursus yang sudah terbit di `/belajar`, bisa memulai salah satunya dengan satu klik (pendaftaran gratis, CRS-11), dan melihat kursus yang diikutinya. Kartu Kam 12 membangun halaman materi yang dituju tombol itu. Selain itu: skeleton saat `/belajar` dimuat, dan tiga halaman legal "Segera hadir".

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD: `docs/prd/sections/06-2-kursus-materi.md` (CRS-11), `06-4-progress-nilai-saya-menggantikan-sertifi.md` (PRG-06), `07-navigasi-information-architecture.md` (§7.4 A), `11-model-data.md` (§11.2 `enrollments` dan `lesson_progress`, §11.4), `12-keamanan.md` (cek akses materi).
- Desain (`docs/design/screens/`):
  - `28a.md` + `.png` + `.html`: peserta baru, 1280 (struktur, copy, ukuran);
  - `28b.md` + `.png`: peserta baru, 360;
  - `8a.md` + `.png` + `.html`: peserta aktif — **hanya** bagian "Kursus saya";
  - `28d.md`: pola skeleton;
  - `12c.md`, `12d.md`, `12e.md`: judul halaman legal saja.
- Kode:
  - `src/app/(learn)/layout.tsx`, `src/app/(learn)/belajar/page.tsx`;
  - `src/components/shared/{member-user,page-container}.ts(x)`;
  - `src/components/ui/{button,button-variants,badge-status,progress-bar,empty-state,skeleton}.ts(x)`;
  - `src/components/public/coming-soon.tsx`, `src/app/(public)/tentang/page.tsx` (pola "Segera hadir"), `src/components/shared/site-footer.tsx`;
  - `src/modules/README.md`; `src/modules/lesson/queries.ts` (membaca tabel `courses` langsung tanpa mengimpor modul course; subquery hitungan `quizQuestionCountSql`); `src/modules/course/schema.ts` (`COURSE_LEVEL_LABELS`, `UUID_PATTERN`);
  - `src/app/api/cms/courses/[id]/route.ts` (pola route), `src/lib/rbac.ts` (`requireRole`, `requireApiRole`, `roleAtLeast`), `src/lib/errors.ts`;
  - `src/db/schema/progress.ts`, `src/db/schema/course.ts`;
  - `src/components/cms/lesson-outline.tsx` (pola `style={{ backgroundImage: "var(--video-bg)" }}`);
  - `src/modules/course/service.integration.test.ts` (harness PGlite), `src/lib/module-boundary.test.ts` (pola tes yang membaca berkas).
- E2E: `e2e/fixtures.ts`, `e2e/layout/helpers.ts`, `e2e/beranda.spec.ts` (tes "halaman segera hadir"), `e2e/layout/{axe,touch-targets,keyboard,no-horizontal-scroll}.spec.ts`, `e2e/cms-terbit.spec.ts` (S1-08: kursus terbit lewat API).

## Kerjakan

### 1. Modul `progress`: data dasbor dan pendaftaran
Modul baru di `src/modules/progress/` (folder sudah ada dengan `.gitkeep`; hapus `.gitkeep`). Pola `src/modules/README.md`: policy → queries → serializer → service. Modul ini membaca tabel `courses`, `lessons`, `enrollments`, dan `lesson_progress` di queries-nya sendiri dan **tidak mengimpor** modul course atau lesson (pola `lesson/queries.ts`), kecuali `COURSE_LEVEL_LABELS` dan `UUID_PATTERN` dari `@/modules/course/schema` (berkas skema boleh diimpor dari luar modulnya). Kam 12 akan memperluas modul ini (`POST /api/progress/video`).

**`getLearnerDashboard(actor)`** — peran dicek lebih dulu (`roleAtLeast(actor.role, "MEMBER")`, gagal → 403). Dua daftar, masing-masing satu SELECT tanpa N+1 (subquery berkorelasi, pola `quizQuestionCountSql`):
- **`enrolled`**: baris `enrollments` milik `actor.id` yang kursusnya `PUBLISHED`, urut `enrollments.updated_at` turun lalu `courses.id` (indeks `enrollments_user_updated_idx`). Per baris: id, slug, judul, level, status enrollment, jumlah materi, jumlah baris `lesson_progress` berstatus `COMPLETED` milik enrollment itu, slug materi pertama (`order_index` terkecil), dan slug materi `last_lesson_id` (boleh NULL).
- **`available`**: kursus `PUBLISHED` yang **belum** diikuti `actor.id` dan punya minimal satu materi, urut `published_at` turun lalu `courses.id`. Per baris: id, slug, judul, level, ringkasan, `estimated_minutes`, jumlah materi, slug materi pertama.

Kolom `courses.description` dan `lessons.content` (TipTap) tidak pernah dipilih.

**Referensi tabel luar di subquery wajib ditulis eksplisit** (temuan PR #129): drizzle 0.45.3 merender kolom yang disisipkan ke template `sql` **tanpa nama tabel** bila SELECT-nya tabel tunggal (tanpa join). `${lessons.courseId} = ${courses.id}` di dalam SELECT `from(courses)` menjadi `"course_id" = "id"`, dan Postgres mengikat kedua sisi ke tabel milik subquery — hitungannya salah tanpa galat. `available` (dari `courses`) kemungkinan besar tabel tunggal; `enrolled` punya join hari ini, tetapi bisa kehilangan join-nya kelak. Jadi tulis eksplisit di **kedua** SELECT, ada join atau tidak. Pakai pola `quizQuestionCountSql` di `lesson/queries.ts` setelah S1-08: alias untuk tabel subquery dan nama tabel luar ditulis tangan (`counted.quiz_id = lessons.quiz_id`).

DTO (`serializer.ts`, field eksplisit):
```ts
type LearnerCourseDTO = {
  id: string;
  slug: string;
  title: string;
  levelLabel: string;              // COURSE_LEVEL_LABELS
  summary: string | null;
  estimatedMinutes: number | null;
  lessonCount: number;
  startHref: string;               // lessonHref(slug kursus, slug materi pertama)
};

type EnrolledCourseDTO = {
  id: string;
  slug: string;
  title: string;
  levelLabel: string;
  lessonCount: number;
  completedLessonCount: number;
  badge: "belum-dimulai" | "sedang-berjalan" | "selesai" | "lulus";
  action: { kind: "mulai" | "lanjutkan"; href: string };
};

type LearnerDashboardDTO = {
  enrolled: EnrolledCourseDTO[];
  available: LearnerCourseDTO[];
};
```

Aturan serializer (satu tempat, dites per baris):
- `badge`: status `PASSED` → `lulus`; `COMPLETED` → `selesai`; selain itu, `last_lesson_id` NULL **dan** 0 materi selesai → `belum-dimulai`; sisanya `sedang-berjalan` (PRG-06; "Lulus" menggantikan "Selesai", 16c).
- `action`: `last_lesson_id` terisi → `lanjutkan` ke materi itu; selain itu `mulai` ke materi pertama.
- Href dibangun oleh satu fungsi yang diekspor lewat service, `lessonHref(courseSlug, lessonSlug)` → `/belajar/{courseSlug}/{lessonSlug}`. Kam 12 memakai fungsi yang sama.

**`enrollInCourse(actor, courseId)`** — `POST /api/progress/courses/{courseId}/enroll`:
1. **Route:** `requireApiRole("MEMBER", request)`; `courseId` bukan UUID (`UUID_PATTERN`) → 404. Tanpa body. Pola error sama dengan route PATCH kursus: galat domain (< 500, `ZodError`) tidak di-log, sisanya di-log lalu `toErrorResponse()`.
2. **Service:** peran dicek (403), lalu satu transaksi:
   1. baca kursus `PUBLISHED` dengan id itu beserta slug materi pertama. Tidak ada — id tidak dikenal, DRAFT, IN_REVIEW, ARCHIVED, atau tanpa materi — → 404 *(usulan)* "Kursus tidak ditemukan.", sama untuk semua alasan, sehingga keberadaan draf tidak terbocor;
   2. `insert into enrollments (user_id, course_id) … on conflict on constraint enrollments_user_course_unique do nothing returning id`;
   3. hanya bila ada baris baru: `update courses set enrollment_count = enrollment_count + 1 where id = …` (atomik di SQL, bukan baca-lalu-tulis).
3. Service mengembalikan `{ created: boolean; data: { courseId: string; startHref: string } }`. Route menjawab `201 { data }` bila `created`, `200 { data }` bila sudah terdaftar. `startHref` mengikuti aturan `action` di atas: pendaftar lama yang sudah membuka materi dibawa ke materi terakhirnya.

Tanpa audit log (audit untuk aksi staf). Tanpa migrasi: tabel, constraint unik, dan `enrollment_count` sudah ada sejak A-07.

### 2. Halaman `/belajar` dan skeleton

**Letak berkas (wajib persis):** `src/app/(learn)/belajar/page.tsx` dipindah dengan `git mv` ke `src/app/(learn)/belajar/(dashboard)/page.tsx`, dan `loading.tsx` dibuat di folder yang sama. **Bukan** di `src/app/(learn)/belajar/` atau `src/app/(learn)/`. `loading.tsx` membungkus semua rute di bawah foldernya: bila diletakkan di `belajar/`, `notFound()` dan `redirect()` di halaman materi Kam 12 akan menjawab 200 (lihat "Catatan tinjauan 10 Nov"). Route group membatasinya ke dasbor saja; URL tidak berubah.

**Halaman:** `requireRole("MEMBER")` (pertahanan berlapis tetap), lalu `getUserProfile` dan `getLearnerDashboard` bersamaan (`Promise.all`), lalu `<LearnDashboard>`. Tetap memakai `PageContainer` seperti sekarang. Layout area belajar tidak diubah.

**`loading.tsx`** merender `<LearnDashboardSkeleton>` (klien). Komponen ini tidak merender apa pun selama `SKELETON_DELAY_MS` (300 ms, `useSkeletonDelay`), lalu `SkeletonList` berbentuk 28a: baris judul, satu baris paragraf, kartu unggulan (blok 236 px + baris teks + blok tombol), dan di ≥ 1024 kolom kanan 340 px berisi dua `SkeletonRow`. Pola 28d: meniru bentuk kartu, tanpa spinner, tanpa gulir samping di 360.

### 3. Tampilan dasbor — `LearnDashboard` (`src/components/learn/`)
Tata letak ≥ 1024 (`lg:`): `grid-cols-[minmax(0,1fr)_340px]` (28a, 8a). Di bawah 1024 satu kolom, urutan sesuai uraian di bawah. h1 memakai kelas dan aturan nama yang ada di `page.tsx` sekarang (A-14b; nama 40 karakter tanpa spasi tidak melebarkan halaman).

**A. Peserta baru** (`enrolled` kosong, `available` berisi) — 28a dan 28b:
- h1 "Selamat datang, {nama depan}" (aturan yang ada).
- Paragraf: ≥ 640 (`sm:`) teks 28a "Belum ada kursus yang Anda ikuti. Pilih satu untuk mulai — setiap materi 3–5 menit dan progress tersimpan otomatis."; < 640 teks 28b "Belum ada kursus. Mulai dari yang paling dasar:".
- **Kartu unggulan** = `available[0]`, kartu `primary-tint` dengan garis seperti 28a:
  - blok gambar 236 px (`style={{ backgroundImage: "var(--video-bg)" }}`, pola `lesson-outline.tsx`; < 640 di atas teks seperti 28b) dengan meta mono "{n} MATERI · {m} MENIT" di kiri bawah; bagian menit hilang bila `estimatedMinutes` null;
  - eyebrow "MULAI DARI SINI", judul h2;
  - baris "{Level} · {ringkasan}" (≥ 640 saja, seperti 28b; tanpa ringkasan → level saja);
  - tombol "Mulai materi 1" (`StartCourseButton`, varian `primary`).
  - **Tidak dibangun:** pil "Paling banyak diikuti" (urutan memakai tanggal terbit, bukan popularitas) dan tombol "Lihat semua kursus" (`/kursus` masih "Segera hadir"). Penyimpangan dari 28a/28b disebut di PR.
- **"Cara belajar di BINZI"** (≥ 640): h2 + tiga kartu 28a (01–03), copy persis. Di < 640 diganti kotak catatan 28b: "**Quiz hanya sekali.** Nilai muncul di Nilai Saya setelah quiz pertama selesai."
- Kolom kanan: **"Kursus lainnya"** (bagian E) bila `available` berisi lebih dari satu kursus, lalu kotak garis putus 28a "Nilai Saya masih kosong" + "Statistik belajar muncul setelah quiz pertama Anda selesai." (≥ 640; di < 640 sudah diwakili kotak catatan).

**B. Peserta aktif** (`enrolled` berisi) — 8a, hanya bagian "Kursus saya":
- h1 "Selamat datang kembali, {nama depan}" (8a; nama kosong → "Selamat datang kembali").
- h2 "Kursus saya", tanpa "Lihat semua" (`/belajar/kursus-saya` belum ada).
- Satu baris per kursus (8a; `96px minmax(0,1fr) 150px` di ≥ 640, di < 640 tombol turun ke bawah selebar baris):
  - blok gambar, `BadgeStatus` dari `badge`, meta mono "{selesai}/{total} MATERI", judul h3;
  - `ProgressBar` dengan nilai selesai/total dan label *(usulan)* "Progress {judul}";
  - tautan bergaya tombol `secondary`: "Mulai materi 1" (`mulai`) atau "Lanjutkan" (`lanjutkan`) ke `action.href`. Tautan biasa, bukan POST — peserta sudah terdaftar.
- Kolom kanan: "Kursus lainnya" bila `available` berisi.
- **Tidak dibangun untuk demo:** widget "Lanjutkan Belajar" (PRG-03), statistik, ringkasan Nilai Saya, "Quiz belum dikerjakan", baris "Terakhir belajar …".

**C. Kosong** (`enrolled` dan `available` kosong): h1 peserta baru, lalu `EmptyState` *(usulan)*: label "KURSUS · BELUM ADA", judul "Belum ada kursus yang terbit", deskripsi "Kursus pertama sedang disiapkan ahli gizi.", aksi utama "Tanya Ahli Gizi" → `/#tanya-ahli-gizi`, aksi lain "Kembali ke Beranda" → `/`.

**D. Satu kursus, satu tempat:** kartu unggulan tidak diulang di "Kursus lainnya"; kursus yang diikuti tidak pernah ada di "Kursus lainnya".

**E. "Kursus lainnya"** (28a): kartu `surface` dengan h2 "Kursus lainnya"; satu baris per kursus (`56px minmax(0,1fr)`): blok gambar, judul h3 (`wrap-anywhere`), meta mono "{LEVEL} · {n} MATERI", lalu `StartCourseButton` varian `secondary` "Mulai materi 1" selebar kolom teks. Tombol per baris menyimpang dari 28a (di sana baris tanpa tombol): tanpa tombol itu, hanya kursus unggulan yang bisa dimulai sebelum katalog S6 ada. Tanpa batas jumlah untuk demo.

**Aksesibilitas:** setiap kartu atau baris kursus adalah `<article aria-labelledby={id judul}>`. Setiap "Mulai materi 1" dan "Lanjutkan" memakai `aria-describedby` ke judul kursusnya, sehingga label yang terlihat tetap menjadi awal nama aksesibel (WCAG 2.5.3) dan pembaca layar tahu kursus mana yang dimaksud.

### 4. `StartCourseButton` (klien)
- Klik → `POST /api/progress/courses/{id}/enroll`, dengan penjaga `inFlight` di handler (pelajaran 7 Nov no. 6) dan `loading`, label *(usulan)* "Membuka…".
- 201 atau 200 → `router.push(startHref)`. `loading` dan penjaga tetap aktif sampai navigasi (pola `add-lesson-dialog`).
- Galat → pesan `role="alert"` tepat di bawah tombol (bukan banner halaman: di 360 tombol "Kursus lainnya" jauh di bawah h1), lalu fokus kembali ke tombol (`loading` memasang `disabled` native, jadi fokus keyboard terlepas — pelajaran 4 Nov):
  - 404 → *(usulan)* "Kursus ini tidak lagi tersedia." + `router.refresh()`;
  - 401 → *(usulan)* "Sesi Anda berakhir. Muat ulang halaman untuk masuk lagi.";
  - lainnya atau jaringan → *(usulan)* "Kursus belum bisa dibuka. Periksa koneksi Anda lalu coba lagi."

Tombol Back browser setelah mendaftar bisa menampilkan dasbor lama dari cache router (kursus masih di "Kursus lainnya"). Klik ulang aman karena API idempoten (200 → materi yang sama). Ini diterima untuk demo dan disebut di PR.

### 5. Halaman legal "Segera hadir"
`src/app/(public)/kebijakan-privasi/page.tsx`, `syarat-ketentuan/page.tsx`, dan `disclaimer/page.tsx`, persis pola `tentang/page.tsx`: `ComingSoon` dengan judul dari 12c/12d/12e — "Kebijakan Privasi", "Syarat & Ketentuan", "Disclaimer medis" — `metadata.title` "{judul} — BINZI", `robots: { index: false }`. Isi legal 12c–12e **tidak** dibangun di kartu ini.

### 6. Tes struktur `loading.tsx`
`src/lib/learn-route-structure.test.ts` (pola baca berkas `module-boundary.test.ts`):
- `src/app/(learn)/loading.tsx` dan `src/app/(learn)/belajar/loading.tsx` **tidak ada**;
- `src/app/(learn)/belajar/page.tsx` **tidak ada**;
- `src/app/(learn)/belajar/(dashboard)/page.tsx` dan `.../(dashboard)/loading.tsx` ada.

Komentar kepala menjelaskan alasannya (status 200 untuk `notFound`/`redirect` di rute anak) dan menunjuk kartu ini.

## Bukan lingkup tugas ini
- **Kam 12:** halaman materi `/belajar/{kursus}/{materi}` (tujuan tombol; sampai ada, tujuan menjawab 404 — wajar), gerbang akses (§12, CRS-08), `POST /api/progress/video`, pengisian `last_lesson_id` dan `lesson_progress`.
- **Setelah demo atau sprint lain:** katalog `/kursus` dan detail `/kursus/{slug}` (S6), Kursus Saya `/belajar/kursus-saya` (13b), Nilai Saya, widget Lanjutkan Belajar dan statistik 8a, gambar sampul (S1-07), isi halaman legal 12c–12e, batas jumlah dan paginasi "Kursus lainnya", `cache()` sesi/profil per request.
- **Tidak diubah:** `src/app/(learn)/layout.tsx`, `src/lib/rbac.ts`, `src/proxy.ts`, `site-footer.tsx` (tautan footer "Nilai Saya" ke `/belajar/nilai` tetap; diputuskan saat jadwal Sen 16 jelas), skema DB.

Pekerjaan di luar lingkup → **berhenti dan tanyakan.**

## Berkas yang boleh dibuat/diubah
- `src/modules/progress/{policy,queries,serializer,service}.ts` + `serializer.test.ts`, `service.integration.test.ts`; hapus `src/modules/progress/.gitkeep`
- `src/app/api/progress/courses/[courseId]/enroll/route.ts` (baru)
- `src/app/(learn)/belajar/page.tsx` → `src/app/(learn)/belajar/(dashboard)/page.tsx` (`git mv`); `src/app/(learn)/belajar/(dashboard)/loading.tsx` (baru)
- `src/components/learn/{learn-dashboard,start-course-button,learn-dashboard-skeleton}.tsx` + tes masing-masing (baru)
- `src/app/(public)/{kebijakan-privasi,syarat-ketentuan,disclaimer}/page.tsx` (baru)
- `src/lib/learn-route-structure.test.ts` (baru)
- `e2e/belajar-dasbor.spec.ts` (baru), `e2e/layout/helpers.ts` (helper baru + `GUEST_PAGES`), `e2e/beranda.spec.ts` (daftar halaman "Segera hadir"), `e2e/layout/{axe,touch-targets,keyboard}.spec.ts`

Tanpa migrasi, tanpa dependensi baru, dan tanpa perubahan `package.json`/`package-lock.json`.

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- **hash basis branch** (`git log --oneline -1`), yang harus sama dengan `main` terbaru, dan konfirmasi bahwa S1-08 ada di dalamnya;
- nama helper e2e S1-08 yang benar-benar ada di `main`, dan cara helper baru memakainya;
- SQL kedua SELECT dasbor (subquery hitungan, filter, urutan) dan langkah transaksi pendaftaran;
- signature setiap ekspor baru dan bentuk DTO;
- struktur DOM satu kartu unggulan, satu baris "Kursus saya", dan satu baris "Kursus lainnya" (heading, `article`, `aria-describedby`);
- kelas responsif per lebar: 360, 640, 768, 1024, 1280;
- daftar tes lama yang berubah, satu per satu. Yang sudah diketahui: tes skip link MEMBER di `keyboard.spec.ts` (diperketat), dan `GUEST_PAGES` bertambah tiga halaman;
- daftar tes per butir "Selesai jika";
- untuk setiap mutasi: tes yang diharapkan merah, beserta tes yang diperkirakan tetap hijau karena tertutup lapis lain.

## Selesai jika
- [ ] **Tes serializer** (node): tabel `badge` (4 status × `last_lesson_id` ada/tidak × 0/> 0 materi selesai); `action` (`mulai`/`lanjutkan` + href); `lessonHref`; label level; `estimatedMinutes` null.
- [ ] **Tes integrasi** (PGlite, `vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 })`):
  - `available` hanya `PUBLISHED`: tanpa DRAFT, IN_REVIEW, ARCHIVED; tanpa kursus terbit tanpa materi; tanpa kursus yang sudah diikuti actor. Kursus yang diikuti peserta **lain** tetap tersedia untuk actor. Urut `published_at` turun. `startHref` ke materi `order_index` terkecil, juga bila baris materi disisipkan tidak berurutan.
  - `enrolled` hanya milik actor; kursus yang tidak lagi `PUBLISHED` (diubah lewat SQL) tidak tampil; jumlah materi dan materi `COMPLETED` (baris `lesson_progress` disisipkan lewat SQL); `last_lesson_id` terisi → `lanjutkan` ke materi itu.
  - `enrollInCourse`: baru → `created: true`, satu baris, `enrollment_count` + 1. Kedua kali → `created: false`, tetap satu baris, hitungan tidak berubah, `startHref` sama. DRAFT, IN_REVIEW, id tidak dikenal, dan terbit tanpa materi → `NotFoundError`, tanpa baris dan tanpa perubahan hitungan. Peserta kedua → hitungan 2.
  - **Hitungan per kursus benar dengan data lebih dari satu kursus:** minimal tiga kursus terbit dengan jumlah materi berbeda (mis. 1, 2, 3), dan dua enrollment dengan jumlah materi `COMPLETED` berbeda. Setiap `lessonCount`, `completedLessonCount`, dan slug materi pertama harus milik kursusnya sendiri. Tes ini yang menangkap subquery tanpa nama tabel (lihat bagian 1); data satu kursus menutupinya, persis seperti `quizQuestionCountSql` lolos sampai S1-08.
  - DTO tanpa `description` atau `content` (`"description" in …` → false).
- [ ] **Tes komponen `LearnDashboard`** (jsdom):
  - keadaan A: unggulan = `available[0]`, sisanya di "Kursus lainnya", unggulan tidak diulang;
  - keadaan B: h1 "Selamat datang kembali", baris dengan badge, meta, dan tautan `mulai`/`lanjutkan` + href;
  - keadaan C: `EmptyState` dengan copy dan kedua aksi;
  - bagian D: kursus yang diikuti tidak ada di "Kursus lainnya";
  - setiap tombol dan tautan memakai `aria-describedby` ke judul yang benar;
  - tanpa ringkasan dan tanpa menit.
- [ ] **Tes komponen `StartCourseButton`:**
  - 201 → satu `fetch` POST ke path yang benar, `router.push(startHref)`, tombol tetap `loading`; 200 sama;
  - dua klik di dalam **satu** `act` selagi `fetch` pertama tertunda → satu `fetch`. Tanpa batch itu, tombol `disabled` hasil `loading` menutupi penjaga, dan tes lulus semu;
  - 404 → pesan + `router.refresh`; 401 → pesan sesi; 500 dan jaringan → pesan umum;
  - setelah galat, fokus di tombol.
- [ ] **Tes komponen `LearnDashboardSkeleton`** (fake timers): tidak merender apa pun sebelum 300 ms, lalu `role="status"` dengan "Memuat…".
- [ ] **Tes struktur** `learn-route-structure.test.ts` (bagian 6).
- [ ] **E2E** `e2e/belajar-dasbor.spec.ts` (proyek `chromium`; lebar lain lewat `page.setViewportSize`). Kursus dibuat per tes dengan judul bertoken lewat helper baru `createPublishedCourseViaApi` di `helpers.ts`: kursus lengkap dengan helper S1-08, dikirim sebagai EDITOR, diterbitkan sebagai ADMIN, lewat endpoint asli (bukan SQL). **Data bersama:** DB e2e berisi kursus terbit dari spec lain, jadi tes **tidak** mengasersi jumlah, isi kartu unggulan, keadaan kosong, atau urutan antar-kursus — hanya kursus milik tes, dicari lewat judulnya (pelajaran 9 Nov no. 9).
  1. MEMBER baru → h1 "Selamat datang, …"; kursus terbit milik tes tampil (di kartu unggulan atau "Kursus lainnya") dengan "Mulai materi 1"; kursus DRAFT bertoken **tidak** tampil.
  2. Klik "Mulai materi 1" milik tes → URL `/belajar/{slug kursus}/{slug materi 1}` (halamannya 404 sampai Kam 12 — isinya tidak diasersi). DB: satu baris `enrollments` (user, kursus), `enrollment_count` = 1. Lalu `page.goto("/belajar")` → h1 "Selamat datang kembali"; baris "Kursus saya" kursus itu memuat badge "Belum dimulai", "0/1 MATERI", tautan "Mulai materi 1" ke href yang sama; kursus itu tidak ada di "Kursus lainnya".
  3. Klik ganda cepat pada "Mulai materi 1" → satu request POST (dicatat lewat `page.on("request")`, diasersi setelah jeda tetap ±500 ms, bukan `waitFor` — pelajaran 4 Nov).
  4. POST dicegat dan dijawab 500 → pesan galat `toBeInViewport({ ratio: 1 })` di 1280 dan 360, fokus di tombol.
  5. **API:** tamu → 401; MEMBER ke kursus DRAFT → 404; id bukan UUID → 404; pendaftaran kedua → 200 dan `enrollment_count` tetap; EDITOR boleh mendaftar (MEMBER+) → 201.
  6. **Skeleton:** request RSC `/belajar` ditunda ±1,5 s lewat `page.route` dengan **predikat** (`url.pathname === "/belajar" && url.searchParams.has("_rsc")`), bukan glob. Navigasi klien dari `/` lewat tautan header "Belajar" → `role="status"` "Memuat…" terlihat, lalu h1 dasbor. Bila tes ini flaky dalam 3 run berturut-turut, laporkan dan ganti dengan langkah manual di "Verifikasi oleh kamu" — jangan dihapus diam-diam.
  7. **Lebar:** kursus terbit berjudul `noSpaceTitle(…).slice(0, 70)` (70 karakter tanpa spasi — helper S1-08 menamai materinya "{judul} materi 1", dan judul materi maksimal 80, `LESSON_TITLE_MAX`; S1-08 sendiri memotong ke 60) → tanpa gulir samping (`expectNoHorizontalScroll`) di 360, 640, 1024, dan 1280, untuk keadaan A (MEMBER baru) dan B (setelah mendaftar lewat API).
  8. **Halaman legal:** ketiga path masuk tes "halaman segera hadir" di `beranda.spec.ts` (200, h1, `noindex`) dan masuk `GUEST_PAGES`, sehingga axe, tanpa gulir samping, dan screenshot berjalan di semua lebar.
- [ ] **axe** (`axe.spec.ts`, w360 dan w1280): `/belajar` keadaan A dan B — tes MEMBER yang ada diperluas; keadaan B setelah mendaftar lewat API.
- [ ] **Target sentuh** (`touch-targets.spec.ts`, w360): "Mulai materi 1" (kartu unggulan atau baris "Kursus lainnya") dan tautan "Mulai materi 1" di "Kursus saya".
- [ ] **Keyboard:** tes skip link MEMBER di `keyboard.spec.ts` diperketat sesuai komentar di dalamnya: Tab setelah skip link mendarat **di dalam** `#konten-utama`. Sekarang selalu ada titik fokus di sana (tombol kursus, atau aksi `EmptyState`).
- [ ] **Uji mutasi** — commit lokal dulu dan `git status` bersih sebelum mutasi pertama; kembalikan setiap mutasi dengan `git restore`. Laporkan per mutasi nama tes yang merah beserta pesannya. Mutasi yang hanya tertangkap E2E dijalankan dengan `npx playwright test --grep …` sungguhan.
  1. Filter `PUBLISHED` dihapus dari `available`.
  2. Cek `PUBLISHED` dihapus dari `enrollInCourse`.
  3. Filter "belum diikuti actor" dihapus dari `available`.
  4. Filter `user_id = actor.id` dihapus dari `enrolled`.
  5. `on conflict do nothing` dihapus (insert polos).
  6. `enrollment_count` dinaikkan juga saat konflik.
  7. Materi pertama memakai `order_index` terbesar.
  8. `belum-dimulai` hanya memeriksa `last_lesson_id`.
  9. Penjaga `inFlight` dihapus.
  10. Fokus kembali ke tombol setelah galat dihapus.
  11. `loading.tsx` dipindah ke `src/app/(learn)/belajar/`.
  12. Jeda 300 ms skeleton dihapus.
  13. Salah satu halaman legal dihapus.
  14. `aria-describedby` dihapus dari tombol "Kursus lainnya".
  15. Subquery jumlah materi memakai interpolasi kolom drizzle (`${lessons.courseId} = ${courses.id}`) alih-alih nama tabel eksplisit.

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`. `main` memuat S1-08.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR. Harapan 0 excused / 0 blocking / OK. Angka di bawah high dicatat apa adanya beserta daftar paketnya (10 Nov: 22 di mesin pemilik, 23 di sandbox atas lockfile yang sama — beda lingkungan). Temuan high/critical baru → berhenti dan tempel output lengkapnya.
- **Build dan rute:** `npm run build` mencantumkan `/belajar` sebagai ƒ. Lalu `npm run start`, buka `/belajar` sebagai MEMBER dan satu halaman legal, serta `curl -s -o /dev/null -w "%{http_code}"` ke `/kebijakan-privasi` (harapan 200) dan `POST /api/progress/courses/bukan-uuid/enroll` tanpa sesi (harapan 401 — peran dicek sebelum id).
- **Prettier:** berkas yang sudah ada tetap apa adanya, sehingga diff sebatas lingkup. Berkas baru boleh dirapikan.
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas.
- **"Keputusan & asumsi" di PR** memuat semua copy usulan, keputusan pemilik 10 Nov, penyimpangan dari 28a/28b/8a, dan keputusan yang diambil tanpa bertanya.
- **Screenshot**, diambil lokal dengan `E2E_SCREENSHOT_DIR` (konvensi A-19b), `animations: "disabled"`:
  - 360, 640, 768, 1024, 1280: keadaan A dan B;
  - skeleton (dari tes no. 6) di 360 dan 1280;
  - satu halaman legal di 360.

  Keadaan C hanya ada di tes komponen, karena DB e2e bersama tidak pernah kosong — sebut di PR.
- **Setelah push:** cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`
- Baseline Vitest = angka di `main` saat sesi dimulai, disebut di rencana. Di `1898ab6`: 101 berkas / 1092 tes (dilaporkan PR #129). PR melaporkan baseline + jumlah tes baru; tes lama yang berubah disebut satu per satu.
- `git diff --stat main -- package.json package-lock.json src/db/migrations src/db/schema 'src/app/(learn)/layout.tsx' src/lib/rbac.ts src/proxy.ts` kosong.

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Lokal: Docker menyala, lalu jalankan:
  ```bash
  cd ~/Project/React/binzi-new && npm run dev:db && npm run db:seed:demo
  ```
  Bila "[DEMO] Kursus contoh 3" belum terbit di DB lokal, terbitkan lewat langkah 1–4 "Verifikasi oleh kamu" kartu S1-08. Lalu `npm run dev`, dan daftar akun MEMBER baru di jendela privat.
  1. `/belajar` → "Selamat datang, …", kartu "MULAI DARI SINI" berisi kursus contoh 3, "Cara belajar di BINZI", dan "Nilai Saya masih kosong".
  2. "Mulai materi 1" → URL berganti ke `/belajar/demo-kursus-contoh-3/…` dan halaman 404. Ini wajar sampai Kam 12.
  3. Klik "Belajar" di header → "Selamat datang kembali, …", baris "Kursus saya" dengan "Belum dimulai", "0/3 MATERI", dan tautan "Mulai materi 1".
  4. DevTools → Network → throttling "Slow 4G" → buka `/`, lalu klik "Belajar" → skeleton tampil sebelum dasbor.
  5. Di `/`, footer "Kebijakan Privasi", "Syarat & Ketentuan", "Disclaimer medis" → halaman "Segera hadir", bukan 404.
  6. HP atau DevTools 360 px: kartu unggulan bertumpuk seperti 28b, tanpa gulir samping.
- [ ] Unggah folder screenshot ke Claude chat untuk dibandingkan dengan 28a, 28b, dan 8a.
- [ ] **Pasca-merge:** kartu ini tanpa migrasi. Di Production, `/belajar` menampilkan keadaan C sampai ada kursus terbit di binzi-dev — wajar; data demo diisi saat gladi resik.

## Catatan jadwal
- Kartu ini masuk `main` lewat PR docs bersama STATUS 10 Nov (aturan STATUS: docs hanya di antara PR), lalu sesi dimulai.
- **Bila terlambat**, yang dipotong lebih dulu: tes skeleton e2e no. 6 (diganti langkah manual no. 4), lalu "Cara belajar di BINZI" (kotak catatan 28b dipakai di semua lebar), lalu kotak "Nilai Saya masih kosong". Modul `progress`, endpoint pendaftaran, keadaan A/B/C, `loading.tsx` di route group, dan halaman legal tidak dipotong.

## Catatan keputusan
- **Pendaftaran tersirat lewat "Mulai materi 1", bukan tombol "Ikut kursus".** 28a, 28b, 13b, dan 7b tidak punya tombol ikut; PRD §7.4 A menyebut *auto-enroll*. Pendaftaran tetap `POST` eksplisit dan tidak pernah terjadi saat GET: `Link` Next memuat halaman tujuan lebih dulu (prefetch), sehingga pendaftaran saat halaman materi dibuka akan mendaftarkan peserta hanya karena tautannya terlihat di layar.
- **404 seragam** untuk semua kursus yang tidak bisa didaftari — tidak membedakan "tidak ada" dan "belum terbit" (pola anti-IDOR modul lesson).
- **Idempoten, 201/200.** Klik ganda, tombol Back, dan dua tab berakhir di satu baris. Yang menjamin adalah constraint `enrollments_user_course_unique` + `on conflict do nothing`, bukan pengecekan sebelum insert.
- **`loading.tsx` di route group `(dashboard)`** — lihat catatan tinjauan.
- **`cache()` ditunda.** Rencana B dan C di STATUS 9 Nov dibuat saat `belajar?_rsc` butuh 1,63–1,64 s. Setelah region fungsi Vercel pindah ke sin1 (10 Nov): `belajar?_rsc` 303 / 321 / 132 / 113 ms, `get-session` 67 / 88 / 74 ms. Kueri ganda sesi/profil kini tinggal beberapa milidetik, sedangkan perubahannya menyentuh jalur baca sesi semua halaman, sepuluh hari sebelum demo.
- **Halaman legal "Segera hadir" hanya untuk demo.** Persetujuan di formulir daftar (3a) merujuk Kebijakan Privasi; isi 12c–12e wajib ada sebelum peserta penelitian atau publik memakai BINZI.

## Catatan untuk kartu Kam 12 (halaman materi)
- Rute `/belajar/[slug]/[materi]` berada di luar `(dashboard)`. Bila butuh `loading.tsx`, letakkan di folder rute itu sendiri, bukan di `belajar/`.
- Href dibangun dengan `lessonHref` dari modul `progress`.
- GET halaman materi **tanpa efek tulis** (prefetch). `last_lesson_id`, `first_accessed_at`, dan status `lesson_progress` diisi lewat POST (mis. `POST /api/progress/video` atau satu POST "materi dibuka").
- Gerbang akses memakai data pendaftaran dari modul `progress`. Tes 404 di rute itu boleh mengasersi status HTTP, karena rutenya di luar route group.
- Badge `sedang-berjalan` dan tombol "Lanjutkan" di dasbor menyala otomatis begitu `last_lesson_id` terisi.

## Catatan tinjauan 10 Nov
| Klaim | Cara dicek | Hasil |
|---|---|---|
| `loading.tsx` membungkus rute anak dan mengubah status | Aplikasi Next 16.4.1 minimal (versi repo, React 19.3.0), `next build` + `next start` + `curl`; layout dan halaman memanggil `headers()` agar dinamis seperti halaman berlogin | `loading.tsx` di `belajar/`: `notFound()` di rute anak → **200** + `noindex`; `redirect()` → **200** + `meta refresh` 1 detik. Tanpa `loading.tsx`: **404** dan **307**. `loading.tsx` di `belajar/(dashboard)/`: `/belajar` tetap menampilkan fallback, rute anak **404** dan **307** |
| Pendaftaran idempoten tanpa migrasi | Postgres 16 + `0000_initial_schema.sql` repo; `insert … on conflict on constraint enrollments_user_course_unique do nothing returning id`, lalu `update` hitungan hanya bila ada baris | Percobaan kedua mengembalikan 0 baris; `enrollment_count` = 1 |
| Daftar kursus tersedia | SQL di skema yang sama: dua kursus terbit (satu diikuti peserta A), satu draf | A: hanya kursus yang belum diikutinya, materi pertama `order_index` 1. B: kedua kursus terbit, urut `published_at` turun. Draf tidak tampil |
| Asal 404 di screenshot pemilik | `src/app/(learn)/layout.tsx`, `site-footer.tsx`, `git grep` | Layout area belajar tanpa footer; prefetch `kebijakan-privasi` datang dari halaman publik yang dibuka sebelumnya. Ketiga path legal hanya dirujuk footer |
| Tes lama | `grep` di `e2e/` | "Selamat datang" diasersi dengan `toContainText` (tetap cocok untuk "Selamat datang kembali"). Komentar skip link `keyboard.spec.ts` meminta pengetatan saat `/belajar` punya titik fokus. Oracle cakupan RBAC hanya memindai `(cms)`; baris `/belajar` (200 untuk semua peran) tidak terpengaruh |
| `EmptyState` | `src/components/ui/empty-state.tsx` | `label` dan dua aksi wajib di tipe, jadi keadaan C butuh dua aksi |
| `POST` tanpa body | Paket `better-auth` 1.7.7 (`npm pack`), `dist/cookies` | Cookie sesi `SameSite=Lax` eksplisit; `POST` lintas situs tidak membawa cookie |
| Token dan komponen | `tokens.css`, `badge-status.tsx`, `course/schema.ts`, `lesson-outline.tsx` | Keempat status PRG-06 sudah ada di `BadgeStatus`. `--video-bg` berupa gradien yang dipasang lewat `backgroundImage`. `COURSE_LEVEL_LABELS` ada di berkas skema yang boleh diimpor |
| Grid desain | `28a.html`, `8a.html` | Kolom `minmax(0,1fr) 340px`; unggulan `236px 1fr`; "Kursus lainnya" `56px 1fr`; baris 8a `96px 1fr 150px`; langkah `repeat(3, 1fr)` |
| Slug bentrok | `course/schema.ts` | `kursus-saya` dan `nilai` sudah ditolak sebagai slug kursus, jadi `/belajar/{slug}` tidak bisa menimpa rute statis |

| Helper e2e S1-08 | PR #129 head `0e834fc` | `createPublishableCourseViaApi(context, title)` → `{ courseId, lessonId, lessonQuizId, finalQuizId }`; materi bernama "{judul} materi 1", judul materi maksimal 80 |
| Kolom di template `sql` drizzle | `drizzle-orm` 0.45.3, `QueryBuilder().toSQL()` | SELECT tabel tunggal: `"course_id" = "id"` (tanpa nama tabel — salah). SELECT dengan join: `"lessons"."course_id" = "courses"."id"` (benar) |

Yang **belum** dicek dari sandbox: tampilan di Chromium (butuh login + DB) dan baseline Vitest di `1898ab6` (angka 101 / 1092 dari laporan PR #129, belum diukur ulang).

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
