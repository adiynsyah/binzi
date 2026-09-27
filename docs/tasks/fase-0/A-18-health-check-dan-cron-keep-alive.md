# A-18 · Health check & cron keep-alive

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-07](A-07-skema-drizzle-lengkap-migrasi-awal-dan-seed.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `infra` |
| **Judul ClickUp** | `[F0][Agent] A-18 Health check & cron keep-alive` |

## Tujuan
Mencegah project Supabase free di-pause karena tidak aktif (§10.5), sekaligus menyediakan health check.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/10-arsitektur-system-design.md` (§10.5)

## Kerjakan
- `GET /api/health`: cek DB ringan, respons tanpa detail internal.
- `POST /api/cron/keep-alive`: dilindungi header `x-cron-secret` (bandingkan dengan `CRON_SECRET` secara constant-time); tanpa header yang benar → 401.
- Workflow `.github/workflows/cron.yml`: keep-alive tiap 3 hari ke URL di GitHub Secret `APP_URL` (selama belum punya domain: `https://<project>.vercel.app`).

## Bukan lingkup tugas ini
- Job `backup-db`, `cleanup-media`, `purge-accounts` — dikerjakan saat fiturnya ada / Fase 1.5.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/app/api/health/**`
- `src/app/api/cron/keep-alive/**`
- `.github/workflows/cron.yml`

## Selesai jika
- [ ] Tes: tanpa secret → 401; dengan secret → 200.
- [ ] Workflow bisa dijalankan manual (`workflow_dispatch`).
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Verifikasi oleh kamu (sebelum merge)
- [ ] Jalankan workflow cron manual dari tab Actions, lalu cek log-nya.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
