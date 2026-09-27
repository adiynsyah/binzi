> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 6. Requirement Fungsional

Prioritas: **[M]** Must (MVP) · **[S]** Should · **[C]** Could · **[W]** Won't (fase berikutnya).

### 6.1 Autentikasi & Akun

| ID | Requirement | Prio |
|---|---|---|
| AUTH-01 | Registrasi email + password (min 8 karakter, huruf + angka) | M |
| AUTH-02 | Login/registrasi dengan Google OAuth 2.0 | M |
| AUTH-03 | Verifikasi email via magic link (kedaluwarsa 24 jam) | M |
| AUTH-04 | Lupa password & reset (token sekali pakai, 1 jam) | M |
| AUTH-05 | Account linking: email Google sama dengan akun terverifikasi → tautkan, jangan duplikat | M |
| AUTH-06 | Logout; logout semua perangkat | M |
| AUTH-07 | Session: 30 hari (member), 8 jam (admin/editor) | M |
| AUTH-08 | Rate limit login: 5 gagal / 15 menit / IP+email | M |
| AUTH-09 | Profil: nama, foto, ubah password, hapus akun (soft delete → purge 30 hari) | M |
| AUTH-10 | Cloudflare Turnstile di form registrasi & login | M |
| AUTH-11 | 2FA (TOTP) untuk ADMIN & SUPER_ADMIN | S |
