# C-07 · Token kontras: tombol utama `primary-deep`, tautan merah, `text-subtle`

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | A-19b (`KNOWN_CONTRAST_FINDINGS` di `e2e/layout/axe.spec.ts`), C-06 di-merge. Sebelum C-08 dan S1-01 |
| **Tenggat** | Merge paling lambat **Kamis 5 Nov**: saat C-04 dikerjakan (Jum 6 – Min 8 Nov) tidak boleh ada branch kartu lain yang terbuka |
| **Branch** | `f0/c-07-kontras` |

> **Dibuat 24 Okt 2026** di Claude chat, ditinjau terhadap `main` `6580878`. Keputusan pemilik 24 Okt: **opsi A** — tombol merah bertuliskan putih memakai `primary-deep`.
>
> **Ditinjau ulang 2 Nov 2026** terhadap `main` `0f99496` dan disimulasikan di Claude chat: perubahan kode bagian 1–5 = 10 berkas `src`, 18 baris tambah / 14 hapus, tanpa satu pun baris di luar kelas/nilai warna; `tsc`, `eslint .`, `lint:hex`, dan Vitest 474 tes hijau (tanpa tes baru). Koreksi terhadap versi 24 Okt: axe hanya berjalan di project w360 dan w1280; kriteria `bg-primary` mengecualikan berkas tes; tes paritas `cn()` tidak bisa mendeteksi token **warna** yang lupa didaftarkan; `text-subtle` juga warna teks state disabled (keputusan pemilik: ikut menggelap); `forbidden.tsx` hanya kelas warna; enam berkas target belum rapi menurut Prettier.

## Tujuan
Menutup semua temuan kontras axe yang masih dicatat sebagai pengecualian di A-19b, sebelum S1 menambah layar baru. Ada tiga masalah, semuanya di bawah batas AA 4,5:1 untuk teks kecil:
- Teks putih di tombol `primary` `#f04030`: 3,83.
- Tautan merah kecil `text-primary`: 3,83 di putih, 3,52 di `fill-soft`.
- Teks `text-subtle` `#8a8378`: 3,24–3,75 di latar terang.

Kartu ini juga menetapkan aturan supaya masalah yang sama tidak muncul lagi di layar S1.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/design/handoff/TOKENS.md`
- `src/styles/tokens.css`
- `src/lib/utils.ts` + `src/lib/utils.test.ts` (daftar token `cn()` dan tes paritasnya)
- `src/emails/tokens.ts`, `src/emails/tokens.test.ts`, `src/emails/layout.ts`
- `src/components/ui/button-variants.ts`, `src/app/forbidden.tsx`
- `e2e/layout/axe.spec.ts`

## Sebelum mulai
- Docker menyala, lalu `npm run e2e:db`.
- `node scripts/check-audit.mjs` di `main` → `5 excused, 0 blocking`. Bila ada temuan blocking baru, **berhenti dan laporkan** — jangan diperbaiki di kartu ini.
- `npm run check` di `main` → 474 tes (baseline).

## Kerjakan

### 1. Token
| Token | Nilai | Keterangan |
|---|---|---|
| `--primary-deeper` (**baru**) | `#a8261a` | Hover tombol utama & tautan merah. Putih di atasnya 7,10 |
| `--text-subtle` | `#8a8378` → **`#706a61`** | surface 5,35 · surface-3 4,74 · fill-soft 4,92 · fill 4,66 · primary-tint 4,63 · surface-disabled 4,44 (lihat catatan) |
| `--primary` | tetap `#f04030` | Hanya untuk elemen **non-teks** (batas kontras non-teks 3:1; 3,83 lolos) |
| `--primary-deep` | tetap `#c42d1e` | Tombol utama, teks & tautan merah. Putih di atasnya 5,61 |

Langkah:
- `:root`: ubah nilai `--text-subtle`, tambah `--primary-deeper` tepat setelah `--primary-deep`, dan sesuaikan komentar `--primary`, `--primary-deep`, `--text-subtle` — tetap satu baris di belakang nilainya (komentar lama "ONLY small uppercase mono labels (3.8:1)" tidak berlaku lagi).
- `@theme`: tambah `--color-primary-deeper: var(--primary-deeper);` tepat setelah `--color-primary-deep`.
- `src/lib/utils.ts`: tambah `"primary-deeper"` tepat setelah `"primary-deep"` di `COLORS`. **Catatan:** tes paritas di `utils.test.ts` tidak akan merah bila baris ini lupa — `cn()` menggabung nama warna yang tidak terdaftar dengan benar (dibuktikan 2 Nov: menghapus baris ini → 17/17 tes tetap lolos). Pastikan lewat diff; jangan mengubah `utils.test.ts`.

Catatan `surface-disabled` 4,44: `text-subtle` juga warna teks state disabled di sekitar 12 komponen (tombol, input, chip, tab, item dropdown, pagination, checkbox, toggle). Menurut keputusan pemilik 2 Nov, teks disabled ikut menggelap — tidak ada token `text-disabled` terpisah. WCAG 1.4.3 mengecualikan komponen yang tidak aktif, dan axe-core 4.13.0 melewati elemen ber-`disabled` maupun ber-`aria-disabled="true"` (dicek di sumbernya), jadi nilai ini tidak memerahkan axe.

### 2. Tombol utama
- `button-variants.ts`, varian `primary`: `bg-primary-deep text-surface hover:bg-primary-deeper`.
- `src/app/forbidden.tsx`: **hanya kelas warna** — `bg-primary` → `bg-primary-deep`, `text-primary-foreground` → `text-surface`, tambah `hover:bg-primary-deeper`. Jangan diganti `buttonVariants` (ukuran `md` mengubah tinggi, padding, dan radius) dan jangan memperbaiki `min-svh` di berkas yang sama: tombol 403 harus identik ukuran & posisinya dengan screenshot A-19b. Halaman ini menunggu desain state error.
- Alias shadcn `--primary-foreground`/`--sidebar-primary` di `tokens.css` tidak diubah. Setelah langkah di atas, tidak ada komponen BINZI yang memakai `text-primary-foreground` (`forbidden.tsx` satu-satunya, dicek 2 Nov).

### 3. Tautan & teks merah
Delapan `text-primary` → `text-primary-deep`: `auth-panels.tsx` 1, `forgot-password-form.tsx` 2, `login-form.tsx` 1, `register-form.tsx` 4. Enam di antaranya punya `hover:text-primary-deep` → jadi `hover:text-primary-deeper`. Dua `<span>` Syarat & Ketentuan / Kebijakan Privasi di `register-form.tsx` tidak punya hover dan tidak diberi hover (bukan tautan).

Tidak ada teks merah di latar gelap: panel `ink` sengaja memakai tautan putih (`text-surface`, komentar di `auth-panels.tsx`). Jangan diubah.

### 4. Elemen non-teks tetap `primary`
Titik penanda (`auth-panels.tsx`), garis aktif (`main-nav.tsx`), checkbox & toggle tercentang (centang putih di atasnya adalah grafis, bukan teks), `progress-bar.tsx`, dan `border-primary` di checkbox, toggle, tabs. Sebutkan daftar akhirnya di PR.

### 5. Email
- Tambah `"primary-deep": "#c42d1e"` ke `src/emails/tokens.ts` tepat setelah `primary` (tes paritas dengan `tokens.css` — yang ini **benar** merah bila nilainya salah).
- `primaryButton` di `layout.ts` memakai `t("primary-deep")`.
- Wordmark "BINZI" di kepala email tetap `primary`, karena logotype dikecualikan dari WCAG 1.4.3.
- Tidak ada tes templat yang mengunci warna tombol (simulasi: 474 tes hijau tanpa perubahan tes).

### 6. Daftar pengecualian axe dikosongkan
- Kosongkan `KNOWN_CONTRAST_FINDINGS` menjadi `{}`. Mekanismenya (tipe, penjaga entri basi) tetap ada untuk masa depan.
- Spesifikasi axe berjalan di project **w360 dan w1280** saja (`testIgnore` di `playwright.config.ts`). Jangan menambahkannya ke project lain.
- Bila masih ada temuan kontras, perbaiki akarnya di token atau kelas. **Jangan** menambah entri baru.
- Komentar kepala `axe.spec.ts` diperbarui: temuan lama selesai di C-07, daftar kosong.

### 7. Aturan anti-regresi
Tabel warna di `docs/design/screens/*.md` memetakan `#f04030` → `primary`, termasuk untuk tombol. Agent yang membangun layar S1 dari tabel itu akan mengulang masalah ini. Karena itu:
- **`CLAUDE.md`, "Token ringkas":** tambahkan `primary-deeper #a8261a` dan aturan: *teks tidak pernah memakai `primary`, termasuk teks putih di atas latar `primary`. Tombol utama lewat komponen `Button` (latar `primary-deep`); teks dan tautan merah memakai `primary-deep`; `primary` hanya untuk elemen non-teks (progress, garis aktif, titik, kontrol tercentang). Aturan ini mengalahkan pemetaan `#f04030` di tabel warna layar.*
- **`TOKENS.md`:** baris `text-subtle` (nilai `#706a61`; label mono kecil dan teks disabled), `primary` (non-teks saja), `primary-deep` (tombol utama, teks & tautan merah), baris baru `primary-deeper`, dan kalimat "Disabled: warna padat (`#efe9e1` latar, `#8a8378` teks)" → `#706a61`.

## Bukan lingkup tugas ini
- Warna lain (`danger`, `success`, `warning`), latar gelap `ink-surface`, dan perubahan tata letak.
- `min-svh` di `forbidden.tsx` dan desain halaman 403.
- `utils.test.ts`, `progress-bar.test.tsx`, dan tes lain — tidak ada yang perlu diubah.
- **Prettier.** Enam berkas target belum rapi di `main` (`tokens.css`, keempat berkas `auth/*`, `axe.spec.ts`). Jangan menjalankan `npm run format`, `prettier --write`, atau format-on-save; diff harus tetap sebatas baris warna.
- Temuan UI auth lain di `STATUS.md` ("Chore UI auth kecil") — itu C-08.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/styles/tokens.css`, `src/lib/utils.ts`
- `src/components/ui/button-variants.ts`, `src/app/forbidden.tsx`
- `src/components/shared/auth/auth-panels.tsx`, `forgot-password-form.tsx`, `login-form.tsx`, `register-form.tsx` (hanya kelas warna)
- `src/emails/tokens.ts`, `src/emails/layout.ts`
- `e2e/layout/axe.spec.ts`
- `CLAUDE.md`, `docs/design/handoff/TOKENS.md`

## Selesai jika
- [ ] `KNOWN_CONTRAST_FINDINGS` = `{}` dan spesifikasi axe hijau di w360 dan w1280, dua run e2e penuh berturut-turut.
- [ ] `git grep -nE 'text-primary([^-]|$)' -- src ':!**/*.test.*'` kosong.
- [ ] `git grep -nE 'bg-primary([^-]|$)' -- src ':!**/*.test.*'` tepat 5 baris: `auth-panels.tsx` (titik), `main-nav.tsx` (garis aktif), `checkbox.tsx`, `progress-bar.tsx`, `toggle.tsx`.
- [ ] `git diff --shortstat origin/main -- src` → `10 files changed, 18 insertions(+), 14 deletions(-)`, dan perintah berikut tidak mencetak apa pun (tidak ada baris berubah di luar warna):
  ```
  git diff -U0 origin/main -- src ':!src/styles/tokens.css' | grep -E '^[-+][^-+]' | grep -vE 'primary|subtle'
  ```
- [ ] `npm run check` → 474 tes, `lint:hex` hijau.
- [ ] Uji mutasi, merah lalu dikembalikan. Nilai dari daftar tes yang gagal, bukan dari warna job (build yang patah tidak menguji apa pun):
  - M1: varian `primary` kembali ke `bg-primary` → axe merah (harapan: "halaman tamu" di w1280 karena pil Daftar Gratis header, dan "menu ponsel terbuka" di w360).
  - M2: `--text-subtle` kembali ke `#8a8378` → axe merah (harapan: tes EDITOR `/cms`, dan menu/drawer di w360).
  - M3: nilai `"primary-deep"` di `src/emails/tokens.ts` diubah satu digit → `tokens.test.ts` merah.

## Sebelum membuka PR
- `E2E_SCREENSHOT_DIR=~/binzi-c07-screenshots`, lalu sebut jumlah berkasnya di PR. Paling penting: `/`, `/masuk`, `/daftar`, `/lupa-password`, 403, header member, dan menu ponsel terbuka, di w360 & w1280.
- Staging per nama berkas (tanpa `git add -A` / `git add .`).
- Setelah push: cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya, termasuk angka gate audit.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e` (dua kali berturut-turut) · `node scripts/check-audit.mjs`

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Unggah screenshot ke Claude chat untuk dibandingkan dengan set A-19b. Tombol harus `#c42d1e`, tidak boleh ada pergeseran tata letak (termasuk tombol 403).
- [ ] Lokal (`npm run dev`): tombol disabled — misalnya "Masuk" di `/masuk` sebelum Turnstile selesai — tetap jelas terlihat tidak aktif dengan teks `#706a61`.
- [ ] Preview (login Vercel): arahkan kursor ke tombol "Daftar Gratis" dan tautan "Lupa password?". Keduanya harus terlihat berubah warna saat hover.

## Catatan keputusan
- Opsi A (24 Okt): tombol merah bertuliskan putih memakai `primary-deep`; opsi B (token tombol baru `#d83525`, 4,71) ditolak pemilik.
- `text-subtle` `#706a61`, bukan `#726c63` dari pratinjau: yang kedua hanya 4,495 di atas `primary-tint`. Secara visual tidak terbedakan.
- Teks disabled ikut menggelap (2 Nov): satu token untuk label mono dan teks disabled, tanpa `text-disabled` terpisah.
- `forbidden.tsx` hanya kelas warna (2 Nov) supaya screenshot 403 tetap pembanding yang bersih.
- Tes paritas `cn()` hanya menjaga token warna sebatas "kelas tergabung dengan benar", dan itu berlaku juga untuk nama yang tidak terdaftar — pendaftaran warna di `COLORS` dijaga lewat review diff, bukan tes.
