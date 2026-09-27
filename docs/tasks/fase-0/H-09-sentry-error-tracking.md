# H-09 · Sentry: error tracking

| | |
|---|---|
| **Pemilik** | Kamu (tidak dikerjakan agent) |
| **Perkiraan** | 15 menit |
| **Bergantung pada** | — |
| **Tag ClickUp** | `fase-0`, `manual`, `setup`, `observability` |
| **Judul ClickUp** | `[F0][Kamu] H-09 Sentry: error tracking` |

## Tujuan
Menangkap error sejak awal pengembangan (PRD §9.2).

## Langkah
1. Buat akun Sentry (free), lalu buat project platform **Next.js** bernama `binzi`.
2. Catat DSN.
3. Buat auth token untuk upload source map. Token ini hanya disimpan di Vercel/CI, bukan di `.env.local`.
4. PostHog (analitik produk) **tidak** perlu disiapkan sekarang; baru dipakai di S6 untuk event konsultasi.

## Simpan sebagai (nama env var — nilainya hanya di `.env.local` / Vercel / GitHub Secrets)
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN` (CI/Vercel saja)

## Selesai jika
- [ ] Project Sentry ada, dan DSN tersimpan.
