# A-04 · Design tokens, font & gaya dasar

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-01](A-01-scaffold-proyek-next-js-16.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `design-system` |
| **Judul ClickUp** | `[F0][Agent] A-04 Design tokens, font & gaya dasar` |

## Tujuan
Mengunci token visual sebelum komponen apa pun dibuat — penyebab inkonsistensi nomor satu pada UI buatan AI (§13.4).

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/design/handoff/TOKENS.md` (seluruhnya)
- `docs/design/screens/17a.md + 17a.png`
- `docs/design/screens/17c.md + 17c.png`

## Kerjakan
- `src/styles/tokens.css`: semua token warna TOKENS.md sebagai CSS variable, dipetakan ke `@theme` Tailwind v4 dengan nama peran (`text-muted`, `primary-tint`, dst.).
- Petakan variabel bawaan shadcn (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, …) **ke token BINZI**. Tidak ada nilai warna baru.
- Font via `next/font`: Lato 300/400/700/900 + italic 400, IBM Plex Mono 400/500. Utilitas `font-mono` = Plex Mono.
- Skala spasi (kelipatan 4), radius (14/16/8–10/999/18), tinggi kendali, bayangan menu & dialog, cincin fokus 2px `#1a1614` dengan jeda 3px, breakpoint (640/768/1024), lebar isi maks 1200.
- Gaya dasar: body 16px, `text-wrap: pretty` untuk paragraf, `prefers-reduced-motion` mematikan transisi/animasi.
- Skrip `scripts/check-hex.mjs` + npm script `lint:hex`: gagal bila ada literal hex di `src/` **di luar** `src/styles/tokens.css` dan folder ilustrasi hero (`src/components/public/hero-illustration/`). Tambahkan ke `npm run check` dan CI.

## Bukan lingkup tugas ini
- Komponen UI (A-05, A-06).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/styles/**`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `scripts/check-hex.mjs`
- `package.json`
- `.github/workflows/ci.yml`

## Selesai jika
- [ ] Semua token di TOKENS.md ada, dengan nama yang sama.
- [ ] Tidak ada bobot font 500/600/800 untuk Lato.
- [ ] `npm run lint:hex` lulus dan terbukti gagal bila hex ditambahkan di komponen.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run lint:hex`

## Verifikasi oleh kamu (sebelum merge)
- [ ] Bandingkan warna di halaman sementara dengan `17a.png`.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
