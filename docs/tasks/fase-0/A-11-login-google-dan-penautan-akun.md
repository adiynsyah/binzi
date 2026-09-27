# A-11 · Login Google & penautan akun

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-09](A-09-better-auth-inti-email-password-sesi-rate-limit.md), [H-06](H-06-google-oauth-client.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `auth` |
| **Judul ClickUp** | `[F0][Agent] A-11 Login Google & penautan akun` |

## Tujuan
Login Google (AUTH-02) tanpa membuat akun ganda (AUTH-05), dan user kembali ke halaman asal.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/06-1-autentikasi-akun.md` (AUTH-02, AUTH-05)
- `docs/prd/sections/14-acceptance-criteria.md` (§14.2)
- `docs/design/screens/3c.md` (akun Google tertaut)

## Kerjakan
- Provider Google di Better Auth (scope `openid email profile`).
- Penautan akun: email Google yang sama dengan akun email/password **terverifikasi** → ditautkan, bukan diduplikasi. Jangan menautkan ke akun yang belum terverifikasi.
- Setelah login, user diarahkan **kembali ke halaman asal** (§14.2), dengan validasi bahwa URL tujuan adalah path internal (cegah open redirect).
- Akun baru dari Google → role `MEMBER`, email dianggap terverifikasi.

## Bukan lingkup tugas ini
- Tombol & UI (A-13).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/lib/auth.ts`
- `src/modules/auth/**`

## Selesai jika
- [ ] Tes: parameter redirect ke domain luar ditolak.
- [ ] Tes (dengan mock): penautan hanya terjadi untuk akun terverifikasi.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Verifikasi oleh kamu (sebelum merge)
- [ ] Di localhost: daftar dengan email/password memakai email Google-mu, verifikasi, logout, lalu login dengan Google → harus masuk ke akun yang sama (cek tabel akun di `db:studio`).

## Catatan
- Login Google tidak bisa dites di URL preview Vercel (lihat catatan H-06).

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
