# Status Proyek BINZI — catatan untuk melanjutkan di chat baru

> Terakhir diperbarui: 10 Okt 2026. File ini dikelola manual (bukan oleh agent) dan hanya untuk melanjutkan percakapan dengan Claude.
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
  - ✅ A-13 layar autentikasi: /masuk, /daftar, /daftar/verifikasi, /lupa-password, /reset-password + LoginModal 2c (PR #39). Di-merge tanpa verifikasi manual; verifikasi 9 Okt menemukan 7 temuan (1 blocker, 1 keamanan).
  - ✅ Fix temuan verifikasi A-13 (PR #40): crash /reset-password, tata letak /lupa-password & /reset-password, Turnstile di endpoint kirim email, tautan "Kembali ke Masuk", ikon jam di banner terkunci, pesan 429, plus perapian panel kedaluwarsa. Sisa langkah verifikasi → "Pekerjaan kecil yang masih terbuka".
  - ✅ Env Vercel diperbaiki (9 Okt): `NEXT_PUBLIC_APP_URL` & `MAIL_TRANSPORT` di Production + Preview, redeploy tanpa cache. /masuk, /daftar, /lupa-password tayang di `https://binzi.vercel.app` dengan Turnstile kunci asli.
  - ✅ Chore: next 16.3.8 (6 advisory high) — ikut di PR #39 sebagai pengecualian (lihat catatan keputusan).
  - ✅ Chore: callbackURL email verifikasi dari hook A-11 → `/daftar/verifikasi` lewat sumber tunggal `VERIFICATION_CALLBACK_PATH` (PR #41). Diverifikasi manual 10 Okt: tautan hook berisi `callbackURL=%2Fdaftar%2Fverifikasi`, token rusak → state "belum aktif" (`?error=INVALID_TOKEN`), tautan asli → "Akun aktif" sudah masuk, login Google berikutnya tertaut normal.
  - ✅ Chore: hapus anotasi ID dari teks UI — `(AUTH-07)` di /daftar/verifikasi, `(AUTH-06)` di /reset-password, `(A-15)` di placeholder /cms — plus aturan anotasi desain di `CLAUDE.md` (PR #42).
  - ⏭️ Berikutnya: (1) sisa verifikasi A-13 + uji masuk di Production, (2) **A-14** (kerangka layout publik & member)
- ✅ Chore: Next 16.3.7 (PR #17). Dependabot: #6 & #7 (actions major) di-merge; #8–#10 (eslint 10, typescript 7, @types/node 26) di-ignore.

## Cara kerja yang sudah berjalan

- Satu kartu = satu sesi Claude Code baru. Prompt pembuka ada di `docs/tasks/README.md` — cukup ganti ID kartu.
- Agent membuat branch, commit, push, dan PR sendiri. Kamu meninjau ("Verifikasi oleh kamu" di kartu + tab "Files changed"), lalu **Squash and merge**.
- PR yang CI-nya merah tidak bisa di-merge (required check `ci`).
- Pertanyaan pilihan dari agent (mis. soal file di luar lingkup): bila ragu, bawa ke Claude chat dulu sebelum menjawab.
- Checklist saat A-07: baca file SQL migrasi sebelum merge (tipe kolom, NOT NULL, foreign key, index) dan cocokkan dengan PRD §11.2–§11.4; tidak ada tabel `certificates`, `consultation_requests`, `course_categories`; satu definisi tabel user (hasil CLI Better Auth + kolom §11.2); seed hanya data sistem dengan nomor WhatsApp dummy, tanpa isi gizi; `db:seed` idempoten.
- Halaman `/dev/ui` hanya hidup di development (404 di preview & production) → verifikasi komponen UI selalu di lokal.
- URL Preview Vercel dilindungi Deployment Protection (SSO): agent tidak bisa membukanya (curl → 302 ke login). Pembukaan Preview selalu oleh kamu, sambil login Vercel.
- Setelah mengubah env di Vercel: redeploy **tanpa build cache**, lalu buka `/masuk` di Production. Status "Ready" tidak membuktikan env benar.

## Pekerjaan kecil yang masih terbuka

- [ ] **Sisa verifikasi A-13 (setelah PR #40).** Sudah lolos 9 Okt: daftar + verifikasi magic link, anti-enumerasi daftar ulang (tanpa email baru, satu baris `users`, password lama tidak tertimpa), error per field, kunci 5× (UI 429), `/reset-password` tanpa token & `?token=palsu` → panel kedaluwarsa. Belum dilaporkan:
  - reset dengan tautan asli → sesi di browser lain tercabut; tautan yang sama dibuka lagi → panel kedaluwarsa;
  - akun belum terverifikasi + password benar → banner + "Kirim ulang tautan" (menunggu token Turnstile baru);
  - lupa password 4×/jam → pesan "satu jam";
  - `?next=https://evil.com` / `//evil.com` → `/`; `?error=<teks>` → pesan generik; sudah masuk → `/masuk` & `/daftar` dialihkan;
  - curl tanpa `x-captcha-response` ke `/api/auth/request-password-reset` & `/api/auth/send-verification-email` → 400;
  - kunci 5× dengan Keep log dan email baru → 5× 401 lalu 429 (tes integrasi sudah membuktikan; pengamatan 9 Okt 429 di percobaan ke-5 kemungkinan karena satu percobaan sebelumnya di jendela yang sama);
  - satu alur penuh dengan keyboard saja; visual 360/768/1280 (+1440 `/masuk`) termasuk margin tepi di 360.
  Temuan → PR fix dari `main`.
- [x] **Env Vercel (temuan PR #39):** selesai 9 Okt (Production terverifikasi; penyebab error setelah perbaikan pertama: `MAIL_TRANSPORT` diisi `LOG` huruf besar). Catatan aslinya: log build Preview menunjukkan `NEXT_PUBLIC_APP_URL` kosong di Preview. Di Vercel → Settings → Environment Variables, pastikan semua env yang dibutuhkan dicentang untuk **Preview dan Production** tanpa batasan branch (`NEXT_PUBLIC_APP_URL`, `MAIL_TRANSPORT=log`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` (kunci uji di Preview), `BETTER_AUTH_SECRET`, `DATABASE_URL`, dst.). Lalu **redeploy** (nilai `NEXT_PUBLIC_*` ditanam saat build) dan buka `/masuk` & `/daftar` di URL Preview dan di `https://binzi.vercel.app`.
- [ ] Tes env A-02 dibuat tidak bergantung pada env mesin (temuan A-03): beri objek env eksplisit atau bersihkan variabel relevan sebelum tiap tes.
- [x] Bila `.env.local` sudah berisi password DB Supabase saat A-02: reset password DB di Supabase.
- [ ] Pastikan `git ls-files .githooks` menampilkan `.githooks/commit-msg` dengan mode `100755` (hook pembersih atribusi AI).
- [x] Setelah 30 Sep 2026: naikkan `next` ke **16.3.7** (rilis keamanan) — kemungkinan datang lewat PR Dependabot; merge bila CI hijau.
- [x] Saat H-08/H-10: set **`MAIL_TRANSPORT=log`** dan **`NEXT_PUBLIC_APP_URL=https://<project>.vercel.app`** di Vercel (Preview & Production) — keduanya wajib di luar development, tanpa itu deploy gagal start. ⚠️ PR #39 menunjukkan `NEXT_PUBLIC_APP_URL` belum ada di Preview — lihat item env Vercel di atas.
- [ ] Uji Production setelah env: masuk dengan akunmu di `https://binzi.vercel.app/masuk` (membuktikan pasangan site key & `TURNSTILE_SECRET_KEY` asli), lalu lupa password → tautan di Vercel Logs harus mengarah ke `https://binzi.vercel.app`. Buka juga URL Preview: Turnstile berlabel "For testing only", tombol Google tersembunyi.
- [ ] H-04 R2 (bucket dev & prod, token dev) sebelum mulai A-17; lalu isi `R2_*` di `.env.local` dan Vercel.
- [ ] Kunci versi Node: `.nvmrc` + `engines.node` di package.json, sama dengan CI & Vercel. Node lokal sudah dinaikkan ke 24 (sebelumnya v20.19, sudah EOL → peringatan EBADENGINE dari vitest). `npm run user:role` butuh Node ≥ 22.9 (`--env-file-if-exists`) — alasan tambahan mengisi `engines.node`.
- [ ] Kartu "pembaruan toolchain" setelah Fase 0: TypeScript 7, ESLint 10, `@types/node` (major yang di-ignore Dependabot) + penguncian versi Node.
- [ ] Kartu "pembaruan token": tambah `success-tint-line` (garis banner sukses sementara `border-success`, usulan A-06) + temuan desain lain.
- [ ] Gambar desain yang gagal dibaca agent (7a, 28e): cek dengan `file docs/design/screens/*.png | grep -v "PNG image"`, ekspor ulang sebagai PNG asli.
- [x] Saat A-13: `src/components/ui/password-rules.ts` mengimpor `passwordSchema`/`PASSWORD_MIN_LENGTH` dari `src/modules/auth/schema.ts` (sumber tunggal sejak A-09). (PR #39)
- [ ] Chore: `src/components/ui/pagination.tsx` mengimpor `PAGE_SIZE` dari `src/lib/pagination.ts` (sumber tunggal sejak A-08).
- [ ] Chore: alias `@/` di `vitest.config.ts`, lalu ganti impor relatif (`../../db/schema`, `../../lib/...`) di `src/modules/**` menjadi `@/`. Sejak A-13 juga berlaku untuk `src/components/shared/auth/**` dan `src/components/ui/password-rules.ts` (impor relatif karena alias belum ada di Vitest).
- [ ] Setelah A-09: aturan ESLint yang melarang impor `@/db` dari luar `src/modules/**` dan `src/db/**` (pengecualian: adapter Better Auth di `src/lib/auth.ts`).
- [ ] Integrasi pelaporan error asli ke Sentry di route/server action sebelum `toErrorResponse()` (aturan di `src/modules/README.md`) — sebelum route API fitur pertama.
  Saat integrasi: hanya error tak terduga (5xx) yang dilaporkan ke Sentry; error domain 4xx (401/403/404/409/422) tidak dilaporkan dan di log cukup satu baris tanpa stack trace.
- [x] Konflik peer npm better-auth ↔ @babel/core@7 diselesaikan dengan overrides (PR #25) — lihat catatan keputusan.
- [ ] Chore: `src/db/index.ts` dibuat lazy (`getDb()`) agar route tidak perlu impor dinamis seperti `src/lib/auth.ts` (A-09).
- [ ] Kartu manajemen user (ubah role): WAJIB mencabut semua sesi user tersebut — masa sesi (30 hari/8 jam) ditetapkan saat sesi dibuat. CLI `user:role` (A-12) sudah melakukannya dalam satu transaksi — pakai ulang logikanya.
- [x] Enumerasi lewat sign-up ditutup di A-10 (`requireEmailVerification` + `customSyntheticUser`, respons identik).
- [x] baseURL Preview mengikuti `VERCEL_BRANCH_URL` (A-10). Callback Google OAuth untuk Preview diputuskan di A-11.
- [ ] Chore: rapikan format Prettier `schema.test.ts` (drift di main, dicatat saat A-10).
- [x] Saat A-13: halaman tujuan tautan verifikasi & reset (`callbackURL`/`redirectTo`), tampilan kode error `TOKEN_EXPIRED`/`INVALID_TOKEN`, dan form mengirim token Turnstile lewat header `x-captcha-response`. (PR #39)
- [ ] Sebelum pengguna nyata: H-07 Resend + `MAIL_TRANSPORT=resend` di Vercel Production. Dengan transport `log`, tautan bertoken tercetak di log Vercel.
- [ ] `users.last_login_at` belum diisi saat login (opsional, catatan PR #25).
- [ ] Sebelum 2 Nov 2026: cek advisory braces GHSA-vfj7-8cjw-p6xm. Bila sudah ada versi tambalan, hapus entri di .github/audit-exceptions.json dan upgrade; bila belum, perpanjang expires dengan alasan yang diperbarui.
- [ ] `id_token` Google masih tersimpan plaintext (`encryptOAuthTokens` hanya mencakup access/refresh token). BINZI tidak memakainya setelah login → kosongkan lewat `databaseHooks.account` create/update.before.
- [x] Saat A-13: copy untuk kode `account_not_verified` (usulan di PR #29) dan `email_not_verified`; tombol Google disembunyikan di Preview (provider nonaktif di sana). (PR #39)
- [ ] Cek aturan branch `main`: tombol Squash and merge aktif walau CI merah (PR #36). Pastikan "Require status checks to pass" aktif dengan check `ci` terdaftar, dan bypass admin dimatikan.
- [ ] Chore kosmetik: hapus `--env-file-if-exists=.env` dari script `user:role` (repo tidak punya `.env`; pesan "not found" muncul dua kali).
- [ ] Saat A-14: guard layout `(learn)` baru bisa diuji setelah `/belajar/page.tsx` ada (URL tanpa halaman langsung 404 tanpa melewati layout grup). Uji: cabut sesi lewat `user:role`, refresh `/belajar` → harus ke `/masuk?next=%2Fbelajar`.
- [x] **Chore (temuan A-13): callbackURL hook A-11** untuk email verifikasi yang dikirim server saat `account_not_verified` masih `"/"` → ganti ke `/daftar/verifikasi` (konstanta di `src/components/shared/auth/constants.ts`). Sekarang pengguna yang membuka tautan itu mendarat di beranda tanpa pesan. Catatan: `sendOnSignIn` tidak aktif — kirim ulang saat login lewat tombol di banner `/masuk`. (PR #41)
- [ ] Chore: `extendTailwindMerge` dengan token tema BINZI (`rounded-control`, warna & ukuran kustom). Tanpa itu, override kelas lewat `cn()` pada utility kustom bisa kalah diam-diam oleh urutan stylesheet (ditemukan di PR #40: `rounded-[8px]` kalah dari `rounded-control`). Kerjakan sebelum atau bersama A-14.
- [ ] Opsional: hapus override `[--radius-control:8px]` di `expired-link-panel.tsx` (PR #40). TOKENS menetapkan radius tombol 8–10, jadi `rounded-control` (10px) sudah sah; pengecualian lokal demi selisih 2px dari mock tidak sepadan.
- [ ] A-19 (E2E): wajib mencakup `/reset-password` tanpa token, `?token=palsu` + submit, dan alur reset penuh dengan tautan asli — rute dinamis ini tidak dirender saat build, jadi CI tidak menangkap crash-nya (kasus PR #39).
- [ ] Chore: satukan sumber `googleEnabled` — ekspor dari `src/lib/auth.ts`, lalu `src/components/shared/auth/auth-config.ts` mengimpornya (sekarang aturannya digandakan dengan komentar penunjuk).
- [ ] Setelah A-14: `POST_LOGIN_DEFAULT_PATH` (`src/components/shared/auth/constants.ts`) dari `"/"` ke `/belajar`.
- [ ] Ditunda dari A-13: state "akun Google ditautkan" (3c) — callback OAuth tidak membawa sinyal linked/baru; butuh perubahan di luar layar auth.
- [ ] Sebelum rilis, bersama halaman S&K & Kebijakan Privasi: persetujuan saat daftar hanya dicek di klien dan **tidak tercatat di server** (PRD §11 tidak punya kolomnya). Putuskan apakah bukti persetujuan disimpan (mis. versi S&K + waktu) — PRD R-11 meminta persetujuan eksplisit (UU PDP). Jalur daftar lewat Google hanya memakai kalimat pasif "Dengan masuk, Anda menyetujui…". Tautan S&K/Kebijakan Privasi di layar auth masih `<span>`.
- [ ] Cek jumlah PR terbuka: per 8 Okt ada 6 PR terbuka; per 9 Okt (sebelum merge #40) 5. Bila 5 di antaranya Dependabot, batasnya penuh (lihat catatan "Batas 5 PR Dependabot").

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
- **Layar auth (A-13):** komponen di `src/components/shared/auth/` — `AuthShell` dengan prop `tone` (`ink` = panel gelap `/masuk` 2a, `cream` = `/daftar` 3a; prop ini juga membawa rasio kolom 0.86fr/0.82fr : 1fr), `LoginModal` (2c, siap dipakai S2, copy generik + prop konteks opsional), `auth-errors.ts` (pemetaan error + copy), `auth-config.ts`, `constants.ts`. Form: React Hook Form + skema Zod dari `src/modules/auth/schema.ts`; `PasswordField` terkontrol → pakai `Controller`, bukan `register()`.
- **Konfigurasi auth UI dibaca per request** (env dimuat lazy di dalam fungsi, pola `src/lib/auth.ts`). Akibatnya build tetap hijau walau env kurang — **build/Vercel hijau ≠ env lengkap**; selalu buka halaman di Preview setelah deploy. Sitekey uji Turnstile hanya fallback di development; production tanpa key gagal jelas saat request.
- **Error auth di UI (A-13):** `?error=` di-whitelist, teks parameter mentah tidak pernah dirender; kode tak dikenal → pesan generik. 429 dipetakan per endpoint: login & daftar "15 menit" (5/15 mnt per IP+email), kirim email (verifikasi & lupa password) "satu jam" (3/jam/email). `EMAIL_NOT_VERIFIED` hanya muncul setelah password benar (diverifikasi di better-auth), jadi banner-nya aman. Daftar ulang email terdaftar = 200 sintetis **tanpa email** → copy pasca-daftar "Jika alamat ini belum terdaftar, kami mengirim tautan…".
- **Redirect auth (A-13):** `?next=` lewat `safeInternalRedirectPath`, default `POST_LOGIN_DEFAULT_PATH = "/"`. Pengguna yang sudah masuk membuka `/masuk`/`/daftar` langsung diarahkan; halaman verifikasi & reset tidak. `/reset-password` memakai metadata `referrer: "no-referrer"` (token di URL) dan pil statis "Tautan valid" (tanpa hitung mundur — sisa umur token tidak tersedia).
- **Copy auth (A-13):** satu judul per halaman di semua lebar ("Masuk", "Daftar gratis"); consent memakai versi 3a ("…termasuk penyimpanan progres belajar saya."); pil "huruf besar" dihapus (bertentangan dengan AUTH-01); validasi nama mengikuti kontrak A-09 (min 1, "Nama wajib diisi"), bukan min 2 di desain; teks yang bergantung enrollment memakai versi generik sampai S2.
- **Logo:** lockup dua gambar `logo-binzi-mark.png` (alt="") + `logo-binzi-wordmark.png` (alt="BINZI"), tinggi 26/15px (≥1024) dan 22/13px; ukuran tampil diatur lewat tinggi saja. `logo-binzi.png` (logo bertumpuk) tidak dipakai di layar auth.
- **Tipografi:** bobot mengikuti `TOKENS.md` (desain 800 → 900, 500 → 400), **ukuran mengikuti tabel Tipografi `TOKENS.md`, bukan skala bawaan Tailwind** — pakai nilai arbitrer (mis. `text-[32px]`). Pengecualian sadar: badan/sub 16px (minimum persona 45+) dan tombol 16px.
- **Panel gelap memakai token `ink-surface`** walaupun mock 2a ber-hex `#1a1614` (dipetakan otomatis ke `text` di 2a.md).
- **Dependensi baru (A-13):** `react-hook-form@7.89.0`, `@hookform/resolvers@5.9.1` (pin eksak).
- **Pengecualian aturan advisory:** bump next 16.3.8 ikut PR #39 (tercatat di pesan squash). Aturannya tetap: advisory di tengah PR → PR chore terpisah dari `main`.
- **Tes komponen (Vitest + jsdom):** checkbox Radix di dalam `<form>` butuh stub `ResizeObserver` di file tes.
- **`buttonVariants` (PR #40):** didefinisikan di `src/components/ui/button-variants.ts` (modul murni tanpa `"use client"`, default `size: "md"`). Server Component yang butuh tautan bergaya tombol mengimpor dari sana — memanggil fungsi dari modul `"use client"` di server membuat halaman crash. **Jangan re-export** dari `button.tsx`.
- **Turnstile (PR #40):** wajib di semua form publik yang memicu email atau sesi — `/sign-in/email`, `/sign-up/email`, `/request-password-reset`, `/send-verification-email` (`TURNSTILE_PROTECTED_ENDPOINTS` di `src/lib/turnstile.ts`). Daftar ini menimpa default plugin captcha better-auth: periksa default di `node_modules` sebelum mengubahnya (pernah menjatuhkan `/request-password-reset`). Token sekali pakai: widget di-remount setelah setiap kirim; tombol kirim ulang di banner /masuk menunggu token baru. Hook A-11 mengirim email langsung tanpa HTTP, jadi tidak terdampak. Melengkapi AUTH-10 (PRD menyebut form registrasi & login saja).
- **Alur reset (PR #40):** /lupa-password & /reset-password memakai `AuthShell` tone `ink` (pola 2a, catatan desain 3b) dengan `ResetFlowMarketing` — copy panel baru, bukan dari desain ("Password baru dalam dua langkah." + 3 butir). "Kembali ke Masuk": footer kartu < 1024, baris bawah panel ≥ 1024. `/reset-password` tanpa token → panel kedaluwarsa (render server); `?token=` apa pun → form; `INVALID_TOKEN` saat submit → `router.replace("?error=INVALID_TOKEN")` agar server merender panel dan token hilang dari URL. Di state kedaluwarsa hanya ada satu h1 (judul kartu, skala Judul kartu 19/1.3/900).
- **Banner terkunci 5× (PR #40):** badge angka "15" diganti ikon jam (lucide) — penyimpangan sadar dari 2b (angka statis mengulang teks dan terbaca seperti hitung mundur).
- **Pesan 429 (PR #40):** login `LOGIN_BLOCKED_MESSAGE` "Terlalu banyak percobaan. Coba lagi dalam 15 menit."; daftar "…percobaan pendaftaran…" (`SIGNUP_RATE_LIMITED`); kirim email "…dalam satu jam." UI selalu memakai copy sendiri per status/kode — `message` server tidak pernah dirender (dijaga tes regresi).
- **Copy tautan "lanjutkan dengan Google."** di /lupa-password (titik & cakupan tautan beda dari 3b) — sengaja dibiarkan.
- **`VERIFICATION_CALLBACK_PATH` (PR #41):** sumber tunggal di `src/modules/auth/schema.ts` (tetangga `safeInternalRedirectPath`); `src/components/shared/auth/constants.ts` me-re-export secara relatif (Vitest belum punya alias `@/`). Dipakai semua pengirim email verifikasi: daftar, kirim ulang di banner /masuk, kirim ulang di /daftar/verifikasi, dan hook A-11. Arah dependensi selalu UI → modul, tidak pernah modul → `src/components`. Token gagal di-redirect Better Auth ke callbackURL yang sama + `?error=<CODE>`, jadi alur verifikasi tidak memakai `errorCallbackURL`. Alur change-email bawaan Better Auth masih default `"/"` — tidak dipakai BINZI.
- **Anotasi desain (PR #42):** ID dalam kurung di `docs/design/screens/*.md` — `(AUTH-07)`, `(A-15)`, `§x.y` — adalah anotasi desainer, bukan copy, **termasuk bila muncul di baris copy** (contoh: 3b.md:64, 3c.md:94). Aturan + pola grep ada di `CLAUDE.md`. Komentar kode, judul tes, dan log developer boleh memuat ID.
- **Aturan agent hanya resmi bila ada di `CLAUDE.md`.** Auto-memory Claude Code (`MEMORY.md` di `~/.claude/projects/…`) di luar repo: tidak ter-versi, tidak bisa ditinjau lewat PR, tidak ikut ke mesin lain.
- **Nilai env case-sensitive:** `MAIL_TRANSPORT` harus `log`/`resend` huruf kecil. Nilai salah tidak menggagalkan build (env dibaca per request) — halaman baru crash saat dibuka.

## Rencana setelah Fase 0

1. Setelah A-13 (irisan uji coba login): evaluasi apakah ukuran kartu per sesi sudah pas.
   Catatan dari A-13 (draf, putuskan saat menulis kartu S1): satu sesi + 4 putaran perbaikan (build Vercel gagal, visual, tipografi ×2). Penyebab utama: kartu ditulis sebelum keputusan A-09–A-12 (catatan tambahan harus ditempel di prompt), dan tampilan baru dibandingkan dengan `.png` setelah PR dibuat. Usulan untuk kartu UI S1: (a) perbarui kartu dengan keputusan terbaru sebelum sesi dimulai; (b) agent membandingkan screenshot (Playwright, 360/768/1280) dengan `.png` dan mencocokkan ukuran huruf dengan tabel TOKENS **sebelum** membuka PR; (c) agent mengecek status deploy Preview, bukan hanya `npm run build` lokal; (d) layar sebanyak A-13 (5 rute + modal) dipecah jadi dua kartu.
   Tambahan dari verifikasi A-13 (9 Okt): (e) sebelum membuka PR, agent wajib `npm run build && npm run start` lalu curl/buka **setiap rute**, termasuk varian query (tanpa token, token palsu, `?error=`) — Vitest dan build tidak menangkap pelanggaran batas Server/Client Component pada rute dinamis; (f) kartu tidak boleh di-merge sebelum "Verifikasi oleh kamu" dijalankan — PR #39 meloloskan 1 blocker dan 1 celah captcha.
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
Posisi terakhir saya: A-13 sudah diverifikasi, temuannya diperbaiki di PR #40,
chore callbackURL hook A-11 (PR #41) dan pembersihan anotasi di teks UI
(PR #42) sudah merged, dan env Vercel sudah benar. Sisa: beberapa langkah
verifikasi A-13 yang belum dilaporkan, lalu A-14.
```
