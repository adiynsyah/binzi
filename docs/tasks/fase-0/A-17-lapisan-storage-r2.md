# A-17 · Lapisan storage R2

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-02](A-02-konfigurasi-environment-tervalidasi-zod.md), [H-04](H-04-cloudflare-r2-bucket-dan-token.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `storage`, `security` |
| **Judul ClickUp** | `[F0][Agent] A-17 Lapisan storage R2` |

## Tujuan
Menyiapkan akses R2 yang aman sekarang, supaya upload & video di S1/S2 tinggal memakainya (PRD §9.2, §10.3).

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/10-arsitektur-system-design.md` (§10.3 alur video)
- `docs/prd/sections/11-model-data.md` (catatan `video_key`)
- `docs/prd/sections/12-keamanan.md` (V-07)

## Kerjakan
- `src/lib/storage.ts` (server-only): klien S3 ke endpoint R2, helper presigned URL **GET** (masa berlaku pendek) dan **PUT** (dengan batas tipe & ukuran).
- Kunci objek disimpan di DB, **bukan** URL (§11.1).
- Skrip `npm run storage:check`: unggah objek uji, buktikan objek **tidak** bisa diakses tanpa tanda tangan (V-07), buktikan presigned GET bisa, lalu hapus objek uji.

## Bukan lingkup tugas ini
- Endpoint upload & UI (S1/S2).
- Aturan CORS bucket (S1/S2).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/lib/storage.ts`
- `scripts/storage-check.ts`

## Selesai jika
- [ ] `npm run storage:check` lulus di bucket dev.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run storage:check`

## Verifikasi oleh kamu (sebelum merge)
- [ ] **V-07:** buka URL objek tanpa tanda tangan di jendela penyamaran → harus ditolak.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
