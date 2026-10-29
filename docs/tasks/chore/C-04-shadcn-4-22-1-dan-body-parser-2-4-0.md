# C-04 · shadcn 4.22.1 + body-parser 2.4.0 (pengecualian audit habis)

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | C-01, C-02, C-03 di-merge |
| **Mulai paling cepat** | Jumat 6 Nov 2026 — body-parser 2.4.0 rilis 22 Okt 11.39 UTC, genap 14 hari 5 Nov 18.39 WIB; shadcn 4.22.1 rilis 18 Okt |
| **Tenggat keras** | Merge paling lambat **Minggu 8 Nov**. Entri zod, body-parser, deepmerge, dan systeminformation `expires` 2026-11-08 → gate merah Senin 9 Nov 07.00 WIB |
| **Branch** | `f0/c-04-shadcn-body-parser` |

> **Dibuat 24 Okt 2026** di Claude chat, ditinjau terhadap `main` `2283dc5`. Hasil lockfile dan gate di bawah sudah disimulasikan pada tanggal itu, di atas hasil C-01–C-03.
> **Diperbarui 28 Okt 2026:** advisory deepmerge GHSA-gcqx-w48m-w2h4 (low, tanpa versi tambalan) dipublikasikan setelah 26 Okt. Selama shadcn masih high oleh zod bersarang, rantai deepmerge membuat `shadcn` dan `@shadcn/registry` blocking, jadi diberi entri tanpa `soakUntil` yang dihapus di kartu ini (PR chore 28 Okt). Disimulasikan ulang 28 Okt di atas C-02 dan C-03: 14 entri lockfile yang sama, gate OK dengan `[]`.
>
> **Diperbarui 29 Okt 2026:** dua advisory systeminformation (GHSA-3f7j-7jwc-fxfj high, GHSA-4vjg-vx72-qq4g low) mulai memblokir gate 29 Okt. Tambalannya, 5.33.16, sudah ada di daftar entri lockfile kartu ini (ikut naik saat shadcn 4.22.1 dipasang), jadi tidak ada perintah tambahan. Kedua entrinya (`soakUntil` 2026-11-02, `expires` 2026-11-08) dihapus di langkah 2. Disimulasikan ulang 29 Okt di atas C-02 dan C-03: 14 entri lockfile yang sama, gate OK dengan `[]`.

## Tujuan
Menutup dua advisory terakhir: zod GHSA-mrhx-c7xc-m3w5 untuk salinan zod 3.25.76 yang bersarang di shadcn, dan body-parser GHSA-27r3-jxmh-p828. Begitu shadcn tidak lagi high, entri deepmerge GHSA-gcqx-w48m-w2h4 juga tidak diperlukan. Setelah kartu ini, `.github/audit-exceptions.json` kosong.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `.github/audit-exceptions.json`
- `src/app/globals.css` (impor `shadcn/tailwind.css`)

## Kerjakan

### 1. Upgrade
```
npm install shadcn@4.22.1 --save-exact --before=2026-10-23
npm update body-parser --before=2026-10-23
```
Hasil yang diharapkan (14 entri lockfile):
- **Langsung:** `shadcn` 4.21.4 → 4.22.1 dan entri root.
- **Dibawa shadcn 4.22.1:**
  - `@shadcn/registry` 0.1.3 → 0.2.0.
  - Salinan `shadcn/node_modules/zod` dan `@shadcn/registry/node_modules/zod` (3.25.76) **hilang**, karena shadcn sekarang memakai zod 4 (dedupe ke zod langsung 4.6.6).
  - `browserslist` 4.29.1 → 4.29.4, karena shadcn 4.22.1 meminta `^4.29.3`. Ikut naik bersamanya: `caniuse-lite` 1.0.30001812 → 1.0.30001819, `electron-to-chromium` 1.5.439 → 1.5.463, `baseline-browser-mapping` 2.11.26 → 2.11.31, `node-releases` 2.0.57 → 2.0.60, `update-browserslist-db` 1.3.3 → 1.3.4.
  - `systeminformation` 5.33.13 → 5.33.16 (rilis 19 Okt; menutup GHSA-3f7j-7jwc-fxfj dan GHSA-4vjg-vx72-qq4g).
- **body-parser:** 2.3.0 → 2.4.0, beserta `qs` 6.16.0 → 6.16.1.

Entri di luar daftar ini wajib dijelaskan di PR, termasuk dependensi mana yang memaksanya.

### 2. Hapus pengecualian
Hapus entri `zod`, `body-parser`, `deepmerge`, dan kedua entri `systeminformation`, sehingga `.github/audit-exceptions.json` menjadi `[]`. Output gate yang diharapkan: `0 excused, 0 blocking`, OK.

deepmerge 4.3.1 tetap ada di lockfile, karena shadcn 4.22.1 (juga 4.23.0) masih meminta `^4.3.1` dan belum ada versi tambalan. Temuannya low dan masuk hitungan baris "info/low/moderate" di output gate. Itu hasil yang diharapkan, jadi versi shadcn tetap tepat 4.22.1.

### 3. Tampilan
`dist/tailwind.css` di shadcn 4.21.4 dan 4.22.1 identik (dicek 24 Okt). Ulangi pengecekan itu dengan `diff` berkas sebelum dan sesudah install, lalu tulis hasilnya di PR. `browserslist`/`caniuse-lite` yang naik bisa menggeser target build CSS/JS, jadi e2e tata letak A-19b menjadi pengaman utama di sini.

## Bukan lingkup tugas ini
- `npx shadcn add/diff` atau memperbarui komponen `src/components/ui/`.
- `scripts/check-audit.mjs`.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `package.json`, `package-lock.json`, `.github/audit-exceptions.json`

## Selesai jika
- [ ] Lockfile dibandingkan dengan `origin/main` per entri (versi + integrity): 14 entri di atas, semua versi baru dirilis ≤ 22 Okt (tanggal disebut di PR).
- [ ] `npm ls zod` → tidak ada lagi zod 3.x.
- [ ] `.github/audit-exceptions.json` = `[]`, dan gate OK dengan 0 excused.
- [ ] `shadcn/tailwind.css` identik sebelum dan sesudah.

## Sebelum membuka PR
- Kerjakan di worktree sendiri; jangan menjalankan `npm run e2e` bersamaan dengan sesi lain (port 3100).
- Jalankan e2e sekali dengan `E2E_SCREENSHOT_DIR=~/binzi-c04-screenshots` dan sebutkan jumlah berkasnya di PR.
- Setelah push: cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm ci` · `npm run check` · `npm run build` (env dummy CI) · `npm run e2e` · `node scripts/check-audit.mjs`

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Unggah beberapa screenshot C-04 ke Claude chat untuk dibandingkan dengan screenshot A-19b (`/`, `/masuk`, `/belajar`, `/cms` di w360 dan w1280).

## Catatan keputusan
- Pembaruan `browserslist` dan kawan-kawan dipaksa rentang shadcn 4.22.1, bukan pilihan bebas. Karena masuk lewat `--before`, semuanya lolos soak.
- Setelah kartu ini tidak ada lagi pengecualian aktif. Advisory baru berikutnya kembali mengikuti pola PR #70: pengecualian ber-`soakUntil` bila tambalannya belum 14 hari.
