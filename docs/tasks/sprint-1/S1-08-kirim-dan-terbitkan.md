# S1-08 · Kirim & terbitkan kursus (versi demo)

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | S1-02 (builder, `evaluatePublishChecklist`, kunci DRAFT), S1-04 (editor materi & deskripsi, kunci 409), S1-09 (`questionInput`, `docToPlainText`, editor quiz) — semuanya sudah di `main` |
| **Target** | Selasa 10 Nov. Langkah ketujuh jalur demo 20 Nov |
| **Branch** | `s1/s1-08-kirim-terbitkan` |

> **Dibuat 9 Nov 2026** di Claude chat, ditinjau terhadap `main` `9edba60`, lalu **ditinjau ulang terhadap `e382359`** (setelah S6-01 #127 merge). Klaim teknis di kartu ini dijalankan dulu di sandbox (PGlite, Postgres 16 dengan migrasi + seed + seed demo sungguhan); buktinya di "Catatan tinjauan 9 Nov" paling bawah. Tinjauan ulang: S6-01 tidak mengubah satu pun berkas modul, komponen CMS, `src/lib`, `src/db`, maupun spec `e2e/cms-*` yang dirujuk kartu ini. Di `e2e/layout/helpers.ts` ia hanya menambah `GUEST_PAGES`, sehingga `createCourseViaApi`, `noSpaceTitle`, `expectNoHorizontalScroll`, dan `maybeScreenshot` tetap ada. Di `touch-targets.spec.ts` ia menambah satu tes Beranda.
>
> **Keputusan pemilik 9 Nov** (dicantumkan di "Keputusan & asumsi" PR sebagai keputusan yang sudah disetujui, bersama semua copy bertanda *(usulan)* di kartu ini):
>
> **Direvisi 9 Nov (sore)** setelah tinjauan ulang: data e2e bersama membuat isi antrean admin tidak deterministik (bagian 8, E2E), semua cek lebar tinggal di `cms-terbit.spec.ts` dengan berkas yang memang diizinkan (bagian 8), dan pesan 409 dari "Simpan" pindah ke banner status (bagian 5).
>
> 1. **Kirim hanya untuk EDITOR** (ahli gizi), sesuai tabel hak akses 18d. **Setujui & terbitkan hanya ADMIN+** (PRD §7, catatan ¹).
> 2. **`reviewer_id` = pengirim, `reviewed_at` = waktu kirim** (18d: "terisi otomatis dari akun ahli gizi penggarap"). Terbit ditolak bila `reviewer_id` kosong (Q6).
> 3. **Persetujuan lewat builder (opsi A).** `/cms/konten?status=menunggu` menjadi antrean sungguhan; baris membuka builder read-only; ADMIN+ melihat tombol "Setujui & terbitkan" di bar atas builder. Layar 19d (pratinjau + catatan + tiga aksi) tidak dibangun untuk demo.
> 4. **Dialog kirim mengikuti 20d:** tombol di bar atas selalu bisa diklik dan membuka dialog berisi checklist; tombol "Kirim" di dialog terkunci sampai lengkap.
> 5. **Tanpa jalan mundur di UI** ("Minta revisi", "Kembalikan ke draf", "Tarik kembali"). Jalan mundur saat gladi resik berupa SQL yang dicatat di STATUS.
> 6. **"Perlu revisi" = layar kosong.** Badge angka di sidebar dan email/notifikasi ditunda.

## Tujuan
Ahli gizi bisa mengirim kursus yang lengkap untuk persetujuan, dan admin bisa menyetujui sekaligus menerbitkannya. Status `DRAFT → IN_REVIEW → PUBLISHED` (CMS-05) berjalan lewat satu gerbang server yang sama dengan checklist builder (CMS-06), ditambah aturan soal PRD §11.4 no. 12. Kursus `PUBLISHED` inilah yang dibaca kartu peserta Rab 11.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD: `docs/prd/sections/06-7-cms.md` (CMS-05, CMS-06), `11-model-data.md` (§11.4 no. 12), `02-decision-log.md` (Q6), `07-navigasi-information-architecture.md` (catatan ¹ di bawah peta rute CMS).
- Desain (`docs/design/screens/`):
  - `18d.md`: alur dan tabel hak akses (siapa mengirim, siapa menyetujui);
  - `20d.md` + `.png`: dialog kirim untuk persetujuan (struktur dan copy dasar);
  - `19d.md` + `.png`: kolom kiri (daftar antrean), baris checklist "Penggarap tercatat", tombol hijau "Setujui & terbitkan";
  - `21a.md` + `.png`: bar atas builder ("Kirim untuk persetujuan", varian gelap).
- Kode:
  - `src/modules/course/{checklist,policy,service,queries,serializer,errors}.ts` (`evaluatePublishChecklist`, `getCourseBuilder`, pola kunci + audit di `updateCourseIfDraft`);
  - `src/modules/lesson/{service,queries}.ts` (`listOutlineByCourseId`, `quizQuestionCountSql`, urutan kunci di `createLessonWithQuiz`);
  - `src/modules/quiz/{service,queries,schema}.ts` (`lockOwnerCourse`, `questionInput`, `getMinQuestions`);
  - `src/lib/content-doc.ts` (`docToPlainText`, `isDocEmpty`), `src/lib/rbac.ts` (`requireApiRole`, `roleAtLeast`);
  - `src/app/api/cms/courses/[id]/route.ts` (pola route);
  - `src/components/cms/{course-builder,course-settings-panel,add-lesson-dialog,question-dialog,cms-pages,cms-nav}.tsx|ts` (`question-dialog.tsx`: pola `onCloseAutoFocus` → pembuka atau h1);
  - `src/app/(cms)/cms/konten/page.tsx`;
  - `src/components/ui/{button-variants.ts,banner.tsx,dialog.tsx,empty-state.tsx}`;
  - `src/emails/reset-password.ts` (`formatWib`), `src/db/seed-demo.ts`.
- E2E: `e2e/cms-quiz-editor.spec.ts` (pembuat soal lewat API, `finalQuizIdOf`), `e2e/cms-materi-editor.spec.ts` (kursus terkunci lewat SQL, `paragraphDoc`), `e2e/layout/helpers.ts`, `e2e/layout/axe.spec.ts`, `e2e/layout/touch-targets.spec.ts`, `e2e/fixtures.ts`.

## Kerjakan

### 1. Gerbang terbit di server — satu pemeriksaan untuk Kirim dan Terbitkan
Gerbang berjalan **di dalam transaksi, setelah baris kursus dikunci**. Semua penulis materi dan soal yang ada (tambah materi, isi materi, deskripsi, pengaturan, simpan soal) mengunci baris `courses` yang sama lebih dulu lalu memeriksa DRAFT. Dengan begitu materi atau soal dari tab lain mendarat sebelum gerbang (dan ikut diperiksa) atau sesudahnya (dan dijawab 409).

Isi gerbang, berurutan; kegagalan pertama menghentikan dan menjawab **409** (`ConflictError`):
1. **Checklist** lewat `evaluatePublishChecklist` dengan masukan yang dibaca **di transaksi yang sama**. Bentuk masukannya sama persis dengan yang dipakai `getCourseBuilder`, sehingga builder dan server tidak pernah berbeda pendapat. `minQuestions` dibaca lewat `getMinQuestions()` sebelum transaksi (gagal tertutup → 500, seperti builder). Belum lengkap → *(usulan)* "Syarat terbit belum lengkap — lihat daftar syarat di halaman kursus."
2. **Aturan soal (§11.4 no. 12)** untuk setiap quiz materi (urut `order_index` materi) lalu Final Quiz; di dalam quiz urut `order_index` soal. Setiap soal tersimpan dipetakan ke bentuk `questionInput` — `text` dan `explanation` lewat `docToPlainText`, opsi urut `order_index` sebagai `{ text, isCorrect }` — lalu `questionInput.safeParse`. Pelanggaran pertama → *(usulan)* "`{Lokasi}`, soal `{nn}`: `{pesan aturan}`", dengan lokasi "Quiz materi `{n}`" atau "Final Quiz" dan nomor dua digit seperti 22a. Contoh: "Final Quiz, soal 03: Tandai tepat satu kunci jawaban."

Pembacaan lintas modul memakai fungsi service yang menerima `tx` (pola `createEmptyFinalQuiz(tx)`):
- modul **lesson**: baris checklist materi (`orderIndex`, isi kosong/tidak, `quizId`, jumlah soal) untuk satu kursus, dengan `tx`;
- modul **quiz**: daftar pelanggaran aturan soal untuk sekumpulan quiz berlabel, dengan `tx`. Pemetaan ke `questionInput` tinggal di modul quiz, sehingga aturan soal tetap satu sumber.

Arah impor tetap: course → lesson, course → quiz. Modul lesson dan quiz tidak mengimpor modul course.

### 2. Kirim dan Terbitkan — service, policy, API
**Policy** (`src/modules/course/policy.ts`), fungsi murni:
- `canSubmitRole(role)` → `role === "EDITOR"` (persis, bukan `roleAtLeast`).
- `canPublishRole(role)` → `roleAtLeast(role, "ADMIN")`.
- `courseActionsFor(role, status)` → `{ canSubmit: canSubmitRole(role) && status === "DRAFT", canPublish: canPublishRole(role) && status === "IN_REVIEW" }`.

**`submitCourse(actor, courseId)`** — `POST /api/cms/courses/{id}/submit`:
1. `requireApiRole("EDITOR", request)` di route; id bukan UUID → 404; **di service, sebelum apa pun:** `canSubmitRole` gagal → 403 *(usulan)* "Hanya ahli gizi yang bisa mengirim kursus untuk persetujuan."
2. Transaksi: kunci baris `courses` (`.for("update", { of: courses })` bila query memakai join) → tidak ada → 404; status bukan `DRAFT` → 409 *(usulan)* "Kursus sudah dikirim atau terbit — hanya draf yang bisa dikirim."
3. Gerbang bagian 1.
4. Update: `status = IN_REVIEW`, `reviewer_id = actor.id`, `reviewed_at = now()`, `updated_by = actor.id`.
5. Satu baris audit `course.submit`, `entity_type = "course"`, berisi ringkasan saja: before `{ status }`, after `{ status, reviewerId, reviewedAt }`.
6. Jawab 200 `{ data: CmsCourseBuilderDTO }`.

**`publishCourse(actor, courseId)`** — `POST /api/cms/courses/{id}/publish`:
1. `requireApiRole("ADMIN", request)` di route; id bukan UUID → 404; di service `canPublishRole` (lapis kedua).
2. Transaksi: kunci → 404; status bukan `IN_REVIEW` → 409 *(usulan)* "Kursus tidak sedang menunggu persetujuan."
3. `reviewer_id` kosong → 409 *(usulan)* "Penggarap belum tercatat — kursus harus dikirim ulang dari draf."
4. Gerbang bagian 1 **sekali lagi** (setelan `quiz.min_questions` atau data bisa berubah sejak dikirim).
5. Update: `status = PUBLISHED`, `published_at = now()`, `updated_by = actor.id`. `reviewer_id` dan `reviewed_at` tidak disentuh.
6. Audit `course.publish`: before `{ status }`, after `{ status, publishedAt }`.
7. Jawab 200 `{ data: CmsCourseBuilderDTO }`.

Kedua route tidak membaca body. Pola error mengikuti route PATCH kursus: galat domain (< 500, `ZodError`) tidak di-log, sisanya di-log lalu `toErrorResponse()`.

### 3. Data halaman builder: `review` dan `actions`
`getCourseBuilder` (DTO halaman `CourseBuilderDTO`, bukan `CmsCourseBuilderDTO`) mendapat dua field:
- `review: { reviewerName: string; reviewedAt: string } | null` — nama peninjau dengan pola `ownerDisplayName` (nama, atau email bila nama kosong), `reviewedAt` string ISO. `null` bila `reviewer_id` kosong.
- `actions: { canSubmit: boolean; canPublish: boolean }` dari `courseActionsFor(actor.role, status)` — sumber yang sama dengan policy server.

`CmsCourseBuilderDTO` (dipakai jawaban PATCH dan isi audit) **tidak** berubah.

### 4. Builder: tombol, dua dialog, banner status
**Bar atas** (baris judul, kanan):
- `actions.canSubmit` → "Kirim untuk persetujuan" (varian `dark`, 21a), di sebelah "Simpan".
- `actions.canPublish` → "Setujui & terbitkan" (varian baru `success`, 19d). Builder tetap read-only untuk admin.

**Varian tombol `success`** di `src/components/ui/button-variants.ts`: `bg-success text-surface hover:brightness-90`, setara `danger`. Teks putih di `success` berkontras 4,96:1 (diukur). Tambahkan satu baris contoh di `/dev/ui`.

**Dialog kirim (20d)** — `SubmitCourseDialog`:
- Eyebrow "KIRIM UNTUK PERSETUJUAN" (20d). Judul: "Semua syarat terpenuhi" / "Satu hal belum lengkap" / "`{n}` hal belum lengkap" *(usulan, mengikuti pola 20d)*. `n` = jumlah butir checklist belum terpenuhi + 1 bila pengaturan belum disimpan.
- Paragraf *(usulan, dari 20d)*: "Validasi yang sama dijalankan server saat admin menekan Setujui & terbitkan — lebih baik ketahuan sekarang."
- Baris checklist dari `builder.checklist` dengan tampilan baris yang sama dengan blok checklist panel (✓ hijau / lingkaran kosong 20 px, teks sr-only "terpenuhi" / "belum terpenuhi"). Ekstrak baris itu menjadi komponen bersama; blok panel memakainya juga.
- **Pengaturan belum disimpan** (`formState.isDirty` formulir panel) → baris peringatan *(usulan)* "Pengaturan kursus belum disimpan — simpan dulu, lalu kirim." dan "Kirim" terkunci.
- Tombol: "Kembali menyunting" (`secondary`, menutup dialog) dan "Kirim" (`dark`). Saat belum lengkap atau belum disimpan, "Kirim" memakai `softDisabled` (tetap bisa difokus) **dan** handler menolak: tanpa `fetch`.
- Catatan kaki *(usulan)*: "Setelah terkirim, kursus terkunci dari suntingan sampai admin menyetujuinya."
- Penjaga `inFlight` di handler (pelajaran 7 Nov no. 6).

**Dialog terbitkan** — `PublishCourseDialog`:
- Eyebrow "SETUJUI & TERBITKAN"; judul *(usulan)* "Terbitkan kursus ini?".
- Baris checklist yang sama, ditambah baris peninjau: "Penggarap tercatat: `{reviewerName}`" (19d) bila `review` ada, atau *(usulan)* "Penggarap belum tercatat" (belum terpenuhi).
- Catatan kaki *(usulan)*: "Setelah terbit, kursus bisa diikuti peserta dan tetap terkunci dari suntingan."
- Tombol: "Batal" (`secondary`) dan "Setujui & terbitkan" (`success`), terkunci dengan aturan yang sama bila ada syarat atau peninjau yang belum terpenuhi. Penjaga `inFlight`.

**Respons → tampilan** (kedua dialog sama):
| Respons | Dialog | Banner status | Lainnya |
|---|---|---|---|
| 200 | tutup | sukses *(usulan)*: "Kursus terkirim — menunggu persetujuan admin." / "Kursus terbit." | `router.refresh()` |
| 409 / 403 / 404 | tutup | galat: pesan server | `router.refresh()` |
| 5xx / jaringan | tutup | galat *(usulan)*: "Kursus belum terkirim." / "Kursus belum terbit." + "Periksa koneksi Anda lalu coba lagi." | — |

**Banner status** tinggal tepat di bawah baris judul builder (bukan di panel kanan), memakai `Banner`. Ia harus terlihat penuh di viewport setelah aksi di semua lebar — di 360 panel kanan berada jauh di bawah outline.

**Fokus.** Dialog dibuka lewat state atau `DialogTrigger` — keduanya boleh, asalkan:
- tutup dengan Esc, "Kembali menyunting", atau "Batal" → fokus kembali ke tombol pembuka;
- setelah 200 atau 409, ketika `router.refresh()` menghilangkan tombol pembuka, fokus berakhir di **h1 builder** (diberi `tabIndex={-1}`), bukan `body`.

Mekanisme yang disarankan: ref "permintaan fokus" yang dikonsumsi efek pasca-commit saat `course.status` atau `actions` berubah — pembuka bila masih terhubung, selain itu h1 (gabungan pola `pendingSaveFocus` S1-02 dan `onCloseAutoFocus` S1-09).

### 5. Dua perbaikan 409 (STATUS 4 Nov malam)
Keduanya baru bisa terjadi setelah kartu ini membuat status non-DRAFT tercapai dari tab lain.
1. **Simpan pengaturan → 409:** setelah `router.refresh()` tombol Simpan hilang, sehingga efek fokus memfokuskan ref yang `null` dan fokus jatuh ke `body`. Perbaiki dua hal:
   - fokus: Simpan bila masih terhubung, selain itu h1 (mekanisme yang sama dengan bagian 4);
   - pesan 409 tampil di **banner status** di bawah judul, bukan di banner panel pengaturan. Formulirnya berubah menjadi read-only, dan di 360 panel itu berada di bawah outline, jauh dari h1 yang menerima fokus.

   Banner panel tetap dipakai untuk hasil Simpan lainnya: sukses, 400, galat umum, dan jaringan.
2. **Dialog tambah materi → 409** saat ini jatuh ke galat umum "periksa koneksi". Perbaiki: dialog tertutup, pesan server tampil di banner status builder, `router.refresh()`, fokus ke h1. Dialog melapor ke builder lewat prop (mis. `onConflict(message)`), karena builder berhenti merender dialog setelah status berubah.

### 6. Antrean `/cms/konten`
Placeholder diganti halaman sungguhan. Judul tetap dari `getActiveCmsItem` (tidak berubah).
- **ADMIN+ ("Persetujuan")**: semua kursus `IN_REVIEW`.
- **EDITOR ("Menunggu persetujuan")**: kursus `IN_REVIEW` yang **dikirim akun itu** (`reviewer_id = actor.id`), sesuai PRD §7 catatan ¹ ("konten miliknya").
- **EDITOR "Perlu revisi"** (`status=perlu-revisi`): `EmptyState` *(usulan)* "Belum ada konten yang perlu direvisi."
- Urutan: `reviewed_at` paling lama di atas (antrean).
- Kepala: pil jumlah *(usulan, 19d)* "`{n}` menunggu".
- Satu baris per kursus, mengikuti kolom kiri 19d:
  - eyebrow "KURSUS · `{reviewerName}` · `{waktu}`", dengan waktu dari `formatWib` (zona `Asia/Jakarta`; server Vercel memakai UTC);
  - di bawahnya judul sebagai tautan ke `/cms/kursus/{id}`. Area tautan setinggi minimal 44 px, dan judul tanpa spasi dibungkus (`wrap-anywhere`).
  - Peninjau kosong (data lama) → eyebrow *(usulan)* "KURSUS · PENGGARAP BELUM TERCATAT · —".
- Kosong → `EmptyState` *(usulan)* "Tidak ada kursus yang menunggu persetujuan."

Service baru `listCourseApprovalQueue(actor)` (EDITOR+, peran dicek sebelum query), DTO baru dengan field eksplisit `{ id, title, reviewerName: string | null, reviewedAt: string | null }`. Peninjau di-join dengan `alias(users, …)` + left join.

**`formatWib`** pindah ke `src/lib/datetime.ts`. `src/emails/reset-password.ts` mengimpornya dan mengekspornya ulang, sehingga `src/emails/templates.test.ts` tidak berubah.

### 7. Seed demo dan helper e2e
- `src/db/seed-demo.ts`: kursus contoh 3 (`IN_REVIEW`) mendapat `reviewerId = DEMO_AUTHOR_ID` dan `reviewedAt` tetap (mis. `new Date("2026-10-28T03:00:00Z")`), supaya data seed memenuhi invarian baru (IN_REVIEW ⇒ peninjau terisi). Seed memakai `onConflictDoNothing`, jadi DB lokal yang sudah terisi tidak ikut berubah — lihat "Verifikasi oleh kamu".
- `e2e/layout/helpers.ts`: helper baru `createPublishableCourseViaApi(context, title)` di sebelah `createCourseViaApi`, untuk akun EDITOR yang sudah masuk. Isinya:
  - buat kursus;
  - `PUT …/description` berisi satu paragraf;
  - buat satu materi (jawaban memuat `quizId`), lalu `PATCH` isi materi;
  - 10 soal PG ke quiz materi dan 10 soal PG ke Final Quiz lewat `POST /api/cms/quizzes/{quizId}/questions`. Id Final Quiz dibaca lewat `withE2eDb`, seperti `finalQuizIdOf`.
  - Jawab `{ courseId, lessonId, lessonQuizId, finalQuizId }`.
  - Teks soal netral bertoken, tanpa istilah gizi (CLAUDE.md).

### 8. Aksesibilitas, target sentuh, lebar
**Data e2e bersama.** `binzi_e2e` diisi `seed.ts` saja (tanpa seed demo), tetapi `cms-materi-editor.spec.ts` dan `cms-quiz-editor.spec.ts` meninggalkan kursus `IN_REVIEW` hasil SQL dengan `reviewer_id` NULL. Antrean ADMIN karena itu selalu berisi baris dari tes lain (termasuk "PENGGARAP BELUM TERCATAT"). Akibatnya:
- tes **tidak** mengasersi jumlah baris, pil "`{n}` menunggu", atau keadaan kosong untuk ADMIN — hanya keberadaan baris kursus milik tes itu (judul bertoken);
- keadaan kosong diuji lewat akun **EDITOR baru**, yang antreannya pasti kosong (hanya kirimannya sendiri), dan di tes komponen.

**axe** (`e2e/layout/axe.spec.ts`), proyek w360 dan w1280 saja (`test.skip` di lebar lain, pola tes yang sudah ada):
- dialog kirim dalam keadaan lengkap dan belum lengkap;
- dialog terbitkan;
- `/cms/konten` sebagai ADMIN (berisi minimal satu baris);
- `/cms/konten` sebagai EDITOR baru (kosong) dan "Perlu revisi".

**Target sentuh** (`e2e/layout/touch-targets.spec.ts`, satu tes baru di w360): "Kirim untuk persetujuan", "Kirim", "Kembali menyunting", "Setujui & terbitkan" (bar atas dan dialog), "Batal", dan tautan baris antrean.

**Tanpa gulir samping** — di `e2e/cms-terbit.spec.ts` (proyek `chromium`) dengan `page.setViewportSize` dan `expectNoHorizontalScroll` dari `e2e/layout/helpers.ts`. `no-horizontal-scroll.spec.ts` tidak termasuk berkas yang diizinkan dan tidak diubah.
- 360 × 780: builder DRAFT (EDITOR) dengan judul 80 karakter tanpa spasi (`noSpaceTitle`), karena bar atas kini memuat dua tombol; `/cms/konten` sebagai ADMIN, yang barisnya memuat judul seperti itu.
- **1024 × 800**: builder DRAFT yang sama. 1024 adalah awal tata letak dua kolom builder (`lg:`) dan tidak termasuk lebar proyek (360/700/768/1280/1440) — pelajaran 4 Nov malam.

`e2e/rbac.spec.ts` tidak berubah: baris `/cms/konten` sudah ada (EDITOR/ADMIN 200, MEMBER 403), dan kartu ini tanpa halaman baru.

## Bukan lingkup tugas ini
- **Setelah demo (PRD v1.6):** "Minta revisi" dan status `NEEDS_REVISION`, catatan untuk penggarap, "Setujui & jadwalkan" (CMS-15 tetap W), "Tarik kembali"/unpublish dan `ARCHIVED`, layar keputusan 19d dengan pratinjau (CMS-11), badge angka sidebar, kartu antrean di Ringkasan admin 19b, email/notifikasi, artikel.
- **Kartu lain:** sampul dan syarat sampul (S1-07), katalog dan daftar kursus peserta (Rab 11), penjaga perubahan di navigasi sidebar (setelah demo).
- **Tidak diubah:** baris "bobot 40% Nilai Akhir" di blok Final Quiz builder (catatan STATUS 4 Nov), aturan isi checklist S1-02, `CmsCourseBuilderDTO`, `src/lib/rbac.ts`.

Pekerjaan di luar lingkup → **berhenti dan tanyakan.**

## Berkas yang boleh dibuat/diubah
- `src/modules/course/{policy,service,queries,serializer,errors}.ts` + `policy.test.ts`, `serializer.test.ts`, `service.integration.test.ts`
- `src/modules/lesson/{service,queries}.ts` (baris checklist dengan `tx`) + tes integrasinya
- `src/modules/quiz/{service,queries}.ts` (pelanggaran aturan soal dengan `tx`) + tes integrasinya
- `src/app/api/cms/courses/[id]/submit/route.ts`, `src/app/api/cms/courses/[id]/publish/route.ts` (baru)
- `src/app/(cms)/cms/konten/page.tsx`; `src/components/cms/approval-queue.tsx` (baru) + tes
- `src/components/cms/course-builder.tsx`, `course-settings-panel.tsx` (ekstraksi baris checklist), `add-lesson-dialog.tsx`, `course-publish-dialogs.tsx` (baru) + tes komponennya (`course-builder.test.tsx`, `add-lesson-dialog.test.tsx`, tes baru dialog)
- `src/components/ui/button-variants.ts` (varian `success`) + `button.test.tsx`; `src/app/(dev)/dev/ui/page.tsx` (satu baris contoh)
- `src/lib/datetime.ts` (baru); `src/emails/reset-password.ts` (impor + ekspor ulang `formatWib`)
- `src/db/seed-demo.ts` (peninjau kursus contoh 3)
- `e2e/cms-terbit.spec.ts` (baru), `e2e/layout/helpers.ts`, `e2e/layout/axe.spec.ts`, `e2e/layout/touch-targets.spec.ts`

Tanpa migrasi (kolom `reviewer_id`, `reviewed_at`, `published_at` sudah ada sejak A-07), tanpa dependensi baru, dan tanpa perubahan `package.json`/`package-lock.json`.

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- **hash basis branch** (`git log --oneline -1`), yang harus sama dengan `main` terbaru;
- daftar berkas, signature setiap ekspor baru, dan bentuk kedua DTO baru;
- urutan langkah di kedua transaksi, termasuk di mana `getMinQuestions` dibaca dan bagaimana `tx` mengalir ke modul lesson dan quiz;
- mekanisme fokus pasca-refresh (bagian 4 dan 5) dalam satu kalimat per kasus;
- letak setiap pesan: tabel respons (Kirim, Terbitkan, Simpan, Tambah materi) → banner status atau banner panel;
- daftar tes lama yang berubah, satu per satu. Yang sudah diketahui: `builderFixture` dan `renderBuilder` di `course-builder.test.tsx` (field `review` dan `actions`); tes `add-lesson-dialog` untuk 409;
- daftar tes per bagian "Selesai jika";
- untuk setiap mutasi: tes yang diharapkan merah, beserta tes yang diperkirakan tetap hijau karena tertutup lapis lain.

## Selesai jika
- [ ] **Tes policy** (node): `courseActionsFor` untuk 4 peran × 4 status — `canSubmit` hanya EDITOR + DRAFT, `canPublish` hanya ADMIN/SUPER_ADMIN + IN_REVIEW.
- [ ] **Tes integrasi** (PGlite, pola `service.integration.test.ts`; helper lokal "kursus lengkap" lewat service yang sudah ada):
  - **Kirim berhasil:** status `IN_REVIEW`; `reviewer_id` = pengirim; `reviewed_at` terisi; `updated_by`; satu baris audit `course.submit` berisi ringkasan saja (tanpa dokumen TipTap).
  - **Peninjau = pengirim, bukan pembuat:** kursus dibuat EDITOR A, dikirim EDITOR B → `reviewer_id` = B.
  - **Penjagaan kirim:**
    - ADMIN, SUPER_ADMIN, MEMBER → 403 tanpa tulis dan tanpa audit;
    - status bukan DRAFT → 409;
    - id tidak dikenal → 404.
  - **Gerbang kirim**, masing-masing → 409 dengan pesan persis, DB dan audit tidak berubah:
    - tanpa materi;
    - quiz materi 9 soal;
    - deskripsi kosong;
    - soal dirusak lewat SQL — dua kunci di quiz materi 1 soal 2 → "Quiz materi 1, soal 02: Tandai tepat satu kunci jawaban."; pembahasan NULL di Final Quiz soal 1 → "Final Quiz, soal 01: Pembahasan wajib diisi.";
    - urutan pelaporan: materi dulu, lalu Final Quiz.
  - **Terbitkan berhasil** (ADMIN dan SUPER_ADMIN): `PUBLISHED`, `published_at` terisi, peninjau tidak berubah, audit `course.publish`.
  - **Penjagaan terbitkan:**
    - EDITOR → 403;
    - DRAFT dan PUBLISHED → 409;
    - `reviewer_id` NULL (SQL) → 409;
    - `quiz.min_questions` dinaikkan ke 11 setelah kirim → 409;
    - soal dirusak setelah kirim → 409.
  - **`getCourseBuilder`:** `actions` mengikuti peran × status; `review` null sebelum kirim, terisi sesudahnya.
  - **`listCourseApprovalQueue`:** hanya `IN_REVIEW`; urut `reviewed_at` naik; EDITOR hanya melihat kirimannya sendiri; peninjau NULL → `reviewerName: null`; MEMBER → 403.
- [ ] **Tes komponen dialog** (jsdom):
  - judul untuk 0, 1, dan 3 kekurangan;
  - baris pengaturan belum disimpan;
  - "Kirim" `aria-disabled` dan `fireEvent.submit` → tanpa `fetch`, baik saat belum lengkap maupun saat belum disimpan;
  - lengkap → satu `fetch` `POST /api/cms/courses/{id}/submit`;
  - submit ganda selagi `fetch` pertama tertunda (jeda tetap, bukan `waitFor`) → satu `fetch`;
  - Esc → fokus ke pembuka;
  - dialog terbitkan: baris "Penggarap tercatat: …" dan versi belum tercatat, terkunci tanpa peninjau.
- [ ] **Tes komponen builder:**
  - tombol muncul hanya sesuai `actions`;
  - 200 → banner sukses + `router.refresh`;
  - 409 → banner berisi pesan server;
  - render ulang dengan status baru → **h1 terfokus**, juga untuk jalur Simpan → 409 (bagian 5 no. 1);
  - Simpan → 409: pesan di banner status (di bawah judul), bukan di panel. Tes lama `course-builder.test.tsx` "shows the 409 lock message, refreshes, and returns focus to Simpan" kemungkinan tetap hijau, karena `findByText` mencari di mana saja dan, tanpa refresh sungguhan di jsdom, Simpan masih terhubung. Bila asersinya diubah, sebut di PR.
- [ ] **Tes `add-lesson-dialog`:** 409 → `onConflict` dipanggil dengan pesan server, bukan galat umum.
- [ ] **Tes `approval-queue`:** baris (eyebrow, tautan, waktu WIB dari ISO UTC), pil jumlah, kosong, varian "Perlu revisi".
- [ ] **Tes varian tombol** `success` dan `formatWib` dari lokasi barunya (tes email lama tetap hijau tanpa diubah).
- [ ] **E2E** (`e2e/cms-terbit.spec.ts`, proyek `chromium` 1280 × 800; lebar lain lewat `page.setViewportSize`). Antrean ADMIN tidak diasersi jumlah maupun kosongnya (bagian 8).
  1. EDITOR, kursus dari `createPublishableCourseViaApi`: builder → "Kirim untuk persetujuan" → dialog "Semua syarat terpenuhi" → "Kirim" → banner sukses `toBeInViewport({ ratio: 1 })` di w1280 **dan** w360; badge "Menunggu persetujuan"; "Simpan" dan "Kirim untuk persetujuan" hilang; h1 `toBeFocused()`.
  2. EDITOR → sidebar "Menunggu persetujuan" → kursus tampil dengan nama pengirim.
  3. ADMIN → "Persetujuan" → klik kursus → builder read-only dengan "Setujui & terbitkan" → dialog memuat "Penggarap tercatat: `{nama EDITOR}`" → setujui → banner "Kursus terbit." dalam viewport, badge "Terbit". DB: `PUBLISHED`, `published_at` terisi, `reviewer_id` = EDITOR; dua baris audit.
  4. Kursus baru yang belum lengkap: dialog menampilkan kekurangan; klik "Kirim" → **tidak ada request** ke `/submit` (dicatat lewat `page.on("request")`, diasersi setelah jeda tetap ±500 ms, bukan `waitFor` — pelajaran 4 Nov).
  5. Ubah judul tanpa Simpan → dialog menampilkan baris belum disimpan, "Kirim" terkunci.
  6. **API:**
     - ADMIN `POST /submit` → 403; EDITOR `POST /publish` → 403; MEMBER keduanya → 403;
     - kirim kedua → 409; terbitkan kursus DRAFT → 409;
     - id bukan UUID → 404.
  7. **409 dari tab lain** (dua halaman EDITOR membuka builder yang sama sebelum ada yang mengirim; kursus lengkap dari helper):
     - **Simpan:** halaman B mengirim; halaman A mengubah judul lalu menekan "Simpan" → banner **status** berisi pesan 409 `toBeInViewport({ ratio: 1 })`, h1 terfokus.
     - **Tambah materi** (kursus lengkap kedua): halaman A membuka "+ Tambah materi" dan mengisi judul; halaman B mengirim; halaman A menekan "Buat & buka editor →" → dialog tertutup, banner pesan 409, h1 terfokus, tanpa navigasi ke editor materi.
  8. **Lebar** (bagian 8): tanpa gulir samping di 360 (builder dan `/cms/konten`) dan 1024 (builder).
- [ ] **axe, target sentuh, lebar:** bagian 8.
- [ ] **Uji mutasi** — commit lokal dulu dan `git status` bersih sebelum mutasi pertama; kembalikan setiap mutasi dengan `git restore`. Laporkan per mutasi nama tes yang merah beserta pesannya. Mutasi yang hanya tertangkap E2E dijalankan dengan `npx playwright test --grep …` sungguhan.
  1. `canSubmitRole` memakai `roleAtLeast(role, "EDITOR")`.
  2. Cek `DRAFT` di transaksi kirim dihapus.
  3. Checklist dihapus dari gerbang kirim.
  4. Aturan soal dihapus dari gerbang (kirim dan terbitkan).
  5. Gerbang tidak dijalankan ulang saat terbitkan (hanya saat kirim).
  6. Cek `reviewer_id` kosong dihapus dari terbitkan.
  7. `reviewer_id` diisi dari `created_by`, bukan pengirim.
  8. `published_at` tidak diisi.
  9. Baris audit `course.submit` tidak ditulis.
  10. `canPublish` juga benar untuk EDITOR.
  11. Penjaga "belum lengkap" di handler dialog kirim dihapus (tombol tetap `aria-disabled`).
  12. Penjaga "pengaturan belum disimpan" dihapus.
  13. Fokus cadangan ke h1 dihapus (bagian 4 dan 5).
  14. Cabang 409 dialog tambah materi dihapus.
  15. Penjaga `inFlight` dialog kirim dihapus.
  16. Banner status dipindah ke panel kanan → E2E no. 1 merah di w360.

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`. `main` sudah memuat S6-01.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR. Harapan: 0 excused / 0 blocking / 23 (dikonfirmasi di `main` `9edba60` dan `e382359`, 9 Nov). Angka lain atau temuan blocking baru → berhenti dan tempel output lengkapnya.
- **Prettier:** berkas yang sudah ada tetap apa adanya, sehingga diff sebatas lingkup. Berkas baru boleh dirapikan.
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas.
- **"Keputusan & asumsi" di PR** memuat semua copy usulan dan keputusan yang diambil tanpa bertanya.
- **Screenshot**, diambil lokal dengan `E2E_SCREENSHOT_DIR` (konvensi A-19b), `animations: "disabled"`. Banner sukses hilang sendiri setelah 4 detik, jadi diambil segera:
  - w1280 dan w360: builder DRAFT (EDITOR) dengan kedua tombol; dialog kirim lengkap, belum lengkap, dan belum disimpan; banner sukses kirim; builder IN_REVIEW (ADMIN) dengan "Setujui & terbitkan"; dialog terbitkan; banner "Kursus terbit."; `/cms/konten` ADMIN (berisi baris dari tes lain — wajar), EDITOR (satu baris), EDITOR baru (kosong), dan "Perlu revisi";
  - w1024: builder DRAFT dengan kedua tombol.
- **Setelah push:** cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`
- Baseline Vitest = angka di `main` saat sesi dimulai, disebut di rencana. Di `e382359` (setelah S6-01): **98 berkas / 1030 tes** (dijalankan di sandbox 9 Nov). PR melaporkan baseline + jumlah tes baru; tes lama yang berubah disebut satu per satu.
- `git diff --stat main -- package.json package-lock.json src/db/migrations src/db/schema` kosong

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Lokal: Docker menyala, lalu jalankan:
  ```bash
  cd ~/Project/React/binzi-new && npm run dev:db && npm run db:seed:demo
  ```
  Kemudian kembalikan kursus contoh 3 ke draf. Ini SQL jalan mundur yang sama dengan gladi resik, versi lokal; harapan output `UPDATE 1`:
  ```bash
  docker exec binzi-local-db psql -U postgres -d binzi_local -c "update courses set status = 'DRAFT', reviewer_id = null, reviewed_at = null, published_at = null where slug = 'demo-kursus-contoh-3';"
  ```
  Lalu `npm run dev`. Butuh dua akun lokal: EDITOR dan ADMIN (peran diubah dengan `npm run user:role`, caranya di `docs/development-lokal.md`). Pakai jendela privat untuk akun kedua.
  1. **EDITOR:** `/cms/kursus` → "[DEMO] Kursus contoh 3" → "Kirim untuk persetujuan" → "Semua syarat terpenuhi" → "Kirim" → banner sukses, badge "Menunggu persetujuan", kedua tombol hilang.
  2. **EDITOR:** "[DEMO] Kursus contoh 1" → dialog menampilkan kekurangan, "Kirim" terkunci. Ubah judul tanpa Simpan → baris "belum disimpan" muncul.
  3. **EDITOR:** sidebar "Menunggu persetujuan" → kursus contoh 3 tampil dengan nama Anda dan jam WIB.
  4. **ADMIN:** "Persetujuan" → kursus contoh 3 → "Setujui & terbitkan" → dialog "Penggarap tercatat: `{nama akun EDITOR}`" → setujui → "Kursus terbit.", badge "Terbit".
  5. **Keyboard saja**, kedua dialog: Tab sampai tombol, Esc menutup dan fokus kembali ke pembuka; setelah sukses, Tab berikutnya mulai dari judul halaman.
- [ ] Unggah folder screenshot ke Claude chat untuk dibandingkan dengan 20d, 19d, dan 21a.
- [ ] **Pasca-merge:** kartu ini tanpa migrasi, jadi tidak perlu `db:migrate:binzi-dev`.

## Catatan jadwal
- Sesi dimulai setelah kartu ini masuk `main` lewat PR docs (aturan STATUS: docs hanya di antara PR). S6-01 sudah di-merge (#127).
- **Bila terlambat**, yang dipotong lebih dulu: tampilan EDITOR di `/cms/konten` tetap placeholder (antrean admin tetap dibangun; ahli gizi melihat status di tab "Menunggu" `/cms/kursus`), lalu baris checklist di dialog terbitkan (baris peninjau tetap). Gerbang server, kedua endpoint, kedua tombol, dan kedua perbaikan 409 tidak dipotong.

## Catatan keputusan
- **Persetujuan di builder (opsi A).** Builder sudah memperlihatkan outline dan checklist, dan editor materi menampilkan teks read-only untuk kursus IN_REVIEW (`cms-materi-editor.spec.ts`). Jadi admin bisa membaca kursus sebelum menyetujui tanpa layar 19d. Tidak ada rute baru, aturan RBAC baru, atau baris `rbac.spec.ts` baru. Penyimpangan dari 19d disebut di PR.
- **Gerbang di dalam transaksi berkunci.** Semua penulis materi dan soal mengunci baris `courses` lebih dulu: `createLessonWithQuiz`, isi materi, deskripsi, pengaturan, dan `lockOwnerCourse` di modul quiz. Gerbang yang berjalan setelah kunci yang sama tidak bisa didahului tulisan dari tab lain.
- **Aturan soal memakai `questionInput`.** Satu sumber untuk editor (S1-09), gerbang terbit, dan impor CSV nanti. Kolom `explanation` boleh NULL di DB (§11.4 no. 12), dan `docToPlainText(null)` → `""` membuatnya gagal dengan pesan "Pembahasan wajib diisi.".
- **409 untuk gerbang yang gagal.** Permintaannya sah; yang menghalangi adalah keadaan kursus. Repo tidak punya kelas 422, dan klien memperlakukan semua 409 sama: banner + refresh.
- **Peninjau = pengirim.** Kursus yang dibuat admin lalu diselesaikan ahli gizi tetap tercatat dengan peninjau ahli gizi. Karena hanya EDITOR yang bisa mengirim, `reviewer_id` selalu akun ahli gizi.
- **Jalan mundur lewat SQL.** Tanpa "Minta revisi", kursus yang terlanjur dikirim dengan salah terjebak di IN_REVIEW. SQL untuk binzi-dev dicatat di STATUS. Jalur ini tidak tercatat di audit log.

## Catatan tinjauan 9 Nov
| Klaim | Cara dicek | Hasil |
|---|---|---|
| Baseline | `npx vitest run` dan `node scripts/check-audit.mjs` di `9edba60`, lalu di `e382359` | 92 / 1006, lalu **98 berkas / 1030 tes**; gate 0 / 0 / 23 di keduanya |
| Tumpang tindih dengan S6-01 | `git diff --stat 9edba60 e382359` atas berkas yang dirujuk kartu | Kosong, kecuali `helpers.ts` (`GUEST_PAGES`) dan `touch-targets.spec.ts` (satu tes Beranda) |
| `questionInput` atas baris tersimpan | PGlite: soal dibuat lewat `createQuestion` asli (PG dengan spasi dan baris kosong, B/S) + satu soal berbentuk seed, lalu baris dibaca ulang dan dipetakan | Ketiganya lolos. Setelah dirusak lewat SQL: dua kunci → `options` "Tandai tepat satu kunci jawaban."; pembahasan NULL → `explanation` "Pembahasan wajib diisi."; 3 opsi → `options` "Pilihan ganda harus punya tepat 4 opsi." |
| Kursus contoh 3 cocok untuk verifikasi | Postgres 16: `drizzle-kit migrate` + `seed.ts` + `seed-demo.ts`, lalu `evaluatePublishChecklist` dan `questionInput` asli atas datanya | `IN_REVIEW`, `reviewer_id` NULL, checklist 6 / 6, materi 10/10/10 soal + Final Quiz 10, 40 soal tanpa pelanggaran |
| SQL jalan mundur | Dijalankan di DB yang sama, lalu `seed-demo.ts` diulang | `UPDATE 1`; seed ulang menambah 0 baris dan status tetap DRAFT (`onConflictDoNothing`) |
| Semua penulis mengunci baris kursus | Membaca kelima `.for("update")` di modul lesson dan quiz | Kunci pertama selalu baris `courses` + cek DRAFT; kunci baris materi/soal menyusul |
| Varian `success` | Kontras WCAG `#ffffff` di `#157f5f` | 4,96:1 |
| Tes lama | `grep` asersi di area yang disentuh | Tidak ada tes yang mengasersi `/cms/konten` sebagai placeholder; asersi builder read-only memakai nama persis ("Simpan", "+ Tambah materi"), jadi tombol baru tidak membuatnya merah |
| Tombol bar atas | `21a.html`, `19d.html` | "Kirim untuk persetujuan" `#1a1614` (`dark`); "Setujui & terbitkan" `#157f5f` (`success`) |
| Isi DB e2e | `e2e/db-setup.ts`; `git grep "status = 'IN_REVIEW'" e2e` | Hanya `seed.ts` (tanpa seed demo); dua spec meninggalkan kursus IN_REVIEW tanpa peninjau → antrean ADMIN tidak deterministik |
| Letak banner Simpan | `course-settings-panel.tsx` | Banner dirender di panel, baik editable maupun read-only; di 360 panel berada di bawah outline |
| Kolom yang dibutuhkan | `src/db/schema/course.ts` | `reviewer_id`, `reviewed_at`, `published_at` sudah ada — tanpa migrasi |

Yang **belum** dicek dari sandbox: tampilan di Chromium (halaman CMS butuh login + DB) dan perintah `docker exec` di mesin pemilik. SQL-nya sendiri sudah dijalankan di Postgres 16.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
