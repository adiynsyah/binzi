# C-07 · Token kontras: tombol utama `primary-deep`, tautan merah, `text-subtle`

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | A-19b (`KNOWN_CONTRAST_FINDINGS` di `e2e/layout/axe.spec.ts`). Sebelum S1-01 |
| **Branch** | `f0/c-07-kontras` |

> **Dibuat 24 Okt 2026** di Claude chat, ditinjau terhadap `main` `6580878`. Keputusan pemilik 24 Okt: **opsi A** — tombol merah bertuliskan putih memakai `primary-deep`.

## Tujuan
Menutup semua temuan kontras axe yang masih dicatat sebagai pengecualian di A-19b, sebelum S1 menambah layar baru. Ada tiga masalah, semuanya di bawah batas AA 4,5:1 untuk teks kecil:
- Teks putih di tombol `primary` `#f04030`: 3,83.
- Tautan merah kecil `text-primary`: 3,83 di putih, 3,52 di krem.
- Label mono `text-subtle` `#8a8378`: 3,27–3,75.

Kartu ini juga menetapkan aturan supaya masalah yang sama tidak muncul lagi di layar S1.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/design/handoff/TOKENS.md`
- `src/styles/tokens.css`
- `src/lib/utils.ts` + `src/lib/utils.test.ts` (daftar token `cn()` dan tes paritasnya)
- `src/emails/tokens.ts`, `src/emails/tokens.test.ts`, `src/emails/layout.ts`
- `src/components/ui/button-variants.ts`, `src/app/forbidden.tsx`
- `e2e/layout/axe.spec.ts`

## Kerjakan

### 1. Token
| Token | Nilai | Keterangan |
|---|---|---|
| `--primary-deeper` (**baru**) | `#a8261a` | Hover tombol utama & tautan merah. Putih di atasnya 7,10 |
| `--text-subtle` | `#8a8378` → **`#706a61`** | ≥ 4,5 di semua latar terang: surface 5,35 · fill-soft 4,9 · fill 4,66 · primary-tint 4,63 |
| `--primary` | tetap `#f04030` | Hanya untuk elemen **non-teks** (batas kontras non-teks 3:1; 3,83 lolos) |
| `--primary-deep` | tetap `#c42d1e` | Tombol utama, teks & tautan merah |

Langkah:
- Daftarkan `--color-primary-deeper` di blok `@theme` dan di daftar token `cn()` (`createCn`). Tes paritas di `src/lib/utils.test.ts` gagal bila lupa (aturan PR #44).
- Perbarui baris `TOKENS.md` dan komentar `tokens.css`, termasuk "(3.8:1)" pada `text-subtle`.

Catatan nilai `text-subtle`: pratinjau di Claude chat memakai `#726c63`, tapi nilai itu hanya 4,495 di atas `primary-tint`. `#706a61` dipilih supaya ada margin; secara visual tidak terbedakan.

### 2. Tombol utama
- `button-variants.ts`, varian `primary`: `bg-primary-deep text-surface hover:bg-primary-deeper`.
- `src/app/forbidden.tsx`: tombol "Kembali ke Beranda" mengikuti pola yang sama. Lebih baik lagi kalau memakai `buttonVariants`, asalkan modulnya tetap murni (aturan PR #40).
- Alias shadcn `--primary-foreground`/`--sidebar-primary` di `tokens.css` tidak diubah, kecuali ada komponen BINZI yang merender teks di atas `bg-primary` lewat alias itu. Kalau ada, laporkan.

### 3. Tautan & teks merah
Delapan `text-primary` di `src/components/shared/auth/*` diganti `text-primary-deep`. Hover-nya `hover:text-primary-deeper`, supaya tetap ada perubahan saat diarahkan.

### 4. Elemen non-teks tetap `primary`
Titik penanda di `auth-panels.tsx`, garis aktif `main-nav.tsx`, checkbox & toggle tercentang (centang putih di atasnya adalah grafis, bukan teks), dan `progress-bar.tsx`. Sebutkan daftar akhirnya di PR.

### 5. Email
- Tambah `primary-deep` ke `src/emails/tokens.ts` (tes paritas dengan `tokens.css`).
- `primaryButton` di `layout.ts` memakai `primary-deep`.
- Wordmark "BINZI" di kepala email tetap `primary`, karena logotype dikecualikan dari WCAG 1.4.3.

### 6. Daftar pengecualian axe dikosongkan
- Kosongkan `KNOWN_CONTRAST_FINDINGS`. Mekanismenya tetap ada sebagai objek kosong untuk masa depan. Penjaga entri basi dan aturan "tanpa temuan `serious`/`critical` lain" harus hijau di **semua** project lebar.
- Bila masih ada temuan kontras, perbaiki akarnya di token atau kelas. **Jangan** menambah entri baru.
- Komentar kepala `axe.spec.ts` diperbarui: temuan lama selesai di C-07.

### 7. Aturan anti-regresi
Tabel warna di `docs/design/screens/*.md` memetakan `#f04030` → `primary`, termasuk untuk tombol. Agent yang membangun layar S1 dari tabel itu akan mengulang masalah ini. Karena itu:
- **`CLAUDE.md`, "Token ringkas":** tambahkan `primary-deeper` dan aturan: *teks tidak pernah memakai `primary`, termasuk teks putih di atas latar `primary`. Tombol utama lewat komponen `Button` (latar `primary-deep`); teks dan tautan merah memakai `primary-deep`; `primary` hanya untuk elemen non-teks (progress, garis aktif, titik, kontrol tercentang). Aturan ini mengalahkan pemetaan `#f04030` di tabel warna layar.*
- **`TOKENS.md`:** keterangan baris `primary`, `primary-deep`, `primary-deeper`, dan `text-subtle` disesuaikan dengan aturan yang sama.

## Bukan lingkup tugas ini
- Warna lain (`danger`, `success`, `warning`), latar gelap `ink-surface`, dan perubahan tata letak.
- Temuan UI auth lain di `STATUS.md` ("Chore UI auth kecil": `aria-disabled`, "Lupa password?", label `md:`, `/daftar/verifikasi`). Itu chore tersendiri.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/styles/tokens.css`, `src/lib/utils.ts`, `src/lib/utils.test.ts`
- `src/components/ui/button-variants.ts` (+ tesnya), `src/app/forbidden.tsx`
- `src/components/shared/auth/*` (hanya kelas warna)
- `src/emails/tokens.ts`, `src/emails/tokens.test.ts`, `src/emails/layout.ts` (+ tes templat bila snapshot berubah)
- `e2e/layout/axe.spec.ts`
- `CLAUDE.md`, `docs/design/handoff/TOKENS.md`

## Selesai jika
- [ ] `KNOWN_CONTRAST_FINDINGS` kosong dan spesifikasi axe hijau di w360/w700/w768/w1280/w1440.
- [ ] `git grep -nE 'text-primary([^-]|$)' -- src ':!**/*.test.*'` kosong.
- [ ] `git grep -nE 'bg-primary([^-]|$)' -- src` hanya menyisakan elemen non-teks dari bagian 4.
- [ ] Tes paritas token (`cn()` dan email) hijau dengan `primary-deeper` dan `primary-deep`.
- [ ] Uji mutasi, merah lalu dikembalikan:
  - Kembalikan varian `primary` ke `bg-primary` → axe merah.
  - Kembalikan `text-subtle` ke `#8a8378` → axe merah.

## Sebelum membuka PR
- `E2E_SCREENSHOT_DIR=~/binzi-c07-screenshots`, lalu sebut jumlah berkasnya di PR. Paling penting: `/`, `/masuk`, `/daftar`, `/lupa-password`, 403, dan header member, di w360 & w1280.
- Setelah push: cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e` (dua kali berturut-turut)

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Unggah screenshot ke Claude chat untuk dibandingkan dengan set A-19b. Tombol harus `#c42d1e`, dan tidak boleh ada pergeseran tata letak.
- [ ] Preview (login Vercel): arahkan kursor ke tombol "Daftar Gratis" dan tautan "Lupa password?". Keduanya harus terlihat berubah warna saat hover.
