# H-05 · Cloudflare Turnstile

| | |
|---|---|
| **Pemilik** | Kamu (tidak dikerjakan agent) |
| **Perkiraan** | 15 menit |
| **Bergantung pada** | — |
| **Tag ClickUp** | `fase-0`, `manual`, `setup`, `security` |
| **Judul ClickUp** | `[F0][Kamu] H-05 Cloudflare Turnstile` |

## Tujuan
CAPTCHA gratis untuk form login & registrasi (AUTH-10).

## Langkah
1. Di Cloudflare → Turnstile, tambahkan site **BINZI** dengan hostname `localhost` dan URL Vercel kamu (mis. `binzi.vercel.app`). Domain sendiri ditambahkan nanti di H-03.
2. Mode: *Managed*.
3. Untuk development & tes E2E, Cloudflare menyediakan **kunci uji Turnstile** yang selalu lolos (lihat dokumentasi Turnstile bagian *testing*). Pakai kunci uji di `.env.local` dan CI; kunci asli hanya di Vercel.

## Simpan sebagai (nama env var — nilainya hanya di `.env.local` / Vercel / GitHub Secrets)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

## Selesai jika
- [ ] Site key & secret tersimpan, dan kunci uji tercatat untuk dev/CI.
