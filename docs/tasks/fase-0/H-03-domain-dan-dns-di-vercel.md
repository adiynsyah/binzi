# H-03 · Domain & DNS di Vercel

| | |
|---|---|
| **Pemilik** | Kamu (tidak dikerjakan agent) |
| **Perkiraan** | 30–60 menit (+ tunggu propagasi) |
| **Bergantung pada** | — |
| **Tag ClickUp** | `fase-0`, `manual`, `setup`, `infra`, `sebelum-rilis` |
| **Judul ClickUp** | `[F0][Kamu] H-03 Domain & DNS di Vercel` |

## Tujuan
**Tidak memblokir Fase 0.** Selama pengembangan kamu memakai URL bawaan Vercel. Domain baru dibutuhkan untuk: mengirim email ke orang lain (H-07), mempublikasikan login Google untuk umum, dan produksi. Kerjakan kapan saja sebelum rilis — makin awal makin baik, karena verifikasi DNS butuh waktu.

## Langkah
1. Beli domain `.id` atau `.com` (PRD §9.2: ~Rp 200–500rb/tahun).
2. Di Vercel → project BINZI → Settings → Domains, tambahkan domain. Pilih cara **nameserver**: ganti nameserver di registrar ke nameserver yang ditampilkan Vercel, sehingga DNS dikelola **Vercel DNS** (PRD Q38).
3. Tunggu status domain di Vercel menjadi valid dan sertifikat HTTPS terbit.
4. **Jangan** memasang proxy Cloudflare (awan oranye) di depan Vercel — Vercel tidak merekomendasikannya. Akun Cloudflare tetap dipakai, tapi hanya untuk R2 dan Turnstile.
5. Sambungkan domain ke layanan yang sudah berjalan: tambahkan hostname-nya di **Turnstile** (H-05); tambahkan redirect URI `https://<domain>/api/auth/callback/google` dan isi *authorized domain* di **Google OAuth** (H-06); ubah `NEXT_PUBLIC_APP_URL` & `BETTER_AUTH_URL` di Vercel dan GitHub Secret `APP_URL`.
6. Lanjutkan ke **H-07** (email dengan domain sendiri).

## Simpan sebagai (nama env var — nilainya hanya di `.env.local` / Vercel / GitHub Secrets)
- Nama domain final (mis. `binzi.id`).

## Selesai jika
- [ ] Domain valid di Vercel dengan HTTPS aktif.
- [ ] Aplikasi bisa dibuka lewat domain, dan login email/password berjalan di sana.

## Catatan
Biaya domain ~Rp 200–500rb/tahun (PRD §9.2) adalah satu-satunya biaya wajib MVP. Jika kelak hosting pindah ke Cloudflare Workers (OQ-12), DNS dipindah ke Cloudflare saat itu — bisa tanpa downtime.
