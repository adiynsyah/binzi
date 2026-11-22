# S6-02 · Katalog `/kursus` + detail kursus `/kursus/{slug}`: daftar kursus terbit, outline, deskripsi, CTA tamu/member

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | **S6-01** (PR #127): layout publik tanpa sesi server, `ComingSoon`, `SessionHeader`. **S5-01**: `StartCourseButton`, `POST /api/progress/courses/{id}/enroll` (idempoten). **S5-04** (PR #150): `getCourseProgressPage` (`kembali`), `MyCourses` keadaan kosong 13c, `CoverBlock` diekspor. **S1-03a**: `RichContent`. **S1-08**: alur terbit. Semua sudah di `main` |
| **Target** | A5 rencana UAT internal 11 Des (STATUS 19 Nov). Perkiraan ±2½ hari |
| **Branch** | `s6/s6-02-katalog-dan-detail` |

> **Dibuat 22 Nov 2026** di Claude chat terhadap `main` `6188302` (#150). Fakta kode yang dirujuk ada di "Catatan tinjauan 22 Nov" di akhir kartu.
>
> **Keputusan teknis kartu** (usulan Claude chat, disetujui bersama kartu):
>
> 1. **Tanpa migrasi, tanpa dependensi baru, tanpa token warna baru, CSP tidak berubah, tanpa route API baru.** Route API yang ada tidak diubah.
> 2. **Bacaan publik milik modul `course`, dengan DTO audiens publik baru** (`src/modules/README.md`: "satu DTO per audiens"). Dua ekspor service tanpa aktor dan tanpa cek role (pola bacaan publik konsultasi S6-01): `getPublicCatalog()` dan `getPublicCourse(slug)`. Hanya kursus `PUBLISHED` yang punya minimal satu materi. **`lessonCountSql` di `course/queries.ts` tidak dipakai**: fragmen itu menyisipkan kolom (`${lessons.courseId} = ${courses.id}`) dan hanya benar bila kuerinya punya join (STATUS 10 Nov, pelajaran no. 1). Kueri katalog adalah SELECT satu tabel dari `courses`, jadi subquery-nya ditulis ber-alias dengan `courses.id` ditulis tangan (pola `progress/queries.ts`).
> 3. **Kedua halaman dirender dinamis** (`export const dynamic = "force-dynamic"`, ƒ di tabel rute). Ini **menyimpang dari PRD §10.4** (ISR `revalidate: 3600` + revalidasi on-demand saat terbit). Alasannya:
>    - job CI `ci` menjalankan `next build` dengan `DATABASE_URL` dummy tanpa server, sehingga prerender katalog saat build akan gagal;
>    - UAT butuh kursus yang baru diterbitkan langsung tampil;
>    - revalidasi on-demand berarti menyentuh jalur terbit S1-08.
>
>    ISR + revalidasi saat terbit dikerjakan sebelum rilis publik (putaran 2). Halaman tetap **tanpa** `cookies()`, `headers()`, atau baca sesi di server, supaya peralihan ke ISR nanti hanya mengubah cara data dibaca.
> 4. **CTA detail ditentukan di klien** dari `authClient.useSession()` (pola `SessionHeader`):
>    - selama sesi dimuat **dan** untuk tamu → CTA tamu: "Daftar & mulai belajar" → `/daftar`, "Sudah punya akun? Masuk" → `/masuk?next=%2Fkursus%2F{slug}`;
>    - member → `StartCourseButton` "Mulai belajar" *(usulan)*. Endpoint enroll idempoten dan menjawab `startHref` = materi terakhir ?? materi 1, jadi peserta yang sudah terdaftar langsung melanjutkan — halaman tidak perlu membaca enrollment.
>
>    `StartCourseButton` **tidak pernah** dirender untuk tamu: 401 dari enroll akan tampil sebagai "Sesi Anda berakhir", pesan yang salah untuk orang yang belum pernah masuk.
> 5. **Preview materi 1 tanpa login (CRS-09, 7c) adalah kartu B2.** A5 tidak menampilkan badge "Preview Gratis", tombol "Putar preview", maupun sampul bertombol putar. Outline tidak berisi tautan dan tidak berlabel "Terkunci": halaman tidak tahu sesi di server, dan peserta terdaftar tidak boleh melihat "terkunci" pada materi yang sudah dibukanya.
> 6. **Filter level/durasi dan "Urutkan" (7a, SRC-02) adalah kartu B5** — tidak dibangun. Urutan katalog `published_at desc, id asc` (urutan "Kursus lainnya" dasbor).
> 7. **Kotak peninjau 7b (foto, nama, gelar) tidak dibangun.** Di versi demo `reviewer_id` = akun pengirim (S1-08), dan kredensial (STR) tidak ada di DB. Diganti chip "Ditinjau ahli gizi" (7t).
> 8. **Deskripsi kaya kursus ditampilkan** di detail sebagai bagian "Tentang kursus ini" *(usulan)* lewat `RichContent`. Desain 7b/7m/7t tidak menggambarnya, tetapi deskripsi wajib diisi sebelum terbit (syarat S1-02) dan tanpa bagian ini tulisan ahli gizi tidak tampil di mana pun.
> 9. **CTA < 1024 mengikuti aturan tablet 7t** (kartu daftar menjadi blok melebar di bawah kepala, tidak menempel), juga di 360 — bukan bar menetap 7m. ≥ 1024: kartu di kolom kanan (7b), tidak sticky.
> 10. **`noindex` tetap di kedua halaman sampai rilis**: kursus "[DEMO]" belum ditinjau ahli gizi, dan Production masih `binzi.vercel.app`. Dicabut di S4/SEO bersama sitemap.
> 11. **Tindak lanjut S5-04** (catatan di akhir kartu S5-04):
>     - peserta belum terdaftar di `/belajar/{kursus}` → `kembali` ke `/kursus/{slug}`, bukan materi 1;
>     - keadaan kosong 13c: setiap baris kursus tersedia memakai tautan "Lihat →" ke `/kursus/{slug}` (13c), menggantikan `StartCourseButton`. Keputusan 10 kartu S5-04 tidak berlaku lagi.
> 12. **Tanpa skeleton dan keadaan gagal 28d**: halaman dirender di server tanpa fetch klien; DB gagal → 500 (putaran 2). **Tanpa `loading.tsx`** di `(public)/`, `kursus/`, maupun `kursus/[slug]/`: `notFound()` di bawah `loading.tsx` menjawab 200 (STATUS 10 Nov, pelajaran no. 2).
> 13. **404 memakai halaman 404 bawaan Next** (14a belum dibangun), sama dengan rute `/belajar`.

## Tujuan
Tamu dan member membuka "Kursus" dari header dan melihat semua kursus yang terbit: level, jumlah materi, estimasi durasi, ringkasan, dan "Lihat kursus". Halaman detail menampilkan judul, ringkasan, outline lengkap, deskripsi, dan CTA yang sesuai: tamu diajak daftar atau masuk lalu kembali ke halaman yang sama, member langsung mulai atau melanjutkan belajar. Ini menutup langkah "katalog → daftar" dari skenario UAT peserta (STATUS 19 Nov).

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD:
  - `docs/prd/sections/06-2-kursus-materi.md` (CRS-01, CRS-09, CRS-11);
  - `07-navigasi-information-architecture.md` (§7.4 A);
  - `10-arsitektur-system-design.md` (§10.4 — dibaca untuk keputusan 3).
- Desain:
  - katalog: `docs/design/screens/7a.md` + `.png` (buka `7a.html` untuk ukuran), `7f.png` (panel kiri, 360), `7t.png` (panel kiri, 768: kartu ganjil terakhir melebar);
  - detail: `7b.md` + `.png` (buka `7b.html`), `7m.png` (panel kiri, 360), `7t.png` (panel tengah, 768);
  - kosong Kursus Saya: `13c.md` + `.png` (tautan "Lihat →").
- Kode:
  - `src/app/(public)/kursus/page.tsx`, `src/app/(public)/layout.tsx`, `src/components/public/coming-soon.tsx`;
  - `src/components/shared/session-header.tsx`, `src/components/shared/auth/auth-client.ts` (`useSession`);
  - `src/modules/README.md`; `src/modules/course/{schema,queries,serializer,service}.ts` (`COURSE_LEVEL_LABELS`, `lessonCountSql` dan catatan bare-name di kepala `progress/queries.ts`), `src/modules/course/service.integration.test.ts` (harness);
  - `src/modules/progress/queries.ts` (`firstLessonSlugSql`, `hasLessonsSql`, `selectAvailableCourses` — pola alias), `src/modules/progress/service.ts` (`getCourseProgressPage`), `src/modules/progress/my-courses.integration.test.ts` (tes `kembali`);
  - `src/components/learn/{start-course-button,learn-dashboard,my-courses}.tsx` + `my-courses.test.tsx`; `src/components/shared/{rich-content,page-container}.tsx`; `src/components/ui/{empty-state,button-variants}.tsx`;
  - `src/app/(learn)/belajar/[slug]/page.tsx`; `src/lib/learn-route-structure.test.ts` (pola tes struktur).
- E2E: `e2e/beranda.spec.ts` (tes "halaman segera hadir"), `e2e/layout/helpers.ts` (`GUEST_PAGES`, `createPublishedCourseViaApi`, `createCourseViaApi`, `attachVideoInE2eDb`, `expectTouchTarget`, `maybeScreenshot`), `e2e/layout/touch-targets.spec.ts`, `e2e/layout/axe.spec.ts`, `e2e/belajar-kursus-saya.spec.ts` (tes 2, `expectBoxFits`), `e2e/README.md`.

## Kerjakan

### 1. Modul `course`: bacaan publik
**Queries** (nama bebas, sebut di rencana). Subquery ber-alias, `courses.id` ditulis tangan (keputusan 2); tanpa `Date` mentah di fragmen `sql` (STATUS 19 Nov, pelajaran no. 3).
1. **Katalog:** `from(courses)`, `status = 'PUBLISHED'` dan punya materi (`exists`, pola `hasLessonsSql`). Kolom: `slug`, `title`, `level`, `summary`, `estimated_minutes`, jumlah materi (`select count(*) from lessons as counted where counted.course_id = courses.id`). Urutan `published_at desc, id asc`.
2. **Detail:** kursus lewat slug, syarat sama dengan katalog. Kolom: `id`, `slug`, `title`, `summary`, `description`, `level`, `estimated_minutes`, `seo_title`, `seo_description`, `final_quiz_id`.
3. **Outline:** materi kursus itu — `title`, `video_status`, `video_duration_seconds` — urutan `order_index asc, id asc` (urutan `firstLessonSlugSql`, jadi "1 · …" di sini dan "Mulai materi 1" di tempat lain menunjuk materi yang sama). **Tidak** membaca `content`, `slug`, `video_external_id`, `video_key`, atau `quiz_id`.

**Service — dua ekspor baru:**
```ts
export type PublicCourseCardDTO = {
  slug: string;
  title: string;
  levelLabel: string;              // COURSE_LEVEL_LABELS
  summary: string | null;
  lessonCount: number;
  estimatedMinutes: number | null;
  href: string;                    // /kursus/{slug}
};

export type PublicCourseDetailDTO = {
  id: string;                      // untuk StartCourseButton (enroll)
  slug: string;
  title: string;
  summary: string | null;
  levelLabel: string;
  lessonCount: number;
  estimatedMinutes: number | null;
  hasFinalQuiz: boolean;           // final_quiz_id terisi
  description: unknown;            // dokumen TipTap tersimpan; RichContent memvalidasi ulang
  lessons: {
    position: number;              // 1-based
    title: string;
    durationSeconds: number | null; // hanya video_status READY dan durasi > 0
  }[];
  meta: { title: string; description: string | null }; // seo_title ?? title, seo_description ?? summary
};
```
- `getPublicCatalog(): Promise<PublicCourseCardDTO[]>`.
- `getPublicCourse(slug: string): Promise<PublicCourseDetailDTO>` — slug tidak ada, kursus bukan `PUBLISHED`, atau tanpa materi → `NotFoundError` yang sama (keberadaan draf tidak bocor).

Tidak ada id materi, id quiz, slug materi, isi materi, id video, `reviewer_id`, `created_by`, atau `enrollment_count` di DTO (allowlist `Object.keys` dites).

### 2. Halaman
- `src/app/(public)/kursus/page.tsx` (ganti `ComingSoon`): `export const dynamic = "force-dynamic"`; metadata `title: "Kursus — BINZI"`, `robots: { index: false }`; `getPublicCatalog()` → `<PageContainer className="pt-8"><CourseCatalog …/></PageContainer>`.
- `src/app/(public)/kursus/[slug]/page.tsx` (baru): `export const dynamic = "force-dynamic"`. Bacaan dibungkus `cache()` React supaya `generateMetadata` dan halaman memakai satu kueri per request. `NotFoundError` → `notFound()` di keduanya. Metadata `title: "{meta.title} — BINZI"`, `description: meta.description ?? undefined`, `robots: { index: false }`.
- `src/lib/public-route-structure.test.ts` (baru): kedua `page.tsx` ada; tidak ada `loading.tsx` di `(public)/`, `(public)/kursus/`, maupun `(public)/kursus/[slug]/` (keputusan 12).
- `ComingSoon` tetap (dipakai `/artikel`, `/tentang`, `/cari`).

### 3. Komponen `CourseCatalog` (`src/components/public/course-catalog.tsx`, baru) — 7a / 7f / 7t
Server component. Satu h1.

**Kepala:**
- eyebrow mono "Beranda / Kursus" — kelas eyebrow Nilai Saya (`font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-subtle`) sebagai konstanta lokal;
- h1 "Kursus gizi yang ditinjau ahli" (7a);
- paragraf "{n} kursus tersedia. Setiap materi singkat dan ditutup satu quiz dengan pembahasan." *(usulan; kalimat preview 7a dibuang, keputusan 5)*.

**Grid:** < 640 satu kolom (7f), 640–1023 dua kolom, ≥ 1024 tiga kolom (7a). Di 640–1023 kartu ganjil terakhir melebar dua kolom dengan sampul di kiri (7t, "kartu ganjil terakhir jadi baris melebar").

**Kartu** (`<article aria-labelledby>` dengan id deterministik dari slug, `rounded-card border bg-surface overflow-hidden`, tanpa bayangan):
- `CoverBlock` di atas (±170 px di 7a, ±130 px di 7f), dengan mono "{n} materi · {m} menit" di kiri-bawah sampul dalam `text-surface` (13,41:1 di ujung terang `video-bg`); " · {m} menit" hanya bila `estimatedMinutes`;
- "{Level} · {n} materi" (13 px bold, `text-text-muted`);
- **h2** judul (`wrap-anywhere`, 7a: ±19 px/900);
- ringkasan (`text-text-muted`, 14 px) bila ada;
- tautan bergaya tombol `secondary` "Lihat kursus" `w-full` → `href`, `aria-describedby` ke h2 (labelnya berulang di setiap kartu).

**Kosong** (tidak ada kursus terbit): `EmptyState` judul "Belum ada kursus yang terbit" *(usulan)*, deskripsi "Kursus baru akan tampil di sini setelah ditinjau ahli gizi." *(usulan)*, aksi "Kembali ke Beranda" → `/`.

### 4. Komponen `CourseDetail` (`src/components/public/course-detail.tsx`, baru) + `CourseEnrollCta` (`src/components/public/course-enroll-cta.tsx`, baru, klien) — 7b / 7m / 7t
`CourseDetail` adalah server component. Satu h1. ≥ 1024 dua kolom (isi kiri, kartu CTA kanan ±380 px, 7b); < 1024 satu kolom dengan CTA tepat setelah kepala (keputusan 9).

**Kepala:**
- `<nav aria-label="Breadcrumb">` berisi tautan "Kursus" → `/kursus` *(usulan)*, gaya eyebrow seperti katalog, area sentuh ≥ 44 px;
- **h1** judul (`wrap-anywhere`; ukuran h1 halaman member: 25 px < 640, 32 px ≥ 640);
- baris meta "{Level} · {n} materi · {m} menit · Quiz per materi" (7b; " · {m} menit" hanya bila ada);
- ringkasan (7m/7t) bila ada;
- chip mono "Ditinjau ahli gizi" (7t, keputusan 7).

**`CourseEnrollCta`** (`"use client"`; props: `courseId`, `slug`, `titleId`) — kartu `rounded-card border bg-surface`:
- `CoverBlock` di atas, **tanpa** tombol putar (keputusan 5);
- "Gratis" + "Tanpa biaya, tanpa kartu kredit." (7b);
- tamu atau sesi masih dimuat: tautan `primary` "Daftar & mulai belajar" → `/daftar`; tautan `secondary` "Sudah punya akun? Masuk" → `/masuk?next=` + `encodeURIComponent("/kursus/{slug}")`;
- member (`data?.user` terisi, pola `SessionHeader`): `StartCourseButton` "Mulai belajar" *(usulan)*, `aria-describedby` → h1. `StartCourseButton` merender dua elemen (tombol + `<p role="alert">` yang selalu terpasang) — taruh di wadah blok, bukan langsung di wadah flex (STATUS 22 Nov, pelajaran no. 5);
- tiga butir bercentang (7b): "Progress tersimpan, bisa dilanjut dari HP", "Quiz dengan pembahasan lengkap", "Nilai tercatat di halaman Nilai Saya". Ikon centang dekoratif (`aria-hidden`), teksnya teks biasa.

Semua tombol dan tautan CTA ≥ 44 px.

**Isi kursus:**
- h2 "Isi kursus"; paragraf "Seluruh materi terlihat supaya Anda tahu apa yang dipelajari." *(usulan; kalimat preview 7b dibuang)*;
- `<ol>`: satu baris per materi, `rounded-card border bg-surface-2`, tinggi ≥ 56 px, lingkaran 28 px `bg-fill` (dekoratif), judul "{posisi} · {judul}" (15 px bold, `wrap-anywhere`), mono "{mm:ss} · video" bila `durationSeconds` (`formatPlaybackClock`), selain itu "materi teks" *(usulan)*. **Bukan** tautan; tanpa "Terkunci" maupun "Preview" (keputusan 5);
- kotak bergaris putus (`border-dashed border-border-dashed`): "Quiz di setiap materi · Final Quiz di akhir" bila `hasFinalQuiz`, selain itu "Quiz di setiap materi" (7b/7m, tanpa "+n materi lain terkunci" — semua materi tampil).

**Tentang kursus ini** *(usulan, keputusan 8)*: h2 + `<RichContent doc={description} />` dalam lebar baca (`max-w-(--width-measure)`).

### 5. Tindak lanjut S5-04 (keputusan 11)
- `src/modules/progress/service.ts`: `getCourseProgressPage` menjawab `{ state: "kembali", href: "/kursus/{slug}" }` untuk peserta belum terdaftar. Urutan baca dan 404 tidak berubah. Komentar `src/app/(learn)/belajar/[slug]/page.tsx` soal `kembali` diperbarui (hanya komentar).
- `src/components/learn/my-courses.tsx` keadaan kosong 13c: `StartCourseButton` di setiap baris diganti tautan teks "Lihat →" → `/kursus/{slug}` (13c: `primary-deep`, 13,5 px bold; `inline-flex min-h-11 items-center`; `aria-describedby` ke h3 baris). Pembungkus `div` dari PR 150 putaran 2 ikut dihapus; `StartCourseButton` tidak lagi diimpor di berkas itu.

### 6. Tes lama yang berubah (yang sudah diketahui)
- `e2e/beranda.spec.ts` "halaman segera hadir…": baris `["/kursus", "Kursus"]` dihapus (`/kursus` bukan lagi "Segera hadir"). Asersi `aria-current` tautan header "Kursus" di `/kursus` tetap.
- `e2e/layout/touch-targets.spec.ts`: "Kembali ke Beranda" diukur di `/artikel`, bukan `/kursus`.
- `src/modules/progress/my-courses.integration.test.ts` "not enrolled → kembali…": harapan href → `/kursus/{slug}`.
- `src/components/learn/my-courses.test.tsx` keadaan kosong: tombol "Mulai materi 1" → tautan "Lihat →" dengan href detail.
- `e2e/belajar-kursus-saya.spec.ts` tes 2: (a) keadaan kosong menghitung tautan "Lihat →" (> 0, tanpa jumlah persis — STATUS 9 Nov, pelajaran no. 9); (b) `/belajar/{slug}` tanpa pendaftaran mendarat di `/kursus/{slug}` (h1 judul kursus).
- `GUEST_PAGES` (`e2e/layout/helpers.ts`) **tidak** diubah: `/kursus` kini katalog sungguhan dan ikut axe, tanpa-gulir-samping, dan screenshot di setiap lebar. Katalog di DB e2e berisi kursus dari spec lain, termasuk judul 80 karakter tanpa spasi — `wrap-anywhere` wajib.

Cari juga asersi keadaan lain yang berubah karena halaman baru (STATUS 14 Nov, pelajaran no. 3), mis. tes yang mengasersi `/kursus/{slug}` 404 atau teks "Segera hadir" di `/kursus`.

## Bukan lingkup tugas ini
- Preview materi 1 tanpa login dan gerbang 7c (B2); filter level/durasi dan "Urutkan" (B5); sampul gambar (B1); kotak peninjau 7b; rating, jumlah peserta, "Paling banyak diikuti".
- ISR + revalidasi on-demand saat terbit (keputusan 3); skeleton dan keadaan gagal 28d; halaman 404 14a; `/daftar` membaca `?next=` (area auth, butir "Pekerjaan kecil" STATUS); sitemap/SEO dan pencabutan `noindex`.
- Penanda "sudah diikuti" di kartu katalog; perapian S5-04 lain (STATUS 22 Nov); judul kursus Nilai Saya sebagai tautan.
- **Tidak diubah:** `src/db/**`, `package.json`, `package-lock.json`, `src/lib/rbac.ts`, `src/proxy.ts`, `next.config.ts`, `.github/**`, `src/app/api/**`, `src/app/(auth)/**`, `src/modules/{attempt,quiz,lesson}/**`, `src/components/shared/**`, `src/components/ui/**`, `src/components/learn/quiz/**`, `src/components/learn/{start-course-button,learn-dashboard}.tsx`, `src/components/public/coming-soon.tsx`, `src/styles/tokens.css`.
- **Jangan menjalankan `next upgrade`.** Pengingat keamanan Next 16.4.1 menghentikan `next build`/`next dev` sekali saat mendeteksi agent; jalankan ulang perintah yang sama.

Pekerjaan di luar lingkup → **berhenti dan tanyakan.**

## Berkas yang boleh dibuat/diubah
- `src/modules/course/{queries,serializer,service}.ts` + `serializer.test.ts`, dan satu berkas tes integrasi **baru** `src/modules/course/catalog.integration.test.ts` (PGlite, harness pola `course/service.integration.test.ts`)
- `src/app/(public)/kursus/page.tsx` (ubah), `src/app/(public)/kursus/[slug]/page.tsx` (baru)
- `src/components/public/{course-catalog,course-detail,course-enroll-cta}.tsx` + tesnya (baru)
- `src/lib/public-route-structure.test.ts` (baru)
- `src/modules/progress/service.ts` (hanya href `kembali`) + `my-courses.integration.test.ts` (hanya tes `kembali`)
- `src/app/(learn)/belajar/[slug]/page.tsx` (hanya komentar `kembali`)
- `src/components/learn/my-courses.tsx` + `my-courses.test.tsx` (hanya baris 13c)
- `e2e/kursus-katalog.spec.ts` (baru), `e2e/beranda.spec.ts` (hanya baris `/kursus`), `e2e/layout/touch-targets.spec.ts` (hanya "Kembali ke Beranda"), `e2e/belajar-kursus-saya.spec.ts` (hanya tes 2), `e2e/layout/axe.spec.ts` (langkah di tes yang sudah ada, tanpa tes baru)

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- hash basis (`6188302` + PR docs kartu ini) dan baseline Vitest **yang diukur**. Claude chat mengukur **133 berkas / 1624 tes** pada `6188302`. Bila angkamu berbeda, berhenti dan laporkan;
- ketiga kueri (kolom, filter, urutan, alias) dan tanda tangan DTO;
- cara `CourseEnrollCta` membaca sesi (tiga keadaan: memuat, tamu, member) dan cara tesnya memalsukan `authClient.useSession`;
- daftar tes lama yang berubah, satu per satu, dengan alasannya (bagian 6), ditambah hasil pencarianmu sendiri;
- urutan commit;
- **tabel mutasi dengan prediksi per baris** — nama tes yang diharapkan merah, bukan "integrasi/komponen".

## Selesai jika
Data uji memenuhi semua syarat kecuali yang sedang diuji (STATUS 14 Nov, pelajaran no. 6). Asersi daftar di PGlite atau DB e2e bersama memakai keberadaan berdasarkan slug/judul bertoken, bukan isi daftar persis (STATUS 9 Nov, pelajaran no. 9).

- [ ] **Integrasi** (PGlite, `src/modules/course/catalog.integration.test.ts`):
  - **Katalog:**
    - kursus `DRAFT`, `IN_REVIEW`, dan `ARCHIVED` yang **punya materi** tidak muncul; kursus `PUBLISHED` **tanpa** materi tidak muncul;
    - urutan `published_at desc`: tiga kursus dengan `published_at` dan `id` ditulis eksplisit, sehingga urutan `id asc`, urutan insert, dan urutan harapan berbeda (STATUS 21 Nov, pelajaran no. 3);
    - `lessonCount` per kursus: **dua kursus dengan 2 dan 3 materi dalam satu tes** (STATUS 22 Nov, pelajaran no. 2);
    - `estimatedMinutes` null dan terisi; `summary` null dan terisi.
  - **Detail:**
    - slug tidak ada, kursus `DRAFT`, kursus `ARCHIVED`, kursus `PUBLISHED` tanpa materi → `NotFoundError` yang sama;
    - outline urut `order_index asc, id asc`: dua materi dengan `order_index` sama, id eksplisit;
    - `durationSeconds`: READY + 100 → 100; NONE dengan durasi terisi → null; READY dengan durasi 0 → null;
    - `hasFinalQuiz` true dan false; `meta` dengan dan tanpa `seo_title`/`seo_description`.
- [ ] **Serializer:** allowlist `Object.keys` untuk `PublicCourseCardDTO`, `PublicCourseDetailDTO`, dan baris outline; `levelLabel`; `href`; aturan `durationSeconds` dan `meta`.
- [ ] **Komponen** (jsdom):
  - `CourseCatalog`: satu h1, satu h2 per kartu; "Lihat kursus" dengan href dan `aria-describedby` ke h2; meta sampul dengan dan tanpa menit; keadaan kosong;
  - `CourseDetail`: satu h1; baris meta; chip; outline berurutan, "{mm:ss} · video" vs "materi teks"; catatan Final dengan dan tanpa Final Quiz; "Tentang kursus ini" merender deskripsi; teks "Preview" dan "Terkunci" tidak ada;
  - `CourseEnrollCta`: sesi memuat → CTA tamu; tamu → dua tautan dengan href persis (`next` ter-encode); member → tombol "Mulai belajar" dan **tidak ada** tautan `/daftar` maupun `/masuk`;
  - `MyCourses` 13c: tautan "Lihat →" ke `/kursus/{slug}`, tanpa tombol "Mulai materi 1".
- [ ] **Struktur:** bagian 2.
- [ ] **E2E** `e2e/kursus-katalog.spec.ts` (proyek `chromium`, **paling banyak 2 tes**):
  1. **Tamu lalu member.** Kursus K (2 materi) lewat `createPublishedCourseViaApi`; `estimated_minutes = 12` lewat `withE2eDb`; `attachVideoInE2eDb(materi 1, …, 100)`.
     - Tamu (konteks tanpa sesi): `/kursus` → kartu K (dicari lewat h2 `exact: true`) memuat "Pemula · 2 materi", "2 materi · 12 menit", dan "Lihat kursus" → `/kursus/{slug}`.
     - Detail sebagai tamu: h1, baris meta, chip, outline dua baris ("01:40 · video" dan "materi teks"), catatan Final, "Tentang kursus ini" memuat teks deskripsi helper, "Daftar & mulai belajar" → `/daftar`, "Sudah punya akun? Masuk" → `/masuk?next=%2Fkursus%2F{slug}`; `meta[name="robots"]` noindex di katalog dan detail.
     - Member (`signInViaApi`): detail menampilkan "Mulai belajar" dan tidak menampilkan "Daftar & mulai belajar" (screenshot `detail-member` di 360 dan 1280, diambil sebelum klik) → klik → mendarat di halaman materi 1 → kembali ke detail → klik lagi → tetap mendarat di halaman materi (idempoten, tanpa galat).
     - Lebar 360, 768, 1024, 1280 untuk katalog dan detail (tamu): tanpa gulir samping (dokumen **dan** kartu K **dan** kotak CTA, pola `expectBoxFits`); di 360 "Lihat kursus" kartu K, kedua tautan CTA, dan tautan "Kursus" breadcrumb ≥ 44 × 44; screenshot. Tunggu h1 sebelum mengukur atau memotret.
  2. **404:** slug acak → 404; kursus `DRAFT` (`createCourseViaApi`, tidak diterbitkan) → 404 di `/kursus/{slug}` dan tidak tampil di katalog.

  Pencocokan teks dibatasi ke kartu atau baris yang tepat dengan `exact: true` (STATUS 20 Nov, pelajaran no. 4). Ukur durasi tes 1; bila > 45 dtk, `test.setTimeout` dengan alasan yang benar.
- [ ] **axe** (`axe.spec.ts`, w360 + w1280; langkah di tes yang sudah ada, tanpa membuat kursus baru): di tes "MEMBER: /belajar keadaan A lalu B…", setelah keadaan B: `/kursus/{kursus tes itu}` sebagai member, lalu konteks tamu baru → detail yang sama. Katalog tamu sudah tercakup `GUEST_PAGES`.
- [ ] **E2E lain tetap hijau.**
- [ ] **Screenshot** — `E2E_SCREENSHOT_DIR=~/binzi-s6-02-screenshots` (kosongkan folder dulu), jalankan **hanya** `kursus-katalog.spec.ts`. Harapan **10 berkas**: `katalog-{360,768,1024,1280}`, `detail-tamu-{360,768,1024,1280}`, `detail-member-{360,1280}`. Sebut jumlahnya di PR.
- [ ] **Uji mutasi** — commit lokal dulu dan `git status` bersih sebelum mutasi pertama; kembalikan dengan `git restore`. Mutasi yang dijalankan harus persis yang tertulis. Setiap mutasi kueri dijalankan juga dengan `-t` pada tes yang diprediksi merah saja, supaya merahnya tidak berasal dari data tes lain (STATUS 22 Nov, pelajaran no. 1). Laporkan per mutasi nama tes yang merah + pesannya:
  1. Katalog tanpa filter `PUBLISHED`.
  2. Katalog tanpa syarat punya materi.
  3. Urutan katalog `published_at asc`.
  4. Jumlah materi katalog memakai `lessonCountSql` dari `course/queries.ts` (bare-name).
  5. Jumlah materi katalog tanpa `counted.course_id = courses.id` (menghitung semua materi).
  6. Detail tanpa filter `PUBLISHED`.
  7. Detail tanpa syarat punya materi.
  8. Outline `order_index desc`. (Pemecah seri `id asc` dites, tetapi tidak dimutasi: urutan baris yang seri tidak dijamin Postgres, jadi mutasinya bisa lolos acak — STATUS 21 Nov, pelajaran no. 3.)
  9. `durationSeconds` tanpa syarat `READY`.
  10. `durationSeconds` tanpa syarat `> 0`.
  11. `meta.description` tanpa cadangan `summary`.
  12. `CourseEnrollCta`: member mendapat CTA tamu (sesi diabaikan).
  13. `CourseEnrollCta`: saat sesi memuat, `StartCourseButton` dirender.
  14. Tautan "Masuk" tanpa `next`.
  15. `kembali` S5-04 kembali ke materi 1.
  16. 13c kembali memakai `StartCourseButton`.
  17. `loading.tsx` ditambahkan di `src/app/(public)/kursus/[slug]/`.
  18. DTO detail ikut membawa `slug` materi.

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR. Harapan `0 excused / 0 blocking / OK` (21 info/low/moderate di sandbox 22 Nov). Temuan high/critical baru → berhenti dan tempel output lengkapnya.
- **Build dan rute:**
  - `npm run build`: `/kursus` ƒ dan `/kursus/[slug]` ƒ; `/` tetap ○.
  - Build juga dengan env persis job `ci` (`.github/workflows/ci.yml`: `NEXT_PUBLIC_APP_URL=http://localhost:3000`, `MAIL_TRANSPORT=log`, `DATABASE_URL=postgresql://ci:ci@localhost:6543/ci`) — harus lolos tanpa koneksi DB (keputusan 3). Lampirkan tabel rutenya.
  - `curl -sI` tanpa cookie: `/kursus` → 200; `/kursus/{slug terbit}` → 200; `/kursus/tak-ada` → 404.
- **Prettier:** berkas yang sudah ada tetap apa adanya; berkas baru boleh dirapikan.
- **`lint:hex`** menolak `#` diikuti 3/6 karakter hex di `src/`, termasuk komentar — tulis "PR 150", bukan "PR #150".
- **Anotasi desain:** grep perubahan untuk `\([A-Z]{1,4}-[0-9]+\)` dan `§` di teks yang dirender (`CLAUDE.md`).
- **`npm run e2e` penuh** sebelum PR. Bila satu tes gagal dengan `UNKNOWN_ERROR` dari siteverify Turnstile, salin blok galatnya sebelum menjalankan ulang (butir "Kandidat tes flaky" di STATUS) dan laporkan di PR.
- **`npm run check` di commit akhir:** tempel 5 baris terakhir output di PR.
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas (`AGENTS.md` tetap untracked).
- **"Keputusan & asumsi" di PR** memuat keputusan 1–13, semua copy *(usulan)*, dan keputusan yang diambil tanpa bertanya.
- **Setelah push:** buat PR segera begitu e2e lokal hijau, lalu kerjakan mutasi selagi CI berjalan. Perbarui isi PR dengan tabel mutasi. Cek CI (`gh pr checks`, job `ci` dan `e2e`), lalu laporkan durasi job `e2e` dibanding PR 150 (8m40s).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` (dua kali: env lokal dan env `ci`) · `npm run e2e`
- Baseline + jumlah tes baru; tes lama yang berubah disebut satu per satu.
- `git diff --stat main -- package-lock.json package.json src/db src/lib/rbac.ts src/proxy.ts next.config.ts .github src/app/api "src/app/(auth)" src/modules/attempt src/modules/quiz src/modules/lesson src/components/shared src/components/ui src/components/learn/quiz src/components/learn/start-course-button.tsx src/components/learn/learn-dashboard.tsx src/components/public/coming-soon.tsx src/styles` kosong.

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Screenshot `~/binzi-s6-02-screenshots` (10 berkas) diunggah ke Claude chat untuk ditinjau terhadap 7a/7f/7t/7b/7m.
- [ ] Lokal (Docker menyala):
  ```bash
  cd ~/Project/React/binzi-new && git fetch origin && git switch s6/s6-02-katalog-dan-detail && git pull --ff-only && npm run dev:db && npm run dev
  ```
  1. Jendela privat (tamu) → header "Kursus" → katalog → "Lihat kursus" → detail: outline, "Tentang kursus ini", CTA tamu.
  2. "Sudah punya akun? Masuk" → masuk dengan akun MEMBER → kembali ke detail yang sama → "Mulai belajar" → halaman materi 1.
  3. Akun yang sudah membuka materi 2 sebuah kursus → detail kursus itu → "Mulai belajar" → halaman materi 2.
  4. Akun MEMBER baru → Kursus Saya (kosong) → "Lihat →" → detail; `/belajar/{kursus}` dengan akun yang tidak terdaftar → detail kursus itu.
  5. Akun ADMIN: terbitkan satu kursus di CMS → kursus itu langsung tampil di katalog tanpa menunggu (keputusan 3).
  6. DevTools 360: kartu katalog, kepala detail, dan kotak CTA utuh; semua aksi bisa diketuk.
- [ ] **binzi-dev:** kartu ini tanpa migrasi.

## Catatan jadwal
- **Urutan commit yang disarankan:**
  1. `course`: kueri + serializer + service publik + tes serializer/integrasi;
  2. katalog: halaman + `CourseCatalog` + tes + tes struktur;
  3. detail: halaman + `CourseDetail` + `CourseEnrollCta` + tes;
  4. tindak lanjut S5-04 (`kembali` + 13c) + tes yang berubah;
  5. e2e + axe + screenshot + tes lama (`beranda`, `touch-targets`).

  Commit + push di antara bagian.
- **Bila terlambat**, yang dipotong lebih dulu:
  1. kartu ganjil terakhir melebar di 640–1023 (cukup dua kolom biasa);
  2. tiga butir bercentang di kotak CTA;
  3. lebar 1024 di e2e (360/768/1280 tetap).

  **Tidak dipotong:** katalog, detail + outline + deskripsi, CTA tamu/member, 404, tindak lanjut S5-04, axe.

## Catatan untuk kartu berikutnya
- **A6 (S5-05, profil dasar `/profil`):** ditulis Claude chat selagi A5 berjalan.
- **B2 (preview materi 1, 7c):** badge "Preview Gratis", "Putar preview" di baris materi 1, dan sampul bertombol putar di kartu CTA dibangun di atas halaman detail ini.
- **B5 (filter katalog):** chip level dan durasi 7a di atas grid; filter kosong 28e-1.
- **Sebelum rilis publik:** ISR + revalidasi on-demand saat terbit (PRD §10.4), cabut `noindex`, `/daftar` membaca `?next=` supaya tamu yang mendaftar dari detail kembali ke halaman yang sama.

## Catatan tinjauan 22 Nov (fakta kode di `6188302`)
| Klaim | Cara dicek | Hasil |
|---|---|---|
| Basis | `git diff --stat a4e903c 6188302` | Kosong: `main` = isi head PR 150 |
| Baseline | `npm run check` di sandbox pada `6188302` | 133 berkas / 1624 tes |
| Gate audit | `node scripts/check-audit.mjs` pada `6188302` | 0 excused / 0 blocking / OK, 21 info/low/moderate |
| Rute | `find "src/app/(public)"`, `src/proxy.ts:53` | `/kursus` = `ComingSoon` ber-`noindex`; `/kursus/[slug]` belum ada → 404. Matcher proxy hanya `/belajar/:path*`, `/profil`, `/cms/:path*` — `/kursus/**` publik |
| Layout publik | `src/app/(public)/layout.tsx`, `session-header.tsx:23` | Tanpa `cookies()`/`headers()`; `SessionHeader` klien membaca `authClient.useSession()`, CTA tamu selama memuat |
| Build CI | `.github/workflows/ci.yml:68–72`, komentar `src/app/(public)/page.tsx` | `next build` dengan `DATABASE_URL` dummy tanpa server; halaman yang membaca DB harus ƒ. Pola `export const dynamic = "force-dynamic"` sudah dipakai di `(auth)` |
| `lessonCountSql` modul course | `src/modules/course/queries.ts:84` | `${lessons.courseId} = ${courses.id}` terinterpolasi → bare-name di SELECT satu tabel. Pola aman: alias + tulis tangan (`progress/queries.ts`) |
| `StartCourseButton` | `start-course-button.tsx` | 401 → "Sesi Anda berakhir…" (tidak cocok untuk tamu); merender tombol + `<p role="alert">` sebagai dua elemen |
| Enroll idempoten | `progress/service.ts` `enrollInCourse` | `startHref` = materi terakhir ?? materi 1 |
| Deskripsi | `course/checklist.ts:109`, `src/components/shared/rich-content.tsx` | Deskripsi wajib sebelum terbit; `RichContent({ doc })` tanpa `"use client"`, memvalidasi dokumen |
| Helper e2e | `e2e/layout/helpers.ts` `createCourseViaApi`, `createPublishedCourseViaApi` | Ringkasan "Ringkasan netral untuk tes e2e.", level `BEGINNER`, deskripsi "Deskripsi netral {judul} untuk tes e2e."; `estimated_minutes` kosong |
| Tes lama | `e2e/beranda.spec.ts:322`, `e2e/layout/touch-targets.spec.ts:481`, `e2e/layout/helpers.ts:29`, tes `kembali` S5-04, tes 2 `belajar-kursus-saya.spec.ts` | Didaftar di bagian 6 |
| axe | `e2e/layout/axe.spec.ts:156` | Hanya w360 + w1280; "halaman tamu" memakai `GUEST_PAGES` (sudah memuat `/kursus`) |
| Kontras (dihitung di sandbox) | rumus WCAG atas `tokens.css` | `surface` di `video-bg` 13,41 (ujung terang) · `text-muted` di `surface-2` 7,05 · `text-subtle` di `surface-2` 5,13 · `text-subtle` di `fill` 4,66 · `text-meta` di `surface` 5,83 · `primary-deep` di `surface` 5,61 |
| Anggaran CI | PR 150 | `timeout-minutes: 30`; job `e2e` terakhir 8m40s |

Yang **belum** dicek dari sandbox: tampilan dengan font Lato asli dan Safari iOS (verifikasi pemilik).

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
