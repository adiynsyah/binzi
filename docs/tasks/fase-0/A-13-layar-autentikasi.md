# A-13 · Layar autentikasi

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-06](A-06-komponen-overlay-dan-umpan-balik.md), [A-10](A-10-email-transaksional-verifikasi-dan-reset-passwor.md), [A-11](A-11-login-google-dan-penautan-akun.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `auth`, `ui` |
| **Judul ClickUp** | `[F0][Agent] A-13 Layar autentikasi` |

## Tujuan
Semua layar masuk, daftar, lupa password, dan verifikasi, lengkap dengan state-nya. Ini penutup irisan uji coba.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/design/handoff/SCREENS.md` (baris /masuk, /daftar, /lupa-password)
- `docs/design/screens/2a, 2b, 2c, 2d, 2t (.md + .png)`
- `docs/design/screens/3a, 3b, 3c, 3d, 3t (.md + .png)`
- `docs/design/screens/17d.png`
- `docs/prd/sections/14-acceptance-criteria.md` (§14.1, §14.2)

## Kerjakan
- Route `/masuk`, `/daftar`, `/lupa-password`, reset password, dan hasil verifikasi di `src/app/(auth)`.
- Semua state di SCREENS.md: error per field, gagal (tanpa bocor), terkunci 5×, berhasil, tautan kedaluwarsa, akun Google tertaut.
- **Modal login di tengah alur** (2c): konteks halaman tidak hilang. Buat komponennya sekarang, walau pemakaiannya baru di S2.
- Form: React Hook Form + skema Zod yang **sama** dengan validasi server.
- Widget Turnstile, tombol Google.
- Copy antarmuka persis dari `.md` layar.

## Bukan lingkup tugas ini
- Header/footer publik penuh (A-14) — pakai layout minimal dulu bila A-14 belum selesai.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/app/(auth)/**`
- `src/components/shared/auth/**`

## Selesai jika
- [ ] Semua state di SCREENS.md ada.
- [ ] Tampilan sesuai `.png` di 360 / 768 / 1280 (+1440 untuk `/masuk`).
- [ ] Alur bisa diselesaikan dengan keyboard saja.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run lint:hex`

## Verifikasi oleh kamu (sebelum merge)
- [ ] Bandingkan setiap layar dengan `.png`-nya di tiga lebar.
- [ ] Isi form dengan data salah: pesan error tampil per field, bukan satu pesan umum.

## Catatan
- Setelah tugas ini, evaluasi: apakah ukuran tugas A-09 → A-13 pas untuk satu sesi agent? Sesuaikan ukuran tugas sprint berikutnya.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
