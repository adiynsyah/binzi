# S2-02 · Pemutar video materi (versi demo): kolom sumber video, iframe YouTube berkontrol bawaan, simpan posisi, skrip pasang video

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | **S2-01** (PR #133, `54e7d7a`): `getLessonPage` + `LessonPageDTO` (keadaan `open` membawa `progress.videoLastPositionSeconds`), `POST /api/progress/video` (`recordVideoProgress`, mewajibkan `video_status = 'READY'`), halaman `/belajar/[slug]/[materi]`, helper e2e `createPublishedCourseViaApi(…, { lessons })`, `waitForOpenBeacon`, `deleteCoursesInE2eDb`. Juga C-05 (pembungkus `scripts/binzi-dev.ts`), A-16b (CSP) |
| **Target** | Sab 14 malam – Min 15 Nov. Langkah kesepuluh jalur demo 20 Nov |
| **Branch** | `s2/s2-02-pemutar-video` |

> **Dibuat 14 Nov 2026** di Claude chat terhadap `main` `54e7d7a` (S2-01 sudah di-merge). Klaim teknis di bawah sudah dijalankan di sandbox (drizzle-kit 0.45 generate, PGlite dengan kedua migrasi, Vitest penuh di atas skema baru). Buktinya ada di "Catatan tinjauan 14 Nov".
>
> **Keputusan pemilik 14 Nov** (disetujui; dicantumkan di "Keputusan & asumsi" PR bersama semua copy bertanda *(usulan)*):
>
> 1. **Garis potong rencana video dipakai:** demo memakai **iframe YouTube dengan kontrol bawaannya**. Kontrol 29a dan antarmuka `PlayerEngine` pindah ke kartu **S2-02b** setelah demo (sebelum S1-05). Yang permanen tetap dibangun sekarang: kolom sumber video, `PlaybackDTO` + `resolvePlayback`, `LessonVideoPlayer` dengan bingkai 16:9, dan pencatatan posisi.
> 2. **Posisi tetap dicatat lewat IFrame API**, karena tombol quiz (kartu berikutnya) baru aktif setelah video ≥ 90 % ditonton.
> 3. **Video demo dipasang lewat skrip**, tidak ada isian YouTube di CMS (rencana video bagian 8, pagar 1).
> 4. **Iframe dirender sendiri** (`youtube-nocookie.com/embed/{id}?enablejsapi=1…`), lalu IFrame API **menempel** ke iframe itu. API tidak membuat iframe. Alasannya: video tetap bisa diputar walau skrip API gagal dimuat, React tetap memiliki node-nya, dan `src` bisa diuji tanpa jaringan.

## Tujuan
Peserta yang membuka materi berisi video melihat pemutar YouTube 16:9 di atas judul materi, bisa memutarnya dengan kontrol bawaan YouTube, dan melanjutkan dari posisi terakhir. Posisi dan persen tonton tersimpan lewat `POST /api/progress/video` (S2-01) saat diputar, dijeda, selesai, dan saat halaman ditinggalkan. Database punya kolom sumber video yang permanen (R2 atau YouTube) dengan `CHECK` yang menjaga konsistensinya. Pemilik bisa memasang video demo ke satu materi lewat skrip, di lokal maupun di binzi-dev.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/decisions/video-sumber.md`: blok "Pembaruan 14 Nov" di atas, lalu bagian 1, 2, 3c (hanya bagian `host`, `playerVars`, `onError`, `title`, `referrerPolicy`), 4, 5, 8.
- PRD: `docs/prd/sections/06-4-progress-nilai-saya-menggantikan-sertifi.md` (PRG-01), `12-keamanan.md` (§12.5 CSP, V-06).
- Desain: `docs/design/screens/7d.md` + `.png` (letak video di kolom utama di atas judul; banner kuning "Video gagal dimuat…"), `13d.png` (format waktu "BERHENTI DI 01:24").
- Kode:
  - `src/db/schema/course.ts` (tabel `lessons`, `videoStatusEnum`), `src/db/schema/quiz.ts` (pola `check()`), `src/db/migrations/` (hanya `0000_initial_schema.sql` sejauh ini);
  - `src/modules/progress/{queries,serializer,service}.ts` dan `lesson-page.integration.test.ts` (S2-01);
  - `src/components/learn/{lesson-page,lesson-open-beacon}.tsx` dan `lesson-page.test.tsx`;
  - `src/components/ui/banner.tsx`;
  - `next.config.ts` (CSP) dan `src/config/security-headers.test.ts`;
  - `src/components/cms/editor-paste.ts` (`VIDEO_HOSTS`, aturan host YouTube);
  - `scripts/binzi-dev.ts`, `scripts/set-role.ts`, `src/db/binzi-dev-target.ts`, `src/db/local-guard.ts` (`formatDatabaseTarget`);
  - `src/modules/lesson/service.integration.test.ts` (sekitar baris 313).
- E2E: `e2e/fixtures.ts` (pengumpul CSP: dokumen utama saja), `e2e/layout/helpers.ts`, `e2e/belajar-materi.spec.ts` (S2-01), `e2e/layout/{axe,no-horizontal-scroll}.spec.ts`.

## Kerjakan

### 1. Migrasi `0001` — kolom sumber video (permanen)
1. Di `src/db/schema/course.ts`:
   - enum baru `videoProviderEnum = pgEnum("video_provider", ["R2", "YOUTUBE"])`, tepat di bawah `videoStatusEnum`;
   - dua kolom nullable di `lessons`, tepat di bawah `videoKey`: `videoProvider: videoProviderEnum("video_provider")` dan `videoExternalId: text("video_external_id")`;
   - satu `check()` di blok indeks `lessons` (impor `check` dari `drizzle-orm/pg-core`, urut abjad):
     ```ts
     check(
       "lessons_video_source_check",
       sql`${table.videoStatus} <> 'READY' or coalesce(
         (${table.videoProvider} = 'R2' and ${table.videoKey} is not null)
         or (${table.videoProvider} = 'YOUTUBE' and ${table.videoExternalId} ~ '^[A-Za-z0-9_-]{11}$'),
         false)`,
     ),
     ```
     **`coalesce(…, false)` wajib.** Tanpa itu, baris `READY` dengan `video_provider` NULL **lolos**: `NULL = 'R2'` bernilai NULL, dan `CHECK` yang bernilai NULL dianggap lulus (dicek di PGlite, lihat catatan tinjauan). Bentuk di rencana video versi 7 Nov punya celah ini dan sudah diperbaiki di dokumen itu.
2. `npm run db:generate -- --name video_source` → **satu** berkas `src/db/migrations/0001_video_source.sql` + `meta/0001_snapshot.json` + entri `_journal.json`. Isi SQL yang diharapkan (hasil sandbox):
   ```sql
   CREATE TYPE "public"."video_provider" AS ENUM('R2', 'YOUTUBE');--> statement-breakpoint
   ALTER TABLE "lessons" ADD COLUMN "video_provider" "video_provider";--> statement-breakpoint
   ALTER TABLE "lessons" ADD COLUMN "video_external_id" text;--> statement-breakpoint
   ALTER TABLE "lessons" ADD CONSTRAINT "lessons_video_source_check" CHECK ("lessons"."video_status" <> 'READY' or coalesce(
           ("lessons"."video_provider" = 'R2' and "lessons"."video_key" is not null)
           or ("lessons"."video_provider" = 'YOUTUBE' and "lessons"."video_external_id" ~ '^[A-Za-z0-9_-]{11}$'),
           false));
   ```
   - **Jangan generate dua kali.** Bila skema diubah lagi setelah generate, bersihkan dulu (`git checkout -- src/db/migrations && git clean -fd src/db/migrations`) lalu generate ulang. Snapshot `0001` yang tertinggal membuat drizzle-kit menulis migrasi selisih (`DROP CONSTRAINT` lalu `ADD`), yang gagal di database baru (terjadi di sandbox).
   - `UPDATE … SET video_provider = 'R2' WHERE video_key IS NOT NULL` dari rencana video **tidak** dipakai: belum ada kode yang mengisi `video_key`, jadi pernyataan itu tidak mengubah apa pun.
   - Bila drizzle-kit menghasilkan SQL lain dari yang di atas, **berhenti dan tempel isinya**.
3. `npm run db:migrate` ke DB lokal (baca baris `[drizzle] target:` dulu, harus `localhost:54330/binzi_local`).
4. **Pemilik membaca berkas SQL sebelum rencana disetujui** (aturan A-07). Tempel isinya di rencana.

### 2. Tes lama yang patah karena `CHECK` (satu per satu)
Dicek di sandbox dengan Vitest penuh di atas skema baru: **6 tes di 2 berkas** merah, ditambah dua `UPDATE` di e2e. Setiap tempat yang memasang `video_status = 'READY'` juga mengisi `video_provider = 'YOUTUBE'` dan `video_external_id` 11 karakter (pakai konstanta tes yang jelas palsu, mis. `"e2eVideo001"`):
- `src/modules/lesson/service.integration.test.ts` — "outline: ordered rows, computed emptiness, quiz counts, no content key" (sekitar baris 313);
- `src/modules/progress/lesson-page.integration.test.ts` — helper `videoCourse` (lima tes `recordVideoProgress` memakainya);
- `e2e/belajar-materi.spec.ts` tes 7 — kedua `update lessons set video_status = 'READY' …`.

Tes yang memang mengasersi perilaku lama lalu diubah, sebut di PR satu per satu dengan alasannya. Jangan melemahkan asersinya.

### 3. Server: `PlaybackDTO` + `resolvePlayback` (permanen)
1. **`serializer.ts`**:
   ```ts
   export type PlaybackDTO =
     | { kind: "youtube"; videoId: string; durationSeconds: number | null }
     | { kind: "file"; url: string; expiresAt: string; durationSeconds: number | null };
   ```
   - `resolvePlayback(row)` — fungsi murni, `switch` lengkap atas `video_provider`:
     - `video_status !== 'READY'` → `null`;
     - `YOUTUBE` → `{ kind: "youtube", videoId: video_external_id, durationSeconds }`, dengan `durationSeconds` bernilai `null` bila kolomnya null atau ≤ 0 (aturan yang sama dengan `recordVideoProgress`);
     - `R2` → `null` dengan komentar "cabang file: S1-05 (presigned GET, A-17)";
     - `null` → `null` (tidak terjangkau dengan `CHECK`, tetap aman).
   - TypeScript harus menandai `switch` yang belum lengkap (`const _exhaustive: never = …` di cabang `default`).
2. **DTO keadaan `open`:** `lesson.hasVideo` **diganti** `lesson.playback: PlaybackDTO | null`. Keadaan `locked` dan `not-enrolled` tetap tanpa `playback` (`"playback" in …` → false), sama seperti `content`.
3. **`queries.ts`:** `selectLessonContent` diperluas (atau diganti nama menjadi `selectOpenLesson`) supaya ikut membaca `video_status`, `video_provider`, `video_external_id`, `video_key`, `video_duration_seconds`. Query ini **tetap hanya dijalankan di keadaan `open`**: ID video materi terkunci tidak pernah dibaca, sama seperti isinya (V-06).
4. `service.ts` mengekspor ulang `type PlaybackDTO`. `recordVideoProgress` tidak berubah.
5. Luruskan komentar kepala `serializer.ts` (temuan tinjauan PR #133). Impor runtime-nya adalah `./policy` (helper gerbang) **dan** berkas skema modul course (`COURSE_LEVEL_LABELS`, dipakai saat runtime). Hanya skema db yang `import type`.

### 4. `src/lib/youtube.ts` — fungsi murni, dipakai klien dan skrip
Tanpa impor server, tanpa `"use client"`.
- `YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/` (satu sumber dengan `CHECK`; komentar menunjuk migrasi `0001`).
- `parseYouTubeId(input: string): string | null` menerima:
  - ID 11 karakter langsung;
  - `https://www.youtube.com/watch?v=ID` (parameter lain boleh ada), `https://m.youtube.com/watch?v=ID`;
  - `https://youtu.be/ID`;
  - `https://www.youtube.com/embed/ID`, `https://www.youtube-nocookie.com/embed/ID`;
  - `https://www.youtube.com/shorts/ID`.

  Host dicocokkan seperti `VIDEO_HOSTS` di `editor-paste.ts` (persis sama atau subdomain), hanya `http`/`https`. Selain itu `null`, termasuk `youtube.com.contoh.com` dan host video lain.
- `youtubeEmbedUrl(videoId, { origin, startSeconds })` →
  `https://www.youtube-nocookie.com/embed/{id}?enablejsapi=1&origin={origin ter-encode}&rel=0&playsinline=1&iv_load_policy=3`, ditambah `&start={n}` hanya bila `n > 0`. Pakai `URL`/`URLSearchParams`, bukan rangkaian string.

### 5. Klien: `LessonVideoPlayer` (permanen) + pemutar YouTube (sementara)
Semua di `src/components/learn/`.

**A. `lesson-video-player.tsx`** (`"use client"`, permanen) — props `{ lessonId, lessonTitle, playback: PlaybackDTO, resumeFromSeconds: number }`:
- Bingkai `relative aspect-video w-full overflow-hidden rounded-card bg-ink-surface`. Sebelum terpasang di klien, bingkai kosong saja (tanpa iframe). Setelah terpasang, cabang `playback.kind`:
  - `youtube` → `<YouTubePlayer …>`;
  - `file` → `null` + komentar "S1-05" (pemeriksaan `never` untuk kelengkapan).
- Iframe dirender **setelah mount** karena `src` butuh `window.location.origin`: URL Preview Vercel berbeda per branch, jadi tidak boleh diambil dari env. Bingkai 16:9 sudah ada sejak render server, jadi tidak ada lompatan tata letak.
- **"Melanjutkan dari mm:ss"** *(usulan)*. Kalimat ini muncul di bawah bingkai (`text-sm text-text-meta`) bila `resumeFromSeconds ≥ 5` dan (durasi tidak diketahui atau `resumeFromSeconds < durasi − 5`), diikuti tombol tautan *(usulan)* "Mulai dari awal". Tombol aktif setelah API siap, memanggil `seekTo(0, true)`, lalu baris itu hilang. Bila posisi tidak memenuhi syarat itu, video mulai dari 0 (`start` tidak dipasang).
- Format waktu `mm:ss` (≥ 1 jam: `h:mm:ss`) dari satu fungsi murni yang dites.

**B. `youtube-player.tsx`** (`"use client"`, **sementara** — komentar kepala: "mesin YouTube untuk demo, dihapus di C-10, `docs/decisions/video-sumber.md`"):
- `<iframe>` milik React:
  - `src={youtubeEmbedUrl(videoId, { origin, startSeconds })}`;
  - `title={"Video: " + lessonTitle}` *(usulan)*;
  - `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"`;
  - `allowFullScreen`;
  - `referrerPolicy="strict-origin-when-cross-origin"`;
  - `className="absolute inset-0 size-full"`.
- Loader `loadYouTubeIframeApi()`, sekali per halaman:
  - menyisipkan `<script src="https://www.youtube.com/iframe_api">` satu kali;
  - selesai lewat `window.onYouTubeIframeAPIReady` (handler sebelumnya, bila ada, tetap dipanggil);
  - gagal bila `onerror` atau setelah 15 detik;
  - pemanggil berikutnya memakai promise yang sama.
- Setelah API siap: `new YT.Player(iframeEl, { events: { onReady, onStateChange, onError } })` — **menempel** ke iframe yang ada, tidak membuat iframe baru.
- **Jangan memanggil `player.destroy()` saat unmount.** Dugaan, belum dicek dari sandbox: pada iframe milik React, YT bisa mencabut node itu dan React gagal saat unmount. Cukup hentikan pelapor dan abaikan event setelah unmount.
- Pemetaan `onStateChange` (`data`): `1` diputar → pelapor `playing`; `2` dijeda → `paused`; `0` selesai → `ended`; `3` buffering dan `5` cued diabaikan.
- `onError` (kode 2, 5, 100, 101, 150) → `Banner` tone `info` di bawah bingkai: *(usulan, dari 7d tanpa klausa coba ulang)* "Video gagal dimuat di jaringan ini. Teks materi & quiz tetap bisa dikerjakan."
- Skrip API gagal dimuat → **tanpa pesan**. Video tetap bisa diputar dengan kontrol bawaan; hanya posisi yang tidak tercatat. Catat di PR sebagai perilaku yang disengaja.

**C. `video-progress-reporter.ts`** (permanen, tidak tahu sumber video) — `createVideoProgressReporter({ lessonId, read, send? })`:
- `read()` mengembalikan `{ positionSeconds, durationSeconds }` dari pemutar;
- `send` bawaan: `fetch("/api/progress/video", { method: "POST", headers: JSON, body, keepalive })`.

| Peristiwa | Yang dikirim |
|---|---|
| `playing()` | mulai timer 10 detik; setiap tick kirim posisi saat itu |
| `paused()` | kirim posisi saat itu, hentikan timer |
| `ended()` | kirim `positionSeconds = durationSeconds` (→ 100 %), hentikan timer |
| `pagehide` (selagi diputar) dan `dispose()` (selagi diputar) | kirim posisi terakhir dengan `keepalive: true`, hentikan timer |

Aturan:
- posisi = `Math.floor(currentTime)`, durasi = `Math.round(duration)`; posisi dibatasi ≤ durasi;
- durasi < 1 (belum diketahui) → tidak mengirim;
- paling banyak satu request berjalan: tick yang datang saat request sebelumnya belum selesai dilewati;
- posisi dan durasi yang sama dengan kiriman sukses terakhir tidak dikirim ulang (kecuali `ended`);
- jawaban 401, 404, atau 409 → berhenti mengirim untuk materi ini (sesi habis, materi hilang, atau terkunci);
- galat jaringan dan 5xx diabaikan diam-diam (pola beacon S2-01).

### 6. Halaman materi
- `lesson-page.tsx`, keadaan `open`: bila `data.lesson.playback` ada, `<LessonVideoPlayer key={data.lesson.id} …>` di kolom utama **di atas h1** (7d). h1 mendapat jarak atas `mt-6` hanya bila ada pemutar. Tanpa video, tata letak S2-01 tidak berubah.
- `resumeFromSeconds = data.progress?.videoLastPositionSeconds ?? 0`.
- `key={data.lesson.id}` memastikan pindah materi lewat `<Link>` memasang pemutar dan pelapor baru.

### 7. CSP (sementara, rencana video bagian 4)
- `next.config.ts`:
  - `scriptSrc` + `"https://www.youtube.com"`;
  - `frameSrc` + `"https://www.youtube-nocookie.com"`;
  - keduanya dengan komentar "sementara — mesin video YouTube untuk demo, dihapus di C-10 (`docs/decisions/video-sumber.md` bagian 4)".
- Sekalian luruskan komentar `authInterrupts` (baris 93–94) dari "still experimental in Next 16.3.7" menjadi 16.4.1 (STATUS, pekerjaan kecil sejak C-02).
- `src/config/security-headers.test.ts`: string kebijakan persis untuk keempat lingkungan diperbarui. Tidak ada entri lain yang berubah.

### 8. Skrip pasang video demo (rencana video bagian 5)
- **Inti yang dites** — `src/db/lesson-video.ts` (bukan `scripts/`: Vitest hanya menjalankan `src/**`, pelajaran C-05):
  - `setLessonYouTubeVideo(db, { courseSlug, lessonSlug, videoId, durationSeconds })` dalam satu transaksi;
  - materi dicari lewat slug kursus + slug materi; tidak ada → galat jelas;
  - `video_provider = 'YOUTUBE'`, `video_external_id`, `video_status = 'READY'`, `video_duration_seconds`, `video_key = NULL`;
  - mengembalikan judul kursus, judul materi, dan nilai lama (untuk dicetak);
  - `courses` tidak disentuh;
  - tanpa `audit_logs`: `actor_id` NOT NULL dan CLI tidak punya aktor (pola `set-role`). Sebut di PR.
- **CLI** — `scripts/set-lesson-youtube.ts --kursus <slug> --materi <slug> --video <tautan atau ID> --durasi <detik>`:
  - menerima slug, bukan UUID: keduanya terbaca dari URL `/belajar/{kursus}/{materi}`. Ini menyimpang dari rencana video ("--lesson <uuid>"); sebut di PR;
  - ID diambil lewat `parseYouTubeId`; tidak sah → keluar 1 tanpa menyentuh DB;
  - durasi bilangan bulat 1–86400;
  - mencetak `[video:youtube] target: host:port/nama-db` (`formatDatabaseTarget`) **sebelum** tersambung, lalu ringkasan "lama → baru".
- **npm:**
  - `"video:youtube": "tsx --env-file-if-exists=.env.local scripts/set-lesson-youtube.ts"` (lokal);
  - `"video:youtube:binzi-dev": "tsx scripts/binzi-dev.ts set-video"` — subperintah baru `set-video` di pembungkus, pola `set-role` persis: `DATABASE_URL` dari `.env.binzi-dev`, argumen diteruskan apa adanya, tanpa shell.
- **Agent tidak pernah menjalankan skrip ini ke binzi-dev** (`CLAUDE.md`). Di lokal boleh, ke DB `binzi_local`.
- `docs/development-lokal.md`: bagian pendek "Memasang video YouTube (demo)" berisi contoh perintah lokal dan binzi-dev, plus cara membaca baris target.

### 9. Tes struktur dan batas
- `src/lib/learn-route-structure.test.ts` tidak berubah (tanpa `loading.tsx` baru).
- `youtube-player.tsx` hanya diimpor oleh `lesson-video-player.tsx`. Tambahkan asersi `git grep`-setara di tes, atau sebut di PR dengan bukti perintahnya.

## Bukan lingkup tugas ini
- **S2-02b (setelah demo, sebelum S1-05):** kontrol 29a (`PlayerControls`), antarmuka `PlayerEngine`, menu kecepatan, pintasan keyboard, layar penuh pada bingkai, state memuat/selesai 28f, coba ulang otomatis.
- **S1-05:** cabang `R2` di `resolvePlayback`, mesin file, domain R2 di `media-src`.
- **Kartu quiz (berikutnya):** tombol "Tandai selesai & mulai quiz" dan syarat video ≥ 90 %.
- Isian YouTube di CMS, unggah video, subtitle, analitik tonton, rate limit progres video.
- **Tidak diubah:** `src/app/(learn)/layout.tsx`, `src/lib/rbac.ts`, `src/proxy.ts`, endpoint `POST /api/progress/video` (kontraknya tetap).

Pekerjaan di luar lingkup → **berhenti dan tanyakan.**

## Berkas yang boleh dibuat/diubah
- `src/db/schema/course.ts`; `src/db/migrations/0001_video_source.sql`, `src/db/migrations/meta/0001_snapshot.json`, `src/db/migrations/meta/_journal.json` (hasil generate saja)
- `src/db/lesson-video.ts` (baru) + `lesson-video.integration.test.ts` (baru)
- `src/lib/youtube.ts` (baru) + `youtube.test.ts` (baru)
- `src/modules/progress/{queries,serializer,service}.ts` + `serializer.test.ts`, `lesson-page.integration.test.ts`
- `src/modules/lesson/service.integration.test.ts` (hanya baris `READY` di bagian 2)
- `src/components/learn/{lesson-video-player,youtube-player}.tsx` + tes masing-masing (baru); `src/components/learn/video-progress-reporter.ts` + tes (baru); `src/components/learn/lesson-page.tsx` + `lesson-page.test.tsx`
- `next.config.ts` (hanya entri CSP bagian 7 dan komentar `authInterrupts`); `src/config/security-headers.test.ts`
- `scripts/set-lesson-youtube.ts` (baru); `scripts/binzi-dev.ts` (subperintah `set-video` + teks pemakaian); `package.json` (hanya dua skrip npm di bagian 8)
- `docs/development-lokal.md` (bagian baru saja)
- `e2e/belajar-materi.spec.ts`; `e2e/belajar-video.spec.ts` (baru); `e2e/layout/helpers.ts` (helper stub YouTube); `e2e/layout/{axe,no-horizontal-scroll}.spec.ts`

Tanpa dependensi baru: `package-lock.json` tidak berubah. Tipe `YT` ditulis sendiri secukupnya di `youtube-player.tsx`, **bukan** `@types/youtube`.

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- hash basis (= `main` terbaru, minimal `54e7d7a` + PR docs kartu ini) dan baseline Vitest **yang diukur** di basis itu. Claude chat mengukur **113 berkas / 1215 tes** pada pohon yang identik dengan `54e7d7a`; bila angkamu berbeda, berhenti dan laporkan;
- **isi lengkap `0001_video_source.sql`** hasil generate (pemilik membacanya sebelum menyetujui);
- signature setiap ekspor baru (`resolvePlayback`, `PlaybackDTO`, `parseYouTubeId`, `youtubeEmbedUrl`, `createVideoProgressReporter`, `setLessonYouTubeVideo`, loader API) dan bentuk DTO `open` yang baru;
- daftar tes lama yang berubah, satu per satu, dengan alasannya (minimal empat tempat di bagian 2 dan tes `hasVideo` di `lesson-page.test.tsx`);
- cara stub YouTube di e2e (bagian "E2E" di bawah), dan bukti bahwa stub itu tetap diperiksa CSP sungguhan;
- tabel mutasi: setiap baris jelas merah atau hijau beserta alasannya, tanpa baris ragu.

## Selesai jika
- [ ] **Migrasi:** `0001_video_source.sql` sama dengan isi di bagian 1. `npm run db:migrate` lokal sukses. `git diff --stat main -- src/db/migrations` hanya menunjukkan tiga berkas `0001`/journal.
- [ ] **Tes integrasi `CHECK`** (PGlite, `src/db/lesson-video.integration.test.ts` atau berkas integrasi progress), per baris:
  - ditolak: `READY` tanpa sumber; `READY` + `YOUTUBE` tanpa ID; ID 10 karakter; ID berisi `/`; `READY` + `R2` tanpa `video_key`; `READY` + `R2` dengan ID YouTube saja;
  - diterima: `NONE` tanpa sumber; `UPLOADING` tanpa sumber; `READY` + `YOUTUBE` + ID 11 karakter; `READY` + `R2` + `video_key`.
- [ ] **`setLessonYouTubeVideo`:** memasang kelima kolom; menjalankan ulang menimpa ID lama; slug salah → galat tanpa perubahan; `courses.updated_at` tetap.
- [ ] **`youtube.test.ts`:** setiap bentuk tautan di bagian 4 → ID; ditolak: host lain, `youtube.com.contoh.com`, `javascript:`, ID 10/12 karakter, `watch` tanpa `v`; `youtubeEmbedUrl` dengan dan tanpa `start`, `origin` ter-encode, host `youtube-nocookie.com`.
- [ ] **`serializer.test.ts`:** tabel `resolvePlayback` (NONE/UPLOADING/FAILED → null; READY+YOUTUBE → youtube; durasi null/0 → `durationSeconds: null`; READY+R2 → null); `open` membawa `playback`; `locked`/`not-enrolled` tanpa `playback`.
- [ ] **Tes integrasi halaman:**
  - materi `open` dengan video → `playback.videoId` benar;
  - materi `locked` dengan video → DTO tanpa `playback`, dan **query video tidak dijalankan**: dibuktikan dengan `vi.mock("./queries", async (importOriginal) => …)` parsial yang membungkus fungsi aslinya dengan `vi.fn`, lalu `not.toHaveBeenCalled()` untuk `locked` dan `not-enrolled`;
  - tanpa video → `playback: null`.
- [ ] **Tes komponen** (jsdom, `YT` tiruan dan `fetch` tiruan):
  - `LessonVideoPlayer`: bingkai 16:9; iframe muncul setelah mount dengan `src`, `title`, `referrerPolicy`, `allow` yang benar; baris "Melanjutkan dari 01:24" untuk posisi 84 (dan tidak muncul untuk 3, atau untuk posisi ≥ durasi − 5); "Mulai dari awal" memanggil `seekTo(0, true)` lalu baris hilang; `onError` 150 → banner.
  - Loader: dua pemanggil → satu `<script>`; `onerror` → promise gagal; handler `onYouTubeIframeAPIReady` lama tetap dipanggil.
  - Pemetaan state 1/2/0 ke pelapor; event setelah unmount diabaikan.
  - Pelapor (timer palsu): tick 10 dan 20 detik; `paused` langsung; `ended` = durasi; durasi 0 → tidak ada request; request kedua dilewati selama yang pertama berjalan; 409 → berhenti; posisi sama tidak dikirim ulang; `pagehide`/`dispose` selagi diputar → `keepalive: true`; galat jaringan tidak melempar.
  - `LessonPage`: `open` dengan `playback` → pemutar di atas h1; tanpa `playback` → tidak ada iframe (DOM S2-01 tetap).
- [ ] **`security-headers.test.ts`** hijau dengan dua entri baru, di keempat lingkungan.
- [ ] **E2E** `e2e/belajar-video.spec.ts` (proyek `chromium`). **Stub YouTube** dari helper baru `stubYouTube(page)` di `e2e/layout/helpers.ts`, dipasang **sebelum** navigasi:
  - `https://www.youtube.com/iframe_api` → `route.fulfill` JS palsu: mendefinisikan `window.YT.Player` tiruan yang menempel ke iframe, memanggil `onReady`, dan membuka kendali tes lewat `window.__ytStub` (`setTime(n)`, `setDuration(n)`, `emit(state)`, `error(code)`);
  - `https://www.youtube-nocookie.com/embed/**` → HTML kecil dengan `<html lang="id">` dan `<title>` (supaya axe tidak menandai dokumen stub);
  - karena stub disajikan dari URL aslinya, **CSP sungguhan tetap memeriksanya**. Tanpa entri CSP baru, skrip stub diblokir dan tes merah (mutasi 9).

  Video dipasang lewat `setLessonYouTubeVideo` atau SQL dengan ID `e2eVideo001` + durasi 100. Tes:
  1. Materi dengan video → iframe `src` ber-host `www.youtube-nocookie.com`, path `/embed/e2eVideo001`, `enablejsapi=1`, `origin` = origin halaman, `rel=0`, tanpa `start`. Tanpa pelanggaran CSP (pengumpul).
  2. `setTime(37)`, `emit(1)`, lalu `emit(2)` → `waitForResponse` POST `/api/progress/video` 200 dengan body `{ lessonId, positionSeconds: 37, durationSeconds: 100 }`. DB: posisi 37, persen 37.
  3. Muat ulang → "Melanjutkan dari 00:37" terlihat dan `src` memuat `start=37`.
  4. `emit(0)` → POST dengan posisi 100. DB: persen 100.
  5. `error(150)` → banner "Video gagal dimuat…" terlihat.
  6. Materi tanpa video → tidak ada iframe. Materi **terkunci** yang punya video → `request.get` HTML **tidak memuat** `e2eVideo001`.
  7. Lebar 360 dan 1280: tanpa gulir samping; screenshot `video-open-360`, `video-open-1280`, dan `video-resume-360` (setelah isi + iframe terlihat, `animations: "disabled"`).

  Pembersihan lewat `deleteCoursesInE2eDb`.
- [ ] **axe** (`axe.spec.ts`, w360 dan w1280): materi `open` dengan video (stub aktif).
- [ ] **E2E S2-01** tetap hijau setelah bagian 2.
- [ ] **Uji mutasi** — commit lokal dulu dan `git status` bersih sebelum mutasi pertama; kembalikan setiap mutasi dengan `git restore`. Laporkan per mutasi nama tes yang merah beserta pesannya. Mutasi yang hanya tertangkap E2E dijalankan dengan `npx playwright test --grep …` sungguhan.
  1. `coalesce(…, false)` dihapus dari `CHECK` **langsung di berkas `0001_video_source.sql`** (tes PGlite membaca berkas migrasi, bukan skema TS) → tes "READY tanpa sumber" merah.
  2. Pola ID di `CHECK` (berkas SQL) menjadi `{10,12}`.
  3. `resolvePlayback` mengabaikan `video_status`.
  4. Query video dijalankan juga untuk keadaan `locked` (tertangkap spy di tes integrasi halaman).
  5. `parseYouTubeId` menerima host yang hanya *berakhiran* `youtube.com` tanpa titik pemisah.
  6. `start` selalu dipasang (juga 0).
  7. Pelapor tidak menghentikan timer saat `paused`.
  8. Pelapor mengirim `ended` dengan posisi saat itu, bukan durasi.
  9. Entri `https://www.youtube.com` dihapus dari `scriptSrc` (e2e no. 1 dan unit header merah).
  10. `key={data.lesson.id}` dihapus dari `LessonVideoPlayer` (tes komponen pindah materi).

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`. `main` memuat S2-01.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR. Harapan 0 excused / 0 blocking / OK. Angka di bawah high dicatat apa adanya beserta daftar paketnya. Temuan high/critical baru → berhenti dan tempel output lengkapnya.
- **Build dan rute:** `npm run build` tanpa rute baru. `npm run start`, buka materi berisi video sebagai MEMBER. `curl -sI` halaman materi menunjukkan CSP dengan kedua entri baru dan tanpa `'unsafe-eval'`.
- **Uji manual dengan YouTube sungguhan** (lokal, tanpa stub):
  1. pasang video lewat `npm run video:youtube -- --kursus … --materi … --video <tautan> --durasi <detik>`, memakai video publik yang boleh disematkan;
  2. putar, jeda, putar lagi, biarkan selesai;
  3. Network: POST `/api/progress/video` muncul saat jeda, tiap ±10 detik, dan saat selesai;
  4. Console: tanpa pelanggaran CSP dari dokumen BINZI;
  5. tutup tab saat diputar, buka lagi → "Melanjutkan dari …".

  ID video tidak ditulis di PR atau commit.
- **Prettier:** berkas yang sudah ada tetap apa adanya. Berkas baru boleh dirapikan.
- **`npm run check` di commit akhir:** tempel 5 baris terakhir output di PR.
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas.
- **"Keputusan & asumsi" di PR** memuat keputusan pemilik 1–4, copy usulan, penyimpangan dari rencana video (CLI pakai slug, tanpa `UPDATE`, tanpa `destroy()`, kontrol bawaan), dan keputusan yang diambil tanpa bertanya.
- **Setelah push:** cek CI (`gh pr checks`, job `ci` dan `e2e`), lalu laporkan hasilnya beserta durasi job e2e dibanding `main`.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`
- Baseline Vitest = angka yang diukur di basis sesi. PR melaporkan baseline + jumlah tes baru; tes lama yang berubah disebut satu per satu.
- `git diff --stat main -- package-lock.json 'src/app/(learn)/layout.tsx' src/lib/rbac.ts src/proxy.ts 'src/app/api/progress/video'` kosong.
- `git diff main -- package.json` hanya dua baris skrip npm.

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] **Baca `0001_video_source.sql`** di PR. Harus sama dengan bagian 1.
- [ ] Lokal (Docker menyala):
  ```bash
  cd ~/Project/React/binzi-new && npm run dev:db && npm run db:migrate
  ```
  Baca baris `[drizzle] target:` (harus `localhost:54330/binzi_local`).
  1. Pasang video uji ke materi 1 "[DEMO] Kursus contoh 3" (yang sudah terbit di lokal sejak S2-01):
     ```bash
     npm run video:youtube -- --kursus demo-kursus-contoh-3 --materi demo-materi-1 --video https://youtu.be/ID_VIDEO --durasi 120
     ```
     Ganti `ID_VIDEO` dengan video publik yang boleh disematkan, dan `120` dengan durasinya dalam detik. Baca baris target dulu.
  2. `npm run dev`, masuk sebagai MEMBER yang sudah mengikuti kursus itu, buka materi 1 → video di atas judul. Putar ±20 detik, jeda.
  3. Muat ulang → "Melanjutkan dari 00:2x". Klik "Mulai dari awal" → video kembali ke 0.
  4. Putar sampai selesai (atau geser ke akhir) → `npm run db:studio`, tabel `lesson_progress` → `video_watched_percent` = 100.
- [ ] **binzi-dev — SEBELUM merge** (Preview dan Production memakai binzi-dev). Setelah merge, kode baru membaca `video_provider` di setiap halaman materi. Bila kolom itu belum ada, halaman materi Production menjawab 500 sampai migrasi dijalankan. Migrasi ini aditif: kode `main` yang sedang berjalan tidak membaca kolom baru dan tidak pernah memasang READY, jadi aman dijalankan lebih dulu.
  1. SQL Editor binzi-dev: `select count(*) from lessons where video_status = 'READY';` → **harus `0`**. Bila bukan 0, berhenti dan bawa ke Claude chat. Dengan `CHECK` baru, migrasi gagal di atas baris READY tanpa sumber (dicek di sandbox).
  2. Dari branch PR yang sudah final (`git switch s2/s2-02-pemutar-video && git pull`): `npm run db:migrate:binzi-dev` → baca kedua baris target. Jangan mengubah berkas migrasi setelah langkah ini.
  3. Buka satu halaman materi di Preview PR (login Vercel) → tampil seperti S2-01, tanpa 500.
  4. Baru **Squash and merge**.
- [ ] **Pasca-merge:** video demo dipasang saat persiapan gladi (Rab 18), dengan ID video *unlisted* dari akun YouTube proyek: `npm run video:youtube:binzi-dev -- --kursus … --materi … --video … --durasi …`. Pemutaran di HP (Safari, `playsinline`) dicek saat gladi resik.

## Catatan jadwal
- Sesi dimulai setelah PR docs kartu ini masuk `main` (Sab 14 malam atau Min 15 pagi).
- **Bila terlambat**, yang dipotong lebih dulu:
  1. baris "Melanjutkan dari" + "Mulai dari awal" (posisi tetap dipakai lewat `start`);
  2. pengiriman saat `pagehide`/`dispose`;
  3. e2e no. 5 (banner galat; tes komponennya tetap).

  Migrasi + `CHECK`, `PlaybackDTO`, iframe nocookie, pelapor putar/jeda/selesai, CSP, skrip, dan stub e2e no. 1–2 **tidak dipotong**.

## Catatan keputusan
- **Iframe milik React, API menempel.** Pola resmi IFrame API mengganti `<div>` dengan iframe buatannya sendiri. Di React itu berarti DOM diubah di luar React, dan `src` baru ada setelah skrip pihak ketiga jalan. Dengan iframe sendiri + `enablejsapi=1`, video tetap bisa diputar walau API gagal, dan e2e bisa memeriksa `src` tanpa jaringan.
- **`start` di URL, bukan `seekTo` saat siap.** `seekTo` sebelum diputar bisa memicu buffering. Parameter `start` hanya berlaku saat peserta menekan putar.
- **Pelapor tidak tahu sumber video.** S2-02b dan S1-05 memakainya ulang tanpa perubahan.
- **Persen tetap posisi terjauh** (keputusan S2-01 no. 5). Celah "geser ke akhir" tetap tercatat untuk setelah demo.
- **`frame-src` hanya `youtube-nocookie.com`.** Tautan video terkait di dalam pemutar bisa berpindah ke `www.youtube.com` dan diblokir. Diterima untuk demo (`rel=0` mengurangi tautan itu); dicek saat gladi.
- **YouTube hanya untuk demo** (rencana video bagian 8): daftar periksa sebelum peserta penelitian atau publik tetap `select count(*) from lessons where video_provider = 'YOUTUBE'` = 0.

## Catatan untuk kartu quiz (Sen 16)
- Tombol "Tandai selesai & mulai quiz" aktif bila `playback === null` atau `progress.videoWatchedPercent ≥ 90`. Nilai persen di halaman berasal dari render server, jadi setelah menonton tombol baru aktif setelah halaman dimuat ulang atau di-`router.refresh()`. Putuskan di kartu quiz: pelapor memberi tahu halaman lewat callback setelah POST sukses, atau tombol membaca persen terbaru dari jawaban POST.
- Bila skrip API YouTube gagal dimuat, persen tidak pernah bertambah. Kartu quiz perlu kalimat untuk keadaan itu (mis. "Tonton video sampai selesai untuk membuka quiz").

## Catatan tinjauan 14 Nov
| Klaim | Cara dicek | Hasil |
|---|---|---|
| `CHECK` versi rencana 7 Nov menolak READY tanpa sumber | PGlite + `0000` + `0001` hasil generate, `INSERT` per kasus | **Tidak**: READY + `video_provider` NULL **diterima** (`NULL = 'R2'` → NULL → `CHECK` lulus). Migrasi juga lolos di atas baris READY lama |
| `CHECK` dengan `coalesce(…, false)` | sama, 10 kasus | Ditolak: READY tanpa sumber, YOUTUBE tanpa ID, ID 10 karakter, ID berisi `/`, R2 tanpa `video_key`, R2 dengan ID saja. Diterima: NONE, UPLOADING, YOUTUBE + ID 11, R2 + `video_key`. Migrasi di atas baris READY lama **gagal** dengan pesan jelas |
| SQL hasil `drizzle-kit generate` | `drizzle-kit` repo, `MIGRATION_DATABASE_URL` tiruan (generate tidak tersambung) | Persis blok di bagian 1, empat pernyataan |
| Generate dua kali | generate → ubah skema → generate | Snapshot `0001` lama membuat migrasi `DROP` + `ADD` yang gagal di DB baru. Perlu `git checkout` + `git clean` folder migrasi sebelum generate ulang |
| Tes lama yang patah | Vitest penuh di atas skema baru | 6 tes di 2 berkas (`lesson/service.integration.test.ts` 1, `progress/lesson-page.integration.test.ts` 5). Ditambah dua `UPDATE` e2e (tidak dijalankan Vitest) |
| Baseline | Vitest penuh pada `81b1700` (pohon identik dengan `54e7d7a`, `git diff` kosong) | 113 berkas / 1215 tes |
| Host CSP YouTube | Dokumentasi Video.js (tabel penyedia) dan rangkuman host Google; YouTube tidak bisa dijangkau dari sandbox | `script-src https://www.youtube.com`; `frame-src` sesuai host embed (`youtube-nocookie.com`). **Belum dicek dari sandbox:** skrip lain yang mungkin dimuat `iframe_api` di luar `www.youtube.com` → dicek agent lewat uji manual YouTube sungguhan (konsol tanpa pelanggaran) |
| Pengumpul CSP e2e | `e2e/fixtures.ts` | Hanya dokumen utama; iframe pihak ketiga punya CSP sendiri. Stub `iframe_api` disajikan dari URL aslinya, jadi `script-src` BINZI tetap memeriksanya |
| `Banner` untuk pesan gagal | `src/components/ui/banner.tsx` | Tone `info` = latar kuning peringatan (7d), `role="status"` |
| `hasVideo` dipakai di mana | `git grep` di `54e7d7a` | `serializer.ts` (tipe + nilai) dan `lesson-page.test.tsx:78` |

Yang **belum** dicek dari sandbox: pemutaran YouTube sungguhan, perilaku `YT.Player` yang menempel ke iframe yang sudah ada (termasuk `destroy()`), dan `playsinline` di Safari iOS.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
