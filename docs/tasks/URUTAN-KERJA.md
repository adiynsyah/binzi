# Urutan Kerja — mulai di sini

Ikuti dari atas ke bawah. Centang setiap langkah yang selesai (di sini atau di ClickUp).

## Arti kode

| Kode | Siapa | Artinya |
|---|---|---|
| **H**-xx | 👤 **Kamu** | Pekerjaan manusia: membuat akun, mengisi secret, meninjau. Agent **tidak** mengerjakan ini. |
| **A**-xx | 🤖 **Agent** | Pekerjaan AI coding agent. Satu kartu = satu sesi agent. Tugasmu: memulai sesi dan meninjau hasilnya. |
| **K**-xx | 📝 **Konten** | Pekerjaan konten bersama ahli gizi. Berjalan **paralel**, tidak menunggu kode. |

## Cara mengerjakan langkah 🤖 Agent (sama untuk semua kartu A)

1. Buat branch baru, mis. `f0/a-01-scaffold`.
2. Buka **sesi agent baru**, lalu kirim prompt pembuka dari [`README.md`](README.md#prompt-pembuka-sesi) dengan nama berkas kartunya.
3. Agent menjelaskan rencana → kamu setujui (atau minta ubah).
4. Agent bekerja lalu membuat PR dengan ringkasan.
5. Kamu jalankan bagian **"Verifikasi oleh kamu"** di kartu itu. CI harus hijau.
6. Merge → centang langkahnya → lanjut ke langkah berikutnya.

Jangan menjalankan dua kartu A sekaligus dalam satu sesi.

---

## Tahap 1 — Persiapan akun (kamu)

Hari 1. Tidak butuh domain.

- [ ] **1.** 👤 Kamu · [H-01](fase-0/H-01-repo-github-dan-dokumen-proyek.md) — Repo GitHub & dokumen proyek
- [ ] **2.** 👤 Kamu · [H-02](fase-0/H-02-supabase-project-dev-dan-prod.md) — Supabase: project dev & prod
- [ ] **3.** 👤 Kamu · [H-09](fase-0/H-09-sentry-error-tracking.md) — Sentry: error tracking

## Tahap 2 — Agent membangun kerangka proyek

Belum butuh secret apa pun.

- [ ] **4.** 🤖 Agent · [A-01](fase-0/A-01-scaffold-proyek-next-js-16.md) — Scaffold proyek Next.js 16
- [ ] **5.** 🤖 Agent · [A-02](fase-0/A-02-konfigurasi-environment-tervalidasi-zod.md) — Konfigurasi environment tervalidasi Zod
- [ ] **6.** 🤖 Agent · [A-03](fase-0/A-03-ci-github-actions-dan-dependabot.md) — CI GitHub Actions & Dependabot
- [ ] **7.** 🤖 Agent · [A-04](fase-0/A-04-design-tokens-font-dan-gaya-dasar.md) — Design tokens, font & gaya dasar

## Tahap 3 — Siapkan layanan & isi secret (kamu)

Semua bisa tanpa domain; kamu memakai `localhost` dan URL bawaan Vercel. Diakhiri H-10: semua kredensial masuk ke `.env.local`, Vercel, dan GitHub. Email belum dikirim sungguhan — `MAIL_TRANSPORT=log` mencetaknya ke terminal.

- [ ] **8.** 👤 Kamu · [H-04](fase-0/H-04-cloudflare-r2-bucket-dan-token.md) — Cloudflare R2: bucket & token
- [ ] **9.** 👤 Kamu · [H-05](fase-0/H-05-cloudflare-turnstile.md) — Cloudflare Turnstile
- [ ] **10.** 👤 Kamu · [H-06](fase-0/H-06-google-oauth-client.md) — Google OAuth client
- [ ] **11.** 👤 Kamu · [H-08](fase-0/H-08-vercel-hubungkan-repo.md) — Vercel: hubungkan repo
- [ ] **12.** 👤 Kamu · [H-10](fase-0/H-10-isi-environment-dan-secret.md) — Isi environment & secret

## Tahap 4 — Agent: komponen & database

Di A-07 kamu wajib membaca file SQL migrasi sebelum menyetujui.

- [ ] **13.** 🤖 Agent · [A-05](fase-0/A-05-komponen-kendali-halaman-dev-ui.md) — Komponen kendali + halaman /dev/ui
- [ ] **14.** 🤖 Agent · [A-06](fase-0/A-06-komponen-overlay-dan-umpan-balik.md) — Komponen overlay & umpan balik
- [ ] **15.** 🤖 Agent · [A-07](fase-0/A-07-skema-drizzle-lengkap-migrasi-awal-dan-seed.md) — Skema Drizzle lengkap, migrasi awal & seed
- [ ] **16.** 🤖 Agent · [A-08](fase-0/A-08-pola-modul-serialisasi-dan-batas-impor.md) — Pola modul, serialisasi & batas impor

## Tahap 5 — Agent: fitur login lengkap (irisan uji coba)

Satu alur utuh dari database sampai layar. Setelah A-13, berhenti sejenak dan evaluasi: apakah ukuran tugas per sesi sudah pas?

- [ ] **17.** 🤖 Agent · [A-09](fase-0/A-09-better-auth-inti-email-password-sesi-rate-limit.md) — Better Auth inti: email/password, sesi, rate limit, Turnstile
- [ ] **18.** 🤖 Agent · [A-10](fase-0/A-10-email-transaksional-verifikasi-dan-reset-passwor.md) — Email transaksional, verifikasi & reset password
- [ ] **19.** 🤖 Agent · [A-11](fase-0/A-11-login-google-dan-penautan-akun.md) — Login Google & penautan akun
- [ ] **20.** 🤖 Agent · [A-12](fase-0/A-12-rbac-dan-proteksi-route.md) — RBAC & proteksi route
- [ ] **21.** 🤖 Agent · [A-13](fase-0/A-13-layar-autentikasi.md) — Layar autentikasi

## Tahap 6 — Agent: layout & pelengkap

Kerangka halaman publik, member, CMS, lalu keamanan, storage, cron, dan tes otomatis.

- [ ] **22.** 🤖 Agent · [A-14](fase-0/A-14-kerangka-layout-publik-dan-member.md) — Kerangka layout publik & member
- [ ] **23.** 🤖 Agent · [A-15](fase-0/A-15-kerangka-layout-cms.md) — Kerangka layout CMS
- [ ] **24.** 🤖 Agent · [A-16](fase-0/A-16-header-keamanan-dan-proposal-csp.md) — Header keamanan & proposal CSP
- [ ] **25.** 🤖 Agent · [A-17](fase-0/A-17-lapisan-storage-r2.md) — Lapisan storage R2
- [ ] **26.** 🤖 Agent · [A-18](fase-0/A-18-health-check-dan-cron-keep-alive.md) — Health check & cron keep-alive
- [ ] **27.** 🤖 Agent · [A-19](fase-0/A-19-e2e-baseline-playwright.md) — E2E baseline (Playwright)

## Tahap 7 — Verifikasi akhir Fase 0 (kamu)

Kalau lolos, Fase 0 selesai dan kita menulis kartu Sprint S1.

- [ ] **28.** 👤 Kamu · [H-11](fase-0/H-11-verifikasi-akhir-fase-0.md) — Verifikasi akhir Fase 0

## Tahap 8 — Setelah beli domain (tidak memblokir apa pun)

Kerjakan kapan saja sebelum peserta penelitian atau publik mulai memakai BINZI — boleh sambil Sprint S1–S6 berjalan. Domain & DNS dikelola di Vercel. Setelah ini, email sungguhan bisa dikirim ke user dan login Google bisa dipublikasikan.

- [ ] **29.** 👤 Kamu · [H-03](fase-0/H-03-domain-dan-dns-di-vercel.md) — Domain & DNS di Vercel
- [ ] **30.** 👤 Kamu · [H-07](fase-0/H-07-resend-domain-pengirim-email.md) — Resend: domain pengirim email

---

## 📝 Jalur konten — paralel dengan tahap 1–7

Dikerjakan kamu bersama ahli gizi, **tidak menunggu** tahap di atas. Konten, bukan kode, yang menentukan tanggal rilis.

- [ ] 📝 [K-01](konten/K-01-putuskan-oq-01-dan-oq-02.md) — Putuskan OQ-01 & OQ-02 · *Minggu 1*
- [ ] 📝 [K-02](konten/K-02-konfirmasi-ahli-gizi-reviewer-dan-ritme-tinjau.md) — Konfirmasi ahli gizi reviewer & ritme tinjau · *Minggu 1*
- [ ] 📝 [K-03](konten/K-03-kerangka-3-kursus.md) — Kerangka 3 kursus · *Minggu 1–2*
- [ ] 📝 [K-04](konten/K-04-kategori-artikel-dan-rencana-artikel.md) — Kategori artikel & rencana artikel · *Minggu 1–2*
- [ ] 📝 [K-05](konten/K-05-template-spreadsheet-soal-impor-csv.md) — Template spreadsheet soal (impor CSV) · *Minggu 2*
- [ ] 📝 [K-06](konten/K-06-panduan-dan-jadwal-produksi-video.md) — Panduan & jadwal produksi video · *Minggu 2*
- [x] 📝 [K-07](konten/K-07-klarifikasi-kebutuhan-penelitian-oq-15.md) — Klarifikasi kebutuhan penelitian (OQ-15) · *✅ selesai*

## Keputusan yang masih kamu tunggu

- [ ] **Proposal CSP** — muncul dari A-16 (tahap 6). Kamu memilih salah satu opsi.
