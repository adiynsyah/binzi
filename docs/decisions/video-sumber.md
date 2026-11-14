# Sumber video materi — YouTube untuk demo 20 Nov, R2 untuk produksi

> **Status: DIPUTUSKAN 7 Nov 2026 oleh pemilik.**
> - Demo 20 Nov memakai video YouTube, **dengan pemutar berkontrol 29a**
>   (bukan kontrol bawaan YouTube).
> - Jalur produksi **tetap R2** sesuai PRD (K-06, Q4, §10.3) dan tidak dihapus.
>
> Dokumen ini adalah rencana supaya perpindahan YouTube → R2 nanti mulus:
> kontrol 29a dibangun sekali di atas "mesin" pemutar yang bisa ditukar.
> Masuk PRD v1.6 sebagai Q46 (teks usulan di bagian terakhir).

> **Pembaruan 14 Nov 2026 — garis potong dipakai (keputusan pemilik).**
> - **Demo 20 Nov memakai iframe YouTube dengan kontrol bawaannya**
>   (`controls` bawaan, tanpa kontrol 29a), kartu
>   [S2-02](../tasks/sprint-2/S2-02-pemutar-video-youtube.md). Alasannya
>   jadwal: S2-01 mulai dua hari terlambat.
> - **Tetap dibangun di S2-02** (permanen): migrasi kolom sumber video,
>   `PlaybackDTO` + `resolvePlayback`, `LessonVideoPlayer` dengan bingkai
>   16:9, dan pelapor posisi yang tidak tahu sumber video. Posisi tetap
>   dicatat lewat IFrame API, karena tombol quiz menunggu video ≥ 90 %.
> - **Iframe dirender sendiri** (`youtube-nocookie.com/embed/{id}?enablejsapi=1…`)
>   lalu IFrame API menempel ke iframe itu, alih-alih membiarkan API membuat
>   iframe (bagian 3c). Video tetap bisa diputar walau skrip API gagal.
> - **Kontrol 29a + antarmuka `PlayerEngine` (bagian 3a, 3b) pindah ke kartu
>   S2-02b**, setelah demo dan **sebelum S1-05**, supaya S1-05 tetap hanya
>   menambah mesin file (bagian 9).
> - **`CHECK` di bagian 1 diperbaiki.** Versi 7 Nov meloloskan baris `READY`
>   dengan `video_provider` NULL, karena `CHECK` yang bernilai NULL dianggap
>   lulus (diuji di PGlite 14 Nov). Bentuk yang berlaku memakai
>   `coalesce(…, false)`.
> - Karena kontrol bawaan YouTube dipakai, batasan bagian 7 soal logo dan
>   iklan yang tertutup kontrol kustom tidak berlaku untuk demo. Cek video
>   tanpa iklan saat gladi resik tetap berlaku.

## Keputusan

- **Demo 20 Nov:** video contoh disimpan di YouTube dengan status *unlisted*,
  diputar lewat YouTube IFrame API dari `www.youtube-nocookie.com` (mode
  privasi YouTube), dengan kontrol bawaan YouTube disembunyikan dan diganti
  kontrol 29a. Tidak ada fitur unggah atau isian YouTube di CMS: video demo
  dipasang lewat skrip.
- **Produksi:** R2 + presigned GET 2 jam + `<video>` HTML5 (PRD §10.3), dengan
  kontrol 29a yang sama. H-04 tetap wajib sebelum S1-05 dan sebelum peserta
  penelitian atau publik memakai BINZI.
- Jalur cadangan `public/` (keputusan 3 Nov) tidak dipakai. Batas keputusan
  pembayaran Cloudflare Kam 12 Nov tidak lagi memblokir demo, tetapi tetap
  memblokir S1-05.

**Alasan:**
- **YouTube untuk demo:** jalur R2 bergantung pada metode pembayaran
  Cloudflare yang belum ada (H-04 tertahan sejak 24 Okt).
- **Kontrol 29a sejak demo:** demo memperlihatkan pemutar sesuai desain final,
  dan saat pindah ke R2 tampilan tidak berubah karena hanya mesinnya yang
  ditukar.

**Yang diterima untuk demo:**
- Siapa pun yang memegang tautan bisa menonton video *unlisted* di luar
  BINZI, dan YouTube berhak menayangkan iklan. Karena itu video demo adalah
  **video contoh yang boleh dilihat umum**, bukan materi final ahli gizi
  (aturan yang sama dengan jalur `public/` 3 Nov).
- Kontrol kustom di atas YouTube ada di wilayah abu-abu ketentuan YouTube
  (bagian 7). Itu diterima untuk demo internal, dan menjadi salah satu alasan
  YouTube tidak boleh dipakai untuk peserta nyata.

## Prinsip: yang permanen dibangun sekarang, yang sementara dibuat tipis

| Permanen — dipakai lagi oleh R2 | Sementara — dibuang saat migrasi |
|---|---|
| Kolom sumber video dan aturan konsistensinya di `lessons` | Mesin YouTube (`createYouTubeEngine`, IFrame API) |
| `video_status` dan `video_duration_seconds`, yang sudah dipakai outline builder (`videoReady`) dan syarat terbit | Entri `https://www.youtube.com` di `script-src` dan `https://www.youtube-nocookie.com` di `frame-src` CSP |
| Penjaga akses halaman materi (login, ikut kursus, preview gratis) **sebelum** pemutar dirender | Skrip pasang video demo |
| `PlaybackDTO` + `resolvePlayback`, dan `LessonVideoPlayer` dengan bingkai 16:9 | Nilai `video_external_id` di baris materi demo |
| **Kontrol 29a** (`PlayerControls`), antarmuka **`PlayerEngine`**, state memuat/selesai/gagal (28f, 7d) | |
| Lanjut dari posisi terakhir dan simpan posisi tiap 10 detik (PRG-01, kolom `video_last_position_seconds` dan `video_watched_percent` yang sudah ada), kecepatan yang diingat | |
| Tes kontrol terhadap mesin palsu | |

Halaman peserta hanya mengenal `LessonVideoPlayer` dan DTO-nya. Kontrol 29a
hanya mengenal `PlayerEngine`. Saat sumber berganti, halaman, kontrol, dan
tes kontrol tidak ikut berubah; yang berubah hanya mesin yang dipilih.

## 1. Model data — satu migrasi kecil, aditif

```sql
CREATE TYPE video_provider AS ENUM ('R2', 'YOUTUBE');

ALTER TABLE lessons ADD COLUMN video_provider video_provider;
ALTER TABLE lessons ADD COLUMN video_external_id text;

-- coalesce wajib (perbaikan 14 Nov): tanpa itu video_provider NULL membuat
-- seluruh ekspresi NULL, dan CHECK yang NULL dianggap lulus.
ALTER TABLE lessons ADD CONSTRAINT lessons_video_source_check CHECK (
  video_status <> 'READY'
  OR coalesce(
       (video_provider = 'R2' AND video_key IS NOT NULL)
       OR (video_provider = 'YOUTUBE'
           AND video_external_id ~ '^[A-Za-z0-9_-]{11}$'),
       false)
);
```

- `UPDATE … SET video_provider = 'R2' WHERE video_key IS NOT NULL` dari versi
  7 Nov dihapus: tidak ada kode yang pernah mengisi `video_key`, jadi
  pernyataan itu tidak mengubah apa pun. Migrasi `0001` dibuat
  `drizzle-kit generate` dari skema (kartu S2-02 bagian 1).
- Migrasi gagal dengan pesan jelas bila sudah ada baris `READY` tanpa
  sumber. Sebelum `db:migrate:binzi-dev`, cek
  `select count(*) from lessons where video_status = 'READY'` = 0.

- Kolom lama (`video_key`, `video_status`, `video_duration_seconds`,
  `video_size_bytes`) tetap. R2 memakai `video_key`; YouTube memakai
  `video_external_id` (ID video 11 karakter).
- `video_status = 'READY'` berarti "materi punya video", apa pun sumbernya.
  Outline builder dan syarat terbit tidak perlu tahu sumbernya.
- Nama kolom `video_external_id` sengaja umum, bukan `youtube_id`.
- Nilai enum `YOUTUBE` dibiarkan di database setelah migrasi selesai
  (menghapus nilai enum di Postgres mahal); penulisan baru ditolak di
  langkah pembersihan.
- Progres tonton tidak butuh migrasi: tabel progres materi sudah punya
  `video_last_position_seconds` dan `video_watched_percent` (A-07).

## 2. Lapisan server — satu titik pilih sumber

```ts
type PlaybackDTO =
  | { kind: "youtube"; videoId: string; durationSeconds: number | null }
  | { kind: "file"; url: string; expiresAt: string; durationSeconds: number | null };
```

- `resolvePlayback(row)` memakai `switch` yang lengkap atas `video_provider`.
  Untuk demo hanya cabang `YOUTUBE` yang ada; cabang `R2` ditambahkan S1-05
  dan memanggil lapisan storage A-17 (presigned GET 2 jam, PRD §10.3).
  TypeScript menandai `switch` yang belum lengkap.
- Penjaga akses dijalankan service halaman materi **sebelum**
  `resolvePlayback`, sama untuk kedua sumber.
- Data halaman juga membawa posisi terakhir dan persen tonton peserta dari
  tabel progres, untuk "Melanjutkan dari …".
- **Simpan posisi** (PRG-01): `POST /api/progress/video` dengan
  `{ lessonId, positionSeconds, durationSeconds }`, dipanggil kontrol tiap
  10 detik saat diputar, saat jeda, dan saat selesai. Endpoint ini tidak tahu
  sumber video.

## 3. Pemutar — kontrol 29a di atas mesin yang bisa ditukar

### 3a. Antarmuka mesin (permanen)

```ts
interface PlayerEngine {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setRate(rate: 0.75 | 1 | 1.25 | 1.5 | 2): void;
  setMuted(muted: boolean): void;
  currentTime(): number;
  duration(): number | null;
  bufferedFraction(): number; // 0–1, untuk bilah buffer
  on(
    event: "ready" | "play" | "pause" | "waiting" | "timeupdate" | "ended" | "error",
    listener: () => void,
  ): () => void; // mengembalikan fungsi lepas
  destroy(): void;
}
```

Hanya yang dipakai kontrol 29a yang masuk antarmuka. Subtitle belum masuk:
demo tanpa subtitle, dan desain 29a menyembunyikan tombol CC bila materi
tidak punya subtitle. Subtitle ditambahkan bersama mesin file (`<track>`
WebVTT) saat ada materinya.

### 3b. Kontrol 29a — `PlayerControls` (permanen)

Mengikuti 29a, 28f, dan 7d:
- bilah bawah di atas video dengan gradasi: putar/jeda, −10, +10, waktu
  `mm:ss / mm:ss`, bilah posisi + buffer yang bisa digeser, menu kecepatan
  (0.75× · 1× normal · 1.25× · 1.5× · 2×), suara, layar penuh;
- pesan "Melanjutkan dari mm:ss" + "Mulai dari awal" di kiri atas, hilang
  sendiri setelah 5 detik;
- kecepatan terakhir diingat untuk materi berikutnya (`localStorage`,
  dibungkus `try/catch`);
- keyboard: Spasi putar/jeda, ← → 10 detik, F layar penuh (C subtitle
  menyusul bersama subtitle);
- layar penuh memakai `requestFullscreen` pada **bingkai pemutar**, bukan
  video, supaya kontrol ikut tampil;
- state: memuat ("memuat video · m:ss", 28f), selesai (28f), dan gagal
  dimuat dengan coba ulang otomatis (7d: "Video gagal dimuat di jaringan
  ini…").

Copy-nya mengikuti layar tersebut (copy antarmuka final, catatan 29a).

### 3c. Mesin YouTube — `createYouTubeEngine` (sementara, khusus demo)

- Memuat `https://www.youtube.com/iframe_api` sekali per halaman, lalu
  `new YT.Player(...)` dengan `host: "https://www.youtube-nocookie.com"` dan
  `playerVars`: `controls: 0`, `disablekb: 1` (keyboard ditangani kontrol
  29a), `fs: 0`, `rel: 0`, `playsinline: 1`, `iv_load_policy: 3`,
  `origin: location.origin`.
- IFrame API tidak punya event `timeupdate`: mesin membaca
  `getCurrentTime()` tiap ±250 ms selama diputar lalu memancarkan
  `timeupdate`. `bufferedFraction` dari `getVideoLoadedFraction()`.
- Kecepatan lewat `setPlaybackRate` (YouTube mendukung 0.75–2).
- `onError` YouTube (kode 2, 5, 100, 101, 150) → event `error` → state
  gagal 7d.
- Lapisan klik transparan di atas iframe (klik = putar/jeda) supaya fokus
  dan pintasan keyboard tetap di bingkai pemutar; iframe diberi
  `tabIndex={-1}`.
- `iframe` tetap mendapat `title` dan
  `referrerPolicy="strict-origin-when-cross-origin"`. YouTube menolak
  sematan tanpa referrer; header situs sudah sesuai, atribut ini menjaga bila
  header berubah.

### 3d. Mesin file — `createFileEngine` (S1-05)

`<video preload="metadata">` dengan `src` presigned URL. Event HTML5
dipetakan langsung ke antarmuka; tanpa polling. Setelah S1-05, kontrol 29a
tidak berubah.

### 3e. Rencana tes

- **Kontrol 29a** dites di jsdom terhadap **mesin palsu** yang
  mengimplementasikan `PlayerEngine`. Tes ini permanen dan tetap berlaku
  setelah migrasi.
- **Mesin YouTube** dites dengan objek `YT` tiruan (pemetaan event dan
  polling). Pemutaran sungguhan tidak dites otomatis.
- **E2E** tidak bergantung pada jaringan YouTube: memeriksa halaman materi,
  kontrol 29a, dan `src` iframe yang menunjuk `youtube-nocookie.com` dengan ID
  yang benar. Pemutaran sungguhan diperiksa manual saat gladi resik.

## 4. CSP (sementara, selama mesin YouTube ada)

- `frame-src`: tambah `https://www.youtube-nocookie.com`.
- `script-src`: tambah `https://www.youtube.com` (IFrame API dan skrip
  pemutarnya dimuat dari host ini).
- Keduanya diberi komentar "sementara — mesin video YouTube untuk demo,
  `docs/decisions/video-sumber.md`" di `next.config.ts`, dan dicatat sebagai
  pengecualian sementara pada kebijakan Q45.
- S1-05: domain R2 masuk `media-src` (PRD §12.5).
- Pembersihan: kedua entri YouTube dihapus.

## 5. Skrip pasang video demo

`scripts/set-lesson-youtube.ts --lesson <uuid> --url <tautan YouTube> --duration <detik>`

- Mengambil ID dari bentuk `youtube.com/watch?v=`, `youtu.be/`, dan
  `youtube.com/embed/`, dengan aturan host yang sama dengan
  `src/components/cms/editor-paste.ts`; ID wajib cocok
  `^[A-Za-z0-9_-]{11}$`.
- Mencetak target database lebih dulu (aturan `CLAUDE.md`, seperti
  `db:migrate`) dan berhenti bila tidak sesuai.
- Satu transaksi: `video_provider = 'YOUTUBE'`, `video_external_id`,
  `video_status = 'READY'`, `video_duration_seconds`, `video_key = NULL`.
- Durasi di database diisi manual untuk label outline. Pemutar sendiri
  membaca durasi dari mesin saat berjalan.

## 6. Aturan konten demo

- Akun YouTube milik proyek (Brand Account), bukan akun pribadi.
- Video berstatus *unlisted*, berisi contoh yang boleh dilihat umum.
- **Simpan berkas master yang siap R2 sejak sekarang:** MP4 H.264, 720p,
  maksimal 5 menit dan 60 MB (K-06, R-05), di drive bersama dengan nama =
  slug materi. Berkas inilah yang diunggah ke R2 saat migrasi. Video tidak
  diunduh dari YouTube (dilarang ketentuan YouTube, dan kualitasnya turun).

## 7. Ketentuan YouTube selama demo

- Ketentuan API YouTube mengizinkan kontrol bawaan disembunyikan dan pemutar
  dikendalikan lewat API, tetapi melarang menutupi atau mengubah bagian
  pemutar seperti logo dan iklan.
- **Logo YouTube tetap harus terlihat**: bilah kontrol 29a memakai gradasi
  tembus pandang dan tidak menaruh elemen pejal di pojok kanan bawah video.
- **Iklan:** bila YouTube memutar iklan, lapisan klik dan bilah kontrol bisa
  menghalangi tombol iklan. Mitigasinya untuk demo: pastikan video demo
  terputar tanpa iklan saat gladi resik, dan ulangi pengecekan pada hari demo.
- Batasan ini hanya diterima untuk demo internal. Peserta nyata hanya
  memakai mesin file R2 (bagian 8, pagar 3).

## 8. Pagar supaya YouTube tidak melebar

1. Tidak ada isian YouTube di CMS. Satu-satunya jalan adalah skrip di atas.
2. H-04 tetap di URUTAN-KERJA tahap 3 sebagai syarat S1-05.
3. Daftar periksa sebelum peserta penelitian atau publik memakai BINZI:
   `SELECT count(*) FROM lessons WHERE video_provider = 'YOUTUBE'` harus `0`,
   dan CSP tidak lagi memuat entri YouTube.

## 9. Urutan kartu dan jadwal demo

**Sebelum demo:**
- **Kam 12 Nov, "Peserta: halaman materi + progres":** termasuk
  `POST /api/progress/video` dan data posisi terakhir untuk halaman (bagian
  2). Endpoint ini permanen.
- **Jum 13 Nov, "Peserta: player video":** bagian 1, 3, 4, 5 (migrasi
  sumber video, `PlaybackDTO` + `resolvePlayback` cabang YouTube,
  `PlayerEngine`, kontrol 29a, mesin YouTube, CSP, skrip, tes). File SQL
  migrasi dibaca pemilik sebelum rencana disetujui (aturan A-07).
  - Perkiraan 1,5–2 hari; hari cadangan **Sel 17** dipakai untuk ini.
  - **Garis potong bila terlambat:** `LessonVideoPlayer` menampilkan iframe
    YouTube dengan kontrol bawaannya (`controls: 1`, tanpa kontrol 29a). Data
    model, DTO, dan halaman tetap sama, jadi potongan ini tidak menambah
    utang migrasi.

**Setelah demo** (urutan sejak 14 Nov: S2-02b disisipkan sebelum S1-05):
0. 🤖 S2-02b — kontrol 29a (`PlayerControls`) + antarmuka `PlayerEngine` +
   mesin YouTube berkontrol tersembunyi (bagian 3a–3c), menggantikan
   kontrol bawaan dari S2-02. Pelapor posisi S2-02 dipakai ulang.
1. 👤 H-04 — metode pembayaran Cloudflare (✓ 14 Nov), bucket dev & prod, token.
2. 🤖 A-17 — lapisan storage R2.
3. 🤖 S1-05 — unggah video ke R2, cabang `R2` di `resolvePlayback`, mesin
   file, domain R2 di `media-src`. Kontrol 29a tidak disentuh.
4. 🤖 C-10 — migrasi video YouTube → R2, lalu pembersihan (runbook di bawah).

## 10. Runbook migrasi YouTube → R2 (kartu C-10)

**Prasyarat:** S1-05 sudah di `main`, R2 produksi aktif, berkas master
semua video YouTube tersedia.

1. **Inventaris (`--dry-run`):** daftar materi `video_provider = 'YOUTUBE'`
   beserta berkas master yang cocok per slug. Ada yang tidak punya master →
   berhenti.
2. **Unggah** setiap master ke R2 lewat jalur S1-05, dengan format kunci
   yang sama dengan unggahan CMS.
3. **Pindah per materi, satu transaksi:** `video_provider = 'R2'`,
   `video_key`, `video_size_bytes`, `video_duration_seconds` (dari berkas),
   `video_status = 'READY'`, ditambah satu baris audit `lesson.video_migrate`
   berisi ringkasan sumber lama → baru. **`video_external_id` dibiarkan** untuk
   jalan mundur. Posisi tonton peserta (`video_last_position_seconds`) tetap
   berlaku karena videonya sama.
4. **Verifikasi** per materi, di staging lalu produksi: video terputar
   dengan kontrol 29a, bisa digeser, posisi tersimpan dan dilanjutkan;
   outline dan syarat terbit tetap "ada video".
5. **Jalan mundur** per materi: kembalikan `video_provider = 'YOUTUBE'`.
   Bisa karena ID lama masih tersimpan, mesin YouTube masih ada, dan entri
   CSP belum dihapus.
6. **Pembersihan** (setelah 7 hari tanpa masalah):
   - hapus `createYouTubeEngine` dan cabang `YOUTUBE` di `resolvePlayback`
     (cabang itu kini melempar galat);
   - hapus entri YouTube di `script-src` dan `frame-src`;
   - kosongkan `video_external_id`, lalu tambahkan `CHECK (video_provider IS
     DISTINCT FROM 'YOUTUBE')`;
   - hapus atau jadikan *private* video di YouTube;
   - jalankan daftar periksa bagian 8.

## 11. Teks usulan untuk PRD v1.6 (Q46)

| Q46 | Sumber video untuk demo 20 Nov? | **YouTube unlisted** lewat iframe `youtube-nocookie.com` + IFrame API, hanya video contoh, dipasang lewat skrip; untuk demo pemutar memakai **kontrol bawaan YouTube** (pembaruan 14 Nov), **kontrol 29a sejak S2-02b**. **Jalur produksi tetap R2** (K-06, §10.3) | Kolom sumber video (`video_provider`, `video_external_id`), satu `LessonVideoPlayer` dengan kontrol 29a di atas antarmuka `PlayerEngine` (mesin YouTube untuk demo, mesin file untuk R2). Migrasi ke R2 berjalan per materi dengan jalan mundur, tanpa mengubah tampilan. Rencana: `docs/decisions/video-sumber.md` |
