# A-09 · Better Auth inti: email/password, sesi, rate limit, Turnstile

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-08](A-08-pola-modul-serialisasi-dan-batas-impor.md), [H-10](H-10-isi-environment-dan-secret.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `auth`, `security` |
| **Judul ClickUp** | `[F0][Agent] A-09 Better Auth inti: email/password, sesi, rate limit, Turnstile` |

## Tujuan
Fondasi autentikasi di server. Ini bagian dari **irisan uji coba** (A-09 → A-13) untuk mengkalibrasi cara kerja dengan agent.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/06-1-autentikasi-akun.md`
- `docs/prd/sections/12-keamanan.md` (§12.1, §12.4)
- `docs/prd/sections/14-acceptance-criteria.md` (§14.2)
- `docs/prd/sections/03-persona-role.md` (§3.2 role)

## Kerjakan
- Better Auth dengan adapter Drizzle; handler di `src/app/api/auth/[...all]/route.ts`; instance di `src/lib/auth.ts`.
- Email/password: minimal 8 karakter, huruf + angka (AUTH-01). Hash bawaan Better Auth — jangan diganti.
- Cookie `HttpOnly`, `Secure`, `SameSite=Lax`; rotasi sesi setelah login.
- Masa sesi: member 30 hari, staf 8 jam (AUTH-07). Better Auth mengatur masa sesi secara global — **usulkan dulu pendekatan untuk staf 8 jam** di ringkasan sebelum mengimplementasikannya.
- Rate limit login/registrasi: **5 percobaan gagal / 15 menit / IP+email** (AUTH-08, §12.4). Pastikan perilaku ini benar-benar tercapai. Rate limit bawaan Better Auth belum tentu menghitung per IP+email; bila tidak cocok, pakai tabel `rate_limits`.
- Pesan gagal login tidak mengungkap apakah email terdaftar (§14.2).
- Verifikasi token Turnstile **di server** untuk login & registrasi (AUTH-10).
- Role default akun baru: `MEMBER`.

## Bukan lingkup tugas ini
- Pengiriman email (A-10), Google (A-11), UI (A-13).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/lib/auth.ts`
- `src/lib/turnstile.ts`
- `src/lib/ratelimit.ts`
- `src/app/api/auth/**`
- `src/modules/auth/**`

## Selesai jika
- [ ] Tes integrasi: registrasi, login, login gagal ke-6 diblokir, token Turnstile tidak valid ditolak.
- [ ] Pesan error login identik untuk email tak terdaftar dan password salah.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Verifikasi oleh kamu (sebelum merge)
- [ ] **V-10:** kirim 20 login gagal via curl → harus diblokir setelah 5.
- [ ] Periksa cookie di DevTools: HttpOnly, Secure, SameSite=Lax.

## Catatan
- Kategori **berisiko tinggi** (§13.4): cantumkan item §12.6 yang relevan di ringkasan PR.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
