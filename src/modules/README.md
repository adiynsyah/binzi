# `src/modules` — pola modul domain

Inti bisnis BINZI, terisolasi per domain (PRD §10.2). Setiap modul punya lima
berkas dengan tanggung jawab tunggal. **Modul contoh:** [`user/`](./user) —
jadikan referensi saat membuat modul baru.

## File per modul

| File | Tanggung jawab | Boleh diimpor dari luar? |
|---|---|---|
| `schema.ts` | Kontrak input Zod (payload masuk) | **Ya** — kontrak bersama; boleh dipakai form klien (Zod murni, tanpa impor server) |
| `policy.ts` | Siapa boleh apa (404 milik / 403 role) | Tidak — internal modul |
| `queries.ts` | Akses DB Drizzle; kolom dipilih **eksplisit**, tanpa `select *` | **Tidak pernah** — ditegakkan ESLint |
| `serializer.ts` | `toXxxDTO()` — allowlist field yang keluar | Tidak — internal modul |
| `service.ts` | Satu-satunya pintu: validasi → policy → queries → serializer | **Ya — hanya ini**, fungsi maupun tipe DTO |

Konsumen luar memakai tipe DTO lewat service, mis.
`import type { PublicUserDTO } from "@/modules/user/service"` — bukan dari
`serializer.ts`/`policy.ts`, dan `schema.ts` boleh diimpor langsung oleh form
klien untuk validasi awal yang sama dengan server.

## Alur satu panggilan

```
route/action ─→ service.ts        (guard + parse input dengan Zod → 400 jika gagal)
                 └→ policy.ts     (kepemilikan → 404; role kurang → 403)
                     └→ queries.ts  (select eksplisit + kondisi kepemilikan)
                         └→ serializer.ts (toXxxDTO → objek baru, allowlist)
```

**Urutan baku guard di `service.ts`:**

- **Endpoint ber-role** (mis. `listUsers` khusus ADMIN): cek role **dulu**,
  baru parse input — pemanggil tak berwenang tidak perlu tahu bentuk
  kontrak inputnya.
- **Endpoint berbasis kepemilikan** (mis. `getUserProfile`): parse input
  **dulu** (ID target dibutuhkan untuk mengecek), lalu policy kepemilikan,
  lalu query.

Aturan yang dijaga pola ini (PRD §12.6, pencegah V-01 & V-05):

- **Serialisasi eksplisit.** Objek DB mentah tidak pernah keluar modul. Baris
  hasil query selalu melewati `toXxxDTO()` yang membangun objek baru dari
  daftar field eksplisit — kolom yang tidak terdaftar (mis. `users.deleted_at`)
  mustahil ikut keluar meski suatu saat query-nya berubah.
- **Satu DTO per audiens.** Bukan satu DTO "lengkap". Contoh di `user/`:
  `toPublicUserDTO` (id, name, image — untuk byline/reviewer artikel; hanya
  user dengan role EDITOR ke atas, dicek di `WHERE` query lewat
  `PUBLIC_PROFILE_ROLES` di `policy.ts`) dan `toUserPrivateDTO` (10 field —
  hanya untuk pemilik akun itu sendiri atau ADMIN+). Menambah audiens baru =
  DTO baru, bukan melonggarkan yang ada.
- **DTO JSON-safe: tanggal = string ISO.** Semua `Date` dikonversi ke string
  ISO 8601 di serializer (`toISOString()`), `null` tetap `null` — DTO tidak
  pernah membawa objek `Date`.
- **Anti-IDOR di dua lapis**: `policy.ts` melempar 404 saat kepemilikan gagal,
  dan `queries.ts` tetap menyertakan kondisi kepemilikan/soft-delete (dan,
  bila relevan, batasan role seperti profil publik) di `WHERE` — jangan
  pernah mengandalkan policy saja.

## Kenapa `serializer.ts` file terpisah (file ke-5)

1. PRD §13.4 langkah 3 menempatkan "skema Zod + fungsi serialisasi" sebagai
   tahap kontrak tersendiri — dipisah agar terlihat dan teruji.
2. Serializer harus murni: hanya impor **tipe** dari `db/schema`, tanpa impor
   runtime ke `db` (yang melempar error tanpa `DATABASE_URL`). Dengan begitu
   `serializer.test.ts` berjalan di vitest tanpa database — tes keamanan
   paling penting justru yang paling murah dijalankan.

## Batas impor (ditegakkan ESLint)

Aturan `no-restricted-imports` di `eslint.config.mjs` menggagalkan build-lint
untuk impor `modules/*/queries` dari luar modulnya — baik lewat alias
(`@/modules/user/queries`) maupun relatif lintas modul (`../user/queries`).
Di dalam modul sendiri, impor relatif `./queries`. Bukti otomatis bahwa aturan
ini benar-benar menggagalkan: `src/lib/module-boundary.test.ts` menjalankan
ESLint API atas berkas konfigurasi yang sama — tanpa perlu meng-commit berkas
yang melanggar.

Konvensi impor tambahan di `src/modules/**`: impor yang keluar dari direktori
modul memakai path relatif (`../../db/schema`, `../../lib/errors`), karena
vitest belum mengonfigurasi alias `@/` (lihat "Belum selesai").

## Error domain → HTTP

`src/lib/errors.ts`: lempar `AppError` dari `policy.ts`/`service.ts`, lalu
route menerjemahkan dengan `toErrorResponse()`.

**Wajib di route/server action:** laporkan error **asli** ke Sentry (atau
logger) **sebelum** memanggil `toErrorResponse()` — respons 500 memang
sengaja generik, jadi detailnya harus sampai ke telemetri, kalau tidak
hilang. (Aturan saja; integrasi Sentry bukan bagian kartu A-08.)

| Situasi | Error | HTTP |
|---|---|---|
| Resource tak ada, **atau ada tapi bukan milik actor** (jangan bocorkan keberadaan — V-05) | `NotFoundError` | 404 |
| Terautentikasi tapi role kurang (mis. MEMBER buka endpoint ADMIN) | `ForbiddenError` | 403 |
| Input gagal validasi Zod (field tercantum, nilai tidak dicetak) | `ZodError` | 400 |
| Pelanggaran state (mis. attempt quiz kedua) | `ConflictError` | 409 |
| Lain-lain | — | 500 generik |

## Membuat modul baru

1. Salin pola `user/`: `schema.ts` → `policy.ts` → `queries.ts` →
   `serializer.ts` → `service.ts` (kontrak dulu, baru server, PRD §13.4).
2. Tulis `schema.test.ts`, `policy.test.ts`, dan `serializer.test.ts` bersama
   fiturnya — serializer wajib membuktikan field sensitif tidak ikut keluar.
3. Paginasi daftar: `PAGE_SIZE` dari `src/lib/pagination.ts` (klien tidak
   boleh menentukan ukuran halaman).
4. Query soft-delete: selalu saring `deletedAt IS NULL` bila tabel punya kolom
   itu.

## Belum selesai / di luar lingkup (catatan A-08)

- `src/components/ui/pagination.tsx` masih mengekspor `PAGE_SIZE` versinya
  sendiri — perlu beralih mengimpor dari `src/lib/pagination.ts` agar satu
  sumber kebenaran (di luar daftar berkas kartu A-08).
- Usulan aturan lanjutan (kartu berikutnya): larang impor `@/db` dari luar
  `src/modules/**` dan `src/db/**`, dengan pengecualian adapter Better Auth
  (kartu A-09).
- `vitest.config.ts` belum mengonfigurasi alias `@/` — itulah alasannya impor
  lintas direktori dari modul memakai path relatif.
- Integrasi Sentry/logger untuk aturan pelaporan error di atas belum
  terpasang (di luar kartu A-08) — sampai ada, route minimal mencatat error
  asli ke `console.error` sebelum memanggil `toErrorResponse()`.
- `queries.ts` belum punya tes integrasi (butuh database); miliki modul fitur
  yang mengonsumsinya.
