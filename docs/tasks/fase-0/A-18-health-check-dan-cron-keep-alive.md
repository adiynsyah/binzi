# A-18 · Health check & cron keep-alive

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-07](A-07-skema-drizzle-lengkap-migrasi-awal-dan-seed.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `infra` |
| **Judul ClickUp** | `[F0][Agent] A-18 Health check & cron keep-alive` |

> **Revisi 18 Okt 2026** (sebelum sesi, ditinjau terhadap kode `main` `ea7adf9`). Versi 27 Sep ditulis sebelum A-08 s/d A-16b. Yang berubah: kontrak respons kedua endpoint ditetapkan, perilaku saat `CRON_SECRET` kosong diputuskan (fail-closed di endpoint), logika dipisah dari route agar bisa dites Vitest, bukti `curl` dari build produksi lokal memakai secret sekali pakai, dan uji manual workflow dipindah ke **setelah merge** (`workflow_dispatch` hanya bisa dijalankan dari branch default). Alasannya di "Catatan keputusan".

## Tujuan
Mencegah project Supabase free di-pause karena tidak aktif (§10.5, R-03) lewat job GitHub Actions terjadwal, sekaligus menyediakan health check publik yang kelak dipakai uptime monitor (§14.9).

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/10-arsitektur-system-design.md` (§10.5 saja)
- `src/modules/README.md` (bagian "Error domain → HTTP")
- Kode: `src/app/api/cms/ping/route.ts` (pola route), `src/lib/errors.ts`, `src/config/env.server.ts`, `src/db/index.ts`, `src/db/client.ts`, `.github/workflows/ci.yml` (gaya workflow), dan 60 baris pertama `src/lib/rbac.integration.test.ts` (pola PGlite & dependensi yang disuntikkan)

## Kerjakan

### 1. Kontrak kedua endpoint
Semua respons berupa JSON dengan header `Cache-Control: no-store`. Bentuk badan mengikuti pola API yang ada: sukses `{ data: … }`, gagal `{ error: { code, message } }`.

**`GET /api/health`** — publik, tanpa sesi.

| Kondisi | Status | Badan |
|---|---|---|
| Ping DB berhasil | 200 | `{ "data": { "status": "ok" } }` |
| Ping DB gagal atau melewati batas waktu | 503 | `{ "error": { "code": "SERVICE_UNAVAILABLE", "message": "Layanan sedang tidak tersedia." } }` |

Tidak ada detail internal di respons: tanpa pesan error, nama host, versi, latensi, atau nama lingkungan.

**`POST /api/cron/keep-alive`** — dilindungi header `x-cron-secret`.

| Kondisi | Status | Badan |
|---|---|---|
| Header tidak ada, salah, atau `CRON_SECRET` server kosong | 401 | `toErrorResponse(new UnauthorizedError())` |
| Header benar, ping DB berhasil | 200 | `{ "data": { "status": "ok" } }` |
| Header benar, ping DB gagal atau melewati batas waktu | 503 | sama dengan 503 health |

Urutan wajib: secret dicek **sebelum** DB disentuh — permintaan tanpa secret yang benar tidak pernah memicu query. Metode lain (mis. `GET`) dibiarkan ditolak Next dengan 405.

### 2. Verifikasi secret (constant-time, fail-closed)
- `CRON_SECRET` **tetap opsional** di `src/config/env.server.ts` (berkas itu tidak diubah). Bila kosong di server, endpoint menolak semua permintaan dengan 401 dan mencatat satu baris log bahwa `CRON_SECRET` belum diisi, tanpa nilai apa pun. Secret kosong tidak pernah cocok dengan header kosong.
- Perbandingan constant-time yang aman untuk panjang berbeda: hash SHA-256 kedua nilai, lalu `timingSafeEqual` dari `node:crypto` atas kedua digest. Bukan `===`, dan bukan `timingSafeEqual` langsung pada nilai mentah (melempar error bila panjangnya beda).
- Nilai secret dan header tidak pernah masuk log, badan respons, judul tes, atau snapshot.

### 3. Ping DB dan batas waktu
- `src/db/ping.ts`: `pingDatabase(db)` menjalankan `select 1` lewat Drizzle. Impor relatif saja, agar bisa dites Vitest.
- Batas waktu **5 detik** dipasang di logika health (bagian 4), membungkus fungsi ping apa pun; timer dibersihkan saat ping selesai.
- Kegagalan ping dicatat dengan pola route yang ada (`console.error("[GET /api/health]", error)`) **sebelum** respons 503. Sentry belum terpasang dan bukan lingkup kartu ini.

### 4. Logika terpisah dari route
Vitest tidak bisa mengimpor route: alias `@/` belum ada di `vitest.config.ts`, dan `env.server.ts` memuat `server-only`. Karena itu:
- Logika ada di modul berimpor relatif dengan dependensi yang disuntikkan (secret, fungsi ping), pola `SessionReader` di `src/lib/rbac.ts`:
  - `src/lib/cron-auth.ts` — verifikasi secret (bagian 2);
  - `src/lib/health.ts` — batas waktu ping dan pembentukan respons health & keep-alive sesuai kontrak (bagian 1).
- Route (`src/app/api/health/route.ts`, `src/app/api/cron/keep-alive/route.ts`) hanya merangkai `serverEnv.CRON_SECRET`, `db` dari `@/db`, dan `pingDatabase`, lalu memanggil logika itu. Runtime Node bawaan — bukan `edge` (`node:crypto`).
- Route handler tidak di-cache secara bawaan di Next 16 tanpa Cache Components (cek di dokumentasi terpasang, "Route Handlers → Caching"). Buktikan lewat output build bahwa kedua rute ƒ, alih-alih menambah konfigurasi segmen.

### 5. Workflow `.github/workflows/cron.yml`
- Pemicu: `schedule` tiap 3 hari (§10.5) pada menit yang **bukan** `:00`, mis. `'17 19 */3 * *'` (02.17 WIB), plus `workflow_dispatch`. GitHub menunda, bahkan bisa membuang, job terjadwal saat beban tinggi, terutama di awal jam.
- `permissions: {}` (job tidak butuh token), `timeout-minutes: 5`, tanpa `actions/checkout` maupun action pihak ketiga — cukup satu step `run`.
- `APP_URL` dan `CRON_SECRET` dari GitHub Secrets masuk lewat `env:` step, bukan disisipkan langsung ke skrip. Step gagal dengan pesan jelas bila salah satunya kosong, tanpa mencetak nilainya.
- `curl -fsS --max-time 30 --retry 2 --retry-delay 15 -X POST "$APP_URL/api/cron/keep-alive" -H "x-cron-secret: $CRON_SECRET"`. curl hanya mengulang galat sementara (timeout, 5xx), jadi 401 langsung gagal. Status non-2xx menggagalkan run, dan GitHub mengirim email run gagal ke pemilik.
- Nama workflow `Cron`, job `keep-alive`. Job terjadwal berikutnya (§10.5) menyusul sebagai job baru di berkas yang sama.

## Bukan lingkup tugas ini
- Job `backup-db`, `cleanup-media`, `purge-accounts`, `learning-reminder`, dan pembersihan tabel `rate_limits` — dikerjakan saat fiturnya ada / Fase 1.5.
- Mengubah `src/config/env.server.ts` atau `.env.example`, termasuk menjadikan `CRON_SECRET` wajib saat startup.
- `getDb()` lazy, alias `@/` di Vitest, dan aturan ESLint impor `@/db` (chore tersendiri di STATUS).
- Sentry SDK, uptime monitor, dan rate limit untuk `/api/health`.
- `src/proxy.ts` — matcher-nya sengaja tidak mencakup `/api/**`, jadi kedua endpoint tidak dialihkan ke `/masuk`.
- Mengisi GitHub Secrets atau env Vercel (pekerjaan pemilik).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/app/api/health/route.ts`
- `src/app/api/cron/keep-alive/route.ts`
- `src/lib/cron-auth.ts`, `src/lib/cron-auth.test.ts`
- `src/lib/health.ts`, `src/lib/health.test.ts`
- `src/db/ping.ts`, `src/db/ping.test.ts`
- `.github/workflows/cron.yml`

## Selesai jika
- [ ] Tes `cron-auth`: header benar → valid; header salah, beda panjang, kosong, atau tidak ada → tidak valid; `CRON_SECRET` kosong atau `undefined` → tidak valid untuk header apa pun, termasuk header kosong.
- [ ] Tes `health`: kedua endpoint persis sesuai tabel kontrak (status, badan, `Cache-Control: no-store`); keep-alive tanpa secret yang benar → 401 dan fungsi ping **tidak dipanggil**; ping yang melempar error berisi teks tertanam → 503 tanpa teks itu di badan; ping yang tidak pernah selesai → 503 setelah 5 detik (fake timers); secret tertanam tidak muncul di argumen `console.*` mana pun.
- [ ] Tes `ping` (PGlite, tanpa jaringan): `pingDatabase` berhasil pada DB sungguhan.
- [ ] Uji mutasi dilampirkan di PR — masing-masing wajib membuat tes merah: (1) `CRON_SECRET` kosong dianggap cocok dengan header kosong; (2) pemeriksaan secret di keep-alive dilewati; (3) ping dijalankan sebelum pemeriksaan secret; (4) pesan error ikut ke badan 503; (5) `Cache-Control: no-store` dihapus.
- [ ] Output `npm run build`: `/api/health` dan `/api/cron/keep-alive` bertanda ƒ; `/` tetap ○; status rute lain tidak berubah.
- [ ] Tabel bukti `curl -si` dari build produksi lokal (lihat "Sebelum membuka PR").
- [ ] `cron.yml` divalidasi `actionlint` bila bisa dijalankan tanpa menambah dependensi proyek (mis. biner rilis resminya); bila tidak, sebutkan di PR.

## Sebelum membuka PR
- **Bukti `curl`** dari `npm run build && npm run start`. Agent tidak membaca `.env.local`, jadi `CRON_SECRET` untuk bukti dibuat **sekali pakai** di shell (mis. `openssl rand -hex 32`) dan diberikan lewat env proses `npm run start` — Next tidak menimpa variabel yang sudah ada di env proses dengan nilai `.env.local`. Nilainya tidak dicetak dan tidak ditulis di PR. Baris tabel:
  - `GET /api/health` → 200, badan dan `Cache-Control` sesuai kontrak, header keamanan §12.5 (termasuk CSP) tetap ada;
  - `POST /api/cron/keep-alive` tanpa header → 401; header salah → 401; header benar → 200;
  - `GET /api/cron/keep-alive` → 405;
  - server yang dijalankan dengan `DATABASE_URL` ke port tertutup (mis. `postgresql://x:x@127.0.0.1:1/x`): health → 503 dan keep-alive dengan header benar → 503, keduanya dengan badan kontrak dan selesai dalam ≤ 6 detik.
- Item checklist §12.6 yang relevan di ringkasan PR: V-09 (secret tidak ter-commit).
- Tidak perlu akun uji.
- Keputusan yang kamu ambil tanpa bertanya **wajib** masuk "Keputusan & asumsi" di PR.
- Setelah push: cek CI dan deploy Preview (`gh pr checks`), lalu laporkan hasilnya di ringkasan.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check`
- `npm run build`

## Verifikasi oleh kamu

**Sebelum merge**
- [ ] Baca `cron.yml`: tidak ada action pihak ketiga, `permissions: {}`, secret hanya lewat `env:`, menit jadwal bukan `:00`.
- [ ] Baca `src/lib/cron-auth.ts`: perbandingan lewat `timingSafeEqual` atas digest, bukan `===`; `CRON_SECRET` kosong selalu tidak valid.
- [ ] Siapkan secret (boleh sebelum atau sesudah merge, wajib sebelum uji workflow):
  - GitHub → Settings → Secrets and variables → Actions: tambah `APP_URL` = `https://binzi.vercel.app` (tanpa garis miring di akhir). `CRON_SECRET` sudah ada sejak H-10.
  - Vercel → Settings → Environment Variables: pastikan `CRON_SECRET` ada di **Production** dengan nilai **sama** dengan GitHub Secret (H-10 hanya menyebut Preview). Bila baru ditambah atau diubah: redeploy tanpa build cache.

**Setelah merge** (`workflow_dispatch` hanya bisa dijalankan setelah workflow ada di `main`)
- [ ] Setelah deploy Production Ready: `curl -si https://binzi.vercel.app/api/health` → 200 `{"data":{"status":"ok"}}` dengan `cache-control: no-store`.
- [ ] `curl -si -X POST https://binzi.vercel.app/api/cron/keep-alive` (tanpa header) → 401.
- [ ] GitHub → Actions → **Cron** → **Run workflow** (branch `main`) → run hijau, log menunjukkan respons sukses tanpa nilai secret. Bila 401: nilai `CRON_SECRET` di Vercel Production berbeda dari GitHub Secret atau belum di-redeploy; bila kosong, Vercel Logs mencatat baris "belum diisi".
- [ ] Beberapa hari kemudian: tab Actions menunjukkan run terjadwal pertama hijau.

## Catatan keputusan
- **`CRON_SECRET` fail-closed di endpoint, bukan wajib saat startup.** `src/instrumentation.ts` memvalidasi env saat server menyala. Menjadikannya wajib di production akan menggagalkan build CI (yang tidak punya nilainya) dan setiap lingkungan yang belum mengisinya — seluruh situs mati demi satu job.
- **401 seragam** untuk header hilang, salah, dan secret server kosong. Respons tidak membocorkan apakah secret sudah dipasang; pembeda untuk pemilik ada di log server.
- **Health publik dengan ping DB.** Satu `select 1` murah, dan perlindungan banjir request ada di platform (Vercel). Rate limit aplikasi ditinjau ulang bila ada tanda penyalahgunaan.
- **Logika dipisah dari route** agar keputusan keamanan (fail-closed, urutan secret → DB, badan tanpa detail) dijaga tes dan uji mutasi; route sendiri dibuktikan lewat `curl`.
- **Route mengimpor `@/db`** sebagai titik komposisi, seperti `src/lib/auth.ts`. Saat aturan ESLint impor `@/db` dibuat (STATUS), kedua route masuk daftar pengecualian.
- **Frekuensi mengikuti PRD §10.5 (tiap 3 hari).** Dokumentasi Supabase ("Project Pausing") menyebut project dianggap tidak aktif bila aktivitas database dalam seminggu terakhir tidak cukup, dan biasanya beberapa request per hari sudah cukup. Tiap 3 hari berarti 2–3 query per minggu, dan GitHub bisa membuang run terjadwal saat beban tinggi. Bila frekuensi diubah, PRD diubah dulu.
- **Setelah binzi-prod dibuat**, Vercel Production — dan karenanya keep-alive — pindah ke prod; binzi-dev tidak lagi di-ping. Selama pengembangan aktif DB dev terpakai setiap hari; bila jeda lebih dari seminggu, project dev bisa di-pause dan di-resume manual dari dashboard Supabase.
- **Repo publik:** GitHub menonaktifkan workflow terjadwal setelah 60 hari tanpa aktivitas repo. Selama pengembangan berjalan hal ini tidak terjadi; bila repo lama diam, aktifkan ulang workflow dari tab Actions.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
