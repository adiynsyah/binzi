# H-07 · Resend: domain pengirim email

| | |
|---|---|
| **Pemilik** | Kamu (tidak dikerjakan agent) |
| **Perkiraan** | 30 menit (+ tunggu verifikasi DNS) |
| **Bergantung pada** | [H-03](H-03-domain-dan-dns-di-vercel.md) |
| **Tag ClickUp** | `fase-0`, `manual`, `setup`, `email`, `sebelum-rilis` |
| **Judul ClickUp** | `[F0][Kamu] H-07 Resend: domain pengirim email` |

## Tujuan
Mengirim email verifikasi, reset password, dan selamat datang ke user sungguhan (NTF-01). **Tidak memblokir Fase 0:** selama pengembangan, `MAIL_TRANSPORT=log` mencetak email (termasuk tautannya) ke terminal, bukan mengirimnya.

## Langkah
1. Buat akun Resend, lalu tambahkan domain kamu (disarankan subdomain, mis. `mail.binzi.id`).
2. Tambahkan record DNS yang diminta Resend (SPF, DKIM) di **Vercel DNS** (Settings → Domains → kelola DNS), lalu tunggu status **Verified**.
3. Buat API key dengan izin *Sending access* saja.
4. Tentukan alamat pengirim, mis. `BINZI <no-reply@mail.binzi.id>`.

## Simpan sebagai (nama env var — nilainya hanya di `.env.local` / Vercel / GitHub Secrets)
- `RESEND_API_KEY`
- `MAIL_FROM`

## Selesai jika
- [ ] Domain berstatus Verified di Resend, dan API key tersimpan.

## Catatan
Ingin melihat tampilan email di inbox sebelum punya domain? Buat akun Resend dan API key saja. Tanpa domain terverifikasi, Resend umumnya hanya mengizinkan pengiriman ke alamat email pemilik akun — cukup untuk mengecek tampilan. Cek batasan terkini di dokumentasi Resend.
