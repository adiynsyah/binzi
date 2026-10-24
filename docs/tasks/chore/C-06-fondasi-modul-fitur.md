# C-06 · Fondasi modul fitur: alias `@/` di Vitest + batas impor DB

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | A-08 (pola modul), C-01 (ESLint mengabaikan `.claude/**`). Sebelum S1-01 |
| **Branch** | `f0/c-06-fondasi-modul` |

> **Dibuat 24 Okt 2026** di Claude chat, ditinjau terhadap `main` `9468120`. Menutup dua item lama di `STATUS.md` ("alias `@/` di `vitest.config.ts`" dan "aturan ESLint impor `@/db`") sebelum S1 menambah banyak modul.

## Tujuan
S1 adalah sprint pertama yang menulis modul fitur sungguhan (`course`, `lesson`, `quiz`, `media`). Dua celah fondasi ditutup lebih dulu supaya tidak ikut berlipat: Vitest belum mengenal alias `@/` (sehingga modul memakai impor relatif panjang dan `page.tsx` tidak bisa dites), dan belum ada aturan yang mencegah instance DB diimpor di luar modul.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `src/modules/README.md`
- `vitest.config.ts`, `tsconfig.json` (`paths`), `eslint.config.mjs` (kedua blok `no-restricted-imports` dan komentarnya)
- `src/lib/module-boundary.test.ts` (pola tes aturan ESLint)
- `src/db/index.ts`, `src/db/client.ts`

## Kerjakan

### 1. Alias `@/` di Vitest
Tambahkan `resolve.alias` `@` → `src` di `vitest.config.ts`, tanpa dependensi baru. Lalu ganti impor relatif **lintas direktori** (`../…`) menjadi `@/…` di `src/modules/**`, `src/components/**`, dan `src/lib/**`. Impor sedirektori (`./…`) tetap. Perbarui catatan di `src/modules/README.md` yang menjelaskan kenapa modul memakai impor relatif.

### 2. Batas impor instance DB
Instance DB (`@/db`, `@/db/index`, `@/db/client`, dan padanan relatifnya) hanya boleh diimpor sebagai **nilai** dari:
- `src/modules/**` dan `src/db/**`
- `src/lib/auth.ts` (adapter Better Auth)
- `src/app/api/health/route.ts` dan `src/app/api/cron/keep-alive/route.ts` (titik komposisi A-18)

`import type` tetap boleh di mana saja (`allowTypeImports`). `@/db/schema` tidak dibatasi — `src/lib/rbac.ts` dan `src/lib/ratelimit.ts` memakai enum/tabelnya.

Perhatikan komentar di `eslint.config.mjs`: blok `no-restricted-imports` yang di-scope **menggantikan**, bukan menggabungkan, blok global. Pola batas `queries.ts` yang sudah ada wajib tetap berlaku di setiap blok yang kamu ubah atau tambahkan.

### 3. Tes aturan
Perluas pola `src/lib/module-boundary.test.ts`: impor nilai `@/db` dari berkas di luar daftar izin → error; dari `src/modules/x/queries.ts` → lolos; `import type` → lolos; impor `queries.ts` modul lain → tetap error.

## Bukan lingkup tugas ini
- Integrasi Sentry. Sampai ada, aturan sementara di `src/modules/README.md` berlaku: route mencatat error asli ke `console.error` sebelum `toErrorResponse()`.
- `src/db/index.ts` lazy (`getDb()`), dan perubahan perilaku kode lainnya.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `vitest.config.ts`, `eslint.config.mjs`, `src/lib/module-boundary.test.ts`, `src/modules/README.md`
- Baris impor di `src/modules/**`, `src/components/**`, `src/lib/**` (hanya baris impor)

## Selesai jika
- [ ] `git grep -n 'from "\.\./' -- src/modules src/components src/lib` kosong.
- [ ] Jumlah tes Vitest sama dengan `main` (428) dan semuanya hijau; tes aturan baru menambah jumlahnya.
- [ ] Mutasi: hapus `src/lib/auth.ts` dari daftar izin → `npm run lint` merah di berkas itu; hapus pola `queries.ts` dari blok yang diubah → tes batas modul merah. Keduanya dikembalikan.

## Sebelum membuka PR
- Diff hanya baris impor di luar empat berkas konfigurasi/dokumentasi — sebut jumlah berkas yang berubah.
- Setelah push: cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Sekilas di "Files changed": selain empat berkas di atas, yang berubah hanya baris `import`.

## Catatan keputusan
- Kerjakan di antara kartu, tanpa branch kartu lain yang terbuka: kartu ini menyentuh banyak berkas.
