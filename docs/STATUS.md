# Status Proyek BINZI — catatan untuk melanjutkan di chat baru

> Terakhir diperbarui: 7 Okt 2026. File ini dikelola manual (bukan oleh agent) dan hanya untuk melanjutkan percakapan dengan Claude.
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
- ✅ Tahap 3: H-05 Turnstile, H-06 Google OAuth, H-08 Vercel (`https://binzi.vercel.app`), H-10 env & secret
  - ⏸️ H-04 R2 ditunda (aktivasi R2 butuh metode pembayaran). **Wajib selesai sebelum A-17.**
  - ⏸️ H-02 binzi-prod ditunda — dibuat menjelang rilis (region Singapore), bersamaan dengan keputusan OQ-12.
- Tahap 4:
  - ✅ A-05 komponen kendali + halaman /dev/ui
  - ✅ A-06 komponen overlay & umpan balik (PR #18)
  - ✅ A-07 skema Drizzle (22 tabel, 13 enum), migrasi awal & seed — diterapkan ke binzi-dev (PR #20)
  - ✅ Chore: gerbang audit CI dengan pengecualian braces GHSA-vfj7-8cjw-p6xm (PR #21)
  - ✅ A-08 pola modul (5 file), serializer per audiens, error domain → HTTP, batas impor ESLint (PR #23)
  - ✅ A-09 Better Auth inti: email/password, sesi 30 hari/8 jam, rate limit IP+email, Turnstile (PR #25)
  - ✅ A-10 email transaksional, verifikasi (magic link) & reset password (PR #27)
  - ✅ A-11 login Google & penautan akun, anti pra-pembajakan, anti open-redirect (PR #29)
  - ✅ A-12 RBAC & proteksi route: matriks rute tunggal, guard halaman & API, proxy cookie, `npm run user:role` (PR #36)
  - ✅ Chore: kunci ulang sharp 0.35.5, source-map-js 1.2.2, @modelcontextprotocol/sdk ≥ 1.31 (advisory 6–7 Okt 2026; tanpa pengecualian audit baru)
  - ⏭️ Berikutnya: **A-13** (layar autentikasi)
- ✅ Chore: Next 16.3.7 (PR #17). Dependabot: #6 & #7 (actions major) di-merge; #8–#10 (eslint 10, typescript 7, @types/node 26) di-ignore.

## Cara kerja yang sudah berjalan

- Satu kartu = satu sesi Claude Code baru. Prompt pembuka ada di `docs/tasks/README.md` — cukup ganti ID kartu.
- Agent membuat branch, commit, push, dan PR sendiri. Kamu meninjau ("Verifikasi oleh kamu" di kartu + tab "Files changed"), lalu **Squash and merge**.
- PR yang CI-nya merah tidak bisa di-merge (required check `ci`).
- Pertanyaan pilihan dari agent (mis. soal file di luar lingkup): bila ragu, bawa ke Claude chat dulu sebelum menjawab.
- Checklist saat A-07: baca file SQL migrasi sebelum merge (tipe kolom, NOT NULL, foreign key, index) dan cocokkan dengan PRD §11.2–§11.4; tidak ada tabel `certificates`, `consultation_requests`, `course_categories`; satu definisi tabel user (hasil CLI Better Auth + kolom §11.2); seed hanya data sistem dengan nomor WhatsApp dummy, tanpa isi gizi; `db:seed` idempoten.
- Halaman `/dev/ui` hanya hidup di development (404 di preview & production) → verifikasi komponen UI selalu di lokal.

## Pekerjaan kecil yang masih terbuka

- [ ] Tes env A-02 dibuat tidak bergantung pada env mesin (temuan A-03): beri objek env eksplisit atau bersihkan variabel relevan sebelum tiap tes.
- [x] Bila `.env.local` sudah berisi password DB Supabase saat A-02: reset password DB di Supabase.
- [ ] Pastikan `git ls-files .githooks` menampilkan `.githooks/commit-msg` dengan mode `100755` (hook pembersih atribusi AI).
- [x] Setelah 30 Sep 2026: naikkan `next` ke **16.3.7** (rilis keamanan) — kemungkinan datang lewat PR Dependabot; merge bila CI hijau.
- [x] Saat H-08/H-10: set **`MAIL_TRANSPORT=log`** dan **`NEXT_PUBLIC_APP_URL=https://<project>.vercel.app`** di Vercel (Preview & Production) — keduanya wajib di luar development, tanpa itu deploy gagal start.
- [ ] H-04 R2 (bucket dev & prod, token dev) sebelum mulai A-17; lalu isi `R2_*` di `.env.local` dan Vercel.
- [ ] Kunci versi Node: `.nvmrc` + `engines.node` di package.json, sama dengan CI & Vercel. Node lokal sudah dinaikkan ke 24 (sebelumnya v20.19, sudah EOL → peringatan EBADENGINE dari vitest). `npm run user:role` butuh Node ≥ 22.9 (`--env-file-if-exists`) — alasan tambahan mengisi `engines.node`.
- [ ] Kartu "pembaruan toolchain" setelah Fase 0: TypeScript 7, ESLint 10, `@types/node` (major yang di-ignore Dependabot) + penguncian versi Node.
- [ ] Kartu "pembaruan token": tambah `success-tint-line` (garis banner sukses sementara `border-success`, usulan A-06) + temuan desain lain.
- [ ] Gambar desain yang gagal dibaca agent (7a, 28e): cek dengan `file docs/design/screens/*.png | grep -v "PNG image"`, ekspor ulang sebagai PNG asli.
- [ ] Saat A-13: `src/components/ui/password-rules.ts` mengimpor `passwordSchema`/`PASSWORD_MIN_LENGTH` dari `src/modules/auth/schema.ts` (sumber tunggal sejak A-09).
- [ ] Chore: `src/components/ui/pagination.tsx` mengimpor `PAGE_SIZE` dari `src/lib/pagination.ts` (sumber tunggal sejak A-08).
- [ ] Chore: alias `@/` di `vitest.config.ts`, lalu ganti impor relatif (`../../db/schema`, `../../lib/...`) di `src/modules/**` menjadi `@/`.
- [ ] Setelah A-09: aturan ESLint yang melarang impor `@/db` dari luar `src/modules/**` dan `src/db/**` (pengecualian: adapter Better Auth di `src/lib/auth.ts`).
- [ ] Integrasi pelaporan error asli ke Sentry di route/server action sebelum `toErrorResponse()` (aturan di `src/modules/README.md`) — sebelum route API fitur pertama.
  Saat integrasi: hanya error tak terduga (5xx) yang dilaporkan ke Sentry; error domain 4xx (401/403/404/409/422) tidak dilaporkan dan di log cukup satu baris tanpa stack trace.
- [x] Konflik peer npm better-auth ↔ @babel/core@7 diselesaikan dengan overrides (PR #25) — lihat catatan keputusan.
- [ ] Chore: `src/db/index.ts` dibuat lazy (`getDb()`) agar route tidak perlu impor dinamis seperti `src/lib/auth.ts` (A-09).
- [ ] Kartu manajemen user (ubah role): WAJIB mencabut semua sesi user tersebut — masa sesi (30 hari/8 jam) ditetapkan saat sesi dibuat. CLI `user:role` (A-12) sudah melakukannya dalam satu transaksi — pakai ulang logikanya.
- [x] Enumerasi lewat sign-up ditutup di A-10 (`requireEmailVerification` + `customSyntheticUser`, respons identik).
- [x] baseURL Preview mengikuti `VERCEL_BRANCH_URL` (A-10). Callback Google OAuth untuk Preview diputuskan di A-11.
- [ ] Chore: rapikan format Prettier `schema.test.ts` (drift di main, dicatat saat A-10).
- [ ] Saat A-13: halaman tujuan tautan verifikasi & reset (`callbackURL`/`redirectTo`), tampilan kode error `TOKEN_EXPIRED`/`INVALID_TOKEN`, dan form mengirim token Turnstile lewat header `x-captcha-response`.
- [ ] Sebelum pengguna nyata: H-07 Resend + `MAIL_TRANSPORT=resend` di Vercel Production. Dengan transport `log`, tautan bertoken tercetak di log Vercel.
- [ ] `users.last_login_at` belum diisi saat login (opsional, catatan PR #25).
- [ ] Sebelum 2 Nov 2026: cek advisory braces GHSA-vfj7-8cjw-p6xm. Bila sudah ada versi tambalan, hapus entri di .github/audit-exceptions.json dan upgrade; bila belum, perpanjang expires dengan alasan yang diperbarui.
- [ ] `id_token` Google masih tersimpan plaintext (`encryptOAuthTokens` hanya mencakup access/refresh token). BINZI tidak memakainya setelah login → kosongkan lewat `databaseHooks.account` create/update.before.
- [ ] Saat A-13: copy untuk kode `account_not_verified` (usulan di PR #29) dan `email_not_verified`; tombol Google disembunyikan di Preview (provider nonaktif di sana).
- [ ] Cek aturan branch `main`: tombol Squash and merge aktif walau CI merah (PR #36). Pastikan "Require status checks to pass" aktif dengan check `ci` terdaftar, dan bypass admin dimatikan.
- [ ] Chore kosmetik: hapus `--env-file-if-exists=.env` dari script `user:role` (repo tidak punya `.env`; pesan "not found" muncul dua kali).
- [ ] Saat A-14: guard layout `(learn)` baru bisa diuji setelah `/belajar/page.tsx` ada (URL tanpa halaman langsung 404 tanpa melewati layout grup). Uji: cabut sesi lewat `user:role`, refresh `/belajar` → harus ke `/masuk?next=%2Fbelajar`.

## Keputusan & catatan dari diskusi yang belum ada di PRD

- **Styling:** CSS + Tailwind v4, **tanpa SCSS** (Tailwind v4 tidak dirancang untuk preprocessor). CSS khusus pakai CSS Modules.
- **Mode gelap:** BINZI hanya mode terang. Blok warna `.dark` & `--chart-*` dihapus, tapi `@custom-variant dark (&:is(.dark *))` wajib dipertahankan agar kelas `dark:` shadcn tidak aktif di perangkat bermode gelap.
- **Cincin fokus:** section gelap (`ink-surface`: Tanya Ahli Gizi, footer) harus meng-override `--focus-ring` ke `var(--surface)`.
- **Cara kerja agent:** per fitur (vertical slice): kontrak (Zod/DTO) → server → UI.
- **CI:** env dummy (`NEXT_PUBLIC_APP_URL`, `MAIL_TRANSPORT=log`) hanya di step build; `next typegen` sebelum typecheck; `next-env.d.ts` tidak di-commit.
- **Blok `nextjs-agent-rules`** (ditulis otomatis Next 16) dipertahankan di `CLAUDE.md`.
- **Backup database (Fase 1.5):** PRD §10.5 menjalankan `pg_dump` lewat API route — tidak jalan di Vercel serverless. Jalankan `pg_dump` di runner GitHub Actions lalu unggah ke R2. Wajib berjalan + uji restore sebelum pengguna pertama mendaftar (data disimpan jangka panjang, Q39).
- **CSP:** keputusan menunggu proposal dari kartu A-16 (nonce vs ISR).
- **`STATUS.md`:** isinya ditentukan pemilik repo; agent hanya boleh menerapkan teks yang sudah ditentukan apa adanya (lewat PR), tidak menulis isinya sendiri.
- **Turnstile per lingkungan:** `.env.local`, CI, dan Vercel Preview memakai kunci uji; kunci asli hanya di Vercel Production (URL preview tidak cocok dengan hostname widget).
- **URL di Preview:** baseURL Better Auth = `https://VERCEL_BRANCH_URL` (fallback `VERCEL_URL`) bila `VERCEL_ENV=preview` (A-10); `trustedOrigins` mencakup semua origin deploy. Production/lokal memakai `BETTER_AUTH_URL` ?? `NEXT_PUBLIC_APP_URL`.
- **Vercel Production memakai nilai dev** (DB binzi-dev) sampai menjelang rilis.
- **GitHub Secrets:** saat ini hanya `CRON_SECRET`; secret lain ditambahkan saat kartu membutuhkannya.
- **`MIGRATION_DATABASE_URL`** hanya di `.env.local` (dipakai drizzle-kit lokal), tidak di Vercel.
- **`BETTER_AUTH_SECRET`** berbeda antara lokal dan Vercel.
- **Dependabot major:** GitHub Actions major dengan CI hijau boleh di-merge (CI di PR itu sendiri membuktikan versinya jalan); paket npm major → komentar `@dependabot ignore this major version`, lalu ditangani sebagai kartu tersendiri.
- **Batas 5 PR Dependabot:** jangan biarkan 5 PR menumpuk — selama penuh, Dependabot tidak membuka PR baru, termasuk rilis keamanan.
- **Keyframes khusus komponen** ditulis di CSS Module di samping komponennya (contoh: shimmer skeleton A-06), bukan di `globals.css`.
- **Badge "Selesai"** memakai token netral terdekat; slate di 16c tidak ada di TOKENS.md.
- **EmptyState:** aksi utama & alternatif berupa objek `{ label, href?, onClick? }` yang dirender sebagai Button — dijaga TypeScript.
- **Password DB binzi-dev di-reset 2 Okt 2026** (sebelum A-07), hanya huruf & angka agar aman di connection string.
- **Tabel auth:** nama jamak + kolom snake_case (`users`, `sessions`, `accounts`, `verifications`). Di A-09, `drizzleAdapter` perlu pemetaan `schema` atau `usePlural: true`.
- **Seed non-destruktif** (`onConflictDoNothing`): nilai bawaan yang sudah ada diubah lewat CMS atau migrasi data, bukan dengan mengedit seed.
- **Tafsiran skema A-07:** kolom §11.2 tanpa label = nullable; `content_status` memakai `IN_REVIEW` (CMS-05); `audit_logs.actor_id` NOT NULL (hanya aksi manusia yang diaudit). Cara mengisi `articles.search_vector` diputuskan di sprint artikel.
- **Gerbang audit CI** (PR #21): `scripts/check-audit.mjs` menggantikan `npm audit --audit-level=high`. Pengecualian hanya per ID GHSA dengan tanggal kedaluwarsa di `.github/audit-exceptions.json`; temuan high lain tetap menggagalkan CI. Jangan menambah pengecualian tanpa alasan dan tanggal kedaluwarsa.
- **Pola modul (A-08, lihat `src/modules/README.md`):** 5 file (`schema`, `policy`, `queries`, `serializer`, `service`). Dari luar modul: `service.ts` dan `schema.ts` (boleh dipakai form klien); tipe DTO via `import type` dari `service.ts`; `queries.ts` tidak pernah (ESLint). Satu DTO per audiens, DTO JSON-safe (tanggal = string ISO). 404 untuk kepemilikan, 403 untuk role; endpoint ber-role cek role sebelum parse input.
- **Auth (A-09):** sesi jendela tetap dari login — member 30 hari, staf (EDITOR/ADMIN/SUPER_ADMIN) 8 jam, `disableSessionRefresh`. Rate limit = reservasi atomik per IP+email di `rate_limits` sebelum password dicek; login sukses menghapus bucket; IPv6 dipotong ke /64. Turnstile lewat plugin captcha resmi, token di header `x-captcha-response`. Cookie `__Secure-better-auth.session_token` di https. `role`/`status` `input: false`.
- **Tes integrasi auth:** PGlite + migrator Drizzle (`src/db/migrations`), tanpa database di CI, tanpa jaringan.
- **Overrides `@babel/plugin-transform-runtime: ^7.29.0`** (PR #25): menyelesaikan konflik peer opsional better-auth → @tanstack/react-start → @babel/core@8-rc. Hapus bila better-auth melepas peer itu atau shadcn pindah ke @babel/core@8.
- **Email (A-10):** template = fungsi TS → HTML string (tanpa React Email), Resend via `fetch` REST dengan timeout 10 detik. Pengiriman tidak pernah melempar error ke alur HTTP; kegagalan dicatat di log dengan alamat disamarkan. Semua nilai di-escape, URL hanya http/https. Warna dari `src/emails/tokens.ts` — satu-satunya pengecualian `lint:hex`, dijaga tes paritas dengan `tokens.css`.
- **Verifikasi & reset (A-10):** `requireEmailVerification` aktif; tautan verifikasi 24 jam = magic link (otomatis masuk) + email selamat datang. Token reset 1 jam, sekali pakai, mencabut semua sesi. Rate limit 3/jam/email untuk lupa password dan kirim ulang verifikasi; respons identik untuk email terdaftar/tidak.
- **Google OAuth (A-11):** provider nonaktif di Preview; production tanpa `GOOGLE_CLIENT_ID`/`SECRET` = fail-fast (seluruh auth mati, jadi env wajib ada); development tanpa env = nonaktif + peringatan. Profil Google wajib `email_verified=true`. Token OAuth disimpan terenkripsi (`encryptOAuthTokens`). Akun baru dari Google menerima email selamat datang.
- **Penautan akun (A-11):** `requireLocalEmailVerified` bawaan better-auth DIMATIKAN; aturannya dipindah ke hook `validateUserInfo` yang fail-closed dan berlaku untuk SEMUA provider OAuth. Login Google yang bertemu akun lokal belum terverifikasi → ditolak `account_not_verified`, password akun itu dihapus, sesinya dicabut, dan tautan verifikasi baru dikirim (3/jam/email). Jangan aktifkan kembali `trustedProviders`.
- **Redirect (A-11):** semua parameter redirect auth (`callbackURL`, `errorCallbackURL`, `newUserCallbackURL`, `redirectTo`) hanya menerima path internal (`safeInternalRedirectPath` di `src/modules/auth/schema.ts`). Pakai fungsi yang sama untuk `?next=`.
- **RBAC (A-12):** matriks rute di `src/lib/rbac.ts` sebagai sumber tunggal — MEMBER+: /belajar/**, /profil · EDITOR+: /cms, /cms/konten, /cms/artikel, /cms/kursus/**, /cms/media · ADMIN+: /cms/kategori, /cms/pengguna, /cms/reset-attempt · SUPER_ADMIN: /cms/pengaturan, /cms/audit-log. Sub-path /cms/* yang tidak terdaftar = SUPER_ADMIN (fail-closed). API CMS di /api/cms/* (tanpa v1; PRD V-04 perlu dirapikan). Halaman belum login → redirect /masuk?next= (lewat safeInternalRedirectPath); API belum login → 401 JSON tanpa redirect; role kurang → 403 (`forbidden()`, butuh `experimental.authInterrupts`). Role & status dibaca dari DB per request; status non-ACTIVE = belum login. Proxy hanya cek cookie (`getSessionCookie`), tanpa DB. Perubahan role selalu mencabut semua sesi user. Guard berlapis: layout + setiap page, route handler, dan server action.
- **Advisory baru di tengah PR:** CI bisa merah tanpa perubahan kode karena advisory baru. Perbaiki lewat PR chore dari `main` (kunci ulang lockfile, tanpa pengecualian bila tambalan tersedia), lalu perbarui branch kartu lewat terminal (`git merge origin/main`). Tombol "Update branch" tidak tampil di repo ini.

## Rencana setelah Fase 0

1. Setelah A-13 (irisan uji coba login): evaluasi apakah ukuran kartu per sesi sudah pas.
2. Tulis kartu Sprint S1 (CMS kursus & materi) dengan `docs/tasks/_TEMPLATE-agent.md`; sumber: tabel fase di `docs/design/handoff/README.md` + `docs/prd/INDEX.md`.
3. Tahap 8 kapan saja sebelum pengguna nyata: beli domain → Vercel DNS (H-03), Resend (H-07). Saat itu juga: tambah redirect URI domain di Google OAuth, unggah logo & publish consent screen (sekarang Testing, redirect localhost saja), dan tambah hostname domain di widget Turnstile.
4. Jalur konten paralel: K-01 s/d K-06 (K-07 selesai).
5. Sebelum rilis publik: putuskan OQ-12 (Vercel Pro atau Cloudflare Workers).

## Prompt untuk melanjutkan di chat baru

```text
Saya sedang membangun BINZI (platform belajar gizi) dengan Next.js 16 +
AI coding agent (Claude Code). Terlampir docs/STATUS.md dan
docs/tasks/URUTAN-KERJA.md dari repo saya — baca keduanya sebagai konteks.
Spesifikasi lengkap ada di docs/prd/PRD-v1.3.md dan aturan agent di
CLAUDE.md; minta saya unggah bagian yang kamu butuhkan.
Posisi terakhir saya: A-12 sudah merged (PR #36), mau mulai A-13 (layar autentikasi).
```
