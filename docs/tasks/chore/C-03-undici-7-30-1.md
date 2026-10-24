# C-03 · undici 7.30.1 (tambalan GHSA-xjj6, GHSA-4qv8, GHSA-f72v)

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | PR #70. Independen dari C-02 (jangan dikerjakan paralel di checkout yang sama) |
| **Mulai paling cepat** | Jumat 30 Okt 2026 — undici 7.30.1 rilis 15 Okt 14.18 UTC, genap 14 hari 29 Okt 21.18 WIB |
| **Tenggat keras** | Merge paling lambat **Minggu 1 Nov**. Ketiga entri undici `expires` 2026-11-01 → gate merah Senin 2 Nov 07.00 WIB |
| **Branch** | `f0/c-03-undici-7-30-1` |

> **Dibuat 24 Okt 2026** di Claude chat, ditinjau terhadap `main` `2283dc5`. Hasil lockfile dan gate di bawah sudah disimulasikan pada tanggal itu.

## Tujuan
Menutup tiga advisory undici 7.30.0 — GHSA-xjj6-f33q-929c (high, DoS), GHSA-4qv8-2p9j-2685 (moderate, DoS memori), GHSA-f72v-6w45-q472 (moderate, bypass Subresource Integrity) — sebelum pengecualiannya kedaluwarsa.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `.github/audit-exceptions.json`

## Kerjakan

### 1. Upgrade
```
npm update undici --before=2026-10-16
```
Hasil yang diharapkan: satu entri lockfile, `node_modules/undici` 7.30.0 → 7.30.1. `package.json` tidak berubah, karena undici bukan dependensi langsung.

Pemakai undici di tree ini: `shadcn`, `@shadcn/registry`, `jsdom` (lingkungan Vitest), dan `@dotenvx/dotenvx`. Semuanya berbagi satu salinan. Tidak satu pun dibundel ke aplikasi, tetapi `jsdom` dipakai tes unit. Kalimat "hanya berada di rantai CLI shadcn" di `reason` entri lama kurang tepat; koreksi ini cukup disebut di PR, karena entrinya dihapus.

### 2. Hapus pengecualian
Hapus ketiga entri `undici` dari `.github/audit-exceptions.json`. Output gate: OK, tidak ada temuan `undici`, dan tanpa catatan "exceptions not referenced".

## Bukan lingkup tugas ini
- next, shadcn, body-parser, zod (C-01, C-02, C-04).
- `scripts/check-audit.mjs`.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `package-lock.json`, `.github/audit-exceptions.json`

## Selesai jika
- [ ] Lockfile dibandingkan dengan `origin/main` per entri (versi + integrity): hanya undici 7.30.0 → 7.30.1, dengan tanggal rilis disebut di PR.
- [ ] `node scripts/check-audit.mjs` OK tanpa entri undici.
- [ ] Seluruh tes unit hijau (jsdom memakai undici).

## Sebelum membuka PR
- Kerjakan di worktree sendiri; jangan menjalankan `npm run e2e` bersamaan dengan sesi lain (port 3100).
- Setelah push: cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm ci` · `npm run check` · `npm run build` (env dummy CI) · `npm run e2e` · `node scripts/check-audit.mjs`

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.

## Catatan keputusan
- `--before=2026-10-16` menyertakan 7.30.1 (15 Okt). Rentang pemakai (`^7.11.0`, `^7.25.0`, `^7.29.0`) semuanya terpenuhi 7.30.1.
