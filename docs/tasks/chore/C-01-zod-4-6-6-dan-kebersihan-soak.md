# C-01 · zod 4.6.6 + kebersihan soak

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | PR #70 (gerbang audit `soakUntil`), PR #69 |
| **Mulai paling cepat** | Senin 26 Okt 2026 — zod 4.6.6 rilis 11 Okt 16.18 UTC, genap 14 hari 25 Okt 23.18 WIB |
| **Tenggat** | Tidak ada tebing gate: entri zod sengaja tetap sampai C-04 |
| **Branch** | `f0/c-01-zod-soak` |

> **Dibuat 24 Okt 2026** di Claude chat, ditinjau terhadap `main` `2283dc5`. Semua hasil yang diharapkan di bawah sudah disimulasikan (`npm install --package-lock-only` + `npm audit` + gate) pada tanggal itu.

## Tujuan
Menutup advisory zod GHSA-mrhx-c7xc-m3w5 (DoS memori saat validasi koleksi besar) untuk **zod langsung** yang dipakai validasi form & API, lalu merapikan tiga sisa sesi 24 Okt: worktree sesi paralel yang memerahkan `npm run check`, override vite yang tidak lagi dibutuhkan sejak kebijakan `--before`, dan Dependabot yang belum mengenal soak 14 hari.

## Baca dulu (hanya ini)
- `CLAUDE.md` (aturan "Versi baru dan lockfile")
- `.github/audit-exceptions.json` dan komentar kepala `scripts/check-audit.mjs`
- `eslint.config.mjs` (blok `globalIgnores`)
- `package.json` (`overrides`), `.github/dependabot.yml`

## Kerjakan

### 1. zod langsung → tepat 4.6.6
```
npm install zod@4.6.6 --save-exact --before=2026-10-12
```
Hasil yang diharapkan: `package.json` zod `4.6.6`; lockfile hanya `node_modules/zod` 4.6.5 → 4.6.6 (ditambah entri root). Salinan `shadcn/node_modules/zod` dan `@shadcn/registry/node_modules/zod` 3.25.76 **tetap** — keduanya hilang di C-04.

Entri GHSA-mrhx-c7xc-m3w5 **tidak dihapus**: gate masih melaporkan zod lewat salinan bersarang ("update shadcn to 4.22.1"). Perbarui kalimat `reason` entri itu: zod langsung sudah 4.6.6 (C-01), sisa temuan hanya salinan bersarang. `soakUntil` dan `expires` tidak berubah.

### 2. ESLint mengabaikan `.claude/**`
Tambah `".claude/**"` ke `globalIgnores` dengan komentar singkat: worktree sesi paralel Claude Code (`.claude/worktrees/*`) adalah checkout penuh, dan flat config ESLint ikut melint folder bertitik (tsconfig `**/*.ts` dan Vitest `src/**` tidak). Satu-satunya berkas ter-track di `.claude/` adalah `settings.json`.

Bukti: `git worktree add .claude/worktrees/uji-eslint HEAD` → `npm run lint` hijau → `git worktree remove .claude/worktrees/uji-eslint`.

### 3. Lepas override vite
Hapus `"vite": "8.3.4"` dari `overrides`, lalu:
```
npm install --package-lock-only --ignore-scripts --before=2026-10-12
```
Hasil yang diharapkan: **tidak ada versi lockfile yang berubah** — vite tetap 8.3.4 dan memenuhi peer vitest (`^6 || ^7 || ^8`). Override dipasang PR #70 sebelum kebijakan `--before` ada; sekarang `--before` yang menjaga soak. Bila ada versi yang berubah, berhenti dan laporkan.

### 4. Cooldown Dependabot
Di blok `npm` `.github/dependabot.yml` tambahkan cooldown 14 hari agar PR versi dari Dependabot tidak mengusulkan rilis yang belum lolos soak. Cocokkan nama kunci dengan dokumentasi resmi GitHub (opsi `cooldown`, `default-days`) dan tulis tautannya di PR. Blok `github-actions` tidak diubah.

## Bukan lingkup tugas ini
- Menghapus entri zod (C-04), upgrade next/undici/shadcn/body-parser (C-02–C-04).
- Mengubah `scripts/check-audit.mjs`.
- `npm update`, `npm audit fix`, atau perubahan lockfile lain.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `package.json`, `package-lock.json`
- `.github/audit-exceptions.json` (hanya `reason` entri zod)
- `eslint.config.mjs`, `.github/dependabot.yml`

## Selesai jika
- [ ] Lockfile dibandingkan dengan `origin/main` per entri (versi + integrity): hanya zod 4.6.5 → 4.6.6 + root, dengan tanggal rilis zod 4.6.6 disebut di PR.
- [ ] `node scripts/check-audit.mjs` OK — zod tetap ter-excuse lewat salinan bersarang.
- [ ] `npm run lint` hijau walau ada worktree di `.claude/worktrees/`.
- [ ] `overrides` tanpa vite, `npm ls vite` → 8.3.4.
- [ ] `dependabot.yml` memuat cooldown 14 hari untuk npm.

## Sebelum membuka PR
- Kerjakan di worktree sendiri; jangan menjalankan `npm run e2e` bersamaan dengan sesi lain (port 3100).
- Setelah push: cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm ci` · `npm run check` · `npm run build` (env dummy CI) · `npm run e2e` · `node scripts/check-audit.mjs`
- Penangkap CSP di e2e tetap hanya mengecualikan probe eval zod; bila zod 4.6.6 mengubah perilaku probe itu, laporkan.

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Preview (login Vercel): `/daftar` dengan email tak valid dan sandi pendek → pesan validasi tampil.
- [ ] Setelah merge: GitHub → Insights → Dependency graph → Dependabot tidak menampilkan error konfigurasi.

## Catatan keputusan
- Entri zod tidak dihapus karena rentang advisory `<4.6.6` mencakup 3.x dan tidak ada tambalan 3.x. Salinan bersarang baru hilang saat shadcn ≥ 4.22.0 (C-04).
- Cooldown Dependabot hanya berlaku untuk PR versi. PR keamanan Dependabot tetap bisa mengusulkan rilis segar — cek tanggal rilisnya sebelum merge.
