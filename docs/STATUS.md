# Status Proyek BINZI — catatan untuk melanjutkan di chat baru

> Terakhir diperbarui: 2 Okt 2026. File ini dikelola manual (bukan oleh agent) dan hanya untuk melanjutkan percakapan dengan Claude.
> Untuk melanjutkan: buka chat baru, unggah file ini + `docs/tasks/URUTAN-KERJA.md`, lalu pakai prompt di bagian paling bawah.

## Di mana semua keputusan tersimpan

| Hal | Lokasi |
|---|---|
| Spesifikasi produk & semua keputusan (Q1–Q40, OQ-01–OQ-15) | `docs/prd/PRD-v1.3.md` (indeks: `docs/prd/INDEX.md`) |
| Desain final, token, komponen, daftar layar | `docs/design/handoff/`, `docs/design/screens/` |
| Aturan untuk AI agent (stack, Git, keamanan, vertical slice, tanpa atribusi AI, larangan membaca `.env`) | `CLAUDE.md` |
| Urutan kerja & kartu tugas | `docs/tasks/URUTAN-KERJA.md`, `docs/tasks/fase-0/`, `docs/tasks/konten/` |

**Repo adalah sumber kebenaran.** Jangan mengekstrak zip lama dari Claude ke root repo — salin hanya file yang disebut berubah (pernah terjadi: `CLAUDE.md` versi lama menimpa versi repo).

## Posisi saat ini (Fase 0)

- ✅ Tahap 1: H-01 (repo), H-02 (Supabase — project dev saja), H-09 (Sentry)
- ✅ Tahap 2: A-01 s/d A-04 merged
- Tahap 3:
  - ✅ H-05 Turnstile — widget BINZI, hostname `binzi.vercel.app`
  - ✅ H-06 Google OAuth — status Testing, redirect URI localhost saja, logo ditunda sampai publikasi
  - ✅ H-08 Vercel — project `binzi`, URL `https://binzi.vercel.app`
  - ✅ H-10 env & secret (`.env.local`, Vercel Production & Preview, GitHub Secrets `CRON_SECRET`)
  - ⏸️ H-04 R2 ditunda (aktivasi R2 butuh metode pembayaran). **Wajib selesai sebelum A-17.**
  - ⏸️ H-02 binzi-prod ditunda — dibuat menjelang rilis (region Singapore), bersamaan dengan keputusan OQ-12.
- ⏭️ Berikutnya: **Tahap 4 — A-05** (komponen kendali + halaman /dev/ui)

## Cara kerja yang sudah berjalan

- Satu kartu = satu sesi Claude Code baru. Prompt pembuka ada di `docs/tasks/README.md` — cukup ganti ID kartu.
- Agent membuat branch, commit, push, dan PR sendiri. Kamu meninjau ("Verifikasi oleh kamu" di kartu + tab "Files changed"), lalu **Squash and merge**.
- PR yang CI-nya merah tidak bisa di-merge (required check `ci`).
- Pertanyaan pilihan dari agent (mis. soal file di luar lingkup): bila ragu, bawa ke Claude chat dulu sebelum menjawab.

## Pekerjaan kecil yang masih terbuka

- [ ] Tes env A-02 dibuat tidak bergantung pada env mesin (temuan A-03): beri objek env eksplisit atau bersihkan variabel relevan sebelum tiap tes.
- [ ] Bila `.env.local` sudah berisi password DB Supabase saat A-02: reset password DB di Supabase.
- [ ] Pastikan `git ls-files .githooks` menampilkan `.githooks/commit-msg` dengan mode `100755` (hook pembersih atribusi AI).
- [ ] Setelah 30 Sep 2026: naikkan `next` ke **16.3.7** (rilis keamanan) — kemungkinan datang lewat PR Dependabot; merge bila CI hijau.
- [x] Saat H-08/H-10: set **`MAIL_TRANSPORT=log`** dan **`NEXT_PUBLIC_APP_URL=https://<project>.vercel.app`** di Vercel (Preview & Production) — keduanya wajib di luar development, tanpa itu deploy gagal start.
- [ ] PR Dependabot: patch/minor + CI hijau → merge; versi major → jangan langsung, tangani sebagai kartu tersendiri.
- [ ] H-04 R2 (bucket dev & prod, token dev) sebelum mulai A-17; lalu isi `R2_*` di `.env.local` dan Vercel.

## Keputusan & catatan dari diskusi yang belum ada di PRD

- **Styling:** CSS + Tailwind v4, **tanpa SCSS** (Tailwind v4 tidak dirancang untuk preprocessor). CSS khusus pakai CSS Modules.
- **Mode gelap:** BINZI hanya mode terang. Blok warna `.dark` & `--chart-*` dihapus, tapi `@custom-variant dark (&:is(.dark *))` wajib dipertahankan agar kelas `dark:` shadcn tidak aktif di perangkat bermode gelap.
- **Cincin fokus:** section gelap (`ink-surface`: Tanya Ahli Gizi, footer) harus meng-override `--focus-ring` ke `var(--surface)`.
- **Cara kerja agent:** per fitur (vertical slice): kontrak (Zod/DTO) → server → UI.
- **CI:** env dummy (`NEXT_PUBLIC_APP_URL`, `MAIL_TRANSPORT=log`) hanya di step build; `next typegen` sebelum typecheck; `next-env.d.ts` tidak di-commit.
- **Blok `nextjs-agent-rules`** (ditulis otomatis Next 16) dipertahankan di `CLAUDE.md`.
- **Backup database (Fase 1.5):** PRD §10.5 menjalankan `pg_dump` lewat API route — tidak jalan di Vercel serverless. Jalankan `pg_dump` di runner GitHub Actions lalu unggah ke R2. Wajib berjalan + uji restore sebelum pengguna pertama mendaftar (data disimpan jangka panjang, Q39).
- **CSP:** keputusan menunggu proposal dari kartu A-16 (nonce vs ISR).
- **`STATUS.md`** dikelola manual, bukan oleh agent.
- **Turnstile per lingkungan:** `.env.local`, CI, dan Vercel Preview memakai kunci uji; kunci asli hanya di Vercel Production (URL preview tidak cocok dengan hostname widget).
- **URL di Preview (untuk A-09):** `NEXT_PUBLIC_APP_URL`/`BETTER_AUTH_URL` di Preview sementara diisi `https://binzi.vercel.app`. Saat A-09, pastikan redirect & trusted origins Better Auth mengikuti URL deploy preview (System Environment Variables Vercel sudah diaktifkan).
- **Vercel Production memakai nilai dev** (DB binzi-dev) sampai menjelang rilis.
- **GitHub Secrets:** saat ini hanya `CRON_SECRET`; secret lain ditambahkan saat kartu membutuhkannya.
- **`MIGRATION_DATABASE_URL`** hanya di `.env.local` (dipakai drizzle-kit lokal), tidak di Vercel.
- **`BETTER_AUTH_SECRET`** berbeda antara lokal dan Vercel.

## Rencana setelah Fase 0

1. Setelah A-13 (irisan uji coba login): evaluasi apakah ukuran kartu per sesi sudah pas.
2. Tulis kartu Sprint S1 (CMS kursus & materi) dengan `docs/tasks/_TEMPLATE-agent.md`; sumber: tabel fase di `docs/design/handoff/README.md` + `docs/prd/INDEX.md`.
3. Tahap 8 kapan saja sebelum pengguna nyata: beli domain → Vercel DNS (H-03), Resend (H-07).
4. Jalur konten paralel: K-01 s/d K-06 (K-07 selesai).
5. Sebelum rilis publik: putuskan OQ-12 (Vercel Pro atau Cloudflare Workers).

## Prompt untuk melanjutkan di chat baru

```text
Saya sedang membangun BINZI (platform belajar gizi) dengan Next.js 16 +
AI coding agent (Claude Code). Terlampir docs/STATUS.md dan
docs/tasks/URUTAN-KERJA.md dari repo saya — baca keduanya sebagai konteks.
Spesifikasi lengkap ada di docs/prd/PRD-v1.3.md dan aturan agent di
CLAUDE.md; minta saya unggah bagian yang kamu butuhkan.
Posisi terakhir saya: Tahap 2 selesai (A-01–A-04 merged), mau mulai
Tahap 3 dari H-04 (Cloudflare R2).
```
