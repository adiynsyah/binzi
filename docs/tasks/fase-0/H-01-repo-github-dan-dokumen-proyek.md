# H-01 · Repo GitHub & dokumen proyek

| | |
|---|---|
| **Pemilik** | Kamu (tidak dikerjakan agent) |
| **Perkiraan** | 30 menit |
| **Bergantung pada** | — |
| **Tag ClickUp** | `fase-0`, `manual`, `setup` |
| **Judul ClickUp** | `[F0][Kamu] H-01 Repo GitHub & dokumen proyek` |

## Tujuan
Menyiapkan repositori privat berisi seluruh dokumen, supaya agent punya konteks sejak sesi pertama.

## Langkah
1. Buat repositori **privat** di GitHub (mis. `binzi`).
2. Ekstrak isi `binzi-docs.zip` ke root repo: `CLAUDE.md`, `docs/`, `public/brand/`.
3. Tambahkan `.gitignore` minimal berisi `.env*` kecuali `.env.example`, `node_modules/`, `.next/`. (A-01 akan melengkapinya.)
4. Commit pertama: `docs: add PRD v1.3, design handoff, tasks`.
5. Aktifkan **branch protection** di `main`: wajib lewat Pull Request. Centang "status checks must pass" setelah CI dari A-03 berjalan.
6. Aktifkan **Dependabot alerts** dan **secret scanning** di Settings → Code security.

## Selesai jika
- [ ] Repo privat ada dan berisi `CLAUDE.md` di root.
- [ ] Push langsung ke `main` ditolak.
