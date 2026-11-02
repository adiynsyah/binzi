# C-08 · UI auth: tombol yang menunggu Turnstile, fokus ke isian salah, tombol Google

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | C-07 di-merge. Sebelum S1-01 (S1 memakai `Button` dan `PasswordField` yang sama) |
| **Tenggat** | Merge paling lambat **Kamis 5 Nov**: saat C-04 dikerjakan (Jum 6 – Min 8 Nov) tidak boleh ada branch kartu lain yang terbuka. Bila Kamis malam PR belum siap di-merge: hentikan, biarkan branch apa adanya, kerjakan C-04, lalu lanjutkan C-08 dengan `git merge origin/main` |
| **Branch** | `f0/c-08-ui-auth` |

> **Dibuat 24 Okt 2026** di Claude chat, ditinjau terhadap `main` `27bd9ae`. Sumbernya verifikasi pemilik A-19b (w700) dan pencocokan layar auth dengan checklist 17d (H-11 langkah 5).
>
> **Ditinjau ulang dan dipecah 2 Nov 2026** terhadap `main` `40726fb`. Kartu ini memuat butir (a), (e), (f) versi lama — perilaku dan komponen yang dipakai S1. Butir tampilan (b), (c), (d), (g), (h) pindah ke **C-08b** (setelah C-04, bukan prasyarat S1). Koreksi terhadap versi 24 Okt: `/reset-password` tidak memakai Turnstile; handler keempat form ber-Turnstile mengirim `captchaToken ?? ""` tanpa penjaga — selama ini aman hanya karena `disabled` memblokir *implicit submission* (Enter di isian); sepuluh penantian `toBeEnabled()` di empat spec e2e akan selalu lolos setelah `disabled` hilang; `Checkbox` sudah meneruskan `ref`; error klien `signIn.social` tidak ditangani; tombol Google bisa macet di "Mengalihkan…" saat halaman dipulihkan dari back-forward cache.

## Tujuan
Menutup tiga celah sebelum S1 memakai komponen yang sama untuk dialog CMS, supaya polanya tidak ikut tersalin:
- Tombol kirim yang menunggu Turnstile dilewati Tab, jadi pengguna keyboard tidak bisa menjangkau "Masuk".
- Fokus tidak pindah ke isian kata sandi atau persetujuan yang salah — di `/reset-password` pengguna pembaca layar tidak mendapat kabar apa pun.
- Tombol Google tanpa state loading.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/design/screens/17d.md` + `.png` (checklist state)
- `src/components/ui/button.tsx`, `button-variants.ts`, `password-field.tsx`, `input.tsx`, `checkbox.tsx`
- `src/components/shared/auth/`: `login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`, `resend-verification-form.tsx`, `reset-password-form.tsx`, `google-button.tsx`, `login-modal.tsx`, `auth-errors.ts`, dan tes masing-masing
- `e2e/fixtures.ts`, `e2e/layout/keyboard.spec.ts`, `e2e/signin-landing.spec.ts`, `e2e/email-flows.spec.ts`, `e2e/lockout.spec.ts`

## Sebelum mulai
- Docker menyala, lalu `npm run e2e:db`.
- `node scripts/check-audit.mjs` di `main` → `5 excused, 0 blocking`. Bila ada temuan blocking baru, **berhenti dan laporkan**.
- Baseline di `main`: `npm run check` → 474 tes; `npm run e2e` → 112 lolos / 10 skip.

## Kerjakan

### (a) Tombol yang menunggu Turnstile tetap terjangkau
Ada lima tombol yang sekarang `disabled={needsCaptcha && !captchaToken}`: tombol kirim di `login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`, `resend-verification-form.tsx`, dan tombol teks "Kirim ulang tautan" di banner `/masuk` (`login-form.tsx`). `/reset-password` tidak memakai Turnstile — tombolnya tidak diubah.

1. **Komponen `Button`:** prop eksplisit baru (nama bebas, sebut di PR; bukan menimpa `disabled`) yang merender `aria-disabled="true"` dan membiarkan tombol tetap bisa difokus. Tampilannya identik dengan `disabled`, **termasuk saat hover** (latar tetap `surface-disabled`, tidak berubah ke warna hover varian) dan `cursor-not-allowed` — lewat varian `aria-disabled:` di `button-variants.ts`. **Tanpa** `pointer-events-none`, supaya klik tetap sampai ke handler. `loading` tetap mengunci tombol dengan `disabled` seperti sekarang.
2. **Penjaga di handler, bukan hanya di tombol.** Kelima handler (keempat `onSubmit` dan `resendVerification`) tidak mengirim request apa pun bila `needsCaptcha && !captchaToken`, dan menampilkan pesan tunggu. Ini wajib: begitu `disabled` hilang, Enter di isian mana pun mengirim form, dan klik tombol `type="submit"` ber-`aria-disabled` juga memicu submit. Validasi isian boleh berjalan lebih dulu; yang dilarang adalah request tanpa token.
3. **Pesan tunggu:** muncul di bawah tombol hanya setelah aktivasi (klik atau Enter) tanpa token, dirujuk lewat `aria-describedby` tombol, dan hilang begitu token masuk. Copy usulan, sebut di PR: "Tunggu sebentar — verifikasi keamanan belum selesai." Untuk "Kirim ulang tautan", pesan yang sama tampil di dalam banner setelah tautannya.
4. **Tes komponen** untuk keempat form dan tombol kirim ulang, tanpa token: Enter di isian → `fetch` tidak dipanggil, pesan tampil; klik tombol → sama, tombol ber-`aria-disabled="true"` dan bisa difokus. Setelah token masuk: atribut dan pesan hilang, submit mengirim header `x-captcha-response` berisi token.
5. **E2E:**
   - Satu helper di `e2e/fixtures.ts` (mis. `waitForCaptchaArmed(button)`) yang menunggu `aria-disabled` hilang. Ganti kesepuluh penantian `toBeEnabled()` pada tombol ber-Turnstile: `signin-landing.spec.ts` (3), `email-flows.spec.ts` (4 — semua kecuali dua tombol simpan `/reset-password`), `lockout.spec.ts` (2), `keyboard.spec.ts` (1). Perbarui juga komentar kepala `signin-landing.spec.ts` (baris 2) yang masih menjelaskan mekanisme `toBeEnabled()`. Dua `toBeEnabled()` tombol simpan `/reset-password` tetap.
   - `keyboard.spec.ts`, jalur normal: tunggu helper **sebelum menekan Enter** (bukan sebelum Tab) — tanpa itu Enter bisa jatuh sebelum token dan tesnya menjadi flaky.
   - `keyboard.spec.ts`, tes baru yang deterministik untuk state sebelum token: blokir skrip Turnstile dengan `page.route("https://challenges.cloudflare.com/**", (route) => route.abort())`, sehingga token tidak pernah masuk. Tab sampai tombol "Masuk" → fokus di tombol dengan `aria-disabled="true"` → Enter → pesan tunggu tampil, URL tetap `/masuk`, dan tidak ada request ke `/api/auth/sign-in/email`. Lalu `hover()` tombol → `background-color` terhitung sama dengan `surface-disabled` (`rgb(239, 233, 225)`). Bila penangkap CSP atau fixture lain keberatan dengan skrip yang diblokir, laporkan — jangan melonggarkan penangkapnya.

### (e) Fokus pindah ke isian yang salah
- `PasswordField`: tambah prop `ref` (React 19: `ref` sebagai prop biasa) yang diteruskan ke `<Input>` dan dari sana ke `<input>`.
- `Checkbox` sudah meneruskan `ref` (tipe `ComponentProps<typeof CheckboxPrimitive.Root>`, props di-spread ke Radix) — jangan diubah kecuali tes membuktikan sebaliknya.
- `register-form.tsx`: berikan `field.ref` ke `PasswordField` dan `Checkbox`. `reset-password-form.tsx`: ke `PasswordField`.
- Tes komponen: `/reset-password` dengan kata sandi < 8 karakter → fokus di isian kata sandi; `/daftar` dengan nama & email benar tetapi kata sandi salah → fokus di isian kata sandi; `/daftar` dengan semua isian benar kecuali persetujuan → fokus di checkbox.

### (f) Tombol Google dengan state loading
- Setelah diklik, `GoogleButton` masuk `loading` dengan label "Mengalihkan…" sampai halaman dialihkan, dan tidak bisa diklik ulang. Berlaku di `/masuk`, `/daftar`, dan `LoginModal` (varian primary).
- `startGoogleSignIn` sekarang memanggil `void authClient.signIn.social(...)` tanpa menangani error. Bila panggilan itu selesai dengan `error` atau melempar: tombol kembali normal dan pesan Google generik yang sudah ada di `auth-errors.ts` ("Tidak bisa melanjutkan dengan Google. Coba lagi, atau lanjut dengan email.") tampil di banner form pemiliknya, lewat callback dari `GoogleButton`. `LoginModal` tidak punya area banner: tampilkan pesan yang sama di bawah tombolnya.
- **Back-forward cache:** saat event `pageshow` datang dengan `persisted === true` (halaman dipulihkan setelah pengguna menekan Kembali dari halaman Google), tombol kembali normal. Tanpa ini Safari bisa menampilkan tombol yang macet di "Mengalihkan…".
- Tes komponen: klik → label "Mengalihkan…", tombol terkunci, klik kedua tidak memanggil `signIn.social` lagi; `signIn.social` mengembalikan error → tombol normal dan pesan tampil; `pageshow` dengan `persisted: true` → tombol normal.

## Bukan lingkup tugas ini
- Butir C-08b: area sentuh "Lupa password?", label mono tablet, tata letak `/daftar/verifikasi`, chip aturan kata sandi, baris sesi "Akun aktif".
- **Prettier.** 33 berkas di area target belum rapi di `main` (hampir semua `src/components/shared/auth/*`, `button.tsx`, `password-field.tsx`, dan sebagian besar `e2e/`). Jangan menjalankan `npm run format`, `prettier --write`, atau format-on-save; diff harus tetap sebatas perubahan kartu.
- Tombol `/reset-password`, copy `/lupa-password` "Masuk dengan Google sebelumnya?…", tautan S&K/Kebijakan Privasi yang masih `<span>`, dan 12 impor side-effect `test-env` yang masih relatif (sisa C-06).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/components/ui/button.tsx`, `button-variants.ts`, `password-field.tsx` (+ tes masing-masing)
- `src/components/shared/auth/**` (+ tes)
- `e2e/fixtures.ts`, `e2e/signin-landing.spec.ts`, `e2e/email-flows.spec.ts`, `e2e/lockout.spec.ts`, `e2e/layout/keyboard.spec.ts`

## Selesai jika
- [ ] `git grep -nE 'disabled=\{needsCaptcha' -- src` kosong.
- [ ] `git grep -n 'toBeEnabled' -- e2e` hanya menyisakan dua baris tombol simpan `/reset-password` di `email-flows.spec.ts` (di `main` 2 Nov: 13 baris = 10 penantian + 1 komentar + 2 tombol simpan).
- [ ] `npm run check` hijau: 474 tes lama + tes baru (sebut jumlahnya).
- [ ] `npm run e2e` dua kali berturut-turut: semua lolos, 10 skip (sebut jumlah lolos); axe tetap hijau — axe-core 4.13.0 melewati elemen ber-`aria-disabled="true"`.
- [ ] Uji mutasi, merah lalu dikembalikan. Nilai dari daftar tes yang gagal, bukan warna job:
  - M1: hapus penjaga token di handler `login-form.tsx` → tes komponen "Enter tanpa token" merah.
  - M2: tombol "Masuk" kembali `disabled={needsCaptcha && !captchaToken}` → tes keyboard "sebelum token" merah.
  - M3: hapus gaya `aria-disabled:` di `button-variants.ts` → asersi warna latar saat hover di tes keyboard merah.
  - M4: `PasswordField` tidak meneruskan `ref` → tes fokus `/reset-password` merah.
  - M5: hapus penanganan `pageshow` → tes back-forward cache merah.

## Sebelum membuka PR
- Commit lokal dulu sebelum uji mutasi. Setiap mutasi dikembalikan dengan `git restore <berkas>`; sesudahnya `git status` bersih.
- Dua run e2e penuh dan screenshot dilakukan pada commit final, setelah semua mutasi dikembalikan. Kosongkan `~/binzi-c08-screenshots` dulu, jalankan dengan `E2E_SCREENSHOT_DIR=~/binzi-c08-screenshots`, lalu sebut hash commit dan jumlah berkasnya di PR. Tambahkan screenshot state "sebelum token" (`/masuk` dengan Turnstile diblokir, pesan tunggu tampil) di w360 dan w1280.
- Staging per nama berkas (tanpa `git add -A` / `git add .`).
- Copy yang tidak berasal dari desain wajib masuk "Keputusan & asumsi", begitu juga nama prop baru di `Button`.
- Setelah push: cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya, termasuk angka gate audit.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e` (dua kali berturut-turut) · `node scripts/check-audit.mjs`

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Unggah screenshot ke Claude chat: tombol "sebelum token" harus identik dengan tombol disabled di set C-07.
- [ ] Preview di laptop (browser biasa, **tanpa** emulasi perangkat DevTools — Turnstile menolak user agent palsu): selesaikan `/masuk` dan `/daftar` hanya dengan keyboard. Sesaat setelah halaman terbuka, tekan Enter di isian kata sandi sebelum Turnstile selesai → pesan tunggu, bukan banner error.
- [ ] Lokal di Safari laptop (`npm run dev`, Google aktif di localhost): klik "Masuk dengan Google" → "Mengalihkan…" → di halaman Google tekan Kembali → tombol kembali normal.

## Catatan keputusan
- Kartu dipecah 2 Nov: perilaku & komponen (C-08, prasyarat S1) dipisah dari tampilan (C-08b), karena tenggat Kamis dan karena butir tampilan tidak dipakai S1.
- Penjaga token di handler adalah sumber kebenaran; `aria-disabled` hanya penanda tampilan dan aksesibilitas.
