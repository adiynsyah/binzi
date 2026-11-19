# S3-02 · Perapian quiz materi + Final Quiz: jam perangkat, coba kumpulkan lagi, banner terlihat, posisi setelah muat ulang, nilai, kebijakan pembahasan, tampilan 360

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | **S3-01** (PR #138), **S5-02** (PR #140), perbaikan e2e #141, C-11 (#142). Semua sudah di `main` |
| **Target** | A2 rencana UAT internal 11 Des (STATUS 19 Nov). Perkiraan ±1½ hari |
| **Branch** | `s3/s3-02-perapian-quiz` |

> **Dibuat 19 Nov 2026 malam** di Claude chat terhadap `main` `186b6c5`. Kodenya sama dengan `bb30848` (#142 dan #143 hanya JSON audit + docs). Setiap butir di bawah sudah dicocokkan dengan kode itu; baris yang dirujuk ada di "Catatan tinjauan 19 Nov" di akhir kartu.
>
> **Keputusan teknis kartu** (usulan Claude chat, disetujui bersama kartu):
>
> 1. **Tanpa migrasi, tanpa dependensi baru, tanpa token warna baru, CSP tidak berubah.** Route API tidak berubah.
> 2. **Nilai quiz ditampilkan dengan pembulatan ke bawah** (`Math.floor`), bukan `Math.round`. Dengan ambang bilangan bulat, angka yang tampil tidak pernah bertentangan dengan label: 69,5 tampil "69 · Belum lulus", bukan "70 · Belum lulus". Nilai tersimpan tidak berubah. Nilai Akhir kursus tetap dibulatkan biasa (labelnya ditentukan Final Quiz, bukan Nilai Akhir).
> 3. **Muat ulang di tengah quiz mendarat di soal pertama yang belum dijawab** (urutan tampilan attempt itu). Bila semua sudah dijawab: soal terakhir. Posisi dihitung dari data server, jadi render server dan klien tetap sama.
> 4. **Kebijakan pembahasan yang menyembunyikan kunci** (`NEVER`, atau `ON_PASS_ONLY` saat tidak lulus) **juga menyembunyikan label Benar/Salah per soal.** Pada soal Benar/Salah, label "Salah" sama dengan membocorkan kunci. Kartu hasil tetap menampilkan jumlah benar/salah (QZ-10).
> 5. **Peserta yang belum terdaftar membuka halaman quiz materi → dialihkan ke halaman materi** (yang menampilkan panel belum terdaftar), sama seperti Final Quiz. Kursus/materi yang tidak ada atau tidak terbit tetap 404. Endpoint mulai quiz tetap 404 untuk peserta belum terdaftar.
> 6. **Antrean simpan tidak di-dispose saat runner dilepas** — tidak dikerjakan (lihat "Bukan lingkup").

## Tujuan
Menutup temuan tinjauan S3-01 dan S5-02 yang akan terasa saat UAT internal 11 Des:
- quiz tidak pernah macet tanpa jalan keluar (kumpul gagal, beacon kedaluwarsa gagal);
- peringatan koneksi muncul tepat waktu walau jam perangkat salah, dan terlihat di layar;
- nilai dan label tidak saling bertentangan;
- kebijakan pembahasan tersembunyi tidak menandai semua soal "Salah";
- tampilan 360 dan layar Final mendekati 7u/7g/7h.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD `docs/prd/sections/06-3-quiz-sistem-penilaian.md` (QZ-01 `explanation_policy`, QZ-05, QZ-08, QZ-09, QZ-10).
- Desain:
  - `docs/design/screens/7u.png` + `.md` (runner tablet: baris kepala dengan timer di kanan, "Berikutnya" gelap; hasil quiz);
  - `7g.png` (runner desktop);
  - `28c.md` + `.png` (tahap 2: **banner menempel di atas**);
  - `7h.png` + `.md` (aturan Final dalam kotak `primary-tint`, pill "Lulus kursus" solid).
- Kode:
  - `src/components/learn/quiz/{quiz-runner,quiz-expired-submit,quiz-result,final-quiz-rules,final-quiz-result,quiz-page,final-quiz-page}.tsx` + tesnya, `answer-save-queue.ts` (hanya dibaca);
  - `src/components/learn/lesson-page.tsx` + tes;
  - `src/modules/attempt/{serializer,service}.ts` + `serializer.test.ts`, `quiz-attempt.integration.test.ts`;
  - `src/modules/progress/{queries,serializer,service}.ts` + `serializer.test.ts`, `lesson-page.integration.test.ts`;
  - `src/components/shared/nav-items.ts` (`HEADER_HEIGHT_CLASS`), `src/components/ui/{banner,button-variants,progress-bar}.tsx`.
- E2E: `e2e/belajar-quiz.spec.ts`, `e2e/belajar-final-quiz.spec.ts`, `e2e/layout/no-horizontal-scroll.spec.ts` (langkah quiz), `e2e/README.md` (`E2E_SCREENSHOT_DIR`).

## Kerjakan

### 1. Runner (`quiz-runner.tsx`)
1. **Jam perangkat di banner 28c tahap 2.**
   - Sekarang `showOfflineBanner` membandingkan `nowMs` (waktu server: `Date.now() + offset`) dengan `queueState.failingSince` (waktu perangkat, `Date.now()` di antrean).
   - Akibatnya, bila jam perangkat berbeda > 10 detik dari server, banner muncul seketika (perangkat lebih lambat) atau tidak pernah muncul (perangkat lebih cepat).
   - Bandingkan dengan jam yang sama: simpan juga waktu perangkat per tick, dan pakai itu untuk `> 10_000`. Timer tetap memakai waktu server.
2. **Banner tahap 2 menempel di atas** (28c: "banner menempel di atas").
   - Banner "N jawaban belum tersimpan di server" `sticky`, tepat di bawah header member (tinggi dari `HEADER_HEIGHT_CLASS`: 68 px / 80 px ≥ 640), dengan `z-index` di bawah header.
   - Banner tetap terlihat saat peserta di bawah halaman, misalnya di ringkasan 360.
3. **Kumpul gagal: pesan di dekat tombol + coba lagi.**
   - Sekarang `submitFailed` hanya memunculkan banner di puncak runner (bisa di luar layar), dan pada keadaan waktu habis tidak ada tombol apa pun. Peserta macet di "Waktu habis — mengumpulkan jawaban…".
   - Ganti dengan pesan inline + tombol **"Coba kumpulkan lagi"** *(usulan)*:
     - di ringkasan, tepat di bawah tombol Kumpulkan;
     - pada keadaan waktu habis, di bawah teks status.
   - Teks pesan tetap `COLLECT_FAILED_MESSAGE`. Boleh memakai `Banner` (`tone="error"`, tombol di `action`) di posisi itu. Saat pesan muncul, fokus pindah ke pesan itu, supaya terbaca pembaca layar dan tergulir ke layar.
   - Tombol memanggil jalur kumpul yang sama (409 → refresh, seperti sekarang).
4. **Posisi setelah muat ulang** (keputusan 3): indeks awal = soal pertama yang belum dijawab menurut `data.answers`; semua dijawab → soal terakhir.
5. **Satu h1** (temuan tinjauan S3-01: runner tanpa h1).
   - Tambah `heading: string` di `QuizRunningDTO`, diisi service:
     - quiz materi: `Quiz Materi {posisi} · {judul materi}` (sama dengan eyebrow aturan);
     - Final: `Final Quiz · {judul kursus}`.
   - Runner merendernya sebagai `<h1>` bergaya eyebrow (mono 11 px, `uppercase`, `text-primary-deep`) di atas kartu runner, mengikuti baris breadcrumb 7u.
   - "Soal X dari Y · Satu kesempatan" tetap seperti sekarang.
6. **Tampilan 360 dan 7u:**
   - **baris kepala** — eyebrow soal di kiri, timer + indikator simpan di kanan, satu baris di semua lebar (sekarang timer turun ke baris kedua di 360). Eyebrow boleh membungkus; timer tidak;
   - **ringkasan hanya punya satu navigator** — sekarang di ringkasan tampil baris chip atas (< 1024) atau aside (≥ 1024) **dan** grid ringkasan. Saat `phase === "ringkasan"`, baris chip atas dan aside tidak dirender, dan kolom ringkasan memakai lebar penuh;
   - **"Kumpulkan sekarang" selebar "Kembali ke soal"** di < 640 (`w-full sm:w-auto`);
   - **"Berikutnya" dan "Lihat ringkasan" memakai varian `dark`** (7u/7g); "Sebelumnya" tetap `secondary`;
   - **ikon panah** di tombol runner `shrink-0` (tidak gepeng di 360);
   - **chip belum tersimpan** selalu berlatar terang (`bg-surface text-text`) dengan garis putus `border-danger`, juga bila soalnya sudah dijawab. Sekarang garis putus merah menumpuk di latar gelap `bg-text`.

### 2. Beacon kedaluwarsa (`quiz-expired-submit.tsx`)
- Sekarang POST gagal (jaringan atau 5xx) tetap memanggil `router.refresh()`. Refresh **tidak** me-remount komponen, jadi `sent.current` tetap `true` dan beacon tidak pernah mencoba lagi. Komentar di kepala berkas keliru.
- Perbaikan:
  - 200 atau 409 → `refresh()`;
  - galat jaringan / status lain → teks "Jawaban belum terkumpulkan. Periksa koneksi lalu coba lagi." + tombol **"Coba lagi"** *(usulan)* yang mengirim POST lagi.
  - Penjaga StrictMode (satu POST saat mount) tetap. Perbaiki komentarnya.

### 3. Hasil quiz (`quiz-result.tsx`, `final-quiz-result.tsx`, serializer)
1. **Nilai dibulatkan ke bawah** (keputusan 2): `scorePercent` di `toQuizReviewDTO` dan nilai quiz di Daftar materi (`progress/serializer.ts`).
2. **Kebijakan pembahasan tersembunyi** (keputusan 4).
   - Tambah satu field di `QuizReviewDTO` yang menyatakan apakah kunci + pembahasan ditampilkan, dan bila tidak, alasannya: `NEVER`, atau `ON_PASS_ONLY` + tidak lulus. Namanya bebas, sebut di rencana.
   - Bila tersembunyi:
     - pill per soal netral **"Dijawab"** / **"Tidak dijawab"** *(usulan)*, tanpa Benar/Salah, tanpa "Kunci:", tanpa pembahasan;
     - judul bagian **"Jawaban Anda"** *(usulan)*, bukan "Pembahasan lengkap";
     - kalimat pengantar *(usulan)*: `NEVER` → "Kunci jawaban dan pembahasan tidak ditampilkan untuk quiz ini."; `ON_PASS_ONLY` → "Kunci jawaban dan pembahasan hanya ditampilkan bila nilai lulus.";
     - di hasil Final, tombol "Lihat pembahasan N soal" menjadi "Lihat jawaban Anda" *(usulan)*.
   - Tidak ada data benar/salah per soal di DTO pada kebijakan tersembunyi (pemindaian rekursif di tes).
3. **h1 hasil quiz materi:** eyebrow "Materi N · Hasil Quiz" menjadi `<h1>` (gaya tetap; pola hasil Final).
4. **Hasil Final mengikuti 7h:**
   - pill "Lulus kursus" solid (`bg-success text-surface`; kontras 4,96:1). "Belum lulus" tetap seperti sekarang;
   - angka Nilai Akhir `text-success` **hanya** bila status kursus Lulus; bila Selesai, `text-text`. Bilah kemajuan tetap `success` (warna kemajuan kursus, TOKENS).

### 4. Aturan Final (`final-quiz-rules.tsx`)
- Judul, kalimat pembuka, daftar aturan, dan dua tombol dibungkus kotak 7h: `rounded-card border bg-primary-tint p-6` (pasangan garis: `border-danger-tint-line`; tanpa token baru).
- Eyebrow "FINAL QUIZ · …" tetap di luar kotak.
- Kontras: `text-primary-deep` di `primary-tint` 4,85:1, `text-text-body` 7,92:1.

### 5. Final Quiz yang sudah dikerjakan (progress + hasil quiz materi + bar bawah materi)
- **Masalah:** setelah Final dikumpulkan, penutup hasil quiz materi tetap menulis "Final Quiz sekarang terbuka" + "Lanjut ke Final Quiz", dan bar bawah materi tetap "Final Quiz".
- **Data:**
  - `selectEnrollmentForCourse` ikut membaca `enrollments.status`;
  - `LessonQuizContext` dan DTO `open` halaman materi mendapat `finalQuizDone: boolean` = `finalQuizHref !== null && status !== "IN_PROGRESS"`. Hanya submit Final yang mengubah status itu (`recordFinalQuizResult`);
  - `QuizResultDTO` meneruskan `finalQuizDone`.
- **Copy bila `finalQuizDone`** *(usulan)*:
  - penutup hasil quiz materi: "Materi N ditandai selesai. Final Quiz sudah dikerjakan." + tombol "Lihat hasil Final Quiz";
  - bar bawah materi: "Hasil Final Quiz".

### 6. Halaman quiz materi untuk peserta belum terdaftar (keputusan 5)
- **Sekarang:** `getLessonQuizPage` meneruskan `NotFoundError` dari `loadLessonQuizContext`, yang juga dilempar untuk "tidak terdaftar" → 404.
- **Perbaikan:** setelah `selectQuizLessonBySlugs` menemukan materi (kursus terbit, materi ada, punya quiz), `NotFoundError` dari konteks → `{ state: "kembali", href: halaman materi }`.
- Penangkap ini **tidak** membungkus pencarian slug: slug salah, kursus tidak terbit, atau materi tanpa quiz tetap 404.

## Bukan lingkup tugas ini
- **Dispose antrean simpan saat runner dilepas** (keputusan 6). `dispose()` menghentikan antrean secara permanen, sedangkan efek di StrictMode dijalankan dua kali (mount → unmount → mount), jadi memanggilnya di cleanup mematikan simpan otomatis di dev. Mengirim jawaban yang tertunda setelah pindah halaman juga perilaku yang baik. Dicatat untuk putaran 2.
- Snapshot bobot Nilai Akhir saat kumpul (rumus hasil Final memakai bobot `system_settings` saat ini) — keputusan putaran 2.
- Lapor gangguan / reset attempt (A7), Nilai Saya (A3), chip "sekarang" merah penuh seperti 7u (ring sekarang sudah cukup), legenda chip Final 7g, timer berbentuk pill.
- **Tidak diubah:** `src/db/**`, `package.json`, `package-lock.json`, `src/lib/rbac.ts`, `src/proxy.ts`, `next.config.ts`, `.github/**`, `src/app/api/**`, `answer-save-queue.ts`, `use-quiz-start.ts`, `quiz-rules.tsx`, `src/styles/tokens.css`.
- **Jangan menjalankan `next upgrade`.** Pengingat keamanan Next 16.4.1 menghentikan `next build`/`next dev` sekali saat mendeteksi agent; jalankan ulang perintah yang sama.

Pekerjaan di luar lingkup → **berhenti dan tanyakan.**

## Berkas yang boleh dibuat/diubah
- `src/components/learn/quiz/{quiz-runner,quiz-expired-submit,quiz-result,final-quiz-rules,final-quiz-result,quiz-page,final-quiz-page}.tsx` + berkas tesnya
- `src/components/learn/lesson-page.tsx` + `lesson-page.test.tsx`
- `src/modules/attempt/{serializer,service}.ts` + `serializer.test.ts`, `quiz-attempt.integration.test.ts`
- `src/modules/progress/{queries,serializer,service}.ts` + `serializer.test.ts`, `lesson-page.integration.test.ts`, dan tes progress lain yang memakai `toEqual` atas hasil `selectEnrollmentForCourse` (sebut di rencana)
- `e2e/belajar-quiz.spec.ts`, `e2e/belajar-final-quiz.spec.ts` (hanya asersi setelah muat ulang di tes 1), `e2e/layout/no-horizontal-scroll.spec.ts` (hanya bila langkah ringkasannya terdampak)

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- hash basis (`186b6c5` + PR docs kartu ini) dan baseline Vitest **yang diukur**. Claude chat mengukur **129 berkas / 1500 tes** pada pohon `bb30848` (kode sama dengan `186b6c5`). Bila angkamu berbeda, berhenti dan laporkan;
- nama dan bentuk field baru (`heading`, field kebijakan pembahasan, `finalQuizDone`) beserta setiap DTO yang terdampak;
- daftar tes lama yang berubah, satu per satu, dengan alasannya. Yang sudah diketahui:
  - `belajar-quiz.spec.ts` tes 3: setelah muat ulang kini "Soal 10 dari 10", bukan soal 1, karena 9 soal sudah dijawab;
  - tes 10: "Soal 2 dari 10", karena posisi 1 sudah dijawab;
  - `belajar-final-quiz.spec.ts` tes 1: setelah muat ulang, posisi pertama yang belum dijawab bergantung pada acakan, jadi pakai pola `/Soal \d+ dari 10/`;
  - tes integrasi "unknown course slug, unknown lesson slug, not enrolled, and a quiz-less lesson all answer 404" dipecah;
  - allowlist kunci DTO hasil, `berjalan`, dan `open`;
  - tes runner yang menghitung navigator di ringkasan atau memakai fixture ber-`answers` dengan harapan soal 1;
  - tes label "Final Quiz" di bar bawah materi.

  Cari juga asersi keadaan lain yang berubah (pelajaran 14 Nov no. 3);
- urutan commit;
- tabel mutasi: setiap baris jelas merah atau hijau beserta alasannya.

## Selesai jika
- [ ] **Unit/komponen** (jsdom):
  - banner tahap 2 dengan jam perangkat **60 detik lebih lambat** dan **60 detik lebih cepat** dari server: tidak tampil sebelum 10 detik gagal, tampil setelahnya;
  - kumpul gagal di ringkasan → pesan + "Coba kumpulkan lagi" di bawah tombol, fokus di pesan; klik → POST kedua → `refresh`;
  - waktu habis + kumpul gagal → pesan + tombol coba lagi; klik → POST kedua;
  - indeks awal: `answers` untuk posisi 1–3 → "Soal 4 dari N"; semua dijawab → soal terakhir; tanpa jawaban → soal 1;
  - ringkasan: tepat satu `group` "Navigator soal";
  - chip belum tersimpan pada soal yang sudah dijawab berlatar terang + garis putus `border-danger`;
  - h1 runner = `heading`;
  - `QuizExpiredSubmit`: POST ditolak → tombol "Coba lagi" → POST kedua → `refresh`; 500 → tombol; 409 → `refresh` tanpa tombol; StrictMode tetap satu POST saat mount;
  - hasil quiz materi: h1 "Materi N · Hasil Quiz"; kebijakan tersembunyi → tanpa "Benar"/"Salah"/"Kunci:", pill "Dijawab"/"Tidak dijawab", judul dan kalimat pengantar sesuai kebijakan; penutup dengan `finalQuizDone`;
  - hasil Final: pill Lulus solid; angka Nilai Akhir `text-text` saat Selesai; "Lihat jawaban Anda" saat tersembunyi;
  - aturan Final: kotak `bg-primary-tint` membungkus judul + aturan + tombol;
  - bar bawah materi: "Hasil Final Quiz" saat `finalQuizDone`.
- [ ] **Serializer:** `scorePercent` 69,5 → 69, 70 → 70, 69,99 → 69 (hasil dan Daftar materi); DTO hasil kebijakan `NEVER` dan `ON_PASS_ONLY`-tidak-lulus lolos pemindaian rekursif tanpa data benar/salah per soal; allowlist kunci diperbarui.
- [ ] **Integrasi** (PGlite):
  - peserta belum terdaftar di halaman quiz materi → `kembali` ke halaman materi; slug kursus salah, slug materi salah, materi tanpa quiz → tetap 404;
  - `heading` quiz materi dan Final;
  - `finalQuizDone` `false` sebelum Final dikumpulkan dan `true` sesudahnya (hasil quiz materi dan DTO `open`).
- [ ] **E2E** — tes lama yang berubah (lihat rencana) + **paling banyak 3 tes baru** di `belajar-quiz.spec.ts` (anggaran CI):
  1. **Kumpul gagal di 360:** POST `/submit` pertama di-`abort` lewat `page.route` → pesan di bawah "Kumpulkan sekarang" `toBeInViewport()` → `unroute` → "Coba kumpulkan lagi" → hasil. Screenshot `quiz-kumpul-gagal-360`.
  2. **Kedaluwarsa + beacon gagal:** 3 jawaban lewat API, `expires_at` dimundurkan (pola tes 7), POST `/submit` pertama di-`abort` → "Coba lagi" tampil → `unroute` → klik → hasil EXPIRED. Screenshot `quiz-kedaluwarsa-gagal-360`.
  3. **Kebijakan `NEVER`:** `update quizzes set explanation_policy = 'NEVER'` lewat `withE2eDb` sebelum mulai → selesaikan lewat API → halaman hasil tanpa "Benar"/"Salah"/"Kunci:", dengan kalimat `NEVER`. Screenshot `quiz-hasil-tertutup-360`.

  Tambahan di **tes 9**, setelah "Lihat ringkasan":
  - gulir ke dasar halaman (`window.scrollTo(0, document.documentElement.scrollHeight)`);
  - asersikan premisnya dulu: `window.scrollY > 0` (pelajaran (hhh)). Bila ringkasan 360×800 tidak cukup panjang untuk tergulir, kecilkan tinggi viewport di langkah ini (mis. 360×560) sampai premis terpenuhi;
  - lalu banner "1 jawaban belum tersimpan di server" `toBeInViewport()`. `toBeVisible` tidak cukup (pelajaran (fff)).
- [ ] **E2E S3-01/S5-02 lain tetap hijau**, termasuk tes axe quiz dan Final.
- [ ] **Screenshot** — `E2E_SCREENSHOT_DIR=~/binzi-s3-02-screenshots` (kosongkan folder dulu), jalankan `belajar-quiz.spec.ts` + `belajar-final-quiz.spec.ts`. Harapan **23 berkas** (15 + 5 lama, 3 baru); sebut jumlahnya di PR. Yang terpenting untuk tinjauan:
  - `quiz-soal-360` (baris kepala);
  - `quiz-ringkasan-360` (satu navigator, Kumpulkan penuh);
  - `quiz-galat-simpan-360` (banner menempel);
  - tiga screenshot baru;
  - `final-aturan-360`/`-1280` (kotak 7h);
  - `final-hasil-360`.
- [ ] **Uji mutasi** — commit lokal dulu dan `git status` bersih sebelum mutasi pertama; kembalikan dengan `git restore`. Laporkan per mutasi nama tes yang merah + pesannya:
  1. Banner tahap 2 kembali membandingkan waktu server dengan `failingSince`.
  2. Banner tahap 2 tanpa `sticky`. Harus merah di e2e tes 9; laporkan dari daftar tes gagal reporter (pelajaran (zz)).
  3. Pesan kumpul gagal kembali hanya di banner atas (tanpa tombol inline).
  4. Keadaan waktu habis tanpa tombol coba lagi.
  5. `QuizExpiredSubmit` tanpa tombol coba lagi (perilaku lama).
  6. Indeks awal selalu 0.
  7. `Math.round` di `toQuizReviewDTO`.
  8. `Math.round` di nilai Daftar materi.
  9. Pill per soal kembali dihitung dari `correct` saat kebijakan tersembunyi.
  10. Kalimat "Ditampilkan untuk semua soal…" tampil tanpa syarat.
  11. Penangkap `NotFoundError` di `getLessonQuizPage` dipindah ke **sebelum** pencarian slug (slug salah ikut dialihkan, bukan 404).
  12. `finalQuizDone` selalu `false`.
  13. Ringkasan kembali merender baris chip atas.
  14. Angka Nilai Akhir `text-success` tanpa syarat.

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR. Harapan `0 excused / 0 blocking / OK`, tanpa catatan entri tak terpakai (C-11 sudah mengosongkan berkasnya). Temuan high/critical baru → berhenti dan tempel output lengkapnya.
- **Build dan rute:** `npm run build`. `curl -sI` halaman quiz materi tanpa cookie → 307 ke `/masuk?next=…`.
- **Prettier:** berkas yang sudah ada tetap apa adanya.
- **`lint:hex`** menolak `#` diikuti 3/6 karakter hex di `src/`, termasuk komentar — tulis "PR 138", bukan "PR #138".
- **`npm run check` di commit akhir:** tempel 5 baris terakhir output di PR.
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas.
- **"Keputusan & asumsi" di PR** memuat keputusan 1–6, semua copy *(usulan)*, dan keputusan yang diambil tanpa bertanya.
- **Setelah push:** buat PR segera begitu e2e lokal hijau, lalu kerjakan mutasi selagi CI berjalan. Perbarui isi PR dengan tabel mutasi. Cek CI (`gh pr checks`, job `ci` dan `e2e`), dan laporkan durasi job `e2e` dibanding PR 140 (12m50s).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`
- Baseline + jumlah tes baru; tes lama yang berubah disebut satu per satu.
- `git diff --stat main -- package-lock.json package.json src/db src/lib/rbac.ts src/proxy.ts next.config.ts .github src/app/api src/styles src/components/learn/quiz/answer-save-queue.ts src/components/learn/quiz/use-quiz-start.ts src/components/learn/quiz/quiz-rules.tsx` kosong.

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Screenshot `~/binzi-s3-02-screenshots` (23 berkas) diunggah ke Claude chat untuk ditinjau terhadap 7u/7g/7h/28c.
- [ ] Lokal (Docker menyala):
  ```bash
  cd ~/Project/React/binzi-new && git fetch origin && git switch s3/s3-02-perapian-quiz && git pull --ff-only && npm run dev:db && npm run dev
  ```
  Masuk sebagai MEMBER di kursus demo lokal, DevTools 360:
  1. Mulai quiz, jawab 3 soal, muat ulang → mendarat di soal 4.
  2. Network "Offline", jawab satu soal, tunggu > 10 detik, gulir ke bawah → banner tetap terlihat di bawah header.
  3. Masih offline, buka ringkasan → "Kumpulkan sekarang" tunggu; kembali online → tersimpan. Offline lagi, klik Kumpulkan → pesan + "Coba kumpulkan lagi" di bawah tombol; online → klik → hasil.
  4. Buka `/belajar/{kursus}/{materi}/quiz` dengan akun MEMBER lain yang belum terdaftar → dialihkan ke halaman materi.

## Catatan tinjauan 19 Nov (fakta kode di `186b6c5`)
- **`quiz-runner.tsx`:**
  - baris 207–217: tick menulis `nowMs = Date.now() + offset` (waktu server);
  - baris 304–307: `nowMs - queueState.failingSince > 10_000`, padahal `failingSince` diisi `Date.now()` di antrean (`answer-save-queue.ts`, `onSendFailure`) — dua jam berbeda;
  - baris 355–361: banner `submitFailed` di puncak;
  - baris 431–437: keadaan `expired` hanya teks status;
  - baris 124: `useState(0)`;
  - baris 413–422 + 599–613: baris chip atas dan aside tetap dirender di ringkasan, dan baris 451–460 menambah grid ketiga;
  - baris 95–106: `unsaved` + `answered` → `border-dashed border-danger` + `bg-text`;
  - baris 581/590: `ArrowRight` tanpa `shrink-0`;
  - baris 365: `flex-wrap` di baris kepala.
- **`quiz-expired-submit.tsx`:** komentar baris 7–8 ("a failed post is retried by the refresh re-mounting this component") keliru. `router.refresh()` tidak me-remount client component di posisi yang sama, jadi `sent.current` tetap `true`.
- **`quiz-result.tsx`:**
  - baris 57: `answeredCorrectly` = ada opsi terpilih dengan `correct === true`. Pada kebijakan tersembunyi semua `correct` bernilai `null`, jadi **setiap** soal berlabel "Salah";
  - baris 174–178: judul + kalimat pengantar tanpa syarat;
  - baris 101: eyebrow `<p>`;
  - baris 193: copy "Final Quiz sekarang terbuka".
- **`attempt/serializer.ts`:** baris 401–404 `revealsKey`; baris 463 `Math.round` nilai.
- **`progress/serializer.ts`:** baris 371 `Math.round` nilai Daftar materi; baris 310 `enrollment: { id: string }`.
- **`attempt/service.ts`:** baris 114–123: hanya `ConflictError` yang menjadi `kembali`; `NotFoundError` dari `loadUnlockedLessonContext` (`progress/service.ts` baris 155–157, tidak terdaftar) diteruskan → 404.
- **`progress/queries.ts`:** baris 287 `selectEnrollmentForCourse` hanya memilih `id` + `lastLessonId`.
- **`final-quiz-result.tsx`:** baris 33 pill tint; baris 92 angka Nilai Akhir `text-success` tanpa syarat. **`lesson-page.tsx`:** baris 190 label "Final Quiz".
- **Header member:** `sticky top-0 z-30`, tinggi `HEADER_HEIGHT_CLASS` = `h-[68px] sm:h-[80px]`.
- **`shuffle_questions` bawaan `true`:** tes e2e yang menjawab lewat API wajib membaca `question_order` attempt (pola #141), bukan urutan DB.
- **Kontras** (dihitung di sandbox): `text-primary-deep` di `primary-tint` 4,85:1; putih di `success` 4,96:1; `text-text-body` di `primary-tint` 7,92:1.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
