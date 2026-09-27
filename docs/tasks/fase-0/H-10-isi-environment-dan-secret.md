# H-10 · Isi environment & secret

| | |
|---|---|
| **Pemilik** | Kamu (tidak dikerjakan agent) |
| **Perkiraan** | 30 menit |
| **Bergantung pada** | [A-02](A-02-konfigurasi-environment-tervalidasi-zod.md), [H-02](H-02-supabase-project-dev-dan-prod.md), [H-04](H-04-cloudflare-r2-bucket-dan-token.md), [H-05](H-05-cloudflare-turnstile.md), [H-06](H-06-google-oauth-client.md), [H-09](H-09-sentry-error-tracking.md) |
| **Tag ClickUp** | `fase-0`, `manual`, `setup`, `security` |
| **Judul ClickUp** | `[F0][Kamu] H-10 Isi environment & secret` |

## Tujuan
Memasukkan semua kredensial ke tempat yang benar, tanpa pernah menempelkannya ke chat dengan agent.

## Langkah
1. Salin `.env.example` (dibuat A-02) menjadi `.env.local`, lalu isi dengan nilai dari H-02, H-04, H-05, H-06, H-09.
2. Set `MAIL_TRANSPORT=log`; biarkan `RESEND_API_KEY` & `MAIL_FROM` kosong sampai H-07.
3. `NEXT_PUBLIC_APP_URL` & `BETTER_AUTH_URL`: `http://localhost:3000` di `.env.local`, dan `https://<project>.vercel.app` di Vercel.
4. Buat `BETTER_AUTH_SECRET` acak (mis. `openssl rand -base64 32`) dan `CRON_SECRET` acak dengan cara yang sama.
5. Isi nilai yang sama di Vercel (Preview) dan GitHub → Settings → Secrets (untuk CI & cron).
6. Jalankan `npm run dev`. Aplikasi harus menyala tanpa error validasi env.
7. Jika sebagian layanan belum siap, biarkan kosong. Validasi env (A-02) akan menunjukkan variabel mana yang hilang.

## Selesai jika
- [ ] `npm run dev` jalan.
- [ ] `git status` tidak menampilkan `.env.local`.
- [ ] Tidak ada secret yang pernah ditulis di chat, issue, atau commit.

## Catatan
Aturan emas: agent boleh **membaca nama** variabel env, tapi kamu yang **mengisi nilainya**. Jika agent meminta nilai secret, tolak.
