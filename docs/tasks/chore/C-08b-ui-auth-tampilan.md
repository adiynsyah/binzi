# C-08b · UI auth: area sentuh, label tablet, tata letak verifikasi, chip kata sandi

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | C-08 di-merge (berkas yang sama: `register-form.tsx`, `password-field.tsx`) dan C-04 di-merge. **Bukan** prasyarat S1 |
| **Mulai paling cepat** | Senin 9 Nov 2026 (setelah C-04) |
| **Branch** | `f0/c-08b-ui-auth-tampilan` |

> **Dipisah dari C-08 pada 2 Nov 2026** di Claude chat, ditinjau terhadap `main` `40726fb`. Isinya butir (b), (c), (d), (g), (h) kartu C-08 versi 24 Okt. Koreksi: (b) area sentuh yang diperbesar simetris akan menutupi tepi atas isian kata sandi; (g) desain 3c memakai `primary-tint` + `primary-deep` untuk chip yang belum terpenuhi setelah submit gagal, **bukan** tint bahaya. Sebelum sesi, tinjau ulang kartu ini terhadap `main` terbaru (C-08 mengubah berkas yang sama).

## Tujuan
Menutup lima celah tampilan di layar auth yang ditemukan di verifikasi A-19b (w700) dan H-11 langkah 5 (checklist 17d).

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/design/screens/17d.md` + `.png`, `3c.md` + `.png` (chip kata sandi & panel "Akun aktif"), `2t.png` + `3t.png` (label mono tablet)
- `src/components/shared/auth/auth-panels.tsx`, `login-form.tsx`, `register-form.tsx`
- `src/app/(auth)/daftar/verifikasi/page.tsx` (panel "Akun aktif" ada di sini, bukan di `src/components/`)
- `src/components/ui/password-field.tsx` + tesnya
- `e2e/layout/touch-targets.spec.ts`, `e2e/layout/widths.ts`, dan spesifikasi layout yang akan diberi asersi baru

## Sebelum mulai
- Docker menyala, lalu `npm run e2e:db`.
- `node scripts/check-audit.mjs` di `main` → sebut angkanya; bila ada temuan blocking, **berhenti dan laporkan**.
- Baseline `npm run check` dan `npm run e2e` di `main` — sebut angkanya di PR.

## Kerjakan

### (b) Area sentuh "Lupa password?" ≥ 44 px tanpa tumpang tindih
Perbesar area sentuhnya (padding + margin negatif) **tanpa** mengubah posisi atau tampilan teks. Jaraknya ke isian kata sandi di bawahnya hanya 8 px (`mt-2`), sedangkan ke blok email di atasnya 16 px (`space-y-4`). Perluasan ke bawah karena itu maksimal 8 px dan sisanya ke atas — perluasan simetris akan menutupi tepi atas isian kata sandi, sehingga ketukan di sana malah membuka "Lupa password?".

Tes target sentuh di w360 berubah dari "dilaporkan saja" menjadi asersi: tinggi ≥ 44; sisi bawah area ≤ sisi atas isian kata sandi; sisi atas area ≥ sisi bawah blok email.

### (c) Label mono "MASUK"/"DAFTAR" di seluruh rentang tablet
`auth-panels.tsx` memakai `md:block lg:hidden`, padahal rentang tablet BINZI adalah 640–1023, sehingga label hilang di 640–767. Ganti ke `sm:block lg:hidden` (aturan `sm:`/`md:` di `CLAUDE.md`). Asersi baru: label terlihat di w700 & w768, tersembunyi di w360 & w1280.

### (d) `/daftar/verifikasi` di ≥ 1024
Ini satu-satunya `AuthShell` tanpa `marketing`, tetapi grid dua kolom (`SHELL_COLUMNS`) tetap dipasang. Akibatnya `<main>` jatuh di kolom sempit pertama (isi di x ≈ 83–493 pada 1280) dan baris logo `lg:hidden` hilang. Untuk shell tanpa panel:
- Kolom grid tidak dipasang, sehingga isi berada di tengah (sesuai komentar komponen "omit for centered pages").
- Logo tetap tampil di ≥ 1024.

State kedaluwarsa halaman yang sama ikut beres. Asersi di w1280: logo terlihat, dan titik tengah kartu berada dalam ±8 px dari tengah viewport.

### (g) Chip aturan kata sandi tidak hanya warna — ikuti desain 3c
| State | Ikon (Lucide, `aria-hidden`) | Latar / teks | Kontras teks |
|---|---|---|---|
| Terpenuhi | `Check` | `success-tint` / `success-tint-text` | 6,70 |
| Belum terpenuhi (mengetik) | `Circle` | `surface-2` / `text-meta` (seperti sekarang) | 5,59 |
| Belum terpenuhi setelah submit gagal karena kata sandi | `Circle` | `primary-tint` / `primary-deep` | 4,85 |

Baris ketiga mengikuti 3c (chip "ada angka" di state error validasi) dan pasangan `primary-tint` → `primary-deep` di `TOKENS.md` — bukan tint bahaya seperti versi 24 Okt. Pengumuman `aria-live` yang sudah ada dipertahankan.

### (h) Baris sesi di panel "Akun aktif"
Di 360 teksnya terbungkus dua baris, sementara ikon centangnya tertinggal di tepi kiri dan teksnya rata tengah. Rapikan sesuai 3c: ikon di kiri, teks rata kiri dalam satu blok, di setiap lebar.

## Bukan lingkup tugas ini
- Ukuran 14 px pada pesan utama panel sukses — menunggu keputusan desain pemilik.
- Copy `/lupa-password` "Masuk dengan Google sebelumnya?…", tautan S&K/Kebijakan Privasi yang masih `<span>`, warna/token.
- **Prettier.** Hampir semua berkas target belum rapi di `main`. Jangan menjalankan `npm run format`, `prettier --write`, atau format-on-save.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/components/shared/auth/**` (+ tes)
- `src/components/ui/password-field.tsx` (+ tes)
- `src/app/(auth)/daftar/verifikasi/page.tsx` (hanya baris sesi panel "Akun aktif", butir (h))
- `e2e/layout/**`

## Selesai jika
- [ ] Tes komponen chip (g) untuk ketiga state hijau.
- [ ] E2E dua kali berturut-turut hijau di kelima project lebar, dengan asersi baru (b), (c), (d); axe tanpa temuan.
- [ ] Uji mutasi, merah lalu dikembalikan (commit lokal dulu; nilai dari daftar tes yang gagal):
  - `sm:` kembali ke `md:` → asersi (c) merah di w700.
  - Hapus perluasan area sentuh → asersi (b) merah.
  - Perluasan dibuat simetris (bawah > 8 px) → asersi tumpang tindih (b) merah.
  - Grid kolom dipasang lagi untuk shell tanpa panel → asersi (d) merah.
  - Hapus ikon dari chip → tes (g) merah.

## Sebelum membuka PR
- Kosongkan `~/binzi-c08b-screenshots`, jalankan e2e final dengan `E2E_SCREENSHOT_DIR=~/binzi-c08b-screenshots`, sebut hash commit dan jumlah berkasnya. Paling penting: `/masuk` & `/daftar` di w700; `/daftar/verifikasi` di w360 & w1280; `/daftar` dengan chip dalam tiga state; panel "Akun aktif" di w360.
- Staging per nama berkas. Copy yang tidak berasal dari desain wajib masuk "Keputusan & asumsi".
- Setelah push: cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e` (dua kali berturut-turut) · `node scripts/check-audit.mjs`

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Unggah screenshot ke Claude chat (bandingkan dengan set C-08 dan desain 3c).
- [ ] Di iPhone: chip kata sandi `/daftar` menampilkan ✓/○; ketuk tepi atas isian kata sandi di `/masuk` → kursor masuk ke isian, **bukan** membuka "Lupa password?".
