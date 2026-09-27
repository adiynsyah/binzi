# Fase 0 — daftar referensi

> **Mau tahu urutan mengerjakan?** Buka [`../URUTAN-KERJA.md`](../URUTAN-KERJA.md). Tabel di bawah hanya daftar referensi dengan urutan yang sama.

| # | ID | Tugas | Siapa | Bergantung pada |
|---|---|---|---|---|
| 1 | [H-01](H-01-repo-github-dan-dokumen-proyek.md) | Repo GitHub & dokumen proyek | 👤 Kamu | — |
| 2 | [H-02](H-02-supabase-project-dev-dan-prod.md) | Supabase: project dev & prod | 👤 Kamu | — |
| 3 | [H-09](H-09-sentry-error-tracking.md) | Sentry: error tracking | 👤 Kamu | — |
| 4 | [A-01](A-01-scaffold-proyek-next-js-16.md) | Scaffold proyek Next.js 16 | 🤖 Agent | [H-01](H-01-repo-github-dan-dokumen-proyek.md) |
| 5 | [A-02](A-02-konfigurasi-environment-tervalidasi-zod.md) | Konfigurasi environment tervalidasi Zod | 🤖 Agent | [A-01](A-01-scaffold-proyek-next-js-16.md) |
| 6 | [A-03](A-03-ci-github-actions-dan-dependabot.md) | CI GitHub Actions & Dependabot | 🤖 Agent | [A-01](A-01-scaffold-proyek-next-js-16.md) |
| 7 | [A-04](A-04-design-tokens-font-dan-gaya-dasar.md) | Design tokens, font & gaya dasar | 🤖 Agent | [A-01](A-01-scaffold-proyek-next-js-16.md) |
| 8 | [H-04](H-04-cloudflare-r2-bucket-dan-token.md) | Cloudflare R2: bucket & token | 👤 Kamu | — |
| 9 | [H-05](H-05-cloudflare-turnstile.md) | Cloudflare Turnstile | 👤 Kamu | — |
| 10 | [H-06](H-06-google-oauth-client.md) | Google OAuth client | 👤 Kamu | — |
| 11 | [H-08](H-08-vercel-hubungkan-repo.md) | Vercel: hubungkan repo | 👤 Kamu | [H-01](H-01-repo-github-dan-dokumen-proyek.md) |
| 12 | [H-10](H-10-isi-environment-dan-secret.md) | Isi environment & secret | 👤 Kamu | [A-02](A-02-konfigurasi-environment-tervalidasi-zod.md), [H-02](H-02-supabase-project-dev-dan-prod.md), [H-04](H-04-cloudflare-r2-bucket-dan-token.md), [H-05](H-05-cloudflare-turnstile.md), [H-06](H-06-google-oauth-client.md), [H-09](H-09-sentry-error-tracking.md) |
| 13 | [A-05](A-05-komponen-kendali-halaman-dev-ui.md) | Komponen kendali + halaman /dev/ui | 🤖 Agent | [A-04](A-04-design-tokens-font-dan-gaya-dasar.md) |
| 14 | [A-06](A-06-komponen-overlay-dan-umpan-balik.md) | Komponen overlay & umpan balik | 🤖 Agent | [A-05](A-05-komponen-kendali-halaman-dev-ui.md) |
| 15 | [A-07](A-07-skema-drizzle-lengkap-migrasi-awal-dan-seed.md) | Skema Drizzle lengkap, migrasi awal & seed | 🤖 Agent | [A-02](A-02-konfigurasi-environment-tervalidasi-zod.md), [H-02](H-02-supabase-project-dev-dan-prod.md), [H-10](H-10-isi-environment-dan-secret.md) |
| 16 | [A-08](A-08-pola-modul-serialisasi-dan-batas-impor.md) | Pola modul, serialisasi & batas impor | 🤖 Agent | [A-07](A-07-skema-drizzle-lengkap-migrasi-awal-dan-seed.md) |
| 17 | [A-09](A-09-better-auth-inti-email-password-sesi-rate-limit.md) | Better Auth inti: email/password, sesi, rate limit, Turnstile | 🤖 Agent | [A-08](A-08-pola-modul-serialisasi-dan-batas-impor.md), [H-10](H-10-isi-environment-dan-secret.md) |
| 18 | [A-10](A-10-email-transaksional-verifikasi-dan-reset-passwor.md) | Email transaksional, verifikasi & reset password | 🤖 Agent | [A-09](A-09-better-auth-inti-email-password-sesi-rate-limit.md) |
| 19 | [A-11](A-11-login-google-dan-penautan-akun.md) | Login Google & penautan akun | 🤖 Agent | [A-09](A-09-better-auth-inti-email-password-sesi-rate-limit.md), [H-06](H-06-google-oauth-client.md) |
| 20 | [A-12](A-12-rbac-dan-proteksi-route.md) | RBAC & proteksi route | 🤖 Agent | [A-09](A-09-better-auth-inti-email-password-sesi-rate-limit.md) |
| 21 | [A-13](A-13-layar-autentikasi.md) | Layar autentikasi | 🤖 Agent | [A-06](A-06-komponen-overlay-dan-umpan-balik.md), [A-10](A-10-email-transaksional-verifikasi-dan-reset-passwor.md), [A-11](A-11-login-google-dan-penautan-akun.md) |
| 22 | [A-14](A-14-kerangka-layout-publik-dan-member.md) | Kerangka layout publik & member | 🤖 Agent | [A-06](A-06-komponen-overlay-dan-umpan-balik.md), [A-12](A-12-rbac-dan-proteksi-route.md) |
| 23 | [A-15](A-15-kerangka-layout-cms.md) | Kerangka layout CMS | 🤖 Agent | [A-14](A-14-kerangka-layout-publik-dan-member.md), [A-12](A-12-rbac-dan-proteksi-route.md) |
| 24 | [A-16](A-16-header-keamanan-dan-proposal-csp.md) | Header keamanan & proposal CSP | 🤖 Agent | [A-14](A-14-kerangka-layout-publik-dan-member.md) |
| 25 | [A-17](A-17-lapisan-storage-r2.md) | Lapisan storage R2 | 🤖 Agent | [A-02](A-02-konfigurasi-environment-tervalidasi-zod.md), [H-04](H-04-cloudflare-r2-bucket-dan-token.md) |
| 26 | [A-18](A-18-health-check-dan-cron-keep-alive.md) | Health check & cron keep-alive | 🤖 Agent | [A-07](A-07-skema-drizzle-lengkap-migrasi-awal-dan-seed.md) |
| 27 | [A-19](A-19-e2e-baseline-playwright.md) | E2E baseline (Playwright) | 🤖 Agent | [A-13](A-13-layar-autentikasi.md), [A-15](A-15-kerangka-layout-cms.md) |
| 28 | [H-11](H-11-verifikasi-akhir-fase-0.md) | Verifikasi akhir Fase 0 | 👤 Kamu | [A-19](A-19-e2e-baseline-playwright.md) |
| 29 | [H-03](H-03-domain-dan-dns-di-vercel.md) | Domain & DNS di Vercel | 👤 Kamu | — |
| 30 | [H-07](H-07-resend-domain-pengirim-email.md) | Resend: domain pengirim email | 👤 Kamu | [H-03](H-03-domain-dan-dns-di-vercel.md) |
