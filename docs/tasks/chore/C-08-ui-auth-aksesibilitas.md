# C-08 · UI auth: aksesibilitas form & dua celah tata letak

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | C-07 di-merge (menyentuh kelas warna di berkas auth yang sama). Sebelum S1-01 |
| **Branch** | `f0/c-08-ui-auth` |

> **Dibuat 24 Okt 2026** di Claude chat, ditinjau terhadap `main` `27bd9ae`. Sumbernya verifikasi pemilik A-19b (lebar w700) dan pencocokan layar auth dengan checklist 17d (H-11 langkah 5).

## Tujuan
Menutup tujuh celah di layar auth sebelum S1 memakai komponen yang sama (`PasswordField`, `Field`, `Checkbox`, `Button`) untuk dialog CMS — supaya polanya tidak ikut tersalin. Kelompok celahnya: tombol kirim yang tidak terjangkau keyboard, fokus yang tidak pindah ke isian salah, tombol Google tanpa loading, penanda yang hanya warna, dan dua celah tata letak yang baru terlihat di w700/w1280.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/design/screens/17d.md + .png` (checklist), `3c.md + .png` (chip kata sandi & state verifikasi), `2t.png` + `3t.png` (label mono tablet)
- `src/components/shared/auth/*` (form, `auth-panels.tsx`, `google-button.tsx`) dan tesnya
- `src/components/ui/button.tsx`, `password-field.tsx`, `checkbox.tsx`, `field.tsx`
- `e2e/layout/keyboard.spec.ts`, `e2e/layout/touch-targets.spec.ts`, `e2e/layout/widths.ts`

## Kerjakan

### (a) Tombol kirim tetap terjangkau saat menunggu Turnstile
Sekarang kelima form ber-Turnstile (masuk, daftar, lupa password, reset, kirim ulang verifikasi) memakai `disabled` sampai token masuk, begitu juga tombol "Kirim ulang tautan" di banner `/masuk`. Akibatnya tombol dilewati Tab, dan pengguna keyboard tidak bisa menjangkau "Masuk".

Ganti dengan pola `aria-disabled="true"`:
- Tampilan sama dengan disabled, tombol tetap bisa difokus.
- Aktivasi saat token belum ada tidak mengirim apa pun dan menampilkan pesan di bawah tombol, terhubung lewat `aria-describedby`.
- Copy usulan, sebut di PR: "Tunggu sebentar — verifikasi keamanan belum selesai."

Dukungan ini masuk ke komponen `Button` (prop eksplisit, bukan menimpa `disabled`), supaya S1 bisa memakainya. `loading` tetap mengunci tombol seperti sekarang.

Tes keyboard A-19b disesuaikan: `toBeEnabled` sebelum Tab terakhir dihapus. Gantinya, tombol kirim adalah perhentian Tab berikutnya **sebelum** token masuk dan membawa `aria-disabled="true"`; setelah token masuk atribut itu hilang.

### (b) Area sentuh "Lupa password?" ≥ 44 px
Perbesar area sentuhnya (padding + margin negatif) **tanpa** mengubah posisi atau tampilan teks. Tes target sentuh A-19b berubah dari "dilaporkan saja" menjadi asersi ≥ 44 di w360.

### (c) Label mono "MASUK"/"DAFTAR" di seluruh rentang tablet
`auth-panels.tsx` memakai `md:block lg:hidden`, padahal komentarnya menyebut "tablet band" — di BINZI rentang itu 640–1023. Akibatnya label hilang di 640–767. Ganti ke `sm:block lg:hidden` (aturan `sm:`/`md:` di `CLAUDE.md`).

Tambah asersi di spesifikasi layout: label terlihat di w700 & w768, tersembunyi di w360 & w1280.

### (d) `/daftar/verifikasi` di ≥ 1024
Ini satu-satunya `AuthShell` tanpa `marketing`, tetapi grid dua kolom (`SHELL_COLUMNS`) tetap berlaku. Akibatnya `<main>` jatuh di kolom sempit pertama (isi di x ≈ 83–493 pada 1280), dan baris logo `lg:hidden` hilang. Perbaikannya, untuk shell tanpa panel:
- Kolom grid tidak dipasang, sehingga isi berada di tengah — sesuai komentar komponen "omit for centered pages".
- Logo tetap tampil di ≥ 1024.

State kedaluwarsa halaman yang sama ikut beres. Tambah asersi di w1280: logo terlihat, dan titik tengah kartu berada dalam ±8 px dari tengah viewport.

### (e) Fokus pindah ke isian yang salah
`PasswordField` dan `Checkbox` persetujuan memakai `Controller` tanpa meneruskan `field.ref`, sehingga React Hook Form tidak bisa memfokuskannya.

- Teruskan `ref` ke `<input>` di `PasswordField` dan ke `Checkbox`, lalu berikan `field.ref` di `register-form.tsx` dan `reset-password-form.tsx`.
- Tes komponen:
  - `/reset-password` dengan kata sandi < 8 karakter → fokus di isian kata sandi.
  - `/daftar` dengan semua isian benar kecuali persetujuan → fokus di checkbox.

### (f) Tombol Google dengan state loading
Setelah diklik, `GoogleButton` masuk `loading` dengan label "Mengalihkan…" sampai halaman dialihkan, dan tidak bisa diklik ulang. Bila `signIn.social` mengembalikan error, tombol kembali normal dan muncul banner error yang sudah ada untuk kegagalan Google. Berlaku juga di `LoginModal` (varian primary).

### (g) Chip aturan kata sandi tidak hanya warna
Ikuti desain 3c:
- Aturan terpenuhi: ikon ✓ + tint sukses.
- Aturan belum terpenuhi: ○.
- Setelah submit gagal karena kata sandi: chip yang belum terpenuhi memakai tint bahaya + ○.

Ikon memakai Lucide (`Check`, `Circle`), `aria-hidden`. Pengumuman `aria-live` yang sudah ada dipertahankan. Kontras teks chip ≥ 4,5 di setiap tint.

### (h) Baris sesi di panel "Akun aktif"
Di 360 teksnya terbungkus dua baris, sementara ikon centangnya tertinggal di tepi kiri dan teksnya rata tengah. Rapikan supaya ikon menempel pada awal teks di setiap lebar (mengacu 3c: ikon di kiri, teks rata kiri dalam satu blok).

## Bukan lingkup tugas ini
- Ukuran 14 px pada pesan utama panel sukses — menunggu keputusan desain pemilik.
- Copy `/lupa-password` "Masuk dengan Google sebelumnya?…" (item tersendiri di `STATUS.md`).
- Tautan S&K/Kebijakan Privasi yang masih `<span>` — menunggu halaman legal (S6).
- Warna/token (C-07).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/components/shared/auth/**` (+ tes)
- `src/components/ui/button.tsx`, `password-field.tsx`, `checkbox.tsx`, `field.tsx` bila perlu (+ tes)
- `e2e/layout/**`

## Selesai jika
- [ ] Tes komponen untuk (a), (e), (f), (g) hijau. Tes `/dev/ui` yang terkait komponen UI tidak rusak.
- [ ] E2E:
  - Spesifikasi keyboard dengan perhentian tombol kirim sebelum token (a).
  - Target sentuh "Lupa password?" ≥ 44 (b).
  - Asersi label tablet (c).
  - Asersi tata letak `/daftar/verifikasi` w1280 (d).
  - Semua hijau di kelima project lebar; axe tanpa temuan baru.
- [ ] Uji mutasi, semuanya merah lalu dikembalikan:
  - Kembalikan `sm:` ke `md:` → asersi (c).
  - Hapus `ref` di `PasswordField` → tes fokus (e).
  - Hapus ikon dari chip → tes (g).
  - Kembalikan `disabled` di tombol kirim → spesifikasi keyboard (a).

## Sebelum membuka PR
- `E2E_SCREENSHOT_DIR=~/binzi-c08-screenshots`; sebut jumlah berkasnya di PR. Paling penting:
  - `/masuk` & `/daftar` di w700.
  - `/daftar/verifikasi` di w360 & w1280.
  - `/daftar` dengan chip dalam tiga state (kosong, sebagian terpenuhi, error).
- Copy yang tidak berasal dari desain wajib masuk "Keputusan & asumsi".
- Setelah push: cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e` (dua kali berturut-turut)

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Unggah screenshot ke Claude chat (bandingkan dengan set A-19b dan desain 3c).
- [ ] Preview di laptop (browser biasa, **tanpa** emulasi perangkat DevTools — Turnstile menolak user agent palsu): selesaikan `/masuk` dan `/daftar` hanya dengan keyboard.
- [ ] Di iPhone: chip kata sandi `/daftar` menampilkan ✓/○, dan tombol Google menampilkan "Mengalihkan…" setelah diketuk.
