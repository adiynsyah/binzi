# A-01 · Scaffold proyek Next.js 16

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [H-01](H-01-repo-github-dan-dokumen-proyek.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `foundation` |
| **Judul ClickUp** | `[F0][Agent] A-01 Scaffold proyek Next.js 16` |

## Tujuan
Membuat kerangka proyek sesuai stack dan struktur folder PRD, dengan versi terkunci.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/09-rekomendasi-teknologi.md` (§9.2)
- `docs/prd/sections/10-arsitektur-system-design.md` (§10.2)

## Kerjakan
- Next.js **16.3.x** (App Router, TypeScript) dengan versi dipin **tanpa** `^`/`~` — minimal 16.3.7 bila sudah tersedia.
- TypeScript `strict: true` + `noUncheckedIndexedAccess`.
- Tailwind CSS v4 dan inisialisasi shadcn/ui (belum menambah komponen apa pun).
- ESLint + Prettier.
- Struktur folder persis §10.2: `src/app/(public)`, `(auth)`, `(learn)`, `(cms)`, `api/`, `src/modules/`, `src/components/{ui,public,learn,cms,shared}`, `src/db`, `src/lib`, `src/config`. Folder kosong diberi `.gitkeep`.
- `.nvmrc` berisi versi Node LTS yang memenuhi syarat minimum Next.js 16, dan `engines` di `package.json`.
- Script npm: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (Vitest, boleh 0 tes dulu), `format`, `check` (typecheck + lint + test).
- Halaman `/` sementara berisi teks "BINZI" saja.
- `.gitignore` lengkap.

## Bukan lingkup tugas ini
- Komponen UI, token warna, auth, database — ada tugasnya sendiri.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `package.json`
- `tsconfig.json`
- `next.config.ts`
- `eslint/prettier config`
- `src/**`
- `components.json`
- `.nvmrc`
- `.gitignore`

## Selesai jika
- [ ] `npm run check` dan `npm run build` lulus.
- [ ] Tidak ada dependensi selain yang disebut di §9.2 dan tooling di atas.
- [ ] Versi Next.js dipin dan tercatat di ringkasan PR.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Verifikasi oleh kamu (sebelum merge)
- [ ] Buka `package.json`: versi `next` tanpa `^`.
- [ ] Jalankan `npm run dev`, lalu buka `localhost:3000`.

## Catatan
- Kode ditulis untuk Next.js 16 (lihat aturan versi di CLAUDE.md), bukan pola Next.js 15.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
