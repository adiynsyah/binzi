# A-08 · Pola modul, serialisasi & batas impor

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-07](A-07-skema-drizzle-lengkap-migrasi-awal-dan-seed.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `foundation`, `security` |
| **Judul ClickUp** | `[F0][Agent] A-08 Pola modul, serialisasi & batas impor` |

## Tujuan
Menetapkan pola `service/queries/schema/policy` dan serialisasi eksplisit sejak awal — pencegah utama V-01 dan V-05 (§12.6).

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/10-arsitektur-system-design.md` (§10.2 aturan modul)
- `docs/prd/sections/12-keamanan.md` (§12.1, §12.6 catatan V-01/V-05)
- `docs/prd/sections/13-4-model-eksekusi-dengan-ai.md` (langkah 3)

## Kerjakan
- Modul contoh `src/modules/user/`: `schema.ts` (Zod input), `queries.ts` (akses DB, field dipilih eksplisit — **tanpa** `select *`), `service.ts` (satu-satunya pintu keluar modul), `policy.ts` (siapa boleh apa).
- Pola serializer: setiap entitas yang keluar ke klien melewati fungsi `toXxxDTO()` yang mendaftar field secara eksplisit. Tes membuktikan field sensitif tidak ikut.
- Helper error domain → respons HTTP (404 untuk bukan milik user, 403 untuk role).
- Aturan ESLint yang **menggagalkan** impor `modules/*/queries` dari luar modulnya sendiri.
- `src/modules/README.md` singkat menjelaskan pola ini untuk sesi agent berikutnya.

## Bukan lingkup tugas ini
- Modul lain — dibuat di sprint masing-masing mengikuti pola ini.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/modules/**`
- `src/lib/**`
- `eslint config`

## Selesai jika
- [ ] Lint gagal bila `queries.ts` diimpor lintas modul (buktikan dengan tes atau contoh).
- [ ] Tes serializer lulus.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Verifikasi oleh kamu (sebelum merge)
- [ ] Baca `src/modules/README.md`: apakah jelas untuk orang yang baru membacanya?

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
