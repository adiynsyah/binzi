# C-06 · Fondasi modul fitur: alias `@/` di Vitest + batas impor DB

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | A-08 (pola modul), C-01 (ESLint mengabaikan `.claude/**`). Sebelum S1-01. Jangan bertumpuk dengan C-04 (Jum 6 – Min 8 Nov) |
| **Branch** | `f0/c-06-fondasi-modul` |

> **Dibuat 24 Okt 2026** di Claude chat, ditinjau terhadap `main` `9468120`. Menutup dua item lama di `STATUS.md` ("alias `@/` di `vitest.config.ts`" dan "aturan ESLint impor `@/db`") sebelum S1 menambah banyak modul.
> **Direvisi 30 Okt 2026** di Claude chat, ditinjau terhadap `main` `5193638`. `no-restricted-imports` tidak memeriksa `import()` dinamis, padahal `src/lib/auth.ts` mengambil DB lewat `import("../db")` — mutasi versi lama ("keluarkan `auth.ts` dari daftar izin → lint merah") tidak akan merah, dan batasnya bisa ditembus pola lazy-load yang sama. Ditambah: aturan `no-restricted-syntax` untuk impor dinamis, batas hanya di `src/**` (`scripts/set-role.ts` memakai `createDb`), impor dinamis relatif ikut diubah, empat baris `../` yang tetap, larangan Prettier, 460 tes, prasyarat e2e. Langkah 1 dan 2 disimulasikan di sandbox: `tsc`, `eslint .`, dan 460 tes hijau; 17 kasus aturan sesuai harapan; mutasi M1, M4, M5 merah.

## Tujuan
S1 adalah sprint pertama yang menulis modul fitur sungguhan (`course`, `lesson`, `quiz`, `media`). Dua celah fondasi ditutup lebih dulu supaya tidak ikut berlipat: Vitest belum mengenal alias `@/` (sehingga modul memakai impor relatif panjang dan `page.tsx` tidak bisa dites), dan belum ada aturan yang mencegah instance DB diimpor — statis maupun dinamis — di luar modul.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `src/modules/README.md`
- `vitest.config.ts`, `tsconfig.json` (`paths`), `eslint.config.mjs` (kedua blok `no-restricted-imports` dan komentarnya)
- `src/lib/module-boundary.test.ts` (pola tes aturan ESLint)
- `src/db/index.ts`, `src/db/client.ts`
- `src/lib/auth.ts` baris 88–95 (impor dinamis `env` dan DB)

## Kerjakan

### 1. Alias `@/` di Vitest
Tambahkan `resolve.alias` `@` → `src` di `vitest.config.ts` (`fileURLToPath(new URL("./src", import.meta.url))`), tanpa dependensi baru.

Lalu ganti ke `@/…` setiap impor relatif lintas direktori yang **menuju ke dalam `src/`**, di `src/modules/**`, `src/components/**`, dan `src/lib/**`:
- statis: `from "../…"`, termasuk `import type` dan `export … from`;
- dinamis: `import("../…")` — 9 baris di `src/lib/auth.ts`, `src/lib/mail.ts`, `src/components/shared/auth/auth-config.ts`. Bentuk relatifnya ada justru karena Vitest belum punya alias (pola A-18).

Simulasi 30 Okt: 139 baris (130 statis + 9 dinamis) di 62 berkas. Impor sedirektori (`./…`) tetap.

**Tetap relatif — jangan diubah:**
- `src/lib/module-boundary.test.ts` → `../../eslint.config.mjs` dan `src/lib/rbac.integration.test.ts` → `../../scripts/set-role`: tujuannya di luar `src/`, alias tidak berlaku.
- Potongan kode di dalam **string** di `module-boundary.test.ts` (saat ini baris 36 dan 52): itu input tes. Mengubahnya mengganti kasus yang diuji dan melemahkan tes aturan.

**Jangan menjalankan Prettier** (`npm run format` atau `prettier --write`). Per 30 Okt, 80 berkas `src/` — 30 di antaranya berkas target kartu ini — belum rapi menurut Prettier 3.9.10, dan CI tidak memeriksa format. Menjalankannya akan melebarkan diff ke luar baris impor.

Perbarui `src/modules/README.md`: hapus penjelasan "modul memakai path relatif karena vitest belum mengonfigurasi alias", hapus butir "Belum selesai" yang tertutup kartu ini (alias Vitest dan usulan aturan `@/db`), dan jelaskan batas DB dari langkah 2, termasuk aturan impor dinamis dan celahnya (lihat di bawah).

### 2. Batas impor instance DB
Instance DB = `@/db`, `@/db/index`, `@/db/client`, dan padanan relatifnya (`./db`, `../db`, `../../db/client`, …). Instance hanya boleh diimpor sebagai **nilai** dari daftar izin:
- `src/modules/**` dan `src/db/**`
- `src/lib/auth.ts` (adapter Better Auth; impor dinamis)
- `src/app/api/health/route.ts` dan `src/app/api/cron/keep-alive/route.ts` (titik komposisi A-18)

Aturan **hanya berlaku di `src/**`**. `scripts/**` (mis. `scripts/set-role.ts` membuat koneksinya sendiri lewat `createDb`), `e2e/**`, dan berkas konfigurasi root adalah alat CLI dan harness, di luar aturan.

`import type` tetap boleh di mana saja (`allowTypeImports` per pola — didukung `no-restricted-imports` inti ESLint 9.39). `@/db/schema` dan `@/db/ping` tidak dibatasi (`src/lib/rbac.ts` dan `src/lib/ratelimit.ts` memakai `schema`, kedua route A-18 memakai `ping`).

Dibutuhkan **dua aturan**, karena `no-restricted-imports` (inti maupun typescript-eslint) tidak memeriksa `import()` dinamis — dibuktikan 30 Okt:
- `no-restricted-imports` untuk impor statis (termasuk `export … from`);
- `no-restricted-syntax` dengan selector `ImportExpression` pada `source.value` untuk impor dinamis.

Bentuk yang sudah diuji di sandbox: satu blok baru `files: ["src/**/*.{js,jsx,ts,tsx}"]` dengan `ignores` = daftar izin, berisi kedua aturan; blok global dan blok `src/modules/**` tidak berubah. Perhatikan komentar di `eslint.config.mjs`: blok yang di-scope **menggantikan**, bukan menggabungkan, blok global untuk aturan yang sama — jadi pola `modules/[^/]+/queries` wajib diulang di blok baru. Berkas daftar izin di luar `src/modules` tetap tercakup pola itu lewat blok global. Konfigurasi belum punya blok `no-restricted-syntax`, jadi aturan itu tidak menggantikan apa pun.

Pola yang diuji:
- statis (`regex` di `patterns`, bersama `allowTypeImports: true`): `^(@/|(\.\./)+|\./)db(/index|/client)?$`
- dinamis (selector esquery): `ImportExpression[source.value=/^(@\/|(\.\.\/)+|\.\/)db(\/index|\/client)?$/]`

Di string JavaScript, setiap garis miring terbalik digandakan. Impor dinamis dengan template literal atau variabel (`import(path)`) tidak tertangkap — sebut celah ini di README dan di komentar blok.

Perbarui komentar blok di `eslint.config.mjs` (bahasa Inggris, seperti komentar yang ada): daftar izin, alasan dua aturan, dan rujukan ke tes.

### 3. Tes aturan
Perluas `src/lib/module-boundary.test.ts` (Linter API dengan `eslint.config.mjs` asli, berkas virtual). Setiap asersi menyebut `ruleId` yang diharapkan (`no-restricted-imports` atau `no-restricted-syntax`). Kasus minimum:

| Kode | Berkas virtual | Hasil |
|---|---|---|
| nilai `@/db` | `src/app/x/page.tsx` | merah (`no-restricted-imports`) |
| nilai `../db` | `src/lib/x.ts` | merah (`no-restricted-imports`) |
| nilai `@/db/client` | `src/components/x.tsx` | merah (`no-restricted-imports`) |
| `import("@/db")` | `src/app/x/page.tsx` | merah (`no-restricted-syntax`) |
| `import("../db")` | `src/lib/x.ts` | merah (`no-restricted-syntax`) |
| `@/modules/user/queries` | `src/app/x/page.tsx` | merah — pola queries di blok baru |
| `@/modules/user/queries` | `src/lib/auth.ts` | merah — pola queries di blok global |
| `import type { Db } from "@/db/client"` | `src/lib/x.ts` | lolos |
| nilai `@/db/schema` | `src/lib/x.ts` | lolos |
| `import("@/config/env.server")` | `src/lib/x.ts` | lolos |
| `import("@/db")` | `src/lib/auth.ts` | lolos |
| nilai `@/db` | `src/app/api/health/route.ts`, `src/modules/course/queries.ts` | lolos |
| nilai `./index` | `src/db/x.ts` | lolos |
| nilai `../src/db/client` | `scripts/x.ts` | lolos — batas hanya `src/**` |

Tes lama tetap ada dan tetap hijau.

## Bukan lingkup tugas ini
- Integrasi Sentry. Sampai ada, aturan sementara di `src/modules/README.md` berlaku: route mencatat error asli ke `console.error` sebelum `toErrorResponse()`.
- `src/db/index.ts` lazy (`getDb()`), dan perubahan perilaku kode lainnya.
- Impor relatif di `src/app/**`, `src/db/**`, `scripts/**`, `e2e/**`.
- Merapikan format Prettier (item tersendiri di `STATUS.md`).
- `CLAUDE.md` — tidak memuat aturan impor relatif.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `vitest.config.ts`, `eslint.config.mjs`, `src/lib/module-boundary.test.ts`, `src/modules/README.md`
- Baris impor (statis dan dinamis) di `src/modules/**`, `src/components/**`, `src/lib/**` — hanya baris impor

## Selesai jika
- [ ] `git grep -nE '(from |import\()"\.\./' -- src/modules src/components src/lib` hanya menyisakan dua impor ke luar `src/` (`../../eslint.config.mjs`, `../../scripts/set-role`) dan potongan kode di dalam string `module-boundary.test.ts`. Output lengkapnya ditempel di PR.
- [ ] Di luar empat berkas di atas, diff hanya baris impor — perintah ini kosong (output ditempel di PR):
  ```
  git diff -U0 origin/main -- src ':!src/lib/module-boundary.test.ts' ':!src/modules/README.md' | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '(from |import\()"'
  ```
- [ ] `npm run check` hijau: 460 tes lama ditambah tes aturan baru.
- [ ] Mutasi, masing-masing dikembalikan, dengan output di PR. Bila sebuah mutasi tidak merah, cari dulu lapis yang menutupinya sebelum menyimpulkan tes lemah.
  - M1: keluarkan `src/lib/auth.ts` dari `ignores` blok baru → `npm run lint` merah tepat di `src/lib/auth.ts` (`no-restricted-syntax`, impor dinamis). Terbukti di sandbox 30 Okt.
  - M2: hapus pola queries dari blok baru → tes "`@/modules/user/queries` dari `src/app`" merah.
  - M3: hapus aturan `no-restricted-syntax` → kedua tes impor dinamis merah.
  - M4: hapus `allowTypeImports` → `npm run lint` merah di `src/lib/ratelimit.ts` dan `src/lib/rbac.integration.test.ts` (`import type … "@/db/client"`). Terbukti di sandbox 30 Okt.
  - M5: hapus alias dari `vitest.config.ts` → `npm run test` merah (resolusi `@/` gagal).

## Sebelum membuka PR
- Prasyarat e2e: Docker menyala, lalu `npm run e2e:db`.
- Checkout utama boleh dipakai bila tidak ada sesi lain; pemilik tidak menjalankan `npm run dev` di checkout itu selama sesi.
- Staging per nama berkas atau direktori yang diizinkan (`git add vitest.config.ts eslint.config.mjs src/modules src/components src/lib`), bukan `git add -A`.
- Sebut di PR jumlah berkas dan baris impor yang berubah (simulasi: 139 baris di 62 berkas, ditambah empat berkas konfigurasi/dokumentasi).
- Setelah push: cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm ci` · `npm run check` · `npm run build` · `npm run e2e` · kedua perintah di "Selesai jika"

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Output perintah diff di PR kosong, dan sekilas di "Files changed": selain empat berkas di atas, yang berubah hanya baris impor.

## Catatan keputusan
- Kerjakan di antara kartu, tanpa branch kartu lain yang terbuka: kartu ini menyentuh banyak berkas.
- **Impor dinamis ikut dibatasi (30 Okt).** `no-restricted-imports` hanya memeriksa deklarasi `import`/`export … from`. Tanpa `no-restricted-syntax`, `await import("@/db")` dari page mana pun lolos lint — pola lazy-load yang sama dengan `auth.ts`.
- **Batas hanya `src/**` (30 Okt).** `scripts/` dan `e2e/` adalah titik masuk CLI/harness yang membuat koneksi sendiri, setara titik komposisi; membatasinya hanya menambah daftar izin tanpa melindungi kode aplikasi.
- **Prettier tidak dijalankan (30 Okt).** Format massal adalah keputusan terpisah agar diff kartu ini tetap bisa diperiksa sebagai "hanya baris impor".
