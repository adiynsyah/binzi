# E2E (Playwright) — BINZI

Harness uji peramban sungguhan terhadap **build produksi** (CSP §12.5 aktif,
`NODE_ENV=production`, jalur fail-fast `src/lib/auth.ts` berjalan). Lingkup
kartu A-19: alur auth & RBAC. Tata letak per lebar + axe ada di kartu A-19b.

## Project per lebar (A-19b)

- `chromium` (1280×800): **semua spec A-19** (root `e2e/*.spec.ts`); tidak
  pernah menjalankan `e2e/layout/` (`testIgnore`).
- `w360`/`w700`/`w768`/`w1280`/`w1440`: **hanya** `e2e/layout/**`
  (`testMatch`), masing-masing satu titik uji per rentang breakpoint
  (tabel lebar + ekspektasi per lebar: `e2e/layout/widths.ts` — nama
  project tak dikenal di-*throw*, bukan di-skip). Project lebar memakai
  `reducedMotion: "reduce"` supaya animasi drawer/dropdown tidak mengganggu
  pengukuran posisi. Spec tertentu hanya relevan untuk lebar tertentu
  (target sentuh w360; keyboard & axe w360+w1280; w1440 hanya `/` dan
  `/masuk`) — pemetaannya di `playwright.config.ts`.
- `E2E_SCREENSHOT_DIR=~/folder` (di luar repo): simpan screenshot halaman
  penuh tiap halaman × lebar + state menu terbuka untuk tinjauan visual di
  Claude chat — bukan baseline, tidak di-commit.
- axe (WCAG 2.1 A/AA) via `@axe-core/playwright`; hanya pengecualian wadah
  Turnstile (iframe lintas origin). serious/critical menggagalkan;
  moderate/minor dilampirkan ke laporan.

## Menjalankan

```bash
npm run e2e:db   # sekali: nyalakan container Postgres lokal (Docker)
npx playwright install chromium   # sekali: unduh peramban
npm run e2e
```

- `e2e:db` idempoten: `docker start binzi-e2e-db` bila sudah ada, `docker run`
  (image `postgres:17.6`, port host **54329**, DB `binzi_e2e`) bila belum,
  lalu menunggu sampai siap. Mematikannya: `docker stop binzi-e2e-db`
  (data boleh dibuang: `docker rm binzi-e2e-db`).
- Setiap run `npm run e2e`: **hapus skema → migrasi → seed → `next build` →
  `next start` di port 3100**. Semua akun uji hanya hidup di DB E2E —
  **binzi-dev (Production) tidak pernah tersentuh.**
- Hasil run dihapus-dan-dibuat-ulang; dua run berturut-turut harus hijau
  (syarat "Selesai jika").

## Laporan & trace

```bash
npx playwright show-report          # laporan HTML (playwright-report/)
```

Trace tersimpan untuk tes gagal (`trace: "retain-on-failure"`), bisa dibuka
dari laporan. Stdout **server** (termasuk baris `[mail:log]` yang dibaca tes
alur email) ada di `test-results/server.log`; output setup DB dan build
tampil langsung di konsol.

## Kenapa harness menolak DB selain `binzi_e2e` lokal

Penjaga `e2e/db-guard.ts` hanya menerima host `localhost`/`127.0.0.1`/`[::1]`
dengan nama database persis `binzi_e2e`, dan berjalan sebelum koneksi DB
pertama serta sebelum env server dibentuk. Alasannya: binzi-dev dipakai
bersama lokal dan Production, sementara harness ini **menghapus skema** —
dan tiga jalur di repo (`drizzle.config.ts`, `seed.ts`, `next start`) bisa
jatuh ke `.env.local` bila satu variabel lupa diisi. URL E2E hanya berasal
dari `E2E_DATABASE_URL` (default `…127.0.0.1:54329/binzi_e2e`; CI mengarah
ke service container port 5432).

## Catatan penting

- **Build E2E menimpa `.next`.** Setelah menjalankan `npm run e2e`,
  jalankan `npm run build` lagi sebelum memakai `npm run start` biasa.
- Port 3100 dipakai eksklusif (`reuseExistingServer: false` di semua
  lingkungan) — pastikan tidak ada dev server lain di port itu.
- Tanpa `bypassCSP`: tes berjalan di bawah CSP yang sama dengan Production
  (pelanggaran CSP otomatis menggagalkan tes, kecuali satu probe eval zod —
  lihat komentar di `e2e/fixtures.ts`; chore di STATUS).
- Sandi akun uji dibuat acak saat runtime; email unik per tes di
  `@example.com`. Tidak ada kredensial dalam repo.
- CI: job `e2e` (`.github/workflows/ci.yml`) memakai service container
  Postgres yang sama, tanpa secret apa pun.
