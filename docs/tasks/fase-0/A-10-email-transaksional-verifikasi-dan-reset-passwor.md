# A-10 · Email transaksional, verifikasi & reset password

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-09](A-09-better-auth-inti-email-password-sesi-rate-limit.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `auth`, `email` |
| **Judul ClickUp** | `[F0][Agent] A-10 Email transaksional, verifikasi & reset password` |

## Tujuan
Alur verifikasi email dan lupa password yang aman, dengan email sesuai desain.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/06-1-autentikasi-akun.md` (AUTH-03, AUTH-04)
- `docs/prd/sections/06-8-pencarian-notifikasi.md` (NTF-01)
- `docs/design/screens/15a.md + 15a.png`
- `docs/design/screens/15b.md + 15b.png`

## Kerjakan
- `src/lib/mail.ts` dengan dua transport: `resend` dan `log` (mencetak subjek + tautan ke konsol) sesuai `MAIL_TRANSPORT`.
- Template: verifikasi, reset password, selamat datang — sesuai 15a/15b. Copy antarmuka final dari `.md` layar. Logo dari `public/brand/`. Nama produk BINZI.
- Tautan verifikasi kedaluwarsa 24 jam (AUTH-03); token reset sekali pakai, 1 jam (AUTH-04).
- Rate limit lupa password: 3/jam/email (§12.4).
- Email selamat datang dikirim setelah verifikasi berhasil.

## Bukan lingkup tugas ini
- Layar web untuk alur ini (A-13).
- Email pengingat (NTF-03 — fase 2).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/lib/mail.ts`
- `src/emails/**`
- `src/lib/auth.ts`
- `src/modules/auth/**`

## Selesai jika
- [ ] Dengan `MAIL_TRANSPORT=log`, seluruh alur bisa diuji tanpa Resend.
- [ ] Token reset tidak bisa dipakai dua kali (ada tesnya).
- [ ] Tautan kedaluwarsa ditolak dengan pesan yang jelas.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Verifikasi oleh kamu (sebelum merge)
- [ ] Di localhost dengan `MAIL_TRANSPORT=log`: daftar akun, lalu pastikan tautan verifikasi muncul di terminal dan bisa dipakai.
- [ ] Nanti setelah H-07: kirim email sungguhan ke alamatmu, lalu periksa tampilannya di Gmail HP & desktop terhadap `15a.png`.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
