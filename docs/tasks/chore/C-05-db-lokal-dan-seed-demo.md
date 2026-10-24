# C-05 · DB lokal untuk development + seed demo

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | A-19 (pola `e2e:db` & `db-guard`). Sebelum S1-01 |
| **Branch** | `f0/c-05-db-lokal` |

> **Dibuat 24 Okt 2026** di Claude chat, ditinjau terhadap `main` `9468120`.

## Tujuan
Memisahkan database development dari binzi-dev. Sampai sekarang `.env.local` menunjuk binzi-dev — DB yang juga dipakai Production (`https://binzi.vercel.app`). Begitu CMS S1 berjalan, setiap kursus uji yang dibuat saat development akan ikut tersimpan di sana. Setelah kartu ini, development dan uji manual memakai Postgres lokal di Docker, binzi-dev praktis hanya dipakai Production, dan tersedia data demo netral untuk melihat layar dengan isi.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `e2e/db-container.ts`, `e2e/db-guard.ts`, `e2e/env.ts`, `e2e/README.md` (pola container & penjaga fail-closed)
- `drizzle.config.ts`, `src/db/seed.ts`, `src/db/client.ts`
- `src/db/schema/course.ts`, `src/db/schema/quiz.ts`, `src/db/schema/auth.ts` (kolom wajib)
- `package.json` (skrip)

## Kerjakan

### 1. Container Postgres development
`npm run dev:db` — idempoten, pola `e2e/db-container.ts`: container `binzi-local-db`, image `postgres:17.6` (sama dengan e2e dan binzi-dev), port host **54330**, DB `binzi_local`. Kredensial lokal sebagai konstanta (seperti `e2e/env.ts`), bukan dari `.env*`. Docker tidak ada → berhenti dengan pesan jelas, tanpa memasang apa pun.

Agent **tidak** mengubah `.env.local` (aturan `CLAUDE.md`). Di akhir sesi, tulis di PR nilai `DATABASE_URL` dan `MIGRATION_DATABASE_URL` lokal yang harus diisi pemilik, dan langkah pemilik di bawah.

### 2. Seed demo
`npm run db:seed:demo` → `src/db/seed-demo.ts`, terpisah dari `db:seed` (data sistem).

**Penjaga fail-closed sebelum koneksi pertama**, pola `e2e/db-guard.ts`: host hanya `localhost`/`127.0.0.1`/`::1`, nama DB hanya `binzi_local` atau `binzi_e2e`. URL kosong, host Supabase, atau nama DB lain → keluar dengan kode ≠ 0 tanpa menyentuh DB.

**Isi** (idempoten: UUID tetap, `onConflictDoNothing`):
- Satu user penulis demo: `demo.penulis@example.com`, role `EDITOR`, tanpa baris `accounts` (tidak bisa login — hanya pengisi `created_by`).
- Tiga kursus: dua `DRAFT` dan satu `IN_REVIEW`, masing-masing 3 materi berurutan. Materi pertama `is_free_preview`.
- Setiap materi punya satu quiz `LESSON`, setiap kursus satu quiz `FINAL`. Quiz pada satu kursus berisi 10 soal pilihan ganda (4 opsi, tepat 1 benar, pembahasan terisi — aturan Q40), supaya checklist terbit S1-08 punya kasus lengkap. Kursus lain boleh tanpa soal.
- Konten materi berupa dokumen TipTap minimal (`doc` → `paragraph` → `text`).

**Teks harus jelas dummy dan netral** (`CLAUDE.md`, PRD §13.4): mis. "[DEMO] Kursus contoh 1", "Teks demo materi 2 — bukan konten gizi.", soal "Pertanyaan demo 3?" dengan opsi "Opsi A"–"Opsi D". **Tidak ada** istilah, angka, atau klaim gizi/kesehatan, termasuk yang ada di desain.

### 3. Migrasi & role ke binzi-dev setelah pemisahan
Setelah `.env.local` menunjuk DB lokal, perintah yang dulu otomatis mengenai binzi-dev kini mengenai DB lokal. Production tetap butuh migrasi dan pengelolaan role di binzi-dev, jadi tambahkan:
- `npm run db:migrate:binzi-dev` — `drizzle-kit migrate` dengan env dari berkas `.env.binzi-dev` (ter-ignore oleh pola `.env*`). Berkas tidak ada → berhenti dengan pesan jelas. Agent tidak membaca isi berkas itu.
- `npm run user:role:binzi-dev` — `scripts/set-role.ts` dengan `.env.binzi-dev`.

### 4. Dokumentasi
- `CLAUDE.md` bagian "Alur Git" atau bagian baru "Database": development & uji manual memakai DB lokal (`npm run dev:db`); agent tidak pernah menjalankan migrasi/seed ke binzi-dev; migrasi binzi-dev dijalankan pemilik dengan `db:migrate:binzi-dev`.
- `e2e/README.md` atau berkas README baru di `docs/`: urutan setup DB lokal dari nol.

## Bukan lingkup tugas ini
- Mengubah `.env.local`, `.env.example` (nilai), Vercel, atau binzi-dev.
- Data demo artikel/kategori (S4 menambahnya sendiri).
- Mengubah `e2e/db-setup.ts` atau harness E2E.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `scripts/dev-db.ts` (atau lokasi setara), `src/db/seed-demo.ts`, penjaga + tesnya
- `package.json` (skrip saja — tanpa dependensi baru)
- `CLAUDE.md`, `e2e/README.md` atau `docs/development-lokal.md`

## Selesai jika
- [ ] `npm run dev:db` dua kali berturut-turut → container yang sama, tanpa galat.
- [ ] Dengan `DATABASE_URL`/`MIGRATION_DATABASE_URL` lokal di env proses (bukan `.env.local`): `db:migrate` → `db:seed` → `db:seed:demo` hijau; `db:seed:demo` kedua kali tidak menggandakan baris.
- [ ] Tes penjaga: host Supabase, nama DB lain, dan URL kosong ditolak sebelum koneksi.
- [ ] `grep` teks seed demo: tidak ada istilah gizi/kesehatan.

## Sebelum membuka PR
- Bukti di PR: output `db:seed:demo` (jumlah baris per tabel) dan output penjaga untuk tiga kasus tolak.
- Setelah push: cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`

## Verifikasi oleh kamu (setelah merge)
1. Simpan nilai binzi-dev yang sekarang ada di `.env.local` ke berkas baru `.env.binzi-dev` (hanya `DATABASE_URL` dan `MIGRATION_DATABASE_URL`).
2. Ganti kedua nilai itu di `.env.local` dengan nilai lokal dari PR.
3. `npm run dev:db`, `npm run db:migrate`, `npm run db:seed`, `npm run db:seed:demo`.
4. `npm run dev` → daftar akun baru di `http://localhost:3000/daftar` (tautan verifikasi dari terminal) → `npm run user:role` menjadikannya `ADMIN` → `/cms` terbuka.
5. `npm run db:migrate:binzi-dev` → "No migrations to apply" (bukti berkas `.env.binzi-dev` terbaca, tanpa perubahan).

## Catatan keputusan
- Dua DB lokal dengan peran berbeda: `binzi_e2e` dihapus-dibuat ulang setiap run E2E, `binzi_local` bertahan untuk development.
- Mulai kartu ini, **setiap PR yang membawa migrasi** diikuti langkah pemilik `npm run db:migrate:binzi-dev` sebelum fitur yang memakainya dibuka di Production (migrasi S1 bersifat aditif, jadi aman dijalankan sebelum atau sesaat setelah deploy).
