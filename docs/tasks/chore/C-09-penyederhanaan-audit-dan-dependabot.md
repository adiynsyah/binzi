# C-09 · Penyederhanaan audit & Dependabot

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | C-04 di-merge (✅ 6 Nov, PR #111: `.github/audit-exceptions.json` = `[]`, shadcn 4.22.1). Sebelum C-08b |
| **Mulai paling cepat** | Setelah demo 20 Nov 2026 (keputusan 3 Nov no. 5), kecuali muncul advisory yang memblokir PR. Kartu ini tidak memasukkan versi baru ke lockfile, jadi tidak ada tanggal soak |
| **Branch** | `f0/c-09-penyederhanaan-audit` |

> **Dibuat 3 Nov 2026** di Claude chat. Disimulasikan di atas `main` `9fff118` ditambah hasil simulasi C-04 (lockfile 14 entri, `audit-exceptions.json` = `[]`). Semua angka di kartu ini berasal dari simulasi itu. **Tinjau ulang terhadap `main` setelah C-04 di-merge**, karena lockfile asli C-04 menggantikan simulasinya.
>
> **Masuk repo 6 Nov 2026, ditinjau ulang terhadap `main` `d3eab7f`** (C-04 asli). Perintah langkah 1 tetap tidak mengubah versi, `integrity`, maupun `resolved` entri mana pun. `npm audit --omit=dev` tetap 16 temuan di `main` (2 low, 14 moderate) dan 7 di branch (semuanya moderate). Audit penuh di `main` kini 23 temuan (2 low, 21 moderate), bukan 32, jadi angka M1 dan catatan keputusan disesuaikan. Jumlah entri yang hanya berubah flag tidak dihitung ulang: npm 10 di sandbox Claude chat juga mengubah field `libc`, jadi angkanya tidak sebanding dengan npm 11. **Tinjau sekali lagi terhadap `main` sebelum sesi**, karena angka audit bisa bergeser tanpa commit.
>
> **Latar:** sejak 23 Okt ada sekitar 8 PR/kartu audit. Hanya next (PR #70, C-02) dan zod langsung (C-01) yang menyentuh kode yang berjalan untuk pengguna. Sisanya — zod bersarang, deepmerge, systeminformation, minimatch, undici — masuk lewat rantai CLI `shadcn`, yang hanya dipakai saat development dan saat CSS di-build.

## Tujuan
Gate audit hanya memblokir dependensi produksi, dan Dependabot mengirim satu PR gabungan per bulan tanpa usulan versi major. Sekalian tiga celah kecil di setelan agent ditutup: daftar larangan `.env`, auto-memory, dan klaim hook atribusi yang tidak pernah ada.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `scripts/check-audit.mjs` (komentar kepala, `runAudit()`, baris ringkasan output)
- `.github/dependabot.yml`, `.github/workflows/ci.yml` (langkah "Audit dependencies")
- `.claude/settings.json`, `.gitignore` (komentar baris 40)
- `package.json`, `src/app/globals.css` baris 1–3
- `docs/tasks/README.md` bagian "Commit tanpa atribusi AI"

## Kerjakan

### 1. `shadcn` → `devDependencies`
```
npm install shadcn@4.22.1 --save-dev --save-exact --before=2026-10-23
```
- `package.json`: `shadcn` pindah dari `dependencies` ke `devDependencies`, tetap tepat `4.22.1`.
- Lockfile: **tidak ada** entri yang berubah versi, `integrity`, atau `resolved`. Yang berubah hanya flag `dev`/`devOptional`. Simulasi dengan npm 10 menghasilkan 303 entri flag; npm 11 bisa berbeda, jadi sebut jumlahnya di PR. Bila ada entri yang berubah versi atau integrity, berhenti dan laporkan.
- Kenapa build tetap aman: `globals.css` mengimpor `shadcn/tailwind.css` saat build. `tailwindcss` dan `@tailwindcss/postcss` sudah lama di `devDependencies` dan dipakai build di CI maupun Vercel, jadi Vercel memang memasang `devDependencies`.

### 2. Gate audit: hanya pohon produksi
Di `scripts/check-audit.mjs` hanya ada tiga perubahan.

**a.** `runAudit()`: argumen `spawnSync` menjadi `["audit", "--json", "--omit=dev"]`.

**b.** Tepat sebelum `console.log` ringkasan `high/critical findings`, tambahkan:
```js
console.log(
  "audit:check — scope: production dependencies (npm audit --omit=dev)",
);
```

**c.** Komentar kepala. Butir pertama baru di bawah `Rules:`:
```
 *   - Scope: the production tree only (`npm audit --omit=dev`). Packages
 *     used only to develop or build the app (CLIs, linters, test tools)
 *     live in devDependencies and are not audited here; they are updated
 *     by the monthly grouped Dependabot PR, and GitHub still raises
 *     Dependabot alerts and security-update PRs for them. npm keeps
 *     `devOptional` packages in the --omit=dev tree — optional peers of a
 *     production package (e.g. vitest and drizzle-kit via better-auth) —
 *     so those remain audited.
```
Lalu kalimat `Any other high advisory on the chain still fails the gate.` diganti agar sesuai perilaku kode (keputusan 3 Nov: perilaku fail-closed dipertahankan, hanya komentarnya yang diluruskan):
```
 *     GHSA-vfj7-8cjw-p6xm). Every advisory on the chain needs its own
 *     active exception, whatever its severity: a low or moderate advisory
 *     without one fails the gate too (fail-closed on purpose).
```
`evaluate()` dan logika lain **tidak** diubah.

Di `.github/workflows/ci.yml`, ubah komentar langkah "Audit dependencies" saja:
```yaml
      # npm audit of the production tree (--omit=dev) with documented,
      # expiring exceptions; entries may carry a soak window and expiry
      # (scripts/check-audit.mjs).
```

Output gate yang diharapkan (simulasi 3 Nov):
```
audit:check — scope: production dependencies (npm audit --omit=dev)
audit:check — high/critical findings: 0 excused, 0 blocking
(7 info/low/moderate finding(s) are below the high threshold and do not fail this gate)
audit:check — OK
```
Ketujuh temuan moderate itu ada di vitest, `@vitest/mocker`, drizzle-kit, `@esbuild-kit/*`, esbuild, dan fast-uri. Mereka tetap teraudit karena npm menandai vitest dan drizzle-kit `devOptional` (peer opsional better-auth). Itu benar dan diharapkan. Bila angkanya berbeda atau ada temuan blocking, berhenti dan tempel output lengkapnya.

### 3. Dependabot bulanan, satu grup per ekosistem
Ganti seluruh isi `.github/dependabot.yml` persis dengan:
```yaml
# Dependabot configuration (card A-03, PRD §12.5; simplified in C-09).
# One grouped version-update PR per ecosystem per month.

version: 2
updates:
  # npm dependencies (package.json / package-lock.json).
  # - Version-update PRs wait 14 days after a release (CLAUDE.md soak rule).
  # - Majors are never proposed here; each major upgrade gets its own card.
  #   `update-types` in an ignore rule applies to version updates only.
  # - Security updates ignore the schedule, the group, the cooldown, and
  #   the major rule: they still open right away as separate PRs.
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: monthly
    cooldown:
      default-days: 14
    groups:
      npm-bulanan:
        applies-to: version-updates
        patterns:
          - "*"
    ignore:
      - dependency-name: "*"
        update-types:
          - version-update:semver-major

  # GitHub Actions used by .github/workflows/*.
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
    groups:
      actions-bulanan:
        patterns:
          - "*"
```

### 4. Setelan agent
`.claude/settings.json` menjadi persis:
```json
{
  "attribution": {
    "commit": "",
    "pr": ""
  },
  "permissions": {
    "deny": [
      "Read(./.env)",
      "Read(./.env.local)",
      "Read(./.env.*.local)",
      "Read(./.env.local.*)",
      "Read(./.env.binzi-dev)",
      "Edit(./.env)",
      "Edit(./.env.local)",
      "Edit(./.env.*.local)",
      "Edit(./.env.local.*)",
      "Edit(./.env.binzi-dev)"
    ]
  },
  "autoMemoryEnabled": false
}
```
Claude Code bisa meminta izin sebelum mengubah berkas ini. Itu wajar; pemilik yang menyetujui.

`CLAUDE.md`, tiga tempat:
- **"Aturan keamanan"**, butir larangan `.env`, diganti menjadi:
  ```
  - JANGAN membaca, menampilkan, atau mengubah .env, .env.local, .env.*.local, .env.local.* (salinan cadangan), atau .env.binzi-dev — termasuk lewat perintah shell seperti cat/grep. Jika butuh nilai env, minta pemilik produk mengisinya sendiri.
  ```
- **"Versi baru dan lockfile"**: tambahkan butir baru setelah butir `soakUntil`:
  ```
  - Gate audit hanya memeriksa dependensi produksi (`npm audit --omit=dev`). Paket yang hanya dipakai untuk mengembangkan atau mem-build aplikasi (CLI, linter, alat tes) masuk `devDependencies`. Dependabot membuka satu PR gabungan per bulan dan tidak pernah mengusulkan versi major — upgrade major selalu lewat kartu tersendiri.
  ```
- **Bagian baru** tepat sebelum `## Alur Git (agent yang menjalankan)`:
  ```
  ## Memori agent
  - Auto-memory Claude Code dimatikan untuk repo ini (`autoMemoryEnabled: false` di `.claude/settings.json`). Aturan agent hanya yang tertulis di `CLAUDE.md` dan kartu tugas.
  - Pelajaran yang layak menjadi aturan ditulis sebagai usulan di bagian "Keputusan & asumsi" ringkasan PR. Pemilik produk yang memutuskan apakah usulan itu masuk `CLAUDE.md`.
  ```

### 5. Klaim hook atribusi diluruskan
`.githooks/commit-msg` tidak pernah di-commit (dicek 2 Nov di seluruh riwayat), tetapi skrip `prepare` mengarahkan `core.hooksPath` ke folder itu dan dua dokumen menyebut hook menegakkan aturan. Keputusan 3 Nov: dokumen diluruskan, hook tidak dibuat.
- `package.json`: hapus skrip `prepare` (beserta koma di baris `check` sebelumnya).
- `CLAUDE.md`, butir "Tanpa atribusi AI": kalimat terakhirnya (yang menyebut hook `.githooks/commit-msg` dan `--no-verify`) diganti menjadi
  ```
  Pengaturan `attribution` di `.claude/settings.json` menegakkan ini untuk commit dan PR yang dibuat Claude Code; jangan menambahkan atribusi secara manual.
  ```
- `docs/tasks/README.md`, paragraf di bawah "Commit tanpa atribusi AI", diganti menjadi
  ```
  Repo memakai dua lapis agar pesan commit & PR bersih dari tulisan "Generated with …" / `Co-Authored-By` AI: pengaturan `attribution` di `.claude/settings.json` dan aturan di `CLAUDE.md`. Tidak ada hook git — tetap lirik sekilas pesan commit dan isi PR saat meninjau PR.
  ```
- `.gitignore` baris 40 menjadi
  ```
  # local-only Claude Code settings (project settings.json stays tracked)
  ```

## Bukan lingkup tugas ini
- Logika `evaluate()`. Rantai low/moderate tetap memblokir (fail-closed, keputusan 3 Nov).
- Memindahkan paket lain ke `devDependencies`. Contoh: `tw-animate-css` juga hanya CSS, tetapi tanpa dependensi dan tidak pernah muncul di audit.
- Mengubah versi paket apa pun.
- Perintah `@dependabot` dan PR Dependabot (langkah pemilik setelah merge).
- Membuat `.githooks/`, format Prettier, rujukan ClickUp, `docs/STATUS.md`, dan kartu lama di `docs/tasks/fase-0/` yang menyebut hook (A-01).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `package.json`, `package-lock.json`
- `scripts/check-audit.mjs`
- `.github/dependabot.yml`, `.github/workflows/ci.yml` (komentar langkah audit saja)
- `.claude/settings.json`, `.gitignore` (komentar baris 40 saja)
- `CLAUDE.md` (empat tempat di atas), `docs/tasks/README.md` (satu paragraf)

## Selesai jika
- [ ] `package.json` hanya punya dua perubahan: `shadcn` di `devDependencies` (tepat 4.22.1), dan `prepare` hilang.
- [ ] Lockfile dibandingkan dengan `origin/main` per entri: 0 entri berubah versi, integrity, atau `resolved`. Jumlah entri yang hanya berubah flag disebut di PR.
- [ ] Bukti dua arah dari kunci `vulnerabilities` di `npm audit --omit=dev --json`. Di `main`: memuat `shadcn`, `deepmerge`, dan `minimatch` (simulasi: 16 temuan). Di branch: ketiganya tidak ada (7 temuan).
- [ ] Gate di branch mencetak empat baris persis seperti di langkah 2.
- [ ] `git diff origin/main -- scripts/check-audit.mjs` hanya berisi argumen `--omit=dev`, satu `console.log` scope, dan komentar.
- [ ] `.github/dependabot.yml` dan `.claude/settings.json` identik dengan blok kartu. Cek dengan `diff` terhadap salinan blok di berkas sementara di luar repo.
- [ ] `git grep -n "githooks\|hooksPath" -- ':!docs/tasks/fase-0' ':!docs/tasks/chore' ':!docs/STATUS.md'` tidak mencetak apa pun.
- [ ] CSS hasil build identik. Catat sha256 setiap berkas `.next/static/css/*.css` dari build `main`, lalu bandingkan dengan build branch (keduanya dengan env dummy CI). Bila berbeda, tempel `diff` isinya. Kerjakan ini sebelum e2e, karena build e2e menimpa `.next`.

## Mutasi wajib
Commit lokal dulu, lalu `git restore` setelah setiap mutasi (pelajaran (uuuu)).
- **M1:** hapus `"--omit=dev"` dari `runAudit()`. Baris hitungan gate harus menjadi 23 temuan di bawah high (angka `main` 6 Nov), bukan 7. Kembalikan.

## Sebelum membuka PR
- Prasyarat e2e: `npm run e2e:db` dengan Docker menyala.
- `npm ls shadcn` dijalankan setelah `npm ci`, bukan setelah `npm install`.
- Staging per nama berkas (sepuluh berkas di daftar "Berkas yang boleh"). Jangan `git add -A` atau `git add .`.
- Setelah push: cek CI (`gh pr checks`, job `ci` dan `e2e`), lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm ci` · `npm ls shadcn` · `npm run check` · `npm run build` (env dummy CI) · `npm run e2e` · `node scripts/check-audit.mjs`

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Preview Vercel berstatus Ready. Buka `/masuk` lewat URL branch (`binzi-git-…` dari komentar bot Vercel): font, warna, dan tombol sama seperti di Production. Ini bukti build Vercel tetap menemukan `shadcn/tailwind.css` dari `devDependencies`.
- [ ] Di tab "Files changed", isi `.claude/settings.json` dan `.github/dependabot.yml` sama dengan blok kartu.

## Langkah pemilik setelah merge
1. Jalankan `git config --unset core.hooksPath` di mesinmu. Ini sisa skrip `prepare` yang sudah dihapus.
2. Buka Insights → Dependency graph → tab "Dependabot" dan pastikan tidak ada error konfigurasi. Dependabot biasanya langsung berjalan setelah berkas konfigurasinya berubah. Bila dalam sekitar 1 jam belum ada PR gabungan npm, buka "Recent update jobs" pada baris `package.json` lalu pilih "Check for updates".
3. Di PR gabungan npm pertama, tulis komentar `@dependabot unignore *`.
   - Perintah ini menghapus semua ignore lama sekaligus, termasuk yang keliru untuk vitest 5.x, radix-ui 1.x, dan react-dom 19.x (PR #95, #97, #98).
   - Ignore major yang disengaja (typescript, eslint, `@types/node`) tidak ikut terbuka, karena kini dijaga `dependabot.yml`.
   - Dependabot akan menutup PR itu dan membuka PR baru.
4. Di PR baru, tulis `@dependabot show react-dom ignore conditions`. Hasil yang benar: hanya kondisi `version-update:semver-major` dari `dependabot.yml`.
5. Tinjau PR gabungan seperti PR Dependabot biasa sebelum merge: bandingkan lockfile per entri, dan pastikan umur setiap versi baru ≥ 14 hari, termasuk dependensi transitif.
6. Di sesi Claude Code berikutnya, `/memory` menunjukkan auto-memory mati, dan folder `~/.claude/projects/-Users-adiyansyah-Project-React-binzi-new/memory` tidak muncul lagi.

## Catatan keputusan
- **Gate hanya produksi (rencana 2 Nov).** Simulasi 3 Nov di atas hasil C-04: `npm audit --omit=dev` turun dari 16 temuan (shadcn masih di `dependencies`) ke 7, semuanya moderate. Audit penuh tetap tanpa high: 32 temuan (2 low, 30 moderate) di simulasi 3 Nov, 23 temuan (2 low, 21 moderate) di `main` `d3eab7f` 6 Nov.
- **Rantai low/moderate tetap fail-closed (keputusan 3 Nov, mengubah rencana 2 Nov).** Kedua kejadiannya (deepmerge 28 Okt, minimatch 2 Nov) datang dari rantai CLI shadcn yang tidak lagi diaudit. Mengubah `evaluate()` butuh tes fixture untuk skrip yang sekarang tanpa tes, dan itu tidak sepadan. Ditinjau ulang bila pola itu muncul di dependensi produksi.
- **Hook atribusi diluruskan, tidak dibuat (keputusan 3 Nov).** Pengaturan `attribution` sudah menjaga commit tanpa hook; contohnya, pesan commit PR #101 bersih.
- **Major lewat `dependabot.yml`, bukan komentar.** Ignore lewat komentar tersimpan di GitHub dan tidak terlihat di repo. Pada usulan patch/minor, perintah itu justru mengunci major yang sedang dipakai (pelajaran (ssss)). Ignore berbasis rentang versi juga bisa ikut menahan security update paket itu. Selama belum di-unignore, gate tetap menangkap advisory high di radix-ui dan react-dom, karena keduanya dependensi produksi.
- **Auto-memory dimatikan (3 Nov).** Tujuh berkas memori di mesin pemilik diarsipkan: empat sudah ada di `CLAUDE.md`, tiga sudah basi (satu bertentangan dengan aturan port 3100).
