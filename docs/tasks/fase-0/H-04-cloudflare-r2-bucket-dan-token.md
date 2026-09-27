# H-04 · Cloudflare R2: bucket & token

| | |
|---|---|
| **Pemilik** | Kamu (tidak dikerjakan agent) |
| **Perkiraan** | 30 menit |
| **Bergantung pada** | — |
| **Tag ClickUp** | `fase-0`, `manual`, `setup`, `storage` |
| **Judul ClickUp** | `[F0][Kamu] H-04 Cloudflare R2: bucket & token` |

## Tujuan
Menyiapkan object storage untuk video & gambar (PRD §9.2, §10.3).

## Langkah
1. Buat akun Cloudflare (gratis) bila belum ada — **tidak perlu domain** untuk R2, dan domainmu nanti tetap dikelola di Vercel. Aktifkan R2.
2. Buat bucket **binzi-media-dev** dan **binzi-media-prod**. **Jangan** aktifkan akses publik (r2.dev maupun custom domain) — V-07 mensyaratkan bucket tidak publik.
3. Buat **R2 API token** dengan izin *Object Read & Write*, dibatasi ke bucket dev saja. Buat token terpisah untuk prod nanti.
4. Catat Account ID.

## Simpan sebagai (nama env var — nilainya hanya di `.env.local` / Vercel / GitHub Secrets)
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET` = `binzi-media-dev`

## Selesai jika
- [ ] Kedua bucket ada, akses publik nonaktif, dan token dev tersimpan.

## Catatan
Aturan CORS untuk upload dari browser disiapkan di Sprint S1/S2, saat fitur upload dibangun.
