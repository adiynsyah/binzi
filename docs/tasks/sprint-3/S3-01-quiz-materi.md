# S3-01 · Quiz materi (versi demo): tombol + konfirmasi, aturan, satu soal per layar, kumpulkan, hasil & pembahasan

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | **S2-02** (PR #135): `PlaybackDTO`, `LessonVideoPlayer`, `createVideoProgressReporter`, stub YouTube e2e. **S2-01** (PR #133): `getLessonPage`, gerbang `isLessonUnlocked` yang membaca `quiz_attempted`, `loadUnlockedLessonContext`, bar bawah materi. **S1-09** (PR #120): soal tersimpan sebagai dokumen (`plainTextToDoc`), opsi A–D + kunci, Benar/Salah tetap. **S1-08**: kursus terbit wajib punya ≥ 10 soal per quiz |
| **Target** | Sel 17 Nov. Langkah kesebelas jalur demo 20 Nov |
| **Branch** | `s3/s3-01-quiz-materi` |

> **Dibuat 16 Nov 2026** di Claude chat terhadap pohon S2-02 (`05aa379`, isinya sama dengan `main` setelah squash merge #135). Fakta kode yang dirujuk kartu ini sudah dicek di sana (lihat "Catatan tinjauan 16 Nov"). ID kartu S3 karena tabel fase `docs/design/handoff/README.md` menaruh mesin quiz di Sprint 3.
>
> **Keputusan pemilik 16 Nov** (tercantum di "Keputusan & asumsi" PR):
>
> 1. **Dua langkah sebelum timer jalan:** dialog konfirmasi di halaman materi (7d; isinya kotak PRD §6.3.2), lalu halaman aturan `/quiz` (7e). Timer baru jalan di "Saya paham, mulai quiz".
> 2. **Satu soal per layar** (7g, 7u, 7n): baris chip nomor soal, Sebelumnya/Berikutnya, tandai ragu-ragu, ringkasan sebelum dikumpulkan (QZ-06 utuh). Mesinnya dipakai ulang Final Quiz (S5-02, Rab 18).
> 3. **Setelah dikumpulkan:** tombol di halaman materi menjadi "Lihat Hasil & Pembahasan" (QZ-11), dan nilai tampil di baris Daftar materi (PRG-10). Kartu "Nilai sementara" 7d tidak dibangun.
> 4. **Final Quiz tetap masuk demo** (Rab 18). Kartu ini tidak membangunnya, tetapi modul attempt tidak boleh menutup jalannya (catatan di akhir).
>
> **Keputusan teknis kartu** (usulan Claude chat, disetujui bersama kartu):
>
> 5. **Modul baru `src/modules/attempt/`** (pola 5 berkas). Arah dependensi satu: `attempt` → `progress` (service). `progress` tidak pernah mengimpor `attempt` (impor melingkar).
> 6. **GET tidak pernah menulis** (aturan S2-01). Attempt yang waktunya habis difinalisasi lewat POST kumpulkan dari klien, bukan saat halaman dirender.
> 7. **Toleransi 15 detik** setelah `expires_at` untuk jawaban dan kumpulkan yang tertunda jaringan. Waktu server yang menentukan, tidak pernah cap waktu dari perangkat.
> 8. **Urutan soal diacak sekali saat mulai** (`question_order`, bila `shuffle_questions`). **Urutan opsi diacak deterministik** per attempt + soal (bila `shuffle_options`, hanya pilihan ganda), sehingga tampilan saat mengerjakan dan saat pembahasan sama tanpa kolom baru.
> 9. **Tombol quiz hidup tanpa muat ulang:** pemutar memanggil `router.refresh()` sekali saat jawaban POST video melewati 90 %.

## Tujuan
Peserta yang sudah menonton video materi ≥ 90 % (atau materi tanpa video) menekan "Tandai selesai & mulai quiz", menyetujui dialog satu kesempatan, membaca aturan, lalu memulai quiz. Timer dihitung server. Soal tampil satu per layar dengan navigator, setiap jawaban tersimpan otomatis, dan quiz dikumpulkan manual atau otomatis saat waktu habis. Halaman hasil menampilkan nilai, status Lulus/Belum lulus, dan pembahasan lengkap. Materi ditandai selesai dan materi berikutnya terbuka. Kunci jawaban tidak pernah sampai ke klien sebelum quiz dikumpulkan.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD:
  - `docs/prd/sections/06-3-quiz-sistem-penilaian.md` (QZ-01…12, QZ-18, QZ-21, §6.3.2);
  - `06-2-kursus-materi.md` (definisi "Materi Selesai", CRS-08);
  - `06-4-progress-nilai-saya-menggantikan-sertifi.md` (PRG-01, PRG-10);
  - `07-navigasi-information-architecture.md` (§7.4 B);
  - `11-model-data.md` (tabel QUIZ, §11.4 no. 5–8);
  - `12-keamanan.md` (QZ-07, V-01, V-05, V-06).
- Desain:
  - `docs/design/screens/7d.png` (bar bawah dengan tombol quiz, nilai di Daftar materi);
  - `7e.md` + `.png` (aturan);
  - `7g.png` (layar soal desktop);
  - `7u.md` + `.png` (chip navigator, hasil + pembahasan);
  - `7n.md` + `.png` (360 px);
  - `28c.md` + `.png` (auto-save gagal).
- Kode:
  - `src/db/schema/quiz.ts`, `src/db/schema/progress.ts` (indeks `one_active_attempt`, unik `(quiz_id, user_id, attempt_number)` dan `(attempt_id, question_id)`);
  - `src/modules/README.md`;
  - `src/modules/progress/{queries,serializer,service}.ts`;
  - `src/modules/quiz/{schema,queries}.ts` (`TRUE_FALSE_OPTIONS`, cara soal disimpan);
  - `src/lib/content-doc.ts` (`docToPlainText`);
  - `src/components/learn/{lesson-page,lesson-outline-nav,lesson-video-player,video-progress-reporter}.tsx`;
  - `src/components/ui/{dialog,button,banner}.tsx`;
  - `src/app/api/progress/video/route.ts` (pola route), `src/app/(learn)/belajar/[slug]/[materi]/page.tsx` (pola halaman);
  - `src/lib/rbac.ts` (`requireRole`, `requireApiRole`), `src/lib/errors.ts`, `src/lib/learn-route-structure.test.ts`.
- E2E: `e2e/fixtures.ts`, `e2e/layout/helpers.ts` (`createPublishedCourseViaApi`: 10 soal per quiz, kuncinya "Opsi satu …"), `e2e/belajar-materi.spec.ts`, `e2e/belajar-video.spec.ts` (stub YouTube, `attachVideoInE2eDb`), `e2e/layout/{axe,no-horizontal-scroll}.spec.ts`, `e2e/README.md` (`E2E_SCREENSHOT_DIR`).

## Kerjakan

### 1. Modul `attempt` (server)
Lima berkas di `src/modules/attempt/` beserta tesnya. Kontrak di `schema.ts`: `lessonId`, `attemptId`, `questionId`, dan `optionId` semuanya `z.uuid()`; body simpan jawaban `z.strictObject({ optionId })`.

**Ekspor `service.ts`:**
- `getLessonQuizPage(actor, courseSlug, lessonSlug): Promise<LessonQuizPageDTO>` — **GET murni, tanpa tulis**. Keadaannya:
  - `kembali` (`{ href }`): belum mendaftar, materi terkunci, atau belum memenuhi syarat video dan belum ada attempt. Halaman memanggil `redirect(href)` ke halaman materi. Kursus/materi yang tidak ada atau tidak terbit → `NotFoundError` (404).
  - `aturan` (7e): belum ada attempt. Isinya judul quiz, posisi + judul materi, jumlah soal, `durationMinutes`, `passingScorePercent`, `explanationPolicy`.
  - `berjalan`: attempt `IN_PROGRESS` dan `now ≤ expires_at + 15 dtk`. Isinya `attemptId`, `expiresAt`, `serverNow` (ISO), soal menurut `question_order` (per soal: `id`, `number`, `text` polos lewat `docToPlainText`, `type`, `options: { id, label: "A"…"D", text }[]`), dan `answers: Record<questionId, optionId>`.
  - `kedaluwarsa` (`{ attemptId }`): attempt `IN_PROGRESS`, tetapi waktu + toleransi sudah lewat.
  - `hasil`: attempt `SUBMITTED` atau `EXPIRED` (bentuk di bagian 4.C).
- `startLessonQuiz(actor, input): Promise<{ attemptId: string; created: boolean }>`.
- `saveQuizAnswer(actor, input): Promise<{ savedAt: string }>`.
- `submitQuizAttempt(actor, input): Promise<{ status: "SUBMITTED" | "EXPIRED" }>` — **idempoten**.

**Ekspor baru di `progress/service.ts`** (dipakai `attempt`, bukan sebaliknya):
- `loadLessonQuizContext(tx, actorId, lessonId)` membungkus `loadUnlockedLessonContext`, dengan 404/409 yang sama. Kembaliannya: `enrollmentId`, `quizId` (`lessons.quiz_id`), `courseSlug`, `lessonSlug`, posisi materi, `eligible`, dan materi berikutnya (`{ position, href } | null`).
  - `eligible` = video materi tidak `READY` **atau** `video_watched_percent ≥ 90` milik aktor (definisi "Materi Selesai").
- `recordLessonQuizResult(tx, { actorId, lessonId, enrollmentId, scorePercent, isPassed, submittedAt })`: upsert `lesson_progress` (barisnya bisa belum ada bila beacon "materi dibuka" gagal).
  - Kolom yang diisi: `quiz_attempted = true`, `quiz_score_percent`, `quiz_is_passed`, `quiz_submitted_at`.
  - `status = 'COMPLETED'` dan `completed_at` (hanya bila masih null) bila syarat video terpenuhi; selain itu status tidak diturunkan.
  - `courses` tidak disentuh.

**Aturan `startLessonQuiz`** (satu transaksi):
1. Konteks lewat `loadLessonQuizContext`: tidak terdaftar/tidak terbit → 404 seragam; terkunci → 409; `!eligible` → 409 "Tonton video sampai minimal 90 % untuk membuka quiz." *(usulan)*.
2. Attempt yang dihitung hanya yang `reset_at IS NULL`. Bila ada yang `IN_PROGRESS` → kembalikan (`created: false`, 200). Bila ada yang `SUBMITTED`/`EXPIRED` → 409 "Quiz ini sudah dikerjakan." *(usulan)*.
3. Soal quiz diambil urut `order_index, id`. Tanpa soal → 409 (defensif; kursus terbit selalu punya ≥ 10).
4. `question_order` diacak dengan Fisher–Yates + `crypto.randomInt` bila `shuffle_questions`.
5. `started_at = now`, `expires_at = now + duration_minutes`, `attempt_number = max(attempt_number) + 1` (1 untuk attempt pertama).
6. Insert `on conflict do nothing`, lalu select. Klik ganda atau dua tab tidak pernah menghasilkan dua attempt (indeks `one_active_attempt` + unik nomor). Tes konkurensinya **berurutan** (insert kedua setelah yang pertama), karena PGlite tidak menjamin jalur konflik teruji lewat `Promise.all` (pelajaran 3 Nov).

**Aturan `saveQuizAnswer`** (satu transaksi):
1. `SELECT … FOR UPDATE` attempt dengan `user_id = aktor` (`.for("update", { of: quizAttempts })`; tanpa baris → 404).
2. Status bukan `IN_PROGRESS` → 409. `now > expires_at + 15 dtk` → 409.
3. Soal tidak ada di `question_order` → 404. Opsi bukan milik soal itu → 404. Pesan 404 seragam.
4. Upsert `quiz_answers (attempt_id, question_id)`: `selected_option_id`, `answered_at = now`. **`is_correct` tidak dihitung dan tidak dibaca di sini.**

**Aturan `submitQuizAttempt`** (satu transaksi, pelajaran 10 Nov no. 3: kunci dulu, baca sesudahnya):
1. `FOR UPDATE` attempt milik aktor (404 bila bukan). Sudah `SUBMITTED`/`EXPIRED` → kembalikan status yang ada **tanpa menilai ulang**.
2. Status = `SUBMITTED` bila `now ≤ expires_at + 15 dtk`, selain itu `EXPIRED`. Keduanya dinilai dari jawaban yang tersimpan.
3. Dengan statement terpisah, baca soal `question_order` + `points`, jawaban, dan `is_correct` opsi terpilih.
   - Soal tanpa jawaban = salah, 0 poin.
   - `score` = jumlah poin soal benar; `max_score` = jumlah poin **semua** soal di `question_order`.
   - `score_percent` dibulatkan 2 desimal; `is_passed = score_percent ≥ passing_score_percent`.
4. Isi `quiz_answers.is_correct` dan `points_earned` untuk baris yang ada, lalu kolom skor + `submitted_at = now` di attempt.
5. `recordLessonQuizResult(...)` dalam transaksi yang sama.

**Serializer** (fungsi murni, tanpa impor runtime `db`):
- `orderOptions(options, { attemptId, questionId, type, shuffle })`: PRNG berbenih dari string `attemptId:questionId` (mis. FNV-1a + mulberry32, ditulis sendiri, tanpa `crypto`). Benar/Salah tidak pernah diacak. Label A–D diberikan **setelah** diurutkan. Fungsi yang sama dipakai keadaan `berjalan` dan `hasil`.
- **DTO `berjalan` tidak pernah membawa `isCorrect`, `explanation`, maupun `points`.** Tes memindai seluruh kunci objek secara rekursif.
- Pembahasan di `hasil` mengikuti `explanation_policy`: `ALWAYS` selalu; `ON_PASS_ONLY` hanya bila lulus; `NEVER` tidak pernah. Baris "Kunci:" ikut aturan yang sama.

### 2. API (tiga route)
Pola `src/app/api/progress/video/route.ts`: `requireApiRole("MEMBER", request)` **dulu**, `readJsonBody(request, 1024)` untuk PUT, `console.error` hanya untuk 5xx, jawaban `{ data }` / `{ error }`.

| Route | Jawaban |
|---|---|
| `POST /api/quiz/lessons/[lessonId]/attempt` | 201 `{ attemptId }` baru · 200 attempt berjalan · 404 · 409 (terkunci / video < 90 % / sudah dikerjakan) |
| `PUT /api/quiz/attempts/[attemptId]/answers/[questionId]` body `{ optionId }` | 200 `{ savedAt }` · 400 · 404 · 409 (bukan `IN_PROGRESS` / waktu habis) |
| `POST /api/quiz/attempts/[attemptId]/submit` | 200 `{ status }` (idempoten) · 404 |

Klien tidak perlu membedakan jenis 409 pada PUT: setiap 409 → hentikan penyimpanan → kumpulkan → `router.refresh()`.

### 3. Halaman materi (7d)
**DTO `open`** mendapat `quiz` (dibaca **hanya** di keadaan `open`, lewat query di modul `progress`, bukan impor `attempt`):

```ts
quiz: {
  state: "belum" | "berjalan" | "selesai"; // selesai = quiz_attempted; berjalan = ada attempt IN_PROGRESS (reset_at null)
  eligible: boolean;                        // video_status !== "READY" || videoWatchedPercent >= 90 — aturan yang SAMA dengan loadLessonQuizContext
  title: string; questionCount: number; durationMinutes: number;
  href: string;                             // /belajar/{kursus}/{materi}/quiz
}
```

**Slot kanan bar bawah** (menggantikan catatan "Materi {n} terbuka setelah quiz materi ini dikerjakan."):
- `belum` + `eligible`: tombol `primary` "Tandai selesai & mulai quiz →" sebagai `DialogTrigger`.
- `belum` + `!eligible`: tombol yang sama dengan `softDisabled` (C-08) + kalimat di bawahnya, dirujuk `aria-describedby`: *(usulan)* "Tonton video sampai minimal 90 % untuk membuka quiz."
- `berjalan`: tautan `primary` "Lanjutkan quiz →".
- `selesai`: tautan `secondary` "Lihat Hasil & Pembahasan", lalu "Materi berikutnya →" bila ada (logika `next` S2-01 tetap).

**Dialog konfirmasi** (QZ-18; isi dari kotak PRD §6.3.2, karena 7d tidak menggambar dialognya):
- Judul "Quiz: {judul quiz}".
- Daftar: "{n} soal" · "Waktu {m} menit" · **"Hanya dapat dikerjakan SATU KALI"** (ikon peringatan, tebal) · "Timer berjalan terus meski halaman ditutup" · "Nilai akan tercatat permanen".
- Kalimat "Pastikan koneksi stabil dan Anda siap."
- Tombol: `DialogClose` `secondary` "Nanti saja", dan tautan `primary` *(usulan)* "Lanjut ke aturan quiz" ke `quiz.href`. Label "Mulai Sekarang" dari PRD tidak dipakai, karena timer baru jalan di halaman aturan.
- Dialog dibuka lewat `DialogTrigger`, sehingga fokus kembali ke pemicu. Tetap dites (Esc → fokus di tombol; pelajaran 8 Nov no. 7).

**Tombol hidup tanpa muat ulang** (keputusan 9):
- `createVideoProgressReporter` mendapat opsi `onRecorded?(result: { positionSeconds; watchedPercent })`, dipanggil setelah jawaban 2xx dengan isi `data` JSON. `lastSent` dicatat **hanya bila `response.ok`** (temuan tinjauan S2-02 no. 3).
- `LessonVideoPlayer` mendapat prop angka `refreshAtPercent?: number`. Halaman memberinya `90` hanya bila `quiz.state === "belum" && !quiz.eligible`. Pemutar memanggil `router.refresh()` **sekali** saat `watchedPercent` pertama kali ≥ nilai itu.
- **Wajib dibuktikan di e2e:** setelah refresh, iframe dan pemutar stub yang sama tetap terpasang (tidak dipasang ulang), dan tombol aktif.

**Daftar materi** (PRG-10): `LessonOutlineItemDTO` mendapat `scorePercent: number | null`, dibulatkan, terisi bila `quiz_attempted`. Dibaca dari `lesson_progress.quiz_score_percent` di `selectOutlineRows`. `LessonOutlineNav` menampilkannya di kanan baris seperti 7d (`text-success`, tebal kecil). Baris "kini" tetap berlabel "kini".

### 4. Halaman `/belajar/[slug]/[materi]/quiz`
`src/app/(learn)/belajar/[slug]/[materi]/quiz/page.tsx` mengikuti pola halaman materi (`requireRole("MEMBER")`, `NotFoundError` → `notFound()`). **Tanpa `loading.tsx`** (tes struktur ditambah untuk folder `quiz/`). Komponen di `src/components/learn/quiz/`.

**A. Aturan — `quiz-rules.tsx` (7e).** Copy dari 7e tanpa anotasi desain ("(7d)", "(QZ-21)" tidak ditampilkan; aturan `CLAUDE.md`):
- eyebrow mono "QUIZ MATERI {n} · {JUDUL MATERI}";
- h1 "Aturan quiz sebelum timer jalan";
- paragraf "Anda sudah menyetujui ketentuan satu kesempatan di layar materi. Halaman ini merangkum cara kerja quiz-nya sebelum waktu mulai berjalan.";
- daftar bernomor 01–06:
  - "{n} soal · waktu {m} menit" (kata "pilihan ganda" hanya bila semua soal pilihan ganda);
  - "Timer berjalan terus meski halaman ditutup — dihitung dari server, bukan dari perangkat Anda";
  - "Habis waktu = jawaban yang sudah terisi otomatis dikumpulkan";
  - "Jawaban tersimpan otomatis tiap soal";
  - butir pembahasan mengikuti `explanation_policy` (`ALWAYS`: "Pembahasan lengkap muncul setelah dikumpulkan");
  - "Lulus di nilai ≥ {passing} — tidak lulus pun materi tetap tercatat selesai";
- kotak "{mm}:00" + "Timer baru mulai setelah Anda menekan tombol di bawah. Menekan “Nanti saja” tidak membuat attempt apa pun.";
- tombol:
  - "Saya paham, mulai quiz" (`loading` selama POST; 201/200/409 → `router.refresh()`; galat jaringan → `Banner` `error` *(usulan)* "Quiz belum dimulai. Periksa koneksi lalu coba lagi.");
  - tautan `secondary` "Nanti saja, kembali ke materi".

**B. Mengerjakan — `quiz-runner.tsx` (7g; 7u di 768; 7n di 360):**
- **Kepala:**
  - "SOAL {i} DARI {n} · SATU KESEMPATAN" (mono `primary-deep`);
  - timer `mm:ss` (`role="timer"`, `aria-label="Sisa waktu"`);
  - indikator simpan: "menyimpan…" / "tersimpan otomatis" / "belum terkirim";
  - bilah kemajuan posisi soal (7g).
- **Chip nomor 1…n:** tombol ≥ 44 × 44 dengan nama aksesibel "Soal {i}, sudah dijawab / belum dijawab, ditandai ragu" dan `aria-current` pada soal yang tampil. Gaya: kini (cincin), dijawab (isi), ragu (penanda `warning`), belum tersimpan di server (garis putus, 28c).
- **Soal:** teks sebagai h2. Fokus pindah ke h2 setiap ganti soal (`tabIndex={-1}`).
- **Opsi:** `<fieldset>` radio native `sr-only`. Area sentuh diukur dari `<label>` (pelajaran 8 Nov no. 4). Kartu opsi penuh lebar, tinggi ≥ 58 px (7u), lencana huruf A–D. Terpilih: `primary-tint` + garis `primary` (7g).
- **"Tandai ragu-ragu":** `aria-pressed`, hanya state klien (hilang saat muat ulang; sebut di PR).
- **Navigasi:** "Sebelumnya" / "Berikutnya". Di soal terakhir, "Berikutnya" menjadi "Lihat ringkasan".
- **Ringkasan:**
  - h2 "Ringkasan sebelum dikumpulkan";
  - "{a} dijawab · {b} belum dijawab · {c} ragu-ragu";
  - grid chip yang bisa diklik untuk lompat ke soal;
  - bila `b > 0`: "{b} soal belum dijawab dan akan dinilai salah.";
  - tombol "Kembali ke soal" dan `primary` "Kumpulkan sekarang". Tombol ini `softDisabled` selama ada jawaban yang belum tersimpan, dengan kalimat "Tunggu, jawaban sedang disimpan…" *(usulan)*.
- **Timer:**
  - `offset = serverNow − Date.now()` saat mount; sisa = `expiresAt − (Date.now() + offset)`, berdetak tiap 1 detik.
  - Saat < 2 menit: warna `danger` + satu pengumuman `aria-live="polite"` "Sisa waktu 2 menit."
  - Di 0: kirim jawaban yang tertunda (tunggu maksimal 5 detik), lalu kumpulkan, lalu `router.refresh()`.
- **Antrean simpan — `answer-save-queue.ts`** (modul murni, dites seperti pelapor S2-02):
  - memilih opsi → PUT untuk soal itu; pilihan terbaru menang (pilihan baru saat request lama berjalan dikirim lagi setelahnya);
  - galat jaringan/5xx dicoba ulang setelah 1, 2, 5 detik, lalu tiap 5 detik;
  - 409 → berhenti, kumpulkan, refresh; 404 → berhenti, refresh.
- **28c:**
  1. **Gagal < 10 detik:** hanya indikator kecil.
  2. **Gagal > 10 detik:** `Banner` `error` di atas runner. Judul "{k} jawaban belum tersimpan di server". Isi "Koneksi terputus. Jawaban soal {daftar} disimpan sementara di perangkat ini dan dikirim otomatis begitu tersambung. Jangan tutup atau muat ulang halaman ini." Tombol "Coba kirim sekarang".
  3. **Tersambung lagi:** `Banner` `success` "Tersambung. Jawaban soal {daftar} sudah tersimpan." (hilang sendiri 4 detik).
- **Muat ulang saat berjalan** (QZ-08): server mengembalikan attempt + jawaban yang sama, dan timer tetap terhitung dari `expires_at`.

**C. Hasil — `quiz-result.tsx` (7u bawah).** DTO `hasil`:
```ts
{ status: "SUBMITTED" | "EXPIRED"; scorePercent: number /* bulat */; isPassed: boolean;
  correct: number; wrong: number; unanswered: number; durationSeconds: number;
  items: { number; text; type; options: { label; text; selected: boolean; correct: boolean | null }[];
           explanation: string | null }[];
  lesson: { position; title; href }; next: { position; href } | null }
```
- `correct` di opsi bernilai `null` bila kebijakan menyembunyikan kunci.
- `durationSeconds` = `min(submitted_at, expires_at) − started_at`, ditampilkan "3m 12d" (fungsi murni dites).

Tampilan:
- eyebrow "MATERI {n} · HASIL QUIZ" + pil "TERKUNCI PERMANEN";
- angka nilai besar + "NILAI" + lencana "Lulus"/"Belum lulus";
- statistik "{x}/{n} benar", "{y} salah", "{waktu}" (ditambah "{z} tidak dijawab" bila > 0);
- `EXPIRED`: kalimat "Waktu habis — jawaban yang sudah tersimpan dikumpulkan otomatis.";
- h2 "Pembahasan lengkap" + "Ditampilkan untuk semua soal, apa pun nilainya — karena tidak ada percobaan kedua.";
- per soal:
  - "SOAL {i}" + lencana Benar/Salah;
  - teks soal;
  - "Jawaban Anda: {teks}" (atau "tidak dijawab");
  - "Kunci: {teks}" bila salah;
  - pembahasan.
- **Penutup:**
  - ada materi berikutnya: "Materi {n} ditandai selesai. Materi {n+1} sekarang terbuka." + tautan `primary` "Lanjut ke Materi {n+1}";
  - materi terakhir: "Materi {n} ditandai selesai." (slot Final Quiz milik S5-02);
  - selalu ada tautan `secondary` "Kembali ke materi".
- Tautan "Ada kendala teknis?" (QZ-19) tidak dibangun.

**D. Kedaluwarsa — `quiz-expired-submit.tsx`:** pola beacon S2-01. Saat mount: POST kumpulkan, lalu `router.refresh()`. Teks "Waktu habis — mengumpulkan jawaban…".

### 5. Struktur
- `learn-route-structure.test.ts`: tambah asersi tidak ada `loading.tsx` di `[materi]/quiz/`.
- Tanpa migrasi, tanpa dependensi baru, CSP tidak berubah.

## Bukan lingkup tugas ini
- **S5-02 Final Quiz** (Rab 18), halaman "Nilai Saya" (dipotong 14 Nov), kartu "Nilai sementara".
- **QZ-19:** reset attempt di CMS (7i) dan tautan "Ada kendala teknis?". Saat gladi, reset lewat SQL (lihat "Catatan untuk gladi").
- **7j** layar "quiz ditunda" dan pengingat di dasbor; QZ-17 (deteksi pindah tab); ulangi kursus; gambar soal (`image_url`); rate limit; analitik butir soal.
- **Perapian S2-02 lainnya** (tes `playing()` ganda, `dispose()` → `stopped`, batas baris "Melanjutkan dari"), kecuali `lastSent` hanya bila `response.ok` di bagian 3.
- **Tidak diubah:** `src/app/(learn)/layout.tsx`, `src/lib/rbac.ts`, `src/proxy.ts`, `next.config.ts`, skema DB, editor quiz CMS, `POST /api/progress/video`.

Pekerjaan di luar lingkup → **berhenti dan tanyakan.**

## Berkas yang boleh dibuat/diubah
- `src/modules/attempt/{schema,policy,queries,serializer,service}.ts` + tesnya (baru)
- `src/modules/progress/{queries,serializer,service}.ts` + `serializer.test.ts`, `lesson-page.integration.test.ts`, tes integrasi baru untuk `recordLessonQuizResult`
- `src/app/api/quiz/lessons/[lessonId]/attempt/route.ts`, `src/app/api/quiz/attempts/[attemptId]/answers/[questionId]/route.ts`, `src/app/api/quiz/attempts/[attemptId]/submit/route.ts` (baru)
- `src/app/(learn)/belajar/[slug]/[materi]/quiz/page.tsx` (baru)
- `src/components/learn/quiz/*` (baru) + tes
- `src/components/learn/{lesson-page,lesson-outline-nav,lesson-video-player}.tsx` + tes masing-masing; `src/components/learn/video-progress-reporter.ts` + tes (hanya `onRecorded` dan `lastSent` bila `ok`)
- `src/lib/learn-route-structure.test.ts`
- `e2e/belajar-quiz.spec.ts` (baru); `e2e/belajar-materi.spec.ts`, `e2e/belajar-video.spec.ts` (hanya asersi yang berubah karena bar bawah); `e2e/layout/helpers.ts`; `e2e/layout/{axe,no-horizontal-scroll}.spec.ts`

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- hash basis (`main` setelah #135 + PR docs kartu ini) dan baseline Vitest **yang diukur**. Claude chat mengukur **119 berkas / 1322 tes** pada `05aa379`; bila angkamu berbeda, berhenti dan laporkan;
- signature setiap ekspor baru, DTO per keadaan halaman quiz, dan DTO `open` + `LessonOutlineItemDTO` yang baru;
- urutan statement `startLessonQuiz`, `saveQuizAnswer`, dan `submitQuizAttempt` (mana yang dikunci, mana yang dibaca sesudahnya);
- daftar tes lama yang berubah, satu per satu, dengan alasannya. Minimal: `lesson-page.test.tsx` (catatan "terbuka setelah quiz…" diganti tombol), tes `toEqual` atas baris outline atau DTO `open`, dan asersi e2e yang memeriksa bar bawah. Cari juga asersi tentang keadaan yang **akan berubah karena perilaku baru** di halaman lain (pelajaran 14 Nov no. 3): dasbor (badge, "{n}/{m} selesai"), outline, dan gerbang materi berikutnya;
- urutan commit (lihat "Catatan jadwal");
- tabel mutasi: setiap baris jelas merah atau hijau beserta alasannya.

## Selesai jika
- [ ] **Integrasi `attempt`** (PGlite), per kasus:
  - mulai:
    - belum mendaftar → 404; terkunci → 409; video `READY` + 50 % → 409; video `READY` + 90 % → 201; tanpa video → 201;
    - mulai kedua saat berjalan → 200 dengan `attemptId` sama; setelah dikumpulkan → 409;
    - `question_order` berisi semua soal quiz, tepat sekali;
  - simpan:
    - attempt milik orang lain → 404; soal di luar attempt → 404; opsi milik soal lain → 404;
    - setelah dikumpulkan → 409; `expires_at` 16 detik lalu → 409; `expires_at` 10 detik lalu → 200 (toleransi);
    - simpan dua kali → satu baris, opsi terakhir;
  - kumpulkan:
    - 10 soal, 7 benar, 2 salah, 1 tidak dijawab → `score 7`, `max_score 10`, `70.00`, lulus pada ambang 70;
    - kumpulkan kedua → hasil sama, `quiz_answers` tidak berubah;
    - `expires_at` lewat → `EXPIRED` dengan skor dari jawaban tersimpan;
    - `lesson_progress`: `quiz_attempted`, skor, `COMPLETED` saat eligible; baris dibuat bila belum ada; materi berikutnya terbuka lewat `getLessonPage`;
  - GET:
    - `getLessonQuizPage` di attempt kedaluwarsa → `kedaluwarsa` dan baris attempt **tetap** `IN_PROGRESS`;
    - halaman materi `locked` tidak menjalankan query quiz (spy, pola S2-02).
- [ ] **Serializer:**
  - DTO `berjalan` lolos pemindaian kunci rekursif (tanpa `isCorrect`/`explanation`/`points`/`is_correct`);
  - `orderOptions` deterministik (dua panggilan sama), berbeda antar-attempt untuk setidaknya satu benih uji, Benar/Salah tetap;
  - pembahasan per `explanation_policy`;
  - `eligible` di DTO `open` per tabel (video tidak `READY` / `READY` + 89,99 / `READY` + 90), dari aturan yang sama dengan server — bukan dari `playback` (baris R2 `READY` ber-`playback` null tetapi belum eligible);
  - `Object.keys` DTO `open.quiz` = allowlist.
- [ ] **Komponen** (jsdom):
  - bar bawah per keadaan;
  - dialog: isi, Esc → fokus kembali ke tombol, "Lanjut ke aturan quiz" menunjuk `href`;
  - aturan: tombol mulai memanggil POST lalu `refresh`;
  - runner:
    - chip + `aria-current`, fokus ke h2 setelah ganti soal;
    - ragu-ragu, ringkasan dengan hitungan;
    - Kumpulkan terkunci selama ada jawaban tertunda;
    - timer dengan `offset`, auto-kumpulkan di 0 (timer palsu);
  - antrean simpan:
    - pilihan terbaru menang, jadwal coba ulang;
    - 409 → kumpulkan; banner 28c setelah 10 detik dan banner "Tersambung." setelah pulih;
  - hasil: lulus/belum lulus, tidak dijawab, `EXPIRED`, kebijakan pembahasan;
  - pemutar: `router.refresh()` sekali saat 90 % pertama kali tercapai, tidak saat sudah ≥ 90 % sejak awal.
- [ ] **E2E** `e2e/belajar-quiz.spec.ts` (proyek `chromium`), kursus dari `createPublishedCourseViaApi` (2 materi, 10 soal, kunci "Opsi satu …"):
  1. Materi tanpa video: tombol aktif → dialog → "Nanti saja" → tidak ada baris `quiz_attempts` → dialog lagi → aturan → "Saya paham, mulai quiz" → soal 1 tampil, timer berjalan.
  2. **Kunci tidak bocor:** HTML `request.get` halaman quiz yang sedang berjalan tidak memuat "Pembahasan PG" maupun `isCorrect`/`is_correct`.
  3. Jawab 7 benar, 2 salah, 1 kosong lewat chip dan Berikutnya. Setiap jawaban → `waitForResponse` PUT 200 (dipasang sebelum klik). Muat ulang di tengah → jawaban dan soal tetap (QZ-08).
  4. Ringkasan "9 dijawab · 1 belum dijawab" → Kumpulkan → hasil nilai 70, "Lulus", 10 pembahasan, "Kunci:" di soal salah → "Lanjut ke Materi 2" membuka materi 2.
  5. Halaman materi 1: "Lihat Hasil & Pembahasan", nilai 70 di Daftar materi, tombol mulai tidak ada.
  6. Video `READY` 100 detik (stub YouTube): tombol `softDisabled` + kalimat 90 % → stub `setTime(91)` + `emit(2)` → tombol aktif **tanpa muat ulang**, iframe yang sama (penanda `data-` atau hitungan instance stub tidak berubah).
  7. Waktu habis: SQL memundurkan `expires_at` 1 menit → buka `/quiz` → hasil `EXPIRED` dengan jawaban yang sudah tersimpan.
  8. API:
     - mulai sebelum mendaftar → 404; materi terkunci → 409;
     - PUT ke attempt akun lain → 404;
     - kumpulkan dua kali → 200 dan nilai tidak berubah;
     - PUT setelah dikumpulkan → 409.
  9. Gagal simpan: `page.route` membatalkan PUT → indikator "belum terkirim" → `page.clock` maju 11 detik → banner "1 jawaban belum tersimpan di server" + Kumpulkan terkunci → `unroute` → "Coba kirim sekarang" → "Tersambung." → Kumpulkan aktif.
  10. Lebar 360 / 768 / 1024 / 1280 tanpa gulir samping; target sentuh chip dan opsi ≥ 44 di 360.
- [ ] **Screenshot** — diambil lokal dengan `E2E_SCREENSHOT_DIR=~/binzi-s3-01-screenshots` (konvensi A-19b, `e2e/README.md`), `animations: "disabled"`, setelah isi terlihat. **Jalankan sekali dengan variabel itu dan sebutkan jumlah berkasnya di PR** (S2-02 terlewat):
  - `quiz-dialog-360`, `quiz-dialog-1280`
  - `quiz-aturan-360`, `quiz-aturan-1280`
  - `quiz-soal-360`, `quiz-soal-768`, `quiz-soal-1024`, `quiz-soal-1280`
  - `quiz-ringkasan-360`, `quiz-galat-simpan-360`
  - `quiz-hasil-360`, `quiz-hasil-1280`
  - `materi-setelah-quiz-360`, `materi-setelah-quiz-1280`, `materi-quiz-terkunci-video-360`
- [ ] **axe** (w360 + w1280): aturan, soal, ringkasan, hasil, materi dengan dialog terbuka.
- [ ] **E2E S2-01 dan S2-02 tetap hijau** setelah asersi bar bawah disesuaikan.
- [ ] **Uji mutasi** — commit lokal dulu dan `git status` bersih sebelum mutasi pertama; kembalikan dengan `git restore`. Laporkan per mutasi nama tes yang merah + pesannya. Mutasi yang hanya tertangkap e2e dijalankan dengan `npx playwright test --grep …` sungguhan.
  1. DTO `berjalan` membawa `isCorrect` opsi.
  2. `saveQuizAnswer` tanpa `user_id = aktor`.
  3. Toleransi diabaikan (simpan diterima kapan pun).
  4. `submitQuizAttempt` menilai ulang attempt yang sudah dikumpulkan.
  5. `startLessonQuiz` tanpa syarat `eligible`.
  6. `startLessonQuiz` membuat attempt baru setelah `SUBMITTED`.
  7. `max_score` hanya dari soal yang dijawab.
  8. `recordLessonQuizResult` tidak mengisi `quiz_attempted`.
  9. Kumpulkan setelah waktu habis berstatus `SUBMITTED`, bukan `EXPIRED`.
  10. `orderOptions` memakai `Math.random`.
  11. Antrean simpan: 409 tidak memicu kumpulkan.
  12. Kumpulkan aktif saat ada jawaban tertunda.
  13. `getLessonQuizPage` memfinalisasi attempt kedaluwarsa (GET menulis).
  14. `eligible` memakai `> 90` alih-alih `>= 90`.
  15. `router.refresh()` dipanggil di setiap rekaman ≥ 90 %, bukan sekali.

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`. `main` memuat S2-02.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR. Harapan 0 excused / 0 blocking / OK; angka di bawah high dicatat apa adanya. Temuan high/critical baru → berhenti dan tempel output lengkapnya.
- **Build dan rute:** `npm run build` (rute baru: halaman quiz ƒ + tiga API). `npm run start`, lalu jalani alur kartu sebagai MEMBER. `curl -sI` halaman quiz tanpa cookie → 307 ke `/masuk?next=…`.
- **Prettier:** berkas yang sudah ada tetap apa adanya; berkas baru boleh dirapikan.
- **`npm run check` di commit akhir:** tempel 5 baris terakhir output di PR.
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas.
- **"Keputusan & asumsi" di PR** memuat keputusan 1–9, semua copy *(usulan)*, dan keputusan yang diambil tanpa bertanya.
- **Setelah push:** cek CI (`gh pr checks`, job `ci` dan `e2e`), lalu laporkan durasi job e2e dibanding `main`.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`
- Baseline + jumlah tes baru; tes lama yang berubah disebut satu per satu.
- `git diff --stat main -- package-lock.json src/db 'src/app/(learn)/layout.tsx' src/lib/rbac.ts src/proxy.ts next.config.ts src/app/api/progress` kosong.

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Lokal (Docker menyala):
  ```bash
  cd ~/Project/React/binzi-new && git fetch origin && git switch s3/s3-01-quiz-materi && git pull --ff-only && npm run dev:db && npm run dev
  ```
  Masuk sebagai MEMBER yang mengikuti "[DEMO] Kursus contoh 3", lalu:
  1. Materi 1 (sudah ber-video sejak S2-02): sebelum ditonton, tombol quiz abu-abu + kalimat 90 %. Tonton sampai ≥ 90 % (geser boleh) → tombol aktif tanpa muat ulang.
  2. Klik tombol → dialog → "Nanti saja" → klik lagi → "Lanjut ke aturan quiz" → aturan → "Saya paham, mulai quiz".
  3. Jawab beberapa soal, muat ulang di tengah → jawaban tetap, timer terus berjalan.
  4. Ringkasan → Kumpulkan → hasil + pembahasan → "Lanjut ke Materi 2" terbuka.
  5. Kembali ke materi 1: "Lihat Hasil & Pembahasan" + nilai di Daftar materi.
  6. Ulangi langkah 2–4 sekilas di HP atau DevTools 360.
- [ ] **binzi-dev:** kartu ini tanpa migrasi, jadi tidak ada langkah binzi-dev sebelum merge.

## Catatan jadwal
- Sesi dimulai setelah PR docs kartu ini masuk `main`, Sel 17 pagi.
- **Urutan commit yang disarankan:**
  1. modul `attempt` + `progress` + tes integrasi;
  2. tiga API;
  3. halaman quiz (aturan → runner → hasil);
  4. halaman materi (bar, dialog, gerbang hidup, nilai outline);
  5. e2e + screenshot.
  Bila sesi panjang, commit + push di antara bagian.
- **Bila terlambat**, yang dipotong lebih dulu:
  1. banner 28c tahap 2–3 (indikator, coba ulang, dan kunci Kumpulkan tetap);
  2. tandai ragu-ragu;
  3. pengumuman dan warna 2 menit;
  4. nilai di Daftar materi;
  5. e2e no. 9.

  **Tidak dipotong:** dialog (keputusan pemilik), aturan, mulai/simpan/kumpulkan di server, timer + auto-kumpulkan + finalisasi kedaluwarsa, hasil + pembahasan, kunci tidak bocor, e2e no. 1–8.

## Catatan untuk gladi (bukan kode)
**Reset quiz akun demo** (binzi-dev, SQL Editor; attempt tidak pernah dihapus, PRD §11.4). Ganti email dan slug materi:
```sql
update quiz_attempts set reset_at = now(), reset_reason = 'gladi resik', reset_by = (select id from users where email = 'email-admin-kamu')
where user_id = (select id from users where email = 'email-akun-demo') and reset_at is null
  and quiz_id = (select quiz_id from lessons where slug = 'slug-materi');
update lesson_progress set quiz_attempted = false, quiz_score_percent = null, quiz_is_passed = null, quiz_submitted_at = null, status = 'IN_PROGRESS', completed_at = null
where user_id = (select id from users where email = 'email-akun-demo')
  and lesson_id = (select id from lessons where slug = 'slug-materi');
```
- Harapan `UPDATE 1` dua kali.
- Slug materi bisa sama di kursus lain; bila ragu, pakai `lesson_id` langsung.
- Jalur ini **tidak tercatat di audit log**.

## Catatan untuk kartu Final Quiz (S5-02, Rab 18)
- Pakai ulang `attempt`:
  - `saveQuizAnswer` dan `submitQuizAttempt` tidak tahu jenis quiz;
  - yang khusus FINAL hanya konteks mulai (gerbang: semua materi `COMPLETED`, `courses.final_quiz_id`) dan efek samping kumpulkan;
  - kartu ini tidak boleh menulis cabang `FINAL`, tetapi juga tidak boleh mengunci desain ke `lessonId` di luar `startLessonQuiz` dan `recordLessonQuizResult`.
- Efek FINAL:
  - `enrollments.final_score_percent` = rata-rata `quiz_score_percent` materi × `score.lesson_weight` + nilai Final × `score.final_weight` (`getScoreWeights`, gagal tertutup);
  - `enrollments.status` `COMPLETED` / `PASSED`;
  - "bobot 40%" di builder masih ditulis langsung di kode (STATUS 4 Nov).
- Runner, ringkasan, hasil, dan antrean simpan dipakai apa adanya. Layar 7h (konfirmasi + hasil + Nilai Akhir) dan 7g/7n menjadi acuan.

## Catatan tinjauan 16 Nov
| Klaim | Cara dicek | Hasil |
|---|---|---|
| Baseline | Vitest penuh di sandbox pada `05aa379` | 119 berkas / 1322 tes |
| Batasan attempt sudah ada | `0000_initial_schema.sql` | `one_active_attempt` (parsial `IN_PROGRESS`), unik `(quiz_id, user_id, attempt_number)`, unik `(attempt_id, question_id)` — tanpa migrasi |
| Soal tersimpan sebagai dokumen | `quiz/queries.ts` | `plainTextToDoc` saat simpan; `docToPlainText` ada di `src/lib/content-doc.ts` |
| Kunci e2e | `e2e/layout/helpers.ts` `publishablePgBody` | "Opsi satu {label}" benar; 10 soal per quiz materi + 10 Final |
| Bawaan quiz materi | `quiz/queries.ts` `insertEmptyLessonQuiz` | 10 menit / 70 % / `ALWAYS`; `shuffle_questions` dan `shuffle_options` bawaan skema `true` |
| Hasil POST video | `progress/serializer.ts` | `VideoProgressResultDTO = { positionSeconds, watchedPercent }` — cukup untuk `onRecorded` |
| Catatan bar bawah yang berubah | `lesson-page.test.tsx:221`, `:230` | "Materi 3 terbuka setelah quiz materi ini dikerjakan." diasersi; tes ini berubah |
| Dialog 7d | `7d.html`, `7d.md` | Dialog tidak digambar (hanya tombol). Isi diambil dari kotak PRD §6.3.2 |
| Tone banner | `banner.tsx` | `info` (kuning), `error` (merah, `role="alert"`), `success` (hilang sendiri) — 28c tahap 2 memakai `error` |
| Arah impor | `src/modules/README.md` | Lintas modul hanya lewat `service.ts`; `attempt` → `progress` satu arah |

Yang **belum** dicek dari sandbox: `router.refresh()` mempertahankan iframe pemutar (dibuktikan e2e no. 6), `page.clock` bersama antrean simpan (e2e no. 9), dan tampilan opsi 58 px di Safari iOS (gladi).

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
