# H-02 · Supabase: project dev & prod

| | |
|---|---|
| **Pemilik** | Kamu (tidak dikerjakan agent) |
| **Perkiraan** | 30 menit |
| **Bergantung pada** | — |
| **Tag ClickUp** | `fase-0`, `manual`, `setup`, `database` |
| **Judul ClickUp** | `[F0][Kamu] H-02 Supabase: project dev & prod` |

## Tujuan
Menyiapkan dua database PostgreSQL gratis di region Singapura (PRD §9.7, §10.6).

## Langkah
1. Buat project **binzi-dev** dan **binzi-prod**, keduanya region **Southeast Asia (Singapore)**.
2. Simpan password database masing-masing di password manager.
3. Di Project Settings → Database, salin dua connection string untuk **binzi-dev**:
   - **Transaction pooler** (port **6543**) → dipakai aplikasi.
   - **Session pooler** (port **5432**) → dipakai migrasi `drizzle-kit`.
4. Untuk **binzi-prod** cukup dicatat dulu. Belum dipakai sampai menjelang rilis.

## Simpan sebagai (nama env var — nilainya hanya di `.env.local` / Vercel / GitHub Secrets)
- `DATABASE_URL` = transaction pooler dev (6543)
- `MIGRATION_DATABASE_URL` = session pooler dev (5432)

## Selesai jika
- [ ] Dua project aktif, dan kedua connection string dev tersimpan aman.

## Catatan
Project free tier Supabase bisa di-pause otomatis jika lama tidak aktif. A-18 membuat job keep-alive untuk mencegahnya.
