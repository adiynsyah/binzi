# H-06 · Google OAuth client

| | |
|---|---|
| **Pemilik** | Kamu (tidak dikerjakan agent) |
| **Perkiraan** | 45 menit |
| **Bergantung pada** | — |
| **Tag ClickUp** | `fase-0`, `manual`, `setup`, `auth` |
| **Judul ClickUp** | `[F0][Kamu] H-06 Google OAuth client` |

## Tujuan
Login dengan Google (AUTH-02). Persona P3 bergantung pada fitur ini.

## Langkah
1. Buat project di Google Cloud Console (mis. `binzi`).
2. Siapkan **OAuth consent screen**: tipe *External*, nama aplikasi **BINZI**, logo `public/brand/logo-binzi-mark.png`, email dukungan. Kolom domain dibiarkan kosong dulu (diisi di H-03). Scope: `openid`, `email`, `profile` saja.
3. Biarkan status **Testing**, lalu tambahkan email kamu sebagai *test user*. Publikasi ke Production dilakukan menjelang rilis, karena butuh URL kebijakan privasi yang sudah online.
4. Buat **OAuth client ID** tipe *Web application*. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - Redirect untuk domain sendiri ditambahkan nanti di H-03.

## Simpan sebagai (nama env var — nilainya hanya di `.env.local` / Vercel / GitHub Secrets)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## Selesai jika
- [ ] Client ID & secret tersimpan, dan email kamu terdaftar sebagai test user.

## Catatan
Selama belum punya domain, **uji login Google di localhost saja**. Di URL Vercel, uji login email/password. Google tidak menerima wildcard di redirect URI, sehingga URL preview Vercel yang berubah-ubah memang tidak cocok untuk login Google.
