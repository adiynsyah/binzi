# A-07 · Skema Drizzle lengkap, migrasi awal & seed

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-02](A-02-konfigurasi-environment-tervalidasi-zod.md), [H-02](H-02-supabase-project-dev-dan-prod.md), [H-10](H-10-isi-environment-dan-secret.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `database` |
| **Judul ClickUp** | `[F0][Agent] A-07 Skema Drizzle lengkap, migrasi awal & seed` |

## Tujuan
Skema menjadi sumber kebenaran tipe untuk semua kode berikutnya (§13.4 langkah 2).

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/11-model-data.md` (seluruhnya)
- `docs/prd/sections/09-rekomendasi-teknologi.md` (§9.6 konvensi Drizzle)
- `docs/prd/sections/06-3-quiz-sistem-penilaian.md` (untuk memahami tabel attempt)

## Kerjakan
- Semua tabel §11.2 di `src/db/schema/*.ts` sesuai konvensi §9.6 (auth, course, quiz, progress, article, media, system) + `relations()`, index §11.3, dan constraint integritas §11.4.
- Tabel identitas: hasilkan skema Better Auth dengan CLI-nya untuk adapter Drizzle, lalu **gabungkan** dengan kolom tambahan dari §11.2 (mis. `role`). Hanya boleh ada satu definisi tabel user.
- `src/db/index.ts`: koneksi `postgres-js` ke `DATABASE_URL` (transaction pooler 6543) dengan `prepare: false`.
- `drizzle.config.ts` memakai `MIGRATION_DATABASE_URL` (session pooler 5432).
- Generate migrasi awal ke `src/db/migrations/` (di-commit).
- `src/db/seed.ts`: hanya data sistem — `system_settings` (`quiz.min_questions`=10, bobot nilai 60/40, nomor WhatsApp **dummy**, jam operasional, SLA) + kategori artikel contoh berlabel jelas dummy. **Tanpa** isi gizi.
- Script: `db:generate`, `db:migrate`, `db:seed`, `db:studio`.

## Bukan lingkup tugas ini
- Query & service per modul — dibangun per fitur.
- Menjalankan migrasi ke database prod.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/db/**`
- `drizzle.config.ts`
- `package.json`

## Selesai jika
- [ ] Migrasi berjalan bersih di binzi-dev.
- [ ] Tidak ada tabel `certificates`, `consultation_requests`, atau `course_categories` (§11.1).
- [ ] `db:seed` idempoten (bisa dijalankan dua kali tanpa error).
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run db:migrate && npm run db:seed` (dua kali)

## Verifikasi oleh kamu (sebelum merge)
- [ ] **Baca file SQL migrasi sebelum menyetujui PR** (§9.6). Periksa: tipe kolom, NOT NULL, foreign key, index.
- [ ] Buka `npm run db:studio`, lalu cocokkan daftar tabel dengan §11.2.

## Catatan
- Jika §11.2 ambigu atau bertentangan dengan kebutuhan Better Auth, berhenti dan tanyakan — jangan mengarang kolom.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
