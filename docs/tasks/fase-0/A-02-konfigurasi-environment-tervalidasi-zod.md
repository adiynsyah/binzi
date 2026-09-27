# A-02 · Konfigurasi environment tervalidasi Zod

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-01](A-01-scaffold-proyek-next-js-16.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `foundation`, `security` |
| **Judul ClickUp** | `[F0][Agent] A-02 Konfigurasi environment tervalidasi Zod` |

## Tujuan
Semua env var divalidasi saat startup, sehingga salah konfigurasi langsung gagal dengan pesan jelas (§12.5).

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/12-keamanan.md` (§12.5)
- `docs/prd/sections/10-arsitektur-system-design.md` (§10.6)
- `docs/tasks/README.md` (tabel Environment variables)

## Kerjakan
- `src/config/env.ts`: skema Zod terpisah untuk server dan klien (`NEXT_PUBLIC_*`). Variabel server tidak boleh bisa diimpor dari komponen klien (gunakan `server-only`).
- Daftar variabel persis seperti tabel env di `docs/tasks/fase-0/README.md`. Variabel layanan yang belum dipakai boleh opsional, dengan komentar tugas mana yang mewajibkannya.
- `MAIL_TRANSPORT` = `resend` | `log` (default `log` di development).
- `.env.example` berisi semua nama variabel dengan nilai kosong + komentar sumbernya (H-xx).
- Pesan error validasi menyebut nama variabel yang salah, **tanpa mencetak nilainya**.

## Bukan lingkup tugas ini
- Mengisi nilai secret — itu H-10.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/config/env.ts`
- `.env.example`

## Selesai jika
- [ ] Aplikasi gagal start dengan pesan jelas bila variabel wajib hilang.
- [ ] Nilai secret tidak pernah muncul di log atau pesan error.
- [ ] Tes unit untuk skema env.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Verifikasi oleh kamu (sebelum merge)
- [ ] Hapus satu variabel wajib dari `.env.local`, lalu jalankan `npm run dev` → pesan error harus menyebut nama variabelnya.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
