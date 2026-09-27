# A-19 · E2E baseline (Playwright)

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-13](A-13-layar-autentikasi.md), [A-15](A-15-kerangka-layout-cms.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `testing`, `ci` |
| **Judul ClickUp** | `[F0][Agent] A-19 E2E baseline (Playwright)` |

## Tujuan
Jaring pengaman otomatis untuk alur login & RBAC di tiga lebar layar, sebelum fitur mulai bertambah.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/14-acceptance-criteria.md` (§14.1, §14.2)
- `docs/prd/sections/09-rekomendasi-teknologi.md` (Testing)

## Kerjakan
- Playwright dengan tiga project viewport: **360**, **768**, **1280**.
- Tes: daftar → verifikasi (ambil tautan dari transport `log`/DB tes) → login → `/belajar`; login gagal ke-6 diblokir; MEMBER ke `/cms` → 403; drawer mobile; tidak ada scroll horizontal di 360.
- Kunci uji Turnstile untuk lingkungan tes.
- Job CI `e2e`: service **PostgreSQL** di GitHub Actions (bukan Supabase), jalankan migrasi + seed, build, lalu jalankan Playwright. Artefak trace diunggah saat gagal.
- Tambahkan pemeriksaan aksesibilitas otomatis dasar (mis. axe) di halaman auth.

## Bukan lingkup tugas ini
- Login Google di E2E (tidak bisa diotomasi dengan aman).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `e2e/**`
- `playwright.config.ts`
- `.github/workflows/ci.yml`

## Selesai jika
- [ ] Job `e2e` hijau di CI.
- [ ] Semua tes jalan di tiga viewport.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`

## Verifikasi oleh kamu (sebelum merge)
- [ ] Rusak sesuatu dengan sengaja (mis. matikan pengecekan role) di branch uji → E2E harus merah.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
