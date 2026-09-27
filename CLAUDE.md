# CLAUDE.md — BINZI

> File ini ada di root repositori dan dibaca otomatis di setiap sesi. Sumber: handoff desain + PRD v1.3.

## Sumber kebenaran
- **PRD v1.3 = perilaku.** Desain = tampilan. PRD v1.3 sudah menyerap semua keputusan desain final, jadi jika menemukan pertentangan: **ikuti PRD**, lalu catat perbedaannya di PR.
- Jangan pernah membaca `docs/prd/PRD-v1.3.md` utuh atau `docs/design/source/` utuh. Muat hanya bagian yang dibutuhkan lewat indeks di bawah.
- **Isi gizi/kesehatan di desain adalah pengisi tata letak.** Jangan dipakai untuk seed, konten, atau contoh data; jangan pula mengarang klaim gizi baru (PRD §13.4). Untuk seed, pakai teks netral yang jelas-jelas dummy.

## Sebelum membuat UI apa pun
1. Cari route di `docs/design/handoff/SCREENS.md` → catat ID layar utama + ID state-nya.
2. Untuk tiap ID: baca `docs/design/screens/<ID>.md` (status, copy, warna → token) dan **lihat** `docs/design/screens/<ID>.png`. Buka `<ID>.html` hanya bila perlu ukuran/struktur persis.
3. Layar berstatus ⛔ (18a–18c) tidak boleh dibangun. Layar ℹ️ hanya referensi.
4. Pakai komponen dari `docs/design/handoff/COMPONENTS.md`. **Periksa `src/components/` dulu** — jangan membuat versi kedua dari komponen yang sudah ada.
5. Nilai visual hanya dari `docs/design/handoff/TOKENS.md`. **Jangan menyalin hex dari desain** — pakai kolom "Token" di `<ID>.md`.
6. Baca bagian PRD yang relevan lewat `docs/prd/INDEX.md` (tabel "Bagian yang dibaca per fase").

## Stack (PRD §9.2)
**Next.js 16.3.x** App Router · TypeScript strict · Tailwind CSS v4 + shadcn/ui · Drizzle ORM · Supabase PostgreSQL · Better Auth · Cloudflare R2 + Turnstile · TipTap · Resend · React Hook Form + Zod · TanStack Query · Vitest + Playwright.
Jangan menambah dependensi baru tanpa menyebutkannya secara eksplisit di ringkasan perubahan.

### Aturan versi Next.js 16 (PRD Q36)
- Pin versi patch Next.js di `package.json` (tanpa `^`); minimal **16.3.7** setelah rilis keamanan 30 Sep 2026.
- Tulis kode untuk **Next.js 16**, bukan 15. Contoh yang sering salah: pakai `proxy.ts`, bukan `middleware.ts`; `params`, `searchParams`, `cookies()`, dan `headers()` bersifat async.
- Jika ragu soal API, rujuk dokumentasi yang sesuai versi terpasang — jangan mengandalkan ingatan atau contoh dari versi lama.

## Struktur folder (PRD §10.2)
```
src/app/(public) (auth) (learn) (cms) api/
src/modules/<domain>/{service,queries,schema,policy}.ts
src/components/{ui,public,learn,cms,shared}
src/db  src/lib  src/config
```
Modul berkomunikasi lewat `service.ts`; **tidak boleh** saling mengimpor `queries.ts`.

## Token ringkas (lengkap di TOKENS.md)
- Warna: `text #1a1614` · `text-muted #5b554f` · `border #e7e2db` · `primary #f04030` · `primary-deep #c42d1e` · `primary-tint #ffeae6` · `success #157f5f` · `danger #b3261e`. Warna lain hanya dari TOKENS.md.
- Font: **Lato** 400/700/900 (jangan 500/600/800) · **IBM Plex Mono** 400/500 untuk label mono & angka.
- Spasi kelipatan 4 · radius kartu 14, tombol 8–10, pil 999 · kartu tanpa bayangan · target sentuh ≥ 44px.
- Mobile-first: gaya dasar untuk 360px, tambah dengan `min-width`. Ambang: < 640 hamburger & sheet · < 768 bottom nav area belajar · ≥ 1024 desktop.

## Aturan keamanan (PRD §12)
- SELALU serialisasi eksplisit; JANGAN kembalikan objek DB mentah.
- SELALU cek kepemilikan user di setiap query berbasis ID (anti-IDOR).
- SELALU validasi input dengan Zod, di klien dan server.
- Editor teks menolak node video/iframe — di editor **dan** server (CRS-05).
- Jangan menulis secret ke kode, tes, atau log. Semua konfigurasi lewat `src/config` (env tervalidasi Zod).
- Kode di kategori "berisiko tinggi" (PRD §13.4) wajib disertai daftar item checklist §12.6 yang relevan di ringkasan PR.

## Aturan quiz (PRD §6.3)
- `is_correct` & pembahasan tidak pernah dikirim sebelum submit.
- Timer dihitung server dari `started_at`; waktu klien hanya tampilan.
- Satu attempt per quiz; attempt kedua ditolak server (409), bukan hanya disembunyikan.
- Auto-save setiap perubahan jawaban; gagal simpan wajib terlihat (layar 28c).

## Bahasa & penamaan
- UI: Bahasa Indonesia (copy antarmuka final ada di `<ID>.md`). Kode & komentar: Inggris.
- Nama produk: **BINZI**.
- **Data dummy:** nomor STR dan nomor WhatsApp di desain adalah dummy. Nomor WhatsApp hanya dibaca dari `system_settings` (KSL-08), STR dari data profil ahli gizi — keduanya **tidak pernah di-hardcode** di komponen, supaya bisa diganti tanpa deploy.
- Hero Beranda: copy dari layar **1a**, ilustrasi dari **6a**. Teks di 6b bukan copy final.

## Definisi selesai untuk satu layar
Acceptance criteria PRD §14 untuk fitur itu lulus · semua state di SCREENS.md ada · checklist layar 17d terpenuhi · diuji di 360 / 768 / 1280 (+1440 untuk Beranda & Masuk) · keyboard bisa menyelesaikan alur · `tsc --noEmit` & lint bersih · tes ditulis bersama fiturnya (E2E wajib untuk alur quiz).

## Tugas
- Kerjakan **hanya** kartu tugas yang diminta di `docs/tasks/` — ikuti bagian "Baca dulu", "Kerjakan", dan "Bukan lingkup" di kartu itu.
- Tugas berkode `H-xx` dan semua di `docs/tasks/konten/` dikerjakan manusia. Jangan dikerjakan, dan jangan meminta nilai secret.
- Akhiri sesi dengan ringkasan PR sesuai format di `docs/tasks/README.md`.

## Alur Git (agent yang menjalankan)
- **Awal sesi:** pastikan working tree bersih (jika tidak, berhenti dan tanya), `git checkout main`, `git pull`, lalu buat branch baru dari `main` terbaru.
- **Nama branch:** `<fase>/<id-huruf-kecil>-<nama-singkat>`, mis. `f0/a-02-env` (Fase 0 = `f0`, Sprint 1 = `s1`, dst.). Satu kartu = satu branch.
- **Commit:** kecil dan sering, format Conventional Commits dengan ID kartu, mis. `feat(auth): add email/password login [A-09]`.
- **Akhir sesi:** jalankan verifikasi otomatis di kartu → push branch → buat PR ke `main` dengan `gh pr create` bila GitHub CLI tersedia dan sudah login; jika tidak, berikan tautan pembuatan PR. Isi PR = ringkasan sesuai format di `docs/tasks/README.md`.
- **Tanpa atribusi AI:** pesan commit dan isi PR **tidak boleh** memuat `Co-Authored-By` untuk AI, tulisan "Generated with …", tautan sesi, atau nama tool/agent apa pun. Pengaturan `attribution` di `.claude/settings.json` dan hook `.githooks/commit-msg` menegakkan ini — jangan dilewati (mis. dengan `--no-verify`).
- **Dilarang:** commit atau push langsung ke `main`, `git push --force`, mengubah riwayat yang sudah di-push, menghapus branch lain, **me-merge PR** (merge dilakukan pemilik produk setelah verifikasi), dan meng-commit `.env*` selain `.env.example`.

## Urutan kerja per fitur (vertical slice)
- Satu kartu fitur = backend + frontend fitur itu sampai bisa diuji utuh. **Tidak** membangun frontend seluruh aplikasi dulu lalu backend belakangan.
- Urutan dalam satu kartu: **kontrak dulu** (skema Zod input + DTO output di `modules/<domain>/schema.ts`) → server (queries, service, policy, route/action) → UI. UI boleh dikerjakan sebelum server **hanya jika** kontraknya sudah ditulis.
- Dilarang data palsu yang mengarang bentuk data, dan dilarang menaruh aturan bisnis di klien (timer quiz, penilaian, gerbang materi, satu kesempatan). File desain berisi JavaScript demo — itu bukan acuan perilaku.

## Ritme kerja
Satu modul per sesi. Commit kecil, satu fitur satu commit. Tunjukkan kode terkait yang sudah ada sebelum mulai. Jika spesifikasi tidak jelas atau bertentangan, **berhenti dan tanyakan** — jangan mengarang.
