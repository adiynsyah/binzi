# S3-03 · Lapor gangguan quiz + `/cms/reset-attempt`: laporan peserta, keputusan admin, reset tanpa laporan

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | **S3-01** (attempt, `lesson_progress` dari hasil quiz, kolom `reset_*` di `quiz_attempts`), **S5-02** (Final Quiz, Nilai Akhir di `enrollments`), **S5-03** (Nilai Saya membaca attempt hidup saja), **A-12** (RBAC), **A-15** (shell CMS, item menu "Reset attempt"), **S1-08** (pola antrean CMS + audit log). Semua sudah di `main` |
| **Target** | A7 rencana UAT internal 11 Des (STATUS 19 Nov). Perkiraan ±3 hari |
| **Branch** | `s3/s3-03-lapor-gangguan-reset-attempt` |

> **Dibuat 22 Nov 2026** di Claude chat terhadap `main` `fd72bea` (#154). Fakta kode yang dirujuk ada di "Catatan tinjauan 22 Nov" di akhir kartu.
>
> **Keputusan teknis kartu** (usulan Claude chat, disetujui bersama kartu):
>
> 1. **Satu migrasi `0002`: tabel `quiz_attempt_reports` + dua enum.** Tanpa dependensi baru, tanpa token warna baru, CSP tidak berubah. Kolom `reset_by`/`reset_reason`/`reset_at` di `quiz_attempts` sudah ada sejak `0000` dan dipakai apa adanya.
> 2. **Reset = versi transaksional SQL gladi di STATUS** ("Reset attempt manual sebelum A7"). Attempt tidak pernah dihapus (PRD §11.4 no. 6):
>    - attempt: `reset_at`, `reset_by`, `reset_reason` diisi; status `IN_PROGRESS` → `EXPIRED` (indeks `one_active_attempt` tidak melihat `reset_at`);
>    - quiz materi: baris `lesson_progress` kembali ke `quiz_attempted = false`, skor/lulus/waktu kumpul `null`, `status = 'IN_PROGRESS'`, `completed_at = null`. Akibatnya materi sesudahnya terkunci lagi sampai quiz itu dikerjakan ulang (gerbang PRD §11.4 no. 7 membaca `quiz_attempted`);
>    - Final Quiz: `enrollments` kembali ke `status = 'IN_PROGRESS'`, `final_score_percent = null`, `completed_at = null`;
>    - satu baris `audit_logs` (`attempt.reset`) dengan `before`/`after`.
>
>    Kode yang membaca attempt sudah memfilter `reset_at IS NULL` dan memberi nomor attempt `max + 1` (S3-01, S5-03), jadi start ulang, Nilai Saya, dan progres mengikuti tanpa diubah.
> 3. **Quiz materi tidak bisa direset bila Final Quiz kursus itu sudah punya attempt hidup** (status apa pun) → 409. Nilai Akhir dihitung dari skor semua quiz materi saat Final dikumpulkan; reset quiz materi sesudahnya akan membuat Nilai Akhir basi atau tak terhitung. Jalurnya: reset Final dulu, baru quiz materi. Ini menyimpang dari baris 26b "Nilai Akhir kursus dihitung ulang tanpa nilai 33": Nilai Akhir terhitung ulang saat Final dikerjakan ulang.
> 4. **Satu reset per quiz per peserta.** Quiz yang punya baris attempt ber-`reset_at` tidak bisa direset lagi (26c: "Satu attempt hanya bisa direset satu kali … agar reset tidak jadi jalan pintas mengulang quiz") dan tidak bisa dilaporkan lagi.
> 5. **Satu laporan per attempt** (7i), hanya untuk attempt hidup yang sudah selesai (`SUBMITTED`/`EXPIRED`). `UNIQUE(attempt_id)` di tabel.
> 6. **Tanpa email.** Production masih `MAIL_TRANSPORT=log` (H-07 belum). Hasil keputusan hanya tampil di halaman laporan peserta. Copy yang menyebut email diubah (daftar copy di bawah), dan kotak banding 7i-3 ("Balas email keputusan … satu kali banding") tidak dibangun.
> 7. **"Catatan sistem" 26b hanya dari data yang ada di DB**: `started_at`, `answered_at` per jawaban (posisi dari `question_order`), `submitted_at`/`expires_at`, status, skor. Tidak ada log galat server, perangkat, atau koneksi — baris merah "server merespons 500", "dicoba ulang 3×", dan "6 galat serupa" tidak dibangun.
> 8. **Reset tanpa laporan (26c) adalah halaman `/cms/reset-attempt/baru`**, bukan dialog tiga langkah. Cari peserta dengan **email persis** (tanpa pencarian sebagian), lalu pilih attempt dan isi alasan di layar yang sama. Halaman server tidak butuh API GET untuk daftar pengguna/attempt.
>    - Attempt yang punya laporan menunggu tetap boleh dipilih (26c), dengan peringatan + tautan ke laporannya. Bila direset dari sini, laporan itu ikut ditutup `APPROVED` dengan alasan yang sama, supaya peserta tetap mendapat jawaban di halaman laporannya.
> 9. **Tenggat = `created_at` + 24 jam kalender** (bukan jam kerja). Merah bila sisa < 6 jam atau sudah lewat.
> 10. **Tanpa angka di sidebar CMS dan di Ringkasan admin (19b).** Menu CMS belum punya mekanisme hitungan untuk item mana pun.
> 11. **Antrean tanpa paginasi**: tiap tab menampilkan paling banyak 50 baris. Tab "Menunggu" hanya berisi laporan menunggu (bagian "Baru diputuskan" 26a tidak dibangun).
> 12. **Modul baru `src/modules/recovery/`** (pola 5 berkas) memiliki `quiz_attempt_reports` dan menulis kolom `reset_*` di `quiz_attempts`. Pembalikan `lesson_progress`/`enrollments` lewat dua fungsi baru di **service `progress`** yang menerima `tx` (pola `recordLessonQuizResult`).
> 13. **RBAC: `/cms/reset-attempt` dari `exact` menjadi `prefix`** (ADMIN+), supaya `/cms/reset-attempt/baru` dan `/cms/reset-attempt/[nomor]` tidak jatuh ke SUPER_ADMIN (fail-closed).
> 14. **Tanpa `loading.tsx`** di semua folder rute baru (`redirect()`/`notFound()` di bawahnya menjadi 200).

## Tujuan
Peserta yang quiz-nya terganggu (koneksi putus, halaman galat, timer aneh) bisa melapor dari layar hasil quiz, melihat status laporannya, dan — bila disetujui — mengerjakan ulang quiz itu. Admin meninjau laporan di CMS dengan catatan attempt dari DB, lalu menyetujui (reset) atau menolak dengan alasan yang dibaca peserta. Admin juga bisa mereset tanpa laporan bila peserta mengeluh lewat jalur lain. Ini satu-satunya jalur pemulihan untuk quiz satu kesempatan (PRD §6.3.3, QZ-19, CMS-10) dan langkah terakhir skenario UAT peserta (STATUS 19 Nov).

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD: `docs/prd/sections/06-3-quiz-sistem-penilaian.md` (§6.3.3, QZ-11, QZ-19); `06-7-cms.md` (CMS-10); `11-model-data.md` (`quiz_attempts`, `audit_logs`, §11.4 no. 6, 8, 11).
- `docs/STATUS.md` bagian "Reset attempt manual sebelum A7 (SQL Editor binzi-dev)" — SQL yang menjadi dasar keputusan 2.
- Desain:
  - peserta: `docs/design/screens/7i.md` + `.png` (tiga panel), `7l.png` (panel kiri, 360);
  - CMS: `26a.md` + `.png` (buka `26a.html` untuk ukuran), `26b.md` + `.png`, `26c.md` + `.png`.
- Kode:
  - `src/modules/README.md`; `src/db/schema/{quiz,progress,system,index}.ts`; `src/db/migrations/` (pola `0001`) + `drizzle.config.ts`;
  - `src/modules/attempt/{queries,service,serializer}.ts` (`selectAttemptByQuizAndUser`, `selectNextAttemptNumber`, `submitQuizAttempt`, `getGradesPage`) + `quiz-attempt.integration.test.ts` (harness);
  - `src/modules/progress/service.ts` (`recordLessonQuizResult`, `recordFinalQuizResult`, `loadLessonQuizContext`, `loadFinalQuizContext`) + `queries.ts` (`upsertLessonQuizResult`, `updateEnrollmentFinalResult`);
  - `src/modules/course/queries.ts` (insert `audit_logs`, pola `before`/`after`), `src/modules/course/service.ts` (`listCourseApprovalQueue`);
  - `src/lib/rbac.ts` + `rbac.test.ts`; `src/lib/errors.ts`; `src/lib/request-body.ts`; `src/lib/datetime.ts`;
  - `src/app/api/quiz/attempts/[attemptId]/submit/route.ts` (pola route), `src/app/(learn)/belajar/[slug]/[materi]/quiz/page.tsx`, `src/app/(learn)/belajar/[slug]/final-quiz/page.tsx`, `src/lib/learn-route-structure.test.ts`;
  - `src/components/learn/quiz/{quiz-result,final-quiz-result}.tsx`;
  - `src/app/(cms)/cms/reset-attempt/page.tsx`, `src/app/(cms)/cms/konten/page.tsx`, `src/components/cms/{cms-nav,cms-pages,course-list,approval-queue}.tsx|ts`;
  - `src/components/ui/{tabs,banner,badge-status,field,textarea,button}.tsx`.
- E2E: `e2e/belajar-nilai.spec.ts` (`completeLessonViaApi`, `completeFinalViaApi`), `e2e/fixtures.ts`, `e2e/layout/helpers.ts` (`createPublishedCourseViaApi`, `createEditorAdminContexts`, `deleteCoursesInE2eDb`, `maybeScreenshot`, `expectNoHorizontalScroll`, `expectTouchTarget`), `e2e/layout/axe.spec.ts`, `e2e/README.md`.

## Kerjakan

### 1. Migrasi `0002` — `quiz_attempt_reports`
Skema Drizzle di `src/db/schema/quiz.ts` (+ relasi di `index.ts`), lalu `npm run db:generate` **sekali** (pelajaran S2-02: bila skema diubah lagi, bersihkan migrasi lalu generate ulang).

```ts
attemptReportCategoryEnum = pgEnum("attempt_report_category",
  ["SUBMIT_ERROR", "TIMER_ENDED_EARLY", "CONTENT_MISSING", "OTHER"]);
attemptReportStatusEnum = pgEnum("attempt_report_status",
  ["PENDING", "APPROVED", "REJECTED"]);

quiz_attempt_reports:
  id            uuid pk defaultRandom
  number        integer generatedAlwaysAsIdentity, UNIQUE   -- tampil "R-{number}"
  attempt_id    uuid NOT NULL UNIQUE → quiz_attempts.id      -- satu laporan per attempt
  user_id       text NOT NULL → users.id                     -- pelapor = pemilik attempt
  category      attempt_report_category NOT NULL
  description   text NOT NULL
  status        attempt_report_status NOT NULL default 'PENDING'
  decision_reason text NULL       -- untuk peserta, tampil apa adanya
  internal_note   text NULL       -- staf saja
  decided_by    text NULL → users.id
  decided_at    timestamptz NULL
  created_at    timestamptz NOT NULL default now()
  updated_at    timestamptz NOT NULL default now() ($onUpdate)
  CHECK ((status = 'PENDING') = (decided_at IS NULL))
  CHECK (status = 'PENDING' OR decision_reason IS NOT NULL)
  INDEX (status, created_at)
```

SQL hasil generate ditempel di rencana. Tes integrasi membaca berkas migrasi (PGlite), jadi `CHECK` diuji lewat berkas, bukan skema TS.

### 2. Modul `recovery` (baru, pola 5 berkas)
**Schema** (pure Zod, aman di klien):
- `createReportInput = z.strictObject({ category: enum 4, description })` — `description` di-`trim`, min 20 "Ceritakan minimal 20 karakter." *(usulan)*, max 1000 "Maksimal 1000 karakter." *(usulan)*.
- `decideReportInput = z.strictObject({ decision: "APPROVE" | "REJECT", reason, internalNote? })` — `reason` trim, min 10 "Alasan minimal 10 karakter." *(usulan)*, max 1000; `internalNote` opsional, max 1000.
- `manualResetInput = z.strictObject({ reason, internalNote? })` — aturan `reason` sama.
- `REPORT_CATEGORY_LABELS` (copy 7i): `SUBMIT_ERROR` "Halaman error saat mengirim jawaban", `TIMER_ENDED_EARLY` "Timer habis padahal baru mulai", `CONTENT_MISSING` "Soal atau pilihan jawaban tidak tampil", `OTHER` "Lainnya".

**Service — peserta:**
- `getAttemptReportPage(actor, target)` — `target` = `{ kind: "LESSON", courseSlug, lessonSlug }` atau `{ kind: "FINAL", courseSlug }`. Urutan:
  1. resolusi quiz lewat konteks yang sama dengan halaman quiz (`loadLessonQuizContext` / `loadFinalQuizContext`); miss → `NotFoundError` seragam;
  2. attempt hidup (`reset_at IS NULL`) punya laporan: `PENDING` → state `menunggu`; `REJECTED` → state `ditolak`;
  3. quiz pernah direset (ada baris ber-`reset_at`):
     - attempt hidup belum ada atau masih `IN_PROGRESS`, dan laporan terakhir quiz ini `APPROVED` → state `disetujui`;
     - attempt hidup sudah `SUBMITTED`/`EXPIRED` (sudah dikerjakan ulang) → state `sudah-direset`;
     - selain itu (reset manual tanpa laporan, belum dikerjakan ulang) → `{ redirect: halaman quiz }`;
  4. attempt hidup `SUBMITTED`/`EXPIRED` tanpa laporan → state `form`;
  5. selain itu → `{ redirect: halaman quiz }`.
- `createAttemptReport(actor, attemptId, input)` — attempt milik actor (selain itu 404 seragam), hidup, `SUBMITTED`/`EXPIRED`, quiz belum pernah direset; laporan kedua → 409. `user_id` diambil dari attempt.

**Service — admin (ADMIN+, cek role DULU lalu parse):**
- `listAttemptReports(actor, { status })` → `{ counts: { PENDING, APPROVED, REJECTED, ALL }, items }`. `PENDING` urut `created_at asc` (tenggat terdekat), lainnya `decided_at desc`; paling banyak 50.
- `getAttemptReportReview(actor, number)` → laporan + pelapor (nama, email, jumlah laporan akun ini) + attempt (judul kursus, "Materi {n}"/"Final Quiz", jumlah soal, durasi, skor, jawaban tersimpan/total, sisa waktu saat berhenti) + `timeline` (keputusan 7) + keputusan bila sudah diputuskan.
- `decideAttemptReport(actor, number, input)` — dalam **satu transaksi**, laporan dikunci (`for update`), harus `PENDING` (selain itu 409):
  - `APPROVE` → `resetAttemptInTx` (di bawah) + laporan `APPROVED`;
  - `REJECT` → laporan `REJECTED`, attempt tidak disentuh, `audit_logs` `attempt_report.reject`.
- `findUserForManualReset(actor, email)` → pelapor + daftar attempt peserta itu (setiap quiz: attempt hidup + riwayat reset), masing-masing dengan `selectable` + alasan bila tidak bisa dipilih (`ALREADY_RESET`, `FINAL_TAKEN`) + nomor laporan menunggu bila ada. Email dinormalisasi (`normalizeEmail`), user `deleted_at` tidak ditemukan.
- `resetAttemptManually(actor, attemptId, input)` → transaksi: `resetAttemptInTx` + tutup laporan `PENDING` attempt itu (bila ada) sebagai `APPROVED` dengan alasan yang sama.

**`resetAttemptInTx(tx, { actorId, attemptId, reason, internalNote })`** (satu pintu untuk kedua jalur): attempt dikunci `for update`; tolak dengan 409 bila sudah ber-`reset_at`, quiz pernah direset (keputusan 4), atau quiz materi dengan Final hidup (keputusan 3); lalu tulis keputusan 2. **Semua baca di dalam transaksi lewat `tx`** — `await` kueri `db` di dalam `db.transaction` macet di PGlite (STATUS 19 Nov, pelajaran no. 4).

**Progress (2 fungsi baru di `progress/service.ts`, menerima `tx`):** `revertLessonQuizResult(tx, { userId, lessonId })` dan `revertFinalQuizResult(tx, { userId, courseId })`, persis kolom keputusan 2.

**DTO:** satu DTO per audiens. DTO halaman peserta **tidak** membawa `internal_note`, `decided_by`, id admin, `reset_by`, atau id attempt lain (allowlist `Object.keys` per state dites). Tanggal dibentuk di server (`formatWib`/`formatWibDate`).

### 3. Route API
Pola route submit quiz: role dulu, `readJsonBody` dengan anggaran kecil (4096), galat domain tidak di-log.
- `POST /api/quiz/attempts/[attemptId]/report` (MEMBER) → 201 `{ data: { number } }`.
- `POST /api/cms/reset-attempt/reports/[nomor]/decision` (ADMIN) → 200 `{ data: { status } }`.
- `POST /api/cms/reset-attempt/attempts/[attemptId]/reset` (ADMIN) → 200 `{ data: { attemptId } }`.

`[nomor]` bukan bilangan bulat positif, atau `[attemptId]` bukan UUID → 404 sebelum service.

### 4. RBAC
`src/lib/rbac.ts`: `{ path: "/cms/reset-attempt", match: "prefix", minRole: "ADMIN" }` (keputusan 13) + tes matriks: EDITOR di `/cms/reset-attempt/baru` → 403, ADMIN → lolos. Item menu "Reset attempt" tetap aktif di sub-halaman (tes `cms-nav`).

### 5. Peserta — tautan + halaman laporan (7i, 7l)
**Tautan di layar hasil** (`quiz-result.tsx`, `final-quiz-result.tsx`): baris kecil di bawah aksi hasil, "Ada kendala teknis?" + tautan "Laporkan gangguan" *(usulan; adaptasi PRD §6.3.3 "Ada kendala teknis? Hubungi kami")* → halaman laporan. Tampil untuk hasil `SUBMITTED` dan `EXPIRED`. Href dibentuk tanpa mengubah modul `attempt`:
- materi: `${data.lesson.href}/quiz/laporan` (`QuizResultDTO.lesson.href` sudah ada);
- Final: DTO hasil Final tidak membawa slug kursus, jadi `final-quiz/page.tsx` meneruskan `reportHref` dari parameter rute lewat `FinalQuizPage` ke `FinalQuizResult`.

**Rute:** `src/app/(learn)/belajar/[slug]/[materi]/quiz/laporan/page.tsx` dan `src/app/(learn)/belajar/[slug]/final-quiz/laporan/page.tsx` (`requireRole("MEMBER")` → `getAttemptReportPage` → komponen). `NotFoundError` → `notFound()`; `{ redirect }` → `redirect()`.

**Komponen** `src/components/learn/quiz/attempt-report.tsx` (server) + `attempt-report-form.tsx` (klien). Satu kolom `max-w-[35rem]` (lebar panel 7i), eyebrow mono "Quiz materi {n} · {Laporkan gangguan | Status laporan | Hasil laporan}" atau "Final Quiz · …", satu h1 per state:
- **form** (7i-1, 7l): h1 "Quiz terputus di tengah jalan?", paragraf 7i; kotak "Data yang ikut terkirim otomatis" (mono): "Attempt ke-{n} · {Materi n | Final Quiz} · Dimulai {tanggal jam}", "Terhenti di soal {tersimpan+1, maks total} dari {total} · Sisa waktu {mm:ss}", "Jawaban tersimpan: {a} dari {total}" (attempt tidak punya nomor tampilan seperti "#4821"); `fieldset` radio "Apa yang terjadi?" (4 label kategori, tiap pilihan ≥ 44 px, `legend`); textarea "Ceritakan singkat (wajib, min. 20 karakter)"; tombol "Kirim laporan" + tautan "Batal" → halaman quiz; catatan "Satu laporan per attempt. Laporan palsu dapat berujung penonaktifan akun (lihat Syarat & Ketentuan)." dengan tautan ke `/syarat-ketentuan`. Sukses → `router.refresh()` (halaman menjadi state menunggu). 409 → "Attempt ini sudah dilaporkan." *(usulan)*; 401 → teks sesi berakhir `StartCourseButton`; lainnya "Terjadi kesalahan. Coba lagi.".
- **menunggu** (7i-2): pil "Menunggu ditinjau" + mono "Laporan #R-{nomor} · {tanggal jam}"; h1 "Laporan Anda sedang diperiksa"; paragraf "Admin memeriksa catatan sistem attempt ini. Biasanya selesai dalam 1×24 jam kerja. Hasilnya muncul di halaman ini." *(usulan; tanpa email, keputusan 6)*; daftar tiga langkah (Laporan terkirim ✓ + waktu · Ditinjau admin, "Sedang berjalan — perkiraan selesai {tanggal tenggat}" · Keputusan, "Reset disetujui atau ditolak, dengan alasan") sebagai `<ol>`; kotak "Sementara menunggu": materi — "Nilai {x} tetap tercatat sementara dan materi lain boleh dilanjutkan. Kalau reset disetujui, nilai itu dihapus dan Anda mengulang quiz materi {n} saja." + tautan "Lanjut ke materi {n+1}" (materi terakhir: "Ke halaman kursus" *(usulan)* → `/belajar/{kursus}`); Final — "Nilai {x} tetap tercatat sementara. Kalau reset disetujui, nilai itu dihapus dan Anda mengulang Final Quiz." *(usulan)* + "Ke halaman kursus".
- **disetujui** (7i-3 atas): pil "Reset disetujui", h1 "Kesempatan Anda dikembalikan", alasan admin apa adanya (`whitespace-pre-line`), mono "Ditinjau admin · {tanggal jam} · Alasan dicatat di audit log", tautan `primary` "Kerjakan ulang quiz materi {n}" / "Kerjakan ulang Final Quiz" *(usulan)* → halaman quiz.
- **ditolak** (7i-3 bawah): pil "Reset ditolak", h1 "Nilai {x} tetap berlaku", alasan admin apa adanya, tautan "Ke halaman kursus". Tanpa kotak banding (keputusan 6) dan tanpa kalimat "nilai di bawah 70 tidak menghalangi Final Quiz".
- **sudah-direset**: h1 "Quiz ini sudah pernah direset" *(usulan)*, paragraf "Setiap quiz hanya bisa direset satu kali, jadi attempt ini tidak bisa dilaporkan lagi." *(usulan)* + "Ke halaman kursus".

`src/lib/learn-route-structure.test.ts`: kedua `page.tsx` ada; tidak ada `loading.tsx` di `quiz/laporan/` dan `final-quiz/laporan/`.

### 6. CMS — antrean, tinjau, reset tanpa laporan (26a–26c)
**`/cms/reset-attempt`** (26a; ganti placeholder): eyebrow "Pengaturan / Reset attempt", h1 "Reset attempt", paragraf 26a **tanpa** "(§6.3.2)" (CLAUDE.md: anotasi desain tidak dirender), tautan `secondary` "Reset tanpa laporan…" → `/cms/reset-attempt/baru`. Tab (pola `course-list.tsx`, `?status=` sebagai kontrak URL) "Menunggu {n}" · "Disetujui {n}" · "Ditolak {n}" · "Semua {n}". Tabel (≥ 1024; di bawahnya kartu bertumpuk): Pelapor (avatar inisial, nama, mono "R-{nomor} · {tanggal jam}") · Quiz & attempt ("{judul kursus} · Materi {n}/Final Quiz", mono "Nilai {x} · Soal {a}/{total}") · Kendala (label kategori) · Status (badge) · Tenggat ("sisa {j} jam" / "lewat {j} jam" *(usulan)*, merah sesuai keputusan 9; "—" bila sudah diputuskan). Seluruh baris adalah satu tautan ke `/cms/reset-attempt/{nomor}` dengan nama aksesibel yang memuat pelapor + nomor. Kosong: "Tidak ada laporan di tab ini." *(usulan)*.

**`/cms/reset-attempt/[nomor]`** (26b): breadcrumb "← Reset attempt / Laporan R-{nomor}", badge status + tenggat. Kiri: pelapor (nama, email, "laporan ke-{k} dari akun ini"; tanpa "Lihat profil" — `/cms/pengguna` dibangun A8); kotak "Kata user · {waktu}" (chip kategori + cerita, `whitespace-pre-line`); kotak "Catatan sistem · attempt ke-{n}" (mono "{kursus} · Materi {n} · {total} soal · {durasi} menit") berisi `<ol>` timeline keputusan 7; tiga kotak angka "Nilai tercatat", "Sisa waktu saat terhenti", "Jawaban tersimpan" *(usulan, menggantikan "Attempt lain user ini")*. Kanan (≥ 1024, ±340 px; di bawahnya bertumpuk), state `PENDING`:
- `fieldset` "Keputusan": radio "Setujui reset" ("Nilai {x} dihapus, quiz {materi n | Final} dibuka lagi dari awal.") / "Tolak" ("Nilai {x} tetap berlaku.");
- textarea "Alasan untuk user" + penanda "Wajib", bantuan "Tampil di halaman laporan peserta apa adanya." *(usulan; tanpa email)*;
- textarea "Catatan internal (opsional)", bantuan "Hanya terlihat staf, masuk audit log";
- tombol `primary` "Setujui & reset attempt" / "Tolak laporan" *(usulan)* sesuai pilihan;
- untuk setujui, daftar centang: "Nilai {x} hilang dari Nilai Saya", "Nilai quiz lain tidak berubah", "Tercatat di audit log: admin, waktu, alasan" *(usulan; keputusan 3)*.
- 409 → `Banner` dengan pesan dari server (mis. "Final Quiz kursus ini sudah dimulai. Reset Final Quiz dulu lewat Reset tanpa laporan, lalu putuskan laporan ini." *(usulan)*). Sukses → `router.refresh()`.

State sudah diputuskan: panel kanan read-only (status, alasan, catatan internal, oleh siapa, kapan).

**`/cms/reset-attempt/baru`** (26c, keputusan 8): h1 "Reset attempt"; form GET "Email pengguna" → `?email=`. Tidak ketemu: "Tidak ada pengguna dengan email ini." *(usulan)*. Ketemu: kartu pengguna + tautan "Ganti" (hapus `?email`), `fieldset` "Pilih attempt yang direset" berisi baris radio per quiz ("{kursus} · Materi {n}/Final Quiz", mono "Nilai {x} · {tanggal} · {Selesai normal | Waktu habis | Sedang berjalan}" *(usulan untuk dua terakhir)*). Baris tidak bisa dipilih tampil `disabled` dengan alasan: "Sudah pernah direset 1× · {tanggal}" (26c) atau "Final Quiz kursus ini sudah dimulai — reset Final dulu" *(usulan)*. Peringatan laporan menunggu (copy 26c) dengan tautan ke laporannya. Lalu alasan + catatan internal (komponen yang sama dengan 26b) + tombol "Reset attempt" *(usulan)*. Sukses → `Banner` "Attempt direset." *(usulan)* + `router.refresh()`.

## Bukan lingkup tugas ini
- Email keputusan, kotak banding, log galat server/perangkat (keputusan 6–7); angka di sidebar/Ringkasan (keputusan 10); paginasi antrean; bagian "Baru diputuskan" 26a; tautan "Lihat profil" (A8).
- Reset quiz materi setelah Final dikerjakan (keputusan 3); reset kedua untuk quiz yang sama; peserta membatalkan laporan; reset kursus / "Ulangi kursus" (7k, B3).
- Tablet 26t sebagai tata letak tersendiri (cukup tumpukan < 1024).
- **Tidak diubah:** `package.json`, `package-lock.json`, `src/proxy.ts`, `next.config.ts`, `.github/**`, `src/app/(auth)/**`, `src/app/(public)/**`, `src/modules/{auth,user,course,lesson,quiz,consultation}/**`, `src/modules/attempt/**`, `src/components/ui/**`, `src/components/shared/**`, `src/components/public/**`, `src/styles/tokens.css`. Bila `attempt` atau `ui` ternyata harus diubah, berhenti dan tanyakan.
- **Jangan menjalankan `next upgrade`.**

Pekerjaan di luar lingkup → **berhenti dan tanyakan.**

## Berkas yang boleh dibuat/diubah
- `src/db/schema/{quiz,index}.ts`; `src/db/migrations/0002_*.sql` + `meta/` (hasil generate)
- `src/modules/recovery/**` (baru) + tes integrasi **baru** `src/modules/recovery/recovery.integration.test.ts` (PGlite, harness pola `attempt/quiz-attempt.integration.test.ts`)
- `src/modules/progress/{service,queries}.ts` (hanya dua fungsi pembalik + kuerinya) + tesnya
- `src/lib/rbac.ts` + `rbac.test.ts` (hanya baris `/cms/reset-attempt`); `src/components/cms/cms-nav.test.ts` (aktif di sub-halaman)
- `src/app/api/quiz/attempts/[attemptId]/report/route.ts`, `src/app/api/cms/reset-attempt/**` (baru)
- `src/app/(learn)/belajar/[slug]/[materi]/quiz/laporan/page.tsx`, `src/app/(learn)/belajar/[slug]/final-quiz/laporan/page.tsx` (baru); `src/lib/learn-route-structure.test.ts`
- `src/components/learn/quiz/{quiz-result,final-quiz-result,final-quiz-page}.tsx` + tesnya dan `src/app/(learn)/belajar/[slug]/final-quiz/page.tsx` (hanya tautan laporan dan `reportHref`); `src/components/learn/quiz/attempt-report*.tsx` + tes (baru)
- `src/app/(cms)/cms/reset-attempt/page.tsx` (ganti), `src/app/(cms)/cms/reset-attempt/{baru,[nomor]}/page.tsx` (baru), `src/components/cms/reset-attempt*.tsx` + tes (baru)
- `e2e/reset-attempt.spec.ts` (baru), `e2e/layout/axe.spec.ts` (satu tes baru di akhir `describe`)

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- hash basis (`fd72bea` + PR docs kartu ini) dan baseline Vitest **yang diukur**. Claude chat mengukur **143 berkas / 1713 tes** pada `fd72bea`. Bila angkamu berbeda, berhenti dan laporkan;
- **SQL `0002` hasil generate** (tempel utuh);
- tanda tangan service + DTO per audiens; isi `before`/`after` `audit_logs`;
- urutan baca di `resetAttemptInTx` dan baris mana yang dikunci;
- pembagian komponen dan props kliennya; cara tes memalsukan `fetch`/`useRouter`;
- daftar tes lama yang berubah, satu per satu, dengan alasannya (hasil pencarianmu sendiri);
- urutan commit;
- **tabel mutasi dengan prediksi per baris** — nama tes yang diharapkan merah.

## Selesai jika
Data uji memenuhi semua syarat kecuali yang sedang diuji (STATUS 14 Nov, pelajaran no. 6). Setiap tes membuat aktornya sendiri: DB PGlite dipakai bersama semua tes dalam satu berkas (STATUS 22 Nov, pelajaran no. 1).

- [ ] **Migrasi:** `npm run db:migrate` lokal sukses; `git diff --stat main -- src/db/migrations` hanya berkas `0002` + `meta`.
- [ ] **Integrasi** (`recovery.integration.test.ts`, lewat berkas migrasi):
  - **Laporan:**
    - attempt milik peserta lain → 404 seragam; attempt `IN_PROGRESS` → 409; attempt ber-`reset_at` → 404/409 (sebutkan); laporan kedua → 409; quiz yang pernah direset → 409;
    - `CHECK` tabel: `APPROVED` tanpa `decided_at` ditolak DB; `REJECTED` tanpa `decision_reason` ditolak DB.
  - **Setujui laporan quiz materi:**
    - attempt ber-`reset_*` dengan nilai dari input; `lesson_progress` persis keputusan 2; laporan `APPROVED` + `decided_*`; satu baris `audit_logs`;
    - **sesudahnya peserta bisa mulai attempt baru** (`startLessonQuiz`) dengan `attempt_number = 2`, dan `getGradesPage` tidak lagi memuat skor lama (bukan hanya cek kolom — STATUS 19 Nov, pelajaran no. 2);
    - materi berikutnya terkunci lagi (`loadLessonQuizContext` materi n+1 → 409).
  - **Setujui laporan Final:** `enrollments` persis keputusan 2; `startFinalQuiz` sesudahnya berhasil.
  - **Tolak:** attempt dan progres tidak berubah; laporan `REJECTED`; audit `attempt_report.reject`.
  - **Penjaga:** quiz materi dengan Final hidup → 409 dan **tidak ada baris yang berubah**; reset kedua quiz yang sama → 409; keputusan untuk laporan yang sudah diputuskan → 409.
  - **Reset manual:** attempt `IN_PROGRESS` → `EXPIRED` + reset, lalu start baru berhasil (indeks `one_active_attempt`); laporan `PENDING` attempt itu ikut `APPROVED` dengan alasan yang sama.
  - **Antrean:** hitungan per status dengan **dua laporan per status dalam satu tes** (STATUS 22 Nov, pelajaran no. 2); urutan `PENDING` `created_at asc` dengan `created_at` dan id eksplisit sehingga urutan id, insert, dan harapan berbeda (STATUS 21 Nov, pelajaran no. 3); batas 50.
  - **Role:** EDITOR dan MEMBER → `ForbiddenError` untuk semua fungsi admin, sebelum input diparse.
- [ ] **Serializer:** allowlist `Object.keys` per state DTO peserta (tanpa `internal_note`/`decided_by`); tenggat (sisa, < 6 jam, lewat); label kategori; "Terhenti di soal" dan sisa waktu (`EXPIRED` → 00:00).
- [ ] **Komponen** (jsdom): kelima state halaman peserta (h1, eyebrow, tautan dengan href persis); form — kategori wajib, cerita < 20 → galat tanpa `fetch`, sukses → `refresh`, 409/401/lainnya; tautan "Laporkan gangguan" di kedua layar hasil; antrean — tab dan hitungan, baris tautan, tenggat merah; tinjau — dua tombol sesuai pilihan, alasan wajib, 409 → banner, state read-only; reset manual — baris `disabled` dengan alasannya, peringatan laporan menunggu.
- [ ] **Struktur + RBAC:** bagian 4 dan 5.
- [ ] **E2E** `e2e/reset-attempt.spec.ts` (proyek `chromium`, **paling banyak 3 tes**; salin lokal `completeLessonViaApi` dari `belajar-nilai.spec.ts`, pola `expectBoxFits` S6-02):
  1. **Lapor → setujui → kerjakan ulang.** Kursus bertoken 2 materi; MEMBER mengerjakan quiz materi 1 lewat API. Peserta: hasil quiz → "Laporkan gangguan" → isi form → "Menunggu ditinjau". ADMIN: `/cms/reset-attempt` → baris laporan itu (dicari lewat nomor) → tinjau → "Setujui reset" + alasan → keputusan tersimpan. Peserta: halaman laporan "Kesempatan Anda dikembalikan" + alasan persis → "Kerjakan ulang quiz materi 1" → layar aturan quiz (attempt baru bisa dimulai); `/belajar/nilai` tidak lagi menampilkan skor lama.
  2. **Lapor → tolak.** Peserta melihat "Nilai {x} tetap berlaku" + alasan persis; halaman quiz tetap layar hasil.
  3. **Reset tanpa laporan.** ADMIN `/cms/reset-attempt/baru` → email peserta → pilih attempt → alasan → "Attempt direset."; peserta di halaman quiz itu melihat layar aturan.

  Lebar 360 dan 1280 untuk halaman peserta (form, menunggu, hasil) dan 1280 + 360 untuk tiga halaman CMS: tanpa gulir samping; di 360 radio kategori, "Kirim laporan", dan tombol keputusan ≥ 44 × 44. Pencocokan teks dibatasi ke wadah yang tepat dengan `exact: true` (STATUS 20 Nov, pelajaran no. 4).
- [ ] **axe** (`axe.spec.ts`, w360 + w1280): satu tes baru di akhir `describe` — halaman laporan peserta (form, lalu menunggu) + `/cms/reset-attempt` + tinjau + `/cms/reset-attempt/baru?email=`.
- [ ] **E2E lain tetap hijau.**
- [ ] **Screenshot** — `E2E_SCREENSHOT_DIR=~/binzi-s3-03-screenshots` (kosongkan dulu), jalankan **hanya** `reset-attempt.spec.ts`, pola nama S6-02 (`{nama}-{lebar}` + nama proyek). Harapan **12 berkas**: `laporan-form`, `laporan-menunggu`, `laporan-disetujui` di 360 dan 1280; `cms-antrean`, `cms-tinjau`, `cms-baru` di 1280 dan 360.
- [ ] **Uji mutasi** — commit lokal dulu, `git status` bersih, kembalikan dengan `git restore`. Setiap mutasi kueri/transaksi dijalankan juga dengan `-t` pada tes yang diprediksi merah saja. Laporkan nama tes yang merah + pesannya:
  1. Laporan tanpa cek pemilik attempt.
  2. Laporan untuk attempt `IN_PROGRESS` diterima.
  3. Laporan untuk quiz yang pernah direset diterima.
  4. Reset tanpa mengubah `IN_PROGRESS` → `EXPIRED`.
  5. Reset quiz materi tanpa membalik `lesson_progress`.
  6. Reset Final tanpa membalik `enrollments`.
  7. Penjaga Final hidup dihapus.
  8. Penjaga satu-reset-per-quiz dihapus.
  9. Reset tanpa baris `audit_logs`.
  10. Tolak ikut mereset attempt.
  11. `decideReportInput` tanpa minimal alasan.
  12. Fungsi admin tanpa cek role (EDITOR lolos).
  13. Reset manual tidak menutup laporan menunggu.
  14. Hitungan antrean tanpa filter status.
  15. Urutan `PENDING` `created_at desc`.
  16. Tenggat merah di < 12 jam (bukan < 6).
  17. DTO peserta membawa `internalNote`.
  18. `loading.tsx` ditambahkan di `quiz/laporan/`.
  19. RBAC `/cms/reset-attempt` kembali `exact` (sub-halaman → 403 untuk ADMIN).
  20. `CHECK (status = 'PENDING') = (decided_at IS NULL)` dihapus dari berkas `0002`.

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db` (migrasi `0002` ikut).
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR. Temuan high/critical baru → berhenti dan tempel output lengkapnya.
- **Build:** `npm run build` — rute baru ƒ; `curl -sI` tanpa cookie: `/cms/reset-attempt/baru` → 307 `/masuk?next=…`; `curl -s -X POST` tanpa cookie ke ketiga API → 401 JSON.
- **Prettier:** berkas yang sudah ada tetap apa adanya; berkas baru boleh dirapikan.
- **`lint:hex`** dan **anotasi desain** (grep `\([A-Z]{1,4}-[0-9]+\)` dan `§` di teks yang dirender).
- **Sandi akun uji tidak pernah ditulis di PR.**
- **`npm run e2e` penuh** sebelum PR. Kegagalan di tes yang tidak berkaitan dengan diff: salin blok `Error:` + Expected/Received **sebelum** menjalankan ulang, telusuri penyebabnya, jangan diperbaiki di PR ini.
- **`npm run check` di commit akhir:** tempel 5 baris terakhir output di PR.
- **Staging per nama berkas.** `AGENTS.md` tetap untracked.
- **"Keputusan & asumsi" di PR** memuat keputusan 1–14, semua copy *(usulan)*, dan keputusan yang diambil tanpa bertanya.
- **Setelah push:** buat PR begitu e2e lokal hijau, kerjakan mutasi selagi CI berjalan, perbarui PR dengan tabel mutasi, laporkan durasi job `e2e`.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`
- Baseline + jumlah tes baru; tes lama yang berubah disebut satu per satu.
- `git diff --stat main -- package-lock.json package.json src/proxy.ts next.config.ts .github "src/app/(auth)" "src/app/(public)" src/modules/auth src/modules/user src/modules/course src/modules/lesson src/modules/quiz src/modules/consultation src/modules/attempt src/components/ui src/components/shared src/components/public src/styles` kosong.

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Screenshot `~/binzi-s3-03-screenshots` (12 berkas) diunggah ke Claude chat untuk ditinjau terhadap 7i/7l/26a–26c.
- [ ] **binzi-dev — migrasi `0002` SEBELUM merge** (Preview dan Production memakai binzi-dev). Migrasi aditif: kode `main` yang berjalan tidak membaca tabel baru.
  1. Dari branch PR yang sudah final (`git switch s3/s3-03-lapor-gangguan-reset-attempt && git pull`): `npm run db:migrate:binzi-dev`. Jangan mengubah berkas migrasi setelah langkah ini.
  2. SQL Editor binzi-dev: `select count(*) from quiz_attempt_reports;` → `0` (tabel ada).
- [ ] Lokal (Docker menyala):
  ```bash
  cd ~/Project/React/binzi-new && git fetch origin && git switch s3/s3-03-lapor-gangguan-reset-attempt && git pull --ff-only && npm run dev:db && npm run db:migrate && npm run dev
  ```
  1. Akun MEMBER: kerjakan quiz materi 1 sebuah kursus → "Laporkan gangguan" → kirim → "Menunggu ditinjau".
  2. Akun ADMIN (jendela lain): `/cms/reset-attempt` → laporan itu → catatan sistem masuk akal → setujui dengan alasan.
  3. MEMBER: muat ulang halaman laporan → alasan tampil apa adanya → "Kerjakan ulang" → quiz bisa dimulai lagi; Nilai Saya tidak memuat skor lama; materi 2 terkunci sampai quiz materi 1 dikerjakan ulang.
  4. ADMIN: "Reset tanpa laporan…" → email MEMBER → quiz yang sudah pernah direset tampil tidak bisa dipilih.
  5. Akun EDITOR: `/cms/reset-attempt` → 403; menu tidak menampilkan "Reset attempt".
  6. DevTools 360: form laporan dan halaman tinjau utuh, semua aksi bisa diketuk.

## Catatan jadwal
- **Urutan commit yang disarankan:**
  1. skema + migrasi `0002` + tes `CHECK`;
  2. `recovery` + dua fungsi `progress` + tes integrasi;
  3. route API + RBAC;
  4. halaman peserta + tautan di layar hasil + tes;
  5. CMS antrean + tinjau + reset manual + tes;
  6. e2e + axe + screenshot.

  Commit + push di antara bagian.
- **Bila terlambat**, yang dipotong lebih dulu:
  1. tiga kotak angka 26b (timeline tetap);
  2. tab "Disetujui"/"Ditolak" (cukup "Menunggu" + "Semua");
  3. state `sudah-direset` sebagai halaman tersendiri (cukup redirect ke halaman quiz).

  **Tidak dipotong:** migrasi, laporan peserta + tiga state utama, setujui/tolak dengan alasan, reset manual dengan cari email, semua penjaga 409, audit log, RBAC.

## Catatan untuk kartu berikutnya
- **A8 (S5-06, pengguna CMS):** tautan "Lihat profil" di 26b mengarah ke halaman pengguna; ubah role/status wajib mencabut semua sesi (butir STATUS).
- **Putaran 2:** email keputusan (setelah H-07), banding, hitungan di sidebar/Ringkasan, reset quiz materi setelah Final dengan hitung ulang Nilai Akhir, log galat server per attempt untuk catatan sistem.

## Catatan tinjauan 22 Nov (fakta kode di `fd72bea`)
| Klaim | Cara dicek | Hasil |
|---|---|---|
| Basis | `git diff --stat 79d4717 fd72bea -- . ':!docs'` | Kosong — `main` = head PR 154 |
| Baseline | `npm run check` di sandbox pada `fd72bea` | **143 berkas / 1713 tes**; gate audit 0 excused / 0 blocking / OK (21 info/low/moderate) |
| Kolom reset | `src/db/schema/quiz.ts:158–161` | `reset_by`, `reset_reason`, `reset_at` ada sejak `0000`; tidak ada tabel laporan |
| Attempt hidup | `attempt/queries.ts:133–170`, `:174–193`; `progress/queries.ts:660`; `attempt/queries.ts:531` | Semua bacaan attempt memfilter `reset_at IS NULL`; nomor berikutnya `max + 1` termasuk baris reset |
| Reset manual | STATUS "Reset attempt manual sebelum A7"; kartu S3-01 "Catatan untuk gladi" | `IN_PROGRESS` harus jadi `EXPIRED` (indeks `one_active_attempt`); kolom `lesson_progress` dan `enrollments` yang dibalik |
| Gerbang materi | `progress/service.ts:183,221,674` | Materi berikutnya terbuka dari `quiz_attempted` materi sebelumnya |
| Nilai Akhir | `progress/service.ts:531–575` (`recordFinalQuizResult`) | Dihitung saat Final dikumpulkan dari skor tersimpan semua materi; skor materi `null` → galat keras |
| RBAC | `src/lib/rbac.ts:83`; `cms-nav.ts:180–186` | `/cms/reset-attempt` `exact` ADMIN; item menu sudah ada (ADMIN+); halaman masih placeholder |
| Audit log | `course/queries.ts:289–299`; `db/schema/system.ts:15–37` | Pola insert dalam transaksi: `actorId`, `action`, `entityType`, `entityId`, `before`, `after`, `ip: null` |
| Rute quiz | `find "src/app/(learn)" -name loading.tsx` | Hanya `(dashboard)/loading.tsx`; tidak ada di `quiz/` maupun `final-quiz/` |
| Migrasi | `src/db/migrations/`, `package.json` | `0000`, `0001`; skrip `db:generate`, `db:migrate`, `db:migrate:binzi-dev` |
| Helper e2e | `e2e/belajar-nilai.spec.ts:66–142` | `answerViaApi`, `completeLessonViaApi`, `completeFinalViaApi` lokal (tidak diekspor) |

Yang **belum** dicek dari sandbox: SQL `0002` hasil drizzle-kit (ditinjau di rencana), tampilan dengan font Lato asli, Safari iOS.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
