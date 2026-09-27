# H-11 · Verifikasi akhir Fase 0

| | |
|---|---|
| **Pemilik** | Kamu (tidak dikerjakan agent) |
| **Perkiraan** | 1–2 jam |
| **Bergantung pada** | [A-19](A-19-e2e-baseline-playwright.md) |
| **Tag ClickUp** | `fase-0`, `manual`, `review`, `security` |
| **Judul ClickUp** | `[F0][Kamu] H-11 Verifikasi akhir Fase 0` |

## Tujuan
Memastikan deliverable Fase 0 tercapai (PRD §13.1): user dapat mendaftar, login, dan melihat halaman yang benar sesuai role, di HP maupun laptop.

## Langkah
1. Di localhost (`MAIL_TRANSPORT=log`): daftar akun baru → salin tautan verifikasi dari terminal → login → masuk `/belajar`. Di URL Vercel: login dengan akun yang sudah terverifikasi → masuk `/belajar`.
2. Uji di **360 / 768 / 1280** (DevTools) **dan** di HP nyata: header, drawer, menu akun, form auth.
3. Login Google di localhost. Jika email Google sama dengan akun email yang sudah terverifikasi, akunnya harus tertaut, bukan dibuat baru (AUTH-05).
4. Jalankan checklist keamanan yang relevan dari `docs/prd/sections/12-keamanan.md`:
   - **V-04:** login sebagai MEMBER, buka `/cms` dan panggil endpoint CMS langsung → harus 403.
   - **V-07:** buka URL objek R2 tanpa tanda tangan di jendela penyamaran → harus ditolak.
   - **V-09:** jalankan `git log -p | grep -iE "sk_|secret|password|api[_-]key"`, lalu periksa `.env*` ada di `.gitignore`.
   - **V-10:** kirim 20 login gagal via curl → harus diblokir setelah 5.
5. Periksa layar auth terhadap checklist layar 17d (`docs/design/screens/17d.png`).
6. Catat temuan sebagai task perbaikan di ClickUp sebelum masuk Sprint S1.

## Selesai jika
- [ ] Semua langkah lolos, atau temuannya sudah tercatat sebagai task perbaikan.
