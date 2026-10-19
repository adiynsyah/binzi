# A-19 · E2E: harness Playwright & alur auth/RBAC

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-13](A-13-layar-autentikasi.md), [A-15](A-15-kerangka-layout-cms.md), [A-16b](A-16b-penegakan-csp.md), [A-18](A-18-health-check-dan-cron-keep-alive.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `testing`, `ci` |
| **Judul ClickUp** | `[F0][Agent] A-19 E2E harness & alur auth/RBAC` |

> **Revisi 19 Okt 2026** (sebelum sesi, ditinjau terhadap kode `main` `e642da2`). Versi 27 Sep ditulis sebelum A-08 s/d A-18. Yang berubah: kartu **dipecah** — kartu ini membangun harness (DB E2E terisolasi dengan penjaga fail-closed, env produksi lengkap, job CI `e2e`) dan menguji alur auth, pendaratan, dan RBAC di satu lebar; tata letak per lebar, menu/drawer, keyboard, dan axe pindah ke [A-19b](A-19b-e2e-tata-letak-dan-aksesibilitas.md). Butir wajib yang terkumpul di STATUS (reset password, pengalihan saat sudah masuk, pendaratan Q44) masuk, tabel ekspektasi RBAC dan uji mutasi ditetapkan. Alasannya di "Catatan keputusan".

## Tujuan
Jaring pengaman otomatis di peramban sungguhan untuk alur yang sejauh ini hanya dibuktikan manual: daftar–verifikasi–masuk, reset password, kunci 5×, pendaratan per peran, dan RBAC halaman & API. Dijalankan terhadap build produksi dengan CSP §12.5 aktif, di setiap PR.

## Sebelum sesi (kamu)
- Docker Desktop terpasang dan menyala (Postgres E2E lokal berjalan di container).
- Cek versi Postgres binzi-dev: Supabase → binzi-dev → Settings → Infrastructure. Sebutkan versi major-nya di prompt pembuka sesi; image E2E memakai major yang sama.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/14-acceptance-criteria.md` (§14.2 saja)
- `docs/prd/sections/12-keamanan.md` (§12.4, dan baris V-04, V-09, V-10 di §12.6)
- Kode:
  - `src/lib/auth.ts` (env yang wajib di production) dan `src/components/shared/auth/auth-config.ts` (sitekey Turnstile per lingkungan);
  - `src/lib/mail.ts` (format baris `[mail:log]`) dan `src/modules/auth/email-senders.ts`;
  - `src/lib/rbac.ts` (`requireRole`, `requireApiRole`, `landingPathForRole`), `src/proxy.ts`, `src/app/(cms)/layout.tsx`, `src/app/api/cms/ping/route.ts`, `src/components/cms/cms-menu.server.ts`;
  - `src/components/shared/auth/auth-errors.ts` dan `constants.ts` (copy & tujuan redirect), `src/lib/turnstile.ts`, `src/lib/ratelimit.ts` (`LOGIN_RATE_LIMIT`);
  - `src/db/client.ts`, `src/db/seed.ts`, `drizzle.config.ts`, `scripts/set-role.ts` (`setUserRole`), dan 60 baris pertama `src/lib/rbac.integration.test.ts` (pola migrator Drizzle);
  - `next.config.ts` (CSP), `.github/workflows/ci.yml`, `eslint.config.mjs`, `vitest.config.ts`, `package.json`.
- Dokumentasi resmi Playwright untuk versi yang dipasang (`webServer`, `globalSetup`/project dependencies, `retries`, `failOnFlakyTests`) — jangan mengandalkan ingatan.

## Kerjakan

### 1. Database E2E terisolasi (fail-closed)
binzi-dev dipakai bersama oleh lokal dan **Production**, termasuk bucket rate limit, sedangkan harness ini menghapus dan membuat ulang skema. `drizzle.config.ts`, `src/db/seed.ts`, dan `next start` semuanya memuat `.env.local` untuk variabel yang tidak di-set — satu variabel yang lupa diisi berarti binzi-dev. Karena itu:
- Satu sumber URL: `E2E_DATABASE_URL`, default `postgresql://postgres:postgres@127.0.0.1:54329/binzi_e2e`. Harness **tidak pernah** membaca `DATABASE_URL` atau `MIGRATION_DATABASE_URL` dari lingkungan, dan tidak memakai `drizzle-kit` maupun `drizzle.config.ts`.
- Penjaga `assertE2eDatabaseUrl(url)` di `e2e/` menolak — dengan pesan yang menyebut alasannya tanpa mencetak URL atau sandi — kecuali host `localhost`, `127.0.0.1`, atau `[::1]` **dan** nama database persis `binzi_e2e`. Penjaga dipanggil sebelum koneksi DB pertama dan sebelum env server dibentuk.
- Setup sekali per run, selesai sebelum tes pertama mengirim request: penjaga → hapus skema `public` dan `drizzle` → migrasi dengan `migrate` dari `drizzle-orm/postgres-js/migrator` (folder `src/db/migrations`) → seed dengan menjalankan `src/db/seed.ts` lewat `tsx` dengan `DATABASE_URL` = URL E2E di env proses (dotenv tidak menimpa variabel yang sudah ada).
- Postgres lokal: cek `docker --version`. Bila Docker ada, jalankan container `binzi-e2e-db` (image `postgres`, major dari prompt sesi, tag minor dipin, port host 54329). Bila tidak ada, **berhenti dan tanyakan** — jangan memasang apa pun.

### 2. Server E2E: build produksi dengan env lengkap
`next start` berjalan dengan `NODE_ENV=production`, dan di sana `src/lib/auth.ts` serta `auth-config.ts` gagal keras tanpa `BETTER_AUTH_SECRET`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, dan pasangan `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. Next juga menanam `NEXT_PUBLIC_*` saat build. Karena itu, **satu objek env** di `playwright.config.ts` dipakai untuk build dan start:
- `NEXT_PUBLIC_APP_URL` = `BETTER_AUTH_URL` = `http://localhost:3100`, dan `baseURL` Playwright sama persis (`trustedOrigins` Better Auth membandingkan origin — `127.0.0.1` akan ditolak);
- `DATABASE_URL` = URL E2E yang sudah lolos penjaga; `MAIL_TRANSPORT=log`;
- `BETTER_AUTH_SECRET`: konstanta dummy ≥ 32 karakter yang namanya jelas khusus E2E;
- Turnstile kunci uji Cloudflare yang selalu lolos — sitekey `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA` (dokumentasi Cloudflare "Testing", dicek 19 Okt). Konstanta `TURNSTILE_TEST_SITEKEY` di `auth-config.ts` berisi nilai **secret** uji, bukan sitekey: jangan disalin, dan jangan diperbaiki di kartu ini (chore di STATUS);
- `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` dummy — tombol Google tampil seperti di Production, tetapi tidak diklik;
- `VERCEL_ENV` tidak di-set, sehingga CSP sama dengan Production (tanpa `vercel.live`, tanpa `'unsafe-eval'`).

Lalu:
- `webServer`: build lalu `next start` di port **3100**, dengan `reuseExistingServer: false` **di semua lingkungan**. Server lain di port itu (mis. dev server yang terhubung ke binzi-dev) tidak boleh dipakai ulang. Batas waktu cukup untuk build.
- Stdout server ditulis ke berkas di `test-results/` (sudah di-gitignore), dibuat ulang setiap run. Tes membaca tautan email dari baris `[mail:log]` di sana. Mekanismenya agent usulkan di rencana.
- Tanpa `bypassCSP`: tes berjalan di bawah CSP yang sama dengan Production.

### 3. Fixture
- Email unik per tes di domain `@example.com`. **Sandi dibuat acak saat runtime** dan memenuhi AUTH-01 (≥ 8 karakter, huruf + angka); tidak ada sandi literal di `e2e/**` (aturan akun uji di `CLAUDE.md`).
- Akun berperan dibuat lewat endpoint daftar (`POST /api/auth/sign-up/email`, header `x-captcha-response` berisi token uji `XXXX.DUMMY.TOKEN.XXXX`), lalu ditandai terverifikasi dan diberi peran langsung di DB E2E dengan `setUserRole` dari `scripts/set-role.ts` (logika yang sama dengan `npm run user:role`). Jangan meniru hashing Better Auth.
- Penangkap pelanggaran CSP: init script mencatat event `securitypolicyviolation` di dokumen utama. Setiap tes yang membuka halaman gagal bila ada pelanggaran selain **probe `allowsEval` zod** (direktif `script-src`, `blockedURI` `eval`, `sourceFile` di bawah `/_next/static/`). Pengecualian itu satu konstanta dengan komentar yang merujuk chore zod `jitless` di STATUS. Atribusi dibaca dari `sourceFile`/`blockedURI`, bukan dari halaman tempat event muncul (pelajaran A-16b).
- Semua tes yang membaca email ada di satu berkas `serial`. Baris log dicocokkan berdasarkan subjek, email tersamar, dan posisi sesudah aksi tes (boleh juga mendekode payload token verifikasi). Menunggu email lewat polling dengan batas waktu, bukan `waitForTimeout` berangka tetap.

### 4. Tes (Chromium, satu project 1280 × 800)
Copy yang sudah diputuskan pemilik diuji sebagai **teks literal**, bukan diimpor dari kode, agar perubahan copy yang tidak disengaja ketahuan. Tabel ekspektasi RBAC ditulis eksplisit di tes, **tidak** diturunkan dari `ROUTE_RULES` atau `cms-nav.ts`.

**a. Smoke.** `GET /api/health` → 200 (server terhubung ke DB E2E). `/dev/ui` → 404 (hanya development).

**b. Daftar & verifikasi (AUTH-01, AUTH-03).**
- Daftar di `/daftar` → tautan dari log → `/daftar/verifikasi` menampilkan "Akun aktif" dalam keadaan sudah masuk → "Mulai belajar" → `/belajar`.
- Token verifikasi dirusak → state belum aktif (`?error=INVALID_TOKEN`).
- Masuk sebelum verifikasi dengan sandi benar → "Email Anda belum diverifikasi. Kirim ulang tautan — berlaku 24 jam."

**c. Masuk & pendaratan (Q44, A-13).**
- Tanpa `?next=`: MEMBER → `/belajar`; EDITOR, ADMIN, SUPER_ADMIN → `/cms`.
- EDITOR dengan `?next=/belajar` → `/belajar` (`next` yang sah menang).
- `?next=https://evil.example.com` dan `?next=//evil.example.com` → tujuan bawaan per peran, tidak pernah ke host luar.
- Sudah masuk lalu membuka `/masuk` dan `/daftar` → dialihkan (MEMBER ke `/belajar`, EDITOR ke `/cms`).
- Keluar lewat menu akun, lalu membuka `/belajar` → `/masuk?next=%2Fbelajar`.

**d. Kunci 5× dan enumerasi (§14.2, AUTH-08, V-10).**
- UI: lima kali sandi salah → "Email atau password salah. Periksa kembali dan coba lagi."; percobaan ke-6 → "Terlalu banyak percobaan. Coba lagi dalam 15 menit, atau reset password."
- API `POST /api/auth/sign-in/email` dengan token uji: enam percobaan untuk email **terdaftar** dan email **tidak terdaftar** menghasilkan urutan status identik (5× 401 lalu 429) dengan kode error identik.
- Tanpa header `x-captcha-response` → 400 di keempat `TURNSTILE_PROTECTED_ENDPOINTS` (`/sign-in/email`, `/sign-up/email`, `/request-password-reset`, `/send-verification-email`).

**e. Reset password (AUTH-04, AUTH-06).**
- `/reset-password` tanpa token → panel kedaluwarsa.
- `/reset-password?token=palsu` + submit → panel kedaluwarsa dan token hilang dari URL.
- Alur penuh: `/lupa-password` → tautan dari log → sandi baru → sandi lama ditolak, sandi baru diterima.
- Sesi lain milik user itu (konteks peramban kedua yang sudah masuk) dicabut: `/belajar` di konteks itu → `/masuk?next=%2Fbelajar`.
- Tautan reset yang sama dibuka lagi → kedaluwarsa (sekali pakai).

**f. RBAC halaman & API (V-04, Q42, Q43).** Status HTTP per halaman, diambil dengan request ber-cookie tanpa mengikuti redirect:

| Path | Tamu | MEMBER | EDITOR | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|---|
| `/cms`, `/cms/konten`, `/cms/artikel`, `/cms/kursus`, `/cms/quiz`, `/cms/media` | → `/masuk?next=…` | 403 | 200 | 200 | 200 |
| `/cms/kategori`, `/cms/pengguna`, `/cms/reset-attempt` | → `/masuk?next=…` | 403 | 403 | 200 | 200 |
| `/cms/pengaturan`, `/cms/audit-log` | → `/masuk?next=…` | 403 | 403 | 403 | 200 |
| `/cms/tidak-ada` (tak terdaftar) | → `/masuk?next=…` | bukan 200 | bukan 200 | bukan 200 | bukan 200 |
| `/belajar` | → `/masuk?next=%2Fbelajar` | 200 | 200 | 200 | 200 |

- "→" = redirect dari proxy dengan `next` ter-encode. Halaman 403 menampilkan "Akses ditolak". Bila kode berperilaku lain dari tabel, **berhenti dan tanyakan** — jangan menyesuaikan tabel dengan kode.
- Path tak terdaftar: yang dikunci adalah sifat keamanannya — status 403 atau 404 dan tanpa isi CMS (tidak ada navigasi "Menu CMS"). Status persis per peran dicatat di PR.
- Satu tes memastikan setiap `page.tsx` di bawah `src/app/(cms)` punya baris di tabel: halaman CMS baru tanpa ekspektasi membuat tes merah.
- Menu CMS di 1280: ADMIN tidak melihat "Audit log" maupun "Pengaturan" (Q43). Setiap tautan menu yang tampil untuk suatu peran membuka 200 untuk peran itu — menangkap menu yang bergeser dari guard halaman.
- `GET /api/cms/ping`: tamu 401 JSON tanpa redirect, MEMBER 403 JSON, EDITOR 200.
- Peran diubah saat sesi aktif (`setUserRole`) → request berikutnya dengan cookie lama diperlakukan belum masuk.

### 5. Job CI `e2e`
Job baru `e2e` di `.github/workflows/ci.yml`, berjalan paralel dengan `ci`. Nama job `e2e` dibuat stabil karena akan didaftarkan sebagai required check.
- `services.postgres`: image yang sama dengan lokal, `POSTGRES_DB=binzi_e2e`, health check. `E2E_DATABASE_URL` mengarah ke `127.0.0.1:5432`.
- Langkah: `npm ci` → `npx playwright install --with-deps chromium` → `npm run e2e`, dengan `timeout-minutes` (mis. 20).
- **Tidak memakai `secrets.*` apa pun.** Repo publik: log dan artefak job bisa dibaca orang lain, dan PR Dependabot/fork tidak punya akses secret.
- Saat gagal: unggah `playwright-report/` dan `test-results/` sebagai artefak dengan retensi 7 hari. Hanya action resmi `actions/*`, dipin per major seperti step lain.
- `retries: 0`. Bila retry di CI dianggap perlu, tes flaky tetap harus menggagalkan job (`failOnFlakyTests` bila tersedia di versi terpasang) — flaky tidak boleh lolos diam-diam.
- Job `ci` yang sudah ada tidak disentuh.

### 6. Paket, skrip, lint
- Dependensi dev baru: `@playwright/test`, versi dipin eksak (tanpa `^`) dan dirilis ≥ 14 hari sebelum sesi. Sebutkan versi dan tanggal rilisnya di ringkasan PR. `node scripts/check-audit.mjs` tetap hijau.
- Skrip `e2e` (`playwright test`) di `package.json`. `npm run check` tidak berubah. Vitest hanya memuat `src/**/*.test.{ts,tsx}`, jadi berkas di `e2e/` memakai akhiran `.spec.ts`.
- Bila `react-hooks/rules-of-hooks` salah menandai `use()` milik fixture Playwright: satu blok di `eslint.config.mjs` khusus `e2e/**` yang mematikan aturan itu saja.

### 7. `e2e/README.md`
Singkat saja: menyalakan dan mematikan DB lokal, `npm run e2e`, membuka laporan dan trace, kenapa harness menolak DB selain `binzi_e2e` lokal, dan bahwa build E2E menimpa `.next` (jalankan `npm run build` lagi sebelum `npm run start` biasa).

## Bukan lingkup tugas ini
- Tata letak per lebar, menu/drawer, target sentuh, keyboard, dan axe — [A-19b](A-19b-e2e-tata-letak-dan-aksesibilitas.md).
- Login Google (tidak bisa diotomasi dengan aman), LoginModal 2c (belum dipakai halaman mana pun), dan `/daftar?next=` (belum didukung, item STATUS).
- Mengubah kode aplikasi di `src/**` atau `scripts/**`, termasuk bug yang ditemukan tes.
- Memperbaiki `TURNSTILE_TEST_SITEKEY`, chore zod `jitless`, alias `@/` di Vitest, atau `getDb()` lazy.
- Branch protection, GitHub Secrets, dan env Vercel (pekerjaan pemilik).
- Peramban selain Chromium.

**Bila tes menemukan bug di kode aplikasi:** jangan perbaiki dan jangan melemahkan ekspektasi. Berhenti, laporkan (rute, langkah, hasil vs ekspektasi), lalu tunggu keputusan pemilik: perbaikan lewat PR chore terpisah, atau tes ditandai `test.fail()` dengan komentar yang merujuk item STATUS. Dengan `test.fail()`, tes menjadi merah begitu bugnya diperbaiki, sehingga penandanya tidak terlupa.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `e2e/**`
- `playwright.config.ts`
- `package.json`, `package-lock.json` (dependensi dev dan skrip `e2e` saja)
- `.github/workflows/ci.yml` (job `e2e` baru saja)
- `eslint.config.mjs` (blok `e2e/**` saja, bila perlu)

## Selesai jika
- [ ] `npm run e2e` hijau lokal **dua kali berturut-turut** (DB di-reset setiap run), dan job `e2e` hijau di CI pada PR.
- [ ] Semua tes di bagian 4 ada, termasuk tabel RBAC lengkap dan tes cakupan `page.tsx`.
- [ ] Tes penjaga DB (tanpa peramban): URL pooler Supabase (`*.pooler.supabase.com`), host lokal dengan nama DB lain, URL tidak valid, dan nilai kosong → ditolak; `localhost`/`127.0.0.1`/`[::1]` dengan `binzi_e2e` → diterima. Pesan error tidak memuat sandi.
- [ ] Uji mutasi dilampirkan di PR. Masing-masing dijalankan lokal, wajib membuat tes merah, lalu dikembalikan (tidak di-commit):
  1. `requireRole` di `src/lib/rbac.ts` tidak memanggil `forbidden()` (= "matikan pengecekan role");
  2. `src/app/(cms)/cms/audit-log/page.tsx`: `requireRole("SUPER_ADMIN")` → `"ADMIN"` (Q43);
  3. `landingPathForRole` selalu mengembalikan `/belajar` (Q44);
  4. `safeInternalRedirectPath` menerima URL `//host` (open redirect);
  5. `LOGIN_RATE_LIMIT.max` 5 → 6;
  6. `/request-password-reset` dihapus dari `TURNSTILE_PROTECTED_ENDPOINTS` (pernah terjadi, PR #40);
  7. `https://challenges.cloudflare.com` dihapus dari `script-src` di `next.config.ts` (bukti tes berjalan di bawah CSP sungguhan);
  8. `/api/cms/ping`: `requireApiRole("EDITOR")` → `"MEMBER"`;
  9. penjaga DB menerima host non-lokal.
- [ ] Waktu job `e2e` di CI dicatat di PR.

## Sebelum membuka PR
- Jalankan `npm run check`, `npm run build`, dan `npm run e2e` (dua kali). Lampirkan ringkasan hasil: jumlah tes, durasi, dan nol tes flaky.
- Tidak ada akun yang dibuat di binzi-dev: semua akun uji hanya ada di DB E2E. Sebutkan itu di PR; pemilik akan mengeceknya.
- Item checklist §12.6 yang relevan di ringkasan PR: V-04, V-09 (tidak ada secret ter-commit; nilai dummy E2E diberi nama yang jelas), V-10.
- Keputusan yang kamu ambil tanpa bertanya **wajib** masuk "Keputusan & asumsi" di PR — termasuk mekanisme log server, cara menunggu token Turnstile, dan urutan setup DB vs `webServer`.
- Setelah push: cek CI (`gh pr checks`, job `ci` **dan** `e2e`) serta deploy Preview, lalu laporkan hasilnya di ringkasan.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check`
- `npm run build`
- `npm run e2e`

## Verifikasi oleh kamu

**Sebelum merge**
- [ ] Baca `playwright.config.ts`: port 3100, `reuseExistingServer: false`, tanpa `bypassCSP`, dan semua env server berasal dari satu objek dengan nilai dummy/uji.
- [ ] Baca penjaga DB dan tesnya: dipanggil sebelum koneksi pertama, menolak semua selain `binzi_e2e` lokal.
- [ ] Baca job `e2e`: tanpa `secrets.*`, hanya action `actions/*`, job `ci` tidak berubah.
- [ ] Jalankan `npm run e2e` sendiri sekali dengan Docker menyala → hijau. Buka laporannya dengan `npx playwright show-report`.
- [ ] binzi-dev tidak tersentuh: di Supabase → binzi-dev → SQL Editor, `select count(*) from users where email like '%@example.com'` → 0.
- [ ] Rusak sesuatu dengan sengaja: dari `main`, buat branch uji dengan mutasi 1, push, lalu buka **PR draft** (CI hanya berjalan di `pull_request` dan push ke `main`) → job `e2e` merah → tutup PR dan hapus branch.

**Setelah merge**
- [ ] Job `e2e` hijau di run push ke `main`.
- [ ] GitHub → Settings → Branches → aturan `main`: tambahkan `e2e` sebagai required status check (namanya baru muncul setelah job pernah berjalan). Sekalian pastikan "Require status checks to pass" aktif dan bypass admin mati (item STATUS sejak PR #36).

## Catatan keputusan
- **Dipecah jadi A-19 dan A-19b.** Harness E2E adalah infrastruktur baru (DB, env produksi, log server, job CI) dan alur auth/RBAC saja sudah sekitar dua puluh tes. Menggabungkan tes tata letak lima lebar dan axe membuat PR terlalu besar untuk ditinjau ±30 menit (pola A-14a/b).
- **DB Postgres sungguhan di Docker, bukan binzi-dev atau PGlite.** binzi-dev menyimpan akun Production dan bucket rate limit, sedangkan harness menghapus skema. PGlite hanya melayani koneksi di dalam prosesnya sendiri, sementara server Next butuh Postgres lewat jaringan. CI memakai service container dengan image yang sama.
- **Penjaga fail-closed di depan koneksi pertama.** Tiga jalur di repo jatuh ke `.env.local` bila sebuah variabel tidak di-set (`drizzle.config.ts`, `seed.ts`, `next start`). Penjaga memeriksa host **dan** nama database, sehingga salah konfigurasi berhenti dengan pesan jelas, bukan menghapus binzi-dev.
- **Build produksi dengan env lengkap.** `next start` menjalankan jalur fail-fast yang sama dengan Production. Crash rute dinamis di PR #39 hanya muncul di build produksi. `VERCEL_ENV` dikosongkan karena varian itu memberi CSP yang identik dengan Production.
- **Kunci uji Turnstile, bukan mock.** Script widget, `script-src`/`frame-src` CSP, dan siteverify server tetap jalur sungguhan, sehingga mutasi 7 bisa memerahkan tes. Konsekuensinya, job butuh jaringan ke Cloudflare — sumber flaky yang diterima. Bila sering terjadi, putuskan ulang.
- **Ekspektasi RBAC eksplisit.** Tabel diturunkan dari PRD §3.2/§7.2 (v1.5), bukan dari `ROUTE_RULES`: oracle yang ikut berubah bersama kode tidak menangkap apa pun.
- **Guard berlapis memaskir mutasi satu lapis.** Halaman EDITOR dijaga layout `(cms)` **dan** page-nya, sehingga menurunkan salah satunya tidak memerahkan tes — itu perilaku yang benar. Karena itu mutasi "matikan pengecekan role" memutasi fungsi bersama `requireRole`, dan mutasi per peran memakai halaman yang lapis di atas EDITOR-nya hanya satu (Audit log).
- **Path CMS tak terdaftar dikunci sebagai sifat, bukan status persis.** Baris catch-all SUPER_ADMIN di `ROUTE_RULES` hanya dipakai menu dan pendaratan; guard halaman ada di layout `(cms)` dan di setiap page. URL tanpa page dirender sebagai 404, dan apakah layout `(cms)` ikut dirender bergantung pada cara Next menangani URL yang tidak cocok. Yang penting: tidak pernah 200 dan tidak ada isi CMS.
- **Job `e2e` terpisah dari `ci`.** Berjalan paralel dan hasilnya terlihat sendiri. Konsekuensinya, pemilik mendaftarkannya sebagai required check setelah merge.
- **Tanpa secret di job dan sandi acak saat runtime.** Repo publik, dan aturan akun uji di `CLAUDE.md` melarang sandi di berkas repo, termasuk untuk DB sekali pakai.
- **`retries: 0`.** Tes flaky adalah temuan, bukan derau: CI yang hijau setelah retry menyembunyikan masalah yang sama di pengguna.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
