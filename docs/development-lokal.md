# Database development lokal — BINZI

> Kartu C-05. Development & uji manual memakai Postgres lokal di Docker;
> binzi-dev (Supabase) sesudahnya praktis hanya dipakai Production. DB E2E
> (`binzi_e2e`, port 54329) terpisah dan dihapus-dibuat ulang tiap run —
> lihat `e2e/README.md`.

## Setup dari nol

1. `npm run dev:db` — menyalakan container `binzi-local-db` (image
   `postgres:17.6`, binding `127.0.0.1:54330`, database `binzi_local`,
   kredensial lokal `postgres`/`postgres` sebagai konstanta skrip). Idempoten:
   `docker start` bila container sudah ada; Docker tidak ada → berhenti dengan
   pesan, tidak memasang apa pun.
2. Isi `.env.local` (langkah **pemilik produk** — agent tidak pernah
   mengubahnya):

   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:54330/binzi_local
   MIGRATION_DATABASE_URL=postgresql://postgres:postgres@localhost:54330/binzi_local
   ```

3. `npm run db:migrate` — **baca baris target** di output:

   ```
   [drizzle] target: localhost:54330/binzi_local
   ```

   Baris ini dicetak `drizzle.config.ts` dari dalam proses yang
   benar-benar tersambung (setelah env dimuat), jadi itu bukti target —
   bukan catatan skrip. Bila barisnya menunjuk hal lain (mis. host pooler
   Supabase), **berhenti** dan perbaiki env; jangan lanjut ke seed.
4. `npm run db:seed` — data sistem (system_settings + kategori artikel
   dummy). Idempoten; nilai yang sudah ada tidak pernah ditimpa.
5. `npm run db:seed:demo` — data demo netral (semua teks berprefiks
   `[DEMO]`, tanpa istilah gizi/kesehatan): 1 penulis demo
   `demo.penulis@example.com` (EDITOR, tanpa baris `accounts` — tidak bisa
   login), 3 kursus (2 `DRAFT`, 1 `IN_REVIEW` berisi summary + description
   sehingga satu-satunya syarat terbit yang belum terpenuhi adalah sampul),
   tiap kursus 3 materi berurutan (pertama free preview) + quiz per materi
   dan quiz akhir; quiz kursus `IN_REVIEW` berisi 4 × 10 soal pilihan ganda
   lengkap (4 opsi, tepat 1 benar, pembahasan terisi — Q40). Idempoten —
   run kedua mencetak `baru 0` dengan total yang sama. Penjaga fail-closed
   menolak host non-lokal dan nama DB selain `binzi_local`/`binzi_e2e`
   **sebelum** koneksi pertama.

## Perintah ke binzi-dev (Production)

Setelah `.env.local` menunjuk DB lokal, `db:migrate` / `user:role` biasa
tidak lagi mengenai binzi-dev. Production tetap butuh migrasi dan pengelolaan
role di sana — pemilik produk membuat berkas `.env.binzi-dev` di root repo
(ter-ignore otomatis oleh pola `.env*`; **agent tidak membukanya`) berisi
persis dua baris:

```
DATABASE_URL=<transaction pooler binzi-dev, port 6543>
MIGRATION_DATABASE_URL=<session pooler binzi-dev, port 5432>
```

Lalu:

- `npm run db:migrate:binzi-dev` — migrasi. **Dua baris target** harus
  muncul dan sama-sama menunjuk host pooler Supabase (bukan `localhost`):

  - `[binzi-dev] MIGRATION_DATABASE_URL → target: …` — dari pembungkus;
  - `[drizzle] target: …` — dari `drizzle.config.ts`, dicetak ulang di
    output drizzle-kit dari dalam proses yang tersambung.

  Bila salah satu menunjuk `localhost`, **berhenti** — berarti env tidak
  diambil dari `.env.binzi-dev`.
- `npm run user:role:binzi-dev -- <email> <ROLE>` — set-role; argumen
  diteruskan apa adanya. Baris target pembungkus dicetak sebelum set-role
  berjalan; set-role sendiri dimuat **tanpa** `--env-file` sehingga
  `.env.local` tidak pernah ikut.

Pembungkus fail-closed — berhenti kode ≠ 0 **tanpa** menjalankan perintah
aslinya bila: berkas `.env.binzi-dev` tidak ada; kunci yang dibutuhkan tidak
ada/kosong di berkas (env proses dan `.env.local` tidak pernah menjadi
cadangan); URL tidak bisa diurai; protokol bukan postgres/postgresql; atau
host-nya lokal. Nilai dari berkas **menimpa** nilai yang sudah ada di env
proses.

## Setelah PR yang membawa migrasi

Pemilik menjalankan `npm run db:migrate:binzi-dev` sebelum fitur yang
memakainya dibuka di Production (migrasi Fase 0/S1 bersifat aditif — aman
dijalankan sebelum atau sesaat setelah deploy).

## Reset data demo lokal

`docker rm -f binzi-local-db` lalu ulangi setup dari langkah 1.
