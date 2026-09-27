# Status Proyek BINZI — catatan untuk melanjutkan di chat baru

> Terakhir diperbarui: 27 Sep 2026. Perbarui file ini setiap kali ada kemajuan atau keputusan baru, lalu commit lewat PR.
> Untuk melanjutkan dengan Claude di chat baru: unggah file ini + `docs/tasks/URUTAN-KERJA.md`, lalu pakai prompt di bagian paling bawah.

## Di mana semua keputusan tersimpan

| Hal | Lokasi |
|---|---|
| Spesifikasi produk & semua keputusan (Q1–Q40, OQ-01–OQ-15) | `docs/prd/PRD-v1.3.md` (indeks: `docs/prd/INDEX.md`) |
| Desain final, token, komponen, daftar layar | `docs/design/handoff/`, `docs/design/screens/` |
| Aturan untuk AI agent (stack, Git, keamanan, vertical slice, tanpa atribusi AI) | `CLAUDE.md` |
| Urutan kerja & kartu tugas | `docs/tasks/URUTAN-KERJA.md`, `docs/tasks/fase-0/`, `docs/tasks/konten/` |

## Posisi saat ini (Fase 0)

- ✅ Tahap 1: H-01 (repo), H-02 (Supabase), H-09 (Sentry)
- ✅ A-01 scaffold Next.js 16.3.x — merged
- ✅ A-02 env tervalidasi Zod — terverifikasi; `env.server.ts` + `env.client.ts` + `instrumentation.ts`
- ✅ A-03 CI — merged (PR #5); job `ci` menjadi required check
- ⏭️ Berikutnya: A-04 (design tokens), lalu Tahap 3 (H-04, H-05, H-06, H-08, H-10)

## Pekerjaan kecil yang masih terbuka

- [x] PR `chore/secret-guard`: `permissions.deny` untuk `.env`/`.env.local`/`.env.*.local` di `.claude/settings.json` + aturan di `CLAUDE.md` bahwa agent dilarang membaca/mengubah file env (termasuk lewat shell). Latar: agent sempat membuka `.env.local` di A-02.
- [ ] Bila `.env.local` sudah berisi password DB Supabase saat A-02: reset password DB di Supabase.
- [ ] Pastikan `git ls-files .githooks` menampilkan `.githooks/commit-msg` (hook pembersih atribusi AI ter-commit, mode `100755`).
- [ ] Putuskan commit `83a3489` (blok `nextjs-agent-rules` yang ditulis otomatis Next 16 ke `CLAUDE.md`): pertahankan bila hanya menunjuk dokumentasi versi terpasang.
- [x] Setelah PR A-03 hijau: merge dengan **Squash and merge**, lalu jadikan job `ci` sebagai *required status check* di branch protection `main`.
- [ ] Setelah 30 Sep 2026: naikkan `next` ke **16.3.7** (rilis keamanan) lewat PR kecil terpisah.
- [ ] Saat H-08/H-10: set `MAIL_TRANSPORT=log` dan `NEXT_PUBLIC_APP_URL` di Vercel (Preview & Production) — keduanya wajib di luar development.
- [x] Masukkan versi terbaru kartu `docs/tasks/fase-0/A-03-…md` (tambahan soal `next-env.d.ts`) ke repo bila belum.
- [ ] Tes env A-02 dibuat tidak bergantung pada env mesin (temuan A-03): beri objek env eksplisit atau bersihkan variabel relevan sebelum tiap tes.

## Keputusan & catatan dari diskusi yang belum ada di PRD

- **Styling:** tetap CSS + Tailwind v4, **tanpa SCSS** — Tailwind v4 tidak dirancang untuk dipakai bersama preprocessor; CSS variable & nesting native sudah cukup; CSS khusus pakai CSS Modules.
- **Cara kerja agent:** per fitur (vertical slice): kontrak (Zod/DTO) → server → UI. Bukan frontend dulu lalu backend.
- **Git:** agent membuat branch/commit/PR sendiri; kamu yang merge. Pesan commit & PR tanpa atribusi AI (settings `attribution` + hook + aturan).
- **Backup database (untuk Fase 1.5):** PRD §10.5 menjalankan `pg_dump` lewat API route — tidak akan jalan di Vercel serverless. Jalankan `pg_dump` langsung di runner GitHub Actions lalu unggah ke R2. Wajib berjalan (dan uji restore) sebelum pengguna pertama mendaftar, karena data disimpan jangka panjang (Q39).
- **CSP:** keputusan menunggu proposal dari kartu A-16 (nonce vs ISR).

## Rencana setelah Fase 0

1. Setelah A-13 (irisan uji coba login): evaluasi apakah ukuran kartu per sesi sudah pas.
2. Tulis kartu Sprint S1 (CMS kursus & materi) dengan `docs/tasks/_TEMPLATE-agent.md`; sumber: tabel fase di `docs/design/handoff/README.md` + `docs/prd/INDEX.md`.
3. Tahap 8 kapan saja sebelum pengguna nyata: beli domain → Vercel DNS (H-03), Resend (H-07).
4. Jalur konten paralel: K-01 s/d K-06 (K-07 selesai).
5. Sebelum rilis publik: putuskan OQ-12 (Vercel Pro atau Cloudflare Workers).

## Prompt untuk melanjutkan di chat baru

```text
Saya sedang membangun BINZI (platform belajar gizi) dengan Next.js 16 +
AI coding agent. Terlampir docs/STATUS.md dan docs/tasks/URUTAN-KERJA.md
dari repo saya. Baca keduanya sebagai konteks. Semua spesifikasi ada di
docs/prd/PRD-v1.3.md dan aturan agent di CLAUDE.md — minta saya unggah
bagian yang kamu butuhkan. Saya ingin melanjutkan dari posisi terakhir: <tulis di sini>.
```
