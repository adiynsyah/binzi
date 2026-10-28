# C-05 · DB lokal untuk development + seed demo

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | A-19 (pola `e2e:db` & `db-guard`). Sebelum S1-01 |
| **Branch** | `f0/c-05-db-lokal` |

> **Dibuat 24 Okt 2026** di Claude chat, ditinjau terhadap `main` `9468120`.
> **Direvisi 28 Okt 2026** di Claude chat terhadap `main` `1556fa3`: skrip binzi-dev lewat pembungkus fail-closed, `drizzle.config.ts` mencetak targetnya sendiri, verifikasi pemilik dua arah, uji mutasi (alasan di "Catatan keputusan").

## Tujuan
Memisahkan database development dari binzi-dev. Sampai sekarang `.env.local` menunjuk binzi-dev — DB yang juga dipakai Production (`https://binzi.vercel.app`). Begitu CMS S1 berjalan, setiap kursus uji yang dibuat saat development akan ikut tersimpan di sana. Setelah kartu ini, development dan uji manual memakai Postgres lokal di Docker, binzi-dev praktis hanya dipakai Production, dan tersedia data demo netral untuk melihat layar dengan isi.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `e2e/db-container.ts`, `e2e/db-guard.ts`, `e2e/env.ts`, `e2e/README.md` (pola container & penjaga fail-closed)
- `drizzle.config.ts`, `src/db/seed.ts`, `src/db/client.ts`
- `scripts/set-role.ts` (komentar pemuatan env di atas berkas + fungsi `main`)
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

### 3. Skrip ke binzi-dev setelah pemisahan
Setelah `.env.local` menunjuk DB lokal, perintah yang dulu otomatis mengenai binzi-dev kini mengenai DB lokal. Production tetap butuh migrasi dan pengelolaan role di binzi-dev, jadi tambahkan dua skrip yang berjalan lewat **satu pembungkus** (mis. `scripts/binzi-dev.ts`):
- `npm run db:migrate:binzi-dev` → `drizzle-kit migrate` dengan `MIGRATION_DATABASE_URL` dari `.env.binzi-dev`.
- `npm run user:role:binzi-dev` → `scripts/set-role.ts` dengan `DATABASE_URL` dari `.env.binzi-dev`; argumen email dan role diteruskan apa adanya.

Pembungkus menyiapkan env dari berkas lalu menjalankan perintah aslinya sebagai proses anak:
- Isi `.env.binzi-dev` (ter-ignore oleh pola `.env*`) diurai dengan `parse` dari `dotenv` tanpa mengubah `process.env`. Nilai kunci yang dibutuhkan perintah itu dipasang eksplisit di env proses anak dan **menimpa** nilai yang mungkin sudah ada di env proses. `set-role.ts` dijalankan langsung lewat `tsx`, tanpa `--env-file`.
- **Fail-closed**: keluar dengan kode ≠ 0 sebelum proses anak berjalan bila berkas tidak ada; kunci yang dibutuhkan tidak ada atau kosong di berkas (env proses dan `.env.local` tidak pernah menjadi cadangannya); URL tidak bisa diurai; atau host-nya lokal (`localhost`/`127.0.0.1`/`::1`). Himpunan host lokal satu sumber dengan penjaga seed demo.
- Sebelum menjalankan, cetak target `host:port/nama-db` — tanpa user dan sandi, sama seperti `e2e/db-guard.ts` tidak pernah mencetak URL.
- Inti pembungkus (urai isi berkas → target tervalidasi; susun env anak) berupa fungsi murni yang dites dengan isi berkas tiruan berupa string.

Agent tidak membuka isi `.env.binzi-dev` dan tidak menjalankan kedua skrip ini terhadap binzi-dev. Satu-satunya run yang dilampirkan agent adalah kasus berkas tidak ada.

**Baris target di `drizzle.config.ts`.** Config mencetak satu baris target (`host:port/nama-db`, tanpa user dan sandi) setiap kali dimuat. Ini bukti dari dalam proses yang benar-benar tersambung: config memuat `.env.local` sebagai cadangan bila `MIGRATION_DATABASE_URL` tidak ada di env, jadi baris dari pembungkus saja tidak membuktikan target drizzle-kit. Baris itu harus terlihat di output `drizzle-kit migrate`; bila tidak tampil, berhenti dan tanyakan. Sekalian luruskan komentar `drizzle.config.ts`, serta komentar dan pesan galat `src/db/seed.ts`, yang menyebut pooler Supabase sebagai satu-satunya target — setelah kartu ini target lokal sama sahnya.

### 4. Dokumentasi
- `CLAUDE.md` bagian "Alur Git" atau bagian baru "Database": development & uji manual memakai DB lokal (`npm run dev:db`); agent tidak pernah menjalankan migrasi/seed ke binzi-dev; migrasi binzi-dev dijalankan pemilik dengan `db:migrate:binzi-dev`.
- `e2e/README.md` atau berkas README baru di `docs/`: urutan setup DB lokal dari nol, termasuk cara membaca baris target.

## Bukan lingkup tugas ini
- Mengubah `.env.local`, `.env.example` (nilai), Vercel, atau binzi-dev.
- Data demo artikel/kategori (S4 menambahnya sendiri).
- Mengubah `e2e/db-setup.ts` atau harness E2E.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `scripts/dev-db.ts` (atau lokasi setara), `src/db/seed-demo.ts`, penjaga + tesnya
- `scripts/binzi-dev.ts` (atau lokasi setara) + tesnya
- `drizzle.config.ts` — baris target dan komentar saja
- `src/db/seed.ts` — komentar dan pesan galat saja
- `package.json` (skrip saja — tanpa dependensi baru)
- `CLAUDE.md`, `e2e/README.md` atau `docs/development-lokal.md`

## Selesai jika
- [ ] `npm run dev:db` dua kali berturut-turut → container yang sama, tanpa galat.
- [ ] Dengan `DATABASE_URL`/`MIGRATION_DATABASE_URL` lokal di env proses (bukan `.env.local`): `db:migrate` → `db:seed` → `db:seed:demo` hijau; output `db:migrate` memuat baris target `localhost:54330/binzi_local`; `db:seed:demo` kedua kali tidak menggandakan baris.
- [ ] Tes penjaga seed demo: host Supabase, nama DB lain, dan URL kosong ditolak sebelum koneksi.
- [ ] Tes pembungkus binzi-dev: berkas tidak ada, kunci tidak ada (juga saat kunci itu ada di env proses), kunci kosong, host lokal (ketiga bentuk), dan URL rusak ditolak; kunci yang sudah ada di env proses dengan nilai lain → env anak berisi nilai dari berkas.
- [ ] `npm run db:migrate:binzi-dev` dan `npm run user:role:binzi-dev` tanpa `.env.binzi-dev` → berhenti dengan pesan jelas, kode ≠ 0, drizzle-kit/set-role tidak berjalan.
- [ ] Uji mutasi di bawah: setiap mutasi memerahkan minimal satu tes.
- [ ] `grep` teks seed demo: tidak ada istilah gizi/kesehatan.

## Uji mutasi wajib
Terapkan satu per satu, jalankan tes, catat tes yang merah, lalu kembalikan:
1. Pembungkus binzi-dev menerima host lokal.
2. Env anak tidak menimpa nilai yang sudah ada di env proses (urutan penggabungan dibalik).
3. Kunci yang hilang di berkas diambil dari `process.env` (cadangan).
4. Penjaga seed demo menerima nama DB apa pun.

Mutasi yang tidak memerahkan tes: cari dulu lapis lain yang menutupinya sebelum menyimpulkan tesnya lemah (STATUS pelajaran (yy)), lalu laporkan.

## Sebelum membuka PR
- Bukti di PR: output `db:seed:demo` (jumlah baris per tabel), output penjaga seed demo untuk tiga kasus tolak, output `db:migrate` lokal dengan baris targetnya, output kedua skrip binzi-dev tanpa `.env.binzi-dev`, dan tabel uji mutasi (mutasi → tes yang merah).
- Setelah push: cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`

## Verifikasi oleh kamu (setelah merge)
1. Simpan nilai binzi-dev yang sekarang ada di `.env.local` ke berkas baru `.env.binzi-dev` (hanya `DATABASE_URL` dan `MIGRATION_DATABASE_URL`).
2. Ganti kedua nilai itu di `.env.local` dengan nilai lokal dari PR.
3. `npm run dev:db`, `npm run db:migrate` (baris target harus `localhost:54330/binzi_local`), `npm run db:seed`, `npm run db:seed:demo`.
4. `npm run dev` → daftar akun baru di `http://localhost:3000/daftar` (tautan verifikasi dari terminal) → `npm run user:role` menjadikannya `ADMIN` → `/cms` terbuka.
5. `npm run db:migrate:binzi-dev` → baris target pembungkus **dan** baris target dari `drizzle.config.ts` sama-sama menunjuk host pooler Supabase, bukan `localhost`; migrasi tanpa perubahan.
6. `npm run user:role:binzi-dev -- tidak-ada@example.com MEMBER` → baris target pooler Supabase, lalu "User dengan email tidak-ada@example.com tidak ditemukan". Bukti tersambung ke binzi-dev tanpa mengubah apa pun.
7. Arah sebaliknya: `mv .env.binzi-dev .env.binzi-dev.off` → `npm run db:migrate:binzi-dev` berhenti dengan pesan berkas tidak ada → `mv .env.binzi-dev.off .env.binzi-dev`.

## Catatan keputusan
- Dua DB lokal dengan peran berbeda: `binzi_e2e` dihapus-dibuat ulang setiap run E2E, `binzi_local` bertahan untuk development.
- Mulai kartu ini, **setiap PR yang membawa migrasi** diikuti langkah pemilik `npm run db:migrate:binzi-dev` sebelum fitur yang memakainya dibuka di Production (migrasi S1 bersifat aditif, jadi aman dijalankan sebelum atau sesaat setelah deploy).
- **Bukti target dari dalam proses (revisi 28 Okt).** Versi 24 Okt memverifikasi `db:migrate:binzi-dev` dengan "No migrations to apply". Hasil itu muncul juga bila `drizzle.config.ts` jatuh ke `.env.local` — yang setelah langkah 2 menunjuk DB lokal yang baru dimigrasi — sehingga langkah itu lolos di keadaan benar maupun salah. Hal yang sama berlaku untuk `user:role:binzi-dev` bila skripnya memuat `.env.local` di samping `.env.binzi-dev`: perubahan role jatuh ke DB lokal tanpa tanda. Karena itu pembungkus menolak cadangan apa pun, dan target dibuktikan dari baris yang dicetak proses yang benar-benar tersambung.
