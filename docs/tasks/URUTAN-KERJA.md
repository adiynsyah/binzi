# Urutan Kerja — mulai di sini

Ikuti dari atas ke bawah. Centang setiap langkah yang selesai (di sini atau di ClickUp).

## Arti kode

| Kode | Siapa | Artinya |
|---|---|---|
| **H**-xx | 👤 **Kamu** | Pekerjaan manusia: membuat akun, mengisi secret, meninjau. Agent **tidak** mengerjakan ini. |
| **A**-xx | 🤖 **Agent** | Pekerjaan AI coding agent. Satu kartu = satu sesi agent. Tugasmu: memulai sesi dan meninjau hasilnya. |
| **S1**-xx | 🤖 **Agent** | Kartu fitur Sprint 1 (dan seterusnya S2-xx, …). Cara mengerjakannya sama dengan kartu A. |
| **C**-xx | 🤖 **Agent** | Chore terjadwal di luar urutan tahap (mis. upgrade dependensi yang menunggu soak 14 hari). Cara mengerjakannya sama dengan kartu A — prompt pembuka yang sama, ganti ID. |
| **K**-xx | 📝 **Konten** | Pekerjaan konten bersama ahli gizi. Berjalan **paralel**, tidak menunggu kode. |

## Cara mengerjakan langkah 🤖 Agent (sama untuk semua kartu A)

Agent yang membuat branch, commit, dan PR. Kamu cukup:

1. Buka terminal di root repo, jalankan `claude` (sesi baru).
2. Tempelkan prompt pembuka dari [`README.md`](README.md#prompt-pembuka-sesi) — **ganti ID kartunya saja** (mis. `A-02`).
3. Setujui rencana agent (atau minta ubah).
4. Setelah agent membuat PR, jalankan bagian **"Verifikasi oleh kamu"** di kartu. CI harus hijau.
5. Merge PR di GitHub → centang langkahnya → keluar (`/exit`) → ulangi dari langkah 1 untuk kartu berikutnya.

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

- [ ] **8.** 👤 Kamu · [H-04](fase-0/H-04-cloudflare-r2-bucket-dan-token.md) — Cloudflare R2: bucket & token *(metode pembayaran ✓ 14 Nov; bucket + token belum)*
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

Kerangka halaman publik, member, CMS, lalu keamanan, storage, cron, dan tes otomatis (E2E dipecah: A-19 harness & alur, A-19b tata letak & aksesibilitas).

- [ ] **22.** 🤖 Agent · [A-14a](fase-0/A-14a-kerangka-layout-publik.md) — Kerangka layout publik (header tamu, menu ponsel, footer)
- [ ] **23.** 🤖 Agent · [A-14b](fase-0/A-14b-header-member-dan-menu-akun.md) — Header member, menu akun & layout area belajar
- [ ] **24.** 🤖 Agent · [A-15](fase-0/A-15-kerangka-layout-cms.md) — Kerangka layout CMS
- [ ] **25.** 🤖 Agent · [A-16](fase-0/A-16-header-keamanan-dan-proposal-csp.md) — Header keamanan & proposal CSP
- [ ] **25b.** 🤖 Agent · [A-16b](fase-0/A-16b-penegakan-csp.md) — Penegakan CSP (opsi b+)
- [ ] **26.** 🤖 Agent · [A-17](fase-0/A-17-lapisan-storage-r2.md) — Lapisan storage R2
- [ ] **27.** 🤖 Agent · [A-18](fase-0/A-18-health-check-dan-cron-keep-alive.md) — Health check & cron keep-alive
- [ ] **28.** 🤖 Agent · [A-19](fase-0/A-19-e2e-baseline-playwright.md) — E2E: harness Playwright & alur auth/RBAC (sebelum sesi: Docker menyala)
- [ ] **28b.** 🤖 Agent · [A-19b](fase-0/A-19b-e2e-tata-letak-dan-aksesibilitas.md) — E2E: tata letak per lebar & aksesibilitas

## Tahap 7 — Verifikasi akhir Fase 0 (kamu)

Kalau lolos, Fase 0 selesai dan kita menulis kartu Sprint S1.

- [ ] **29.** 👤 Kamu · [H-11](fase-0/H-11-verifikasi-akhir-fase-0.md) — Verifikasi akhir Fase 0

## Tahap 8 — Setelah beli domain (tidak memblokir apa pun)

Kerjakan kapan saja sebelum peserta penelitian atau publik mulai memakai BINZI — boleh sambil Sprint S1–S6 berjalan. Domain & DNS dikelola di Vercel. Setelah ini, email sungguhan bisa dikirim ke user dan login Google bisa dipublikasikan.

- [ ] **30.** 👤 Kamu · [H-03](fase-0/H-03-domain-dan-dns-di-vercel.md) — Domain & DNS di Vercel
- [ ] **31.** 👤 Kamu · [H-07](fase-0/H-07-resend-domain-pengirim-email.md) — Resend: domain pengirim email

---

## Chore terjadwal — upgrade audit Okt–Nov 2026

Tanggal mulai mengikuti soak 14 hari; tenggat mengikuti `expires` pengecualian audit. Melewati tenggat membuat gate audit merah dan semua PR terblokir (detail di `STATUS.md`). #137 (18 Nov) menambah 4 entri ber-`expires` 2026-11-27. Per 19 Nov keempatnya tidak lagi dirujuk temuan mana pun dan dihapus di C-11 (STATUS 19 Nov).

- [x] 🤖 [C-01](chore/C-01-zod-4-6-6-dan-kebersihan-soak.md) — zod 4.6.6 + kebersihan soak · *✅ selesai 26 Okt (PR #77)*
- [x] 🤖 [C-02](chore/C-02-next-16-4-1.md) — next 16.4.1 · *✅ selesai 29 Okt (PR #87)*
- [x] 🤖 [C-03](chore/C-03-undici-7-30-1.md) — undici 7.30.1 · *✅ selesai 30 Okt (PR #89)*
- [x] 🤖 [C-04](chore/C-04-shadcn-4-22-1-dan-body-parser-2-4-0.md) — shadcn 4.22.1 + body-parser 2.4.0 · *✅ selesai 6 Nov (PR #111)*
- [ ] 🤖 [C-09](chore/C-09-penyederhanaan-audit-dan-dependabot.md) — penyederhanaan audit & Dependabot · *putaran 2 (setelah UAT 11 Des) kecuali advisory memblokir PR; kartu ditinjau ulang terhadap `main` sebelum sesi*
- [ ] 🤖 C-10 — migrasi video YouTube → R2 + pembersihan *(kartu belum ditulis; runbook di [rencana video](../decisions/video-sumber.md) bagian 9)* · *setelah S1-05; wajib sebelum peserta penelitian atau publik memakai BINZI*
- [x] 👤 C-11 — hapus 4 pengecualian audit yang tidak lagi dipakai · *✅ PR #142 (19 Nov); patch dari Claude chat, tanpa sesi agent*

Prasyarat Sprint 1 (tanpa tanggal tetap — sebelum S1-01, tanpa branch kartu lain yang terbuka):

- [x] 🤖 [C-05](chore/C-05-db-lokal-dan-seed-demo.md) — DB lokal untuk development + seed demo · *✅ selesai 28 Okt (PR #84)*
- [x] 🤖 [C-06](chore/C-06-fondasi-modul-fitur.md) — Fondasi modul fitur: alias `@/` di Vitest + batas impor DB · *✅ selesai 30 Okt (PR #92)*
- [x] 🤖 [C-07](chore/C-07-token-kontras.md) — Token kontras: tombol utama `primary-deep`, tautan merah, `text-subtle` · *✅ selesai 2 Nov (PR #101)*
- [x] 🤖 [C-08](chore/C-08-ui-auth-aksesibilitas.md) — UI auth: tombol yang menunggu Turnstile, fokus ke isian salah, tombol Google · *✅ selesai 2 Nov (PR #103)*
- [ ] 🤖 [C-08b](chore/C-08b-ui-auth-tampilan.md) — UI auth: area sentuh, label tablet, tata letak verifikasi, chip kata sandi · *putaran 2 (setelah UAT 11 Des); bukan prasyarat S1*

## Sprint 1 — CMS kursus & materi

Kartu ditulis di Claude chat menjelang sesinya, terhadap kode `main` terbaru. Rencana lengkap, prasyarat, dan keputusan tertunda ada di `STATUS.md` (item "Rencana S1"). Sejak 3 Nov urutan dan lingkupnya mengikuti jadwal demo 20 Nov (bagian "Pembaruan 3 Nov", "Pembaruan 4 Nov", "Pembaruan 4 Nov malam", "Pembaruan 6 Nov", dan "Pembaruan 7 Nov" di `STATUS.md`). Sejak 8 Nov impor soal CSV pindah ke setelah demo (bagian "Pembaruan 8 Nov"). Keputusan kartu S1-08 ada di bagian "Pembaruan 9 Nov"; hasilnya di "Pembaruan 10 Nov". Jalur peserta (S5-01, S2-01, …) di "Pembaruan 11 Nov"; jadwal yang disusun ulang dan versi demo pemutar video di "Pembaruan 14 Nov"; quiz materi (S3-01), Final Quiz tetap, dan jalur data demo di "Pembaruan 16 Nov". **Demo 20 Nov batal (19 Nov):** "setelah demo" di baris-baris di bawah kini berarti mengikuti bagian "Jalur UAT internal 11 Des".

- [x] 🤖 [S1-01](sprint-1/S1-01-daftar-dan-kursus-baru.md) — Daftar kursus, kursus baru, builder kosong · *✅ PR #106*
- [ ] 🤖 [S1-01b](sprint-1/S1-01b-daftar-kursus-lanjutan.md) — Daftar kursus lanjutan: kartu 19e tablet & ponsel, "Urut ▾", perapian dialog & kode S1-01 · *setelah demo 20 Nov*
- [x] 🤖 [S1-02](sprint-1/S1-02-builder-kursus.md) — Builder kursus: pengaturan, tambah materi, syarat terbit (lingkup demo, revisi 4 Nov) · *✅ PR #108*
- [ ] 🤖 [S1-02b](sprint-1/S1-02b-builder-kursus-lanjutan.md) — Builder lanjutan: urutkan ulang, hapus materi & kursus, tablet & ponsel, kolom kuning daftar · *setelah demo 20 Nov*
- [x] 🤖 [S1-03a](sprint-1/S1-03a-dokumen-konten.md) — Dokumen konten: validator server, renderer, tabel (tanpa dependensi baru) · *✅ PR #110*
- [x] 🤖 [S1-03b](sprint-1/S1-03b-editor-tiptap.md) — Editor TipTap: toolbar inti (B, I, H2, list, tautan, tabel), panel penolakan tempel 20b · *✅ PR #114*
- [x] 🤖 [S1-04](sprint-1/S1-04-editor-materi-dan-deskripsi.md) — Editor materi (teks) + deskripsi kursus, simpan manual (tanpa auto-save, keputusan 3 Nov) · *✅ PR #116*
- [ ] 🤖 S1-05 — Unggah video materi ke R2 + mesin file untuk kontrol 29a *(butuh H-04 + A-17 + S2-02b; kartu belum ditulis)* · *setelah demo — demo memakai video YouTube ([rencana](../decisions/video-sumber.md))*
- [ ] 🤖 S2-02b — Kontrol 29a + antarmuka `PlayerEngine` di atas mesin YouTube berkontrol tersembunyi, menggantikan kontrol bawaan S2-02 *(kartu belum ditulis; [rencana](../decisions/video-sumber.md) bagian 3a–3c)* · *setelah demo, sebelum S1-05*
- [ ] 🤖 S1-06 — Media library *(butuh A-17 + keputusan penyajian gambar; kartu belum ditulis)* · *setelah demo*
- [ ] 🤖 S1-07 — Pemilih gambar, sampul, pemakaian aset *(kartu belum ditulis)* · *setelah demo; menyalakan lagi syarat sampul*
- [ ] 🤖 Impor soal CSV (22c) — memakai aturan soal S1-09 *(kartu belum ditulis)* · *setelah demo; slot Sen 9 dipakai Beranda versi demo (keputusan 8 Nov)*
- [x] 🤖 [S1-08](sprint-1/S1-08-kirim-dan-terbitkan.md) — Kirim & terbitkan, versi demo: Kirim (EDITOR) → antrean `/cms/konten` → Setujui & terbitkan (ADMIN+) di builder, tanpa `NEEDS_REVISION` · *✅ PR #129 (10 Nov); perapian setelah demo (STATUS 10 Nov)* *(versi lengkap butuh PRD v1.6, setelah demo)*

## Jalur demo 20 Nov — selesai, demo dibatalkan 19 Nov

**Demo 20 Nov batal (kabar 19 Nov malam).** Semua kartu jalur ini sudah di-merge. Jadwal berikutnya ada di bagian "Jalur UAT internal 11 Des" di bawah.

Jadwal dan keputusannya di `STATUS.md` (bagian "Pembaruan 3 Nov", "Pembaruan 8 Nov", "Pembaruan 9 Nov", "Pembaruan 10 Nov", "Pembaruan 11 Nov", "Pembaruan 14 Nov", dan "Pembaruan 16 Nov"). Kartu ditulis di Claude chat selagi agent mengerjakan kartu sebelumnya. Halaman "Nilai Saya" sudah dipotong (14 Nov). Final Quiz tetap masuk demo (keputusan 16 Nov, ditegaskan 19 Nov walau titik cek usulan Rab 18 pukul 12.00 terlewat); batas potong baru: PR S5-02 belum di-merge 3 jam sebelum demo → demo tanpa Final Quiz. Impor CSV sudah dipindah ke setelah demo (8 Nov).

- [x] 🤖 [S1-09](sprint-1/S1-09-editor-quiz.md) — Editor quiz CMS: daftar soal (22a) + form satu soal (22b) · *✅ PR #120 (8 Nov); perapian kosmetik setelah demo (STATUS 8 Nov)*
- [x] 🤖 [S6-01](sprint-6/S6-01-beranda-versi-demo.md) — Beranda versi demo: hero 1a + ilustrasi 6a (bergerak, tombol jeda), Cara kerjanya, Tanya Ahli Gizi, CTA penutup, halaman "Segera hadir" · *✅ PR #127 (9 Nov); perapian setelah demo (STATUS 9 Nov)*
- [x] 🤖 [S5-01](sprint-5/S5-01-dasbor-belajar-versi-demo.md) — Dasbor belajar versi demo: kursus terbit, "Mulai materi 1" (pendaftaran), Kursus saya, skeleton `/belajar`, halaman legal "Segera hadir" · *✅ PR #131 (11 Nov); ⚠️ verifikasi manual pemilik belum dijalankan; perapian setelah demo (STATUS 11 Nov)* *(`cache()` sesi/profil ditunda ke setelah demo — STATUS 10 Nov)*
- [x] 🤖 [S2-01](sprint-2/S2-01-halaman-materi-dan-progres.md) — Halaman materi peserta + progres: gerbang akses, "materi dibuka", `POST /api/progress/video` dan posisi terakhir ([rencana video](../decisions/video-sumber.md) bagian 2) · *✅ PR #133 (14 Nov; terlambat 2 hari); perapian setelah demo (STATUS 14 Nov)*
- [x] 👤 Keputusan video demo: **YouTube unlisted** · *✅ diputuskan 7 Nov; R2 tetap jalur produksi, H-04 tetap wajib sebelum S1-05 — [rencana](../decisions/video-sumber.md)*
- [x] 🤖 [S2-02](sprint-2/S2-02-pemutar-video-youtube.md) — Pemutar video versi demo: migrasi kolom sumber video (`0001`, dengan `CHECK`), iframe YouTube **berkontrol bawaan** + simpan posisi, CSP, skrip pasang video ([rencana](../decisions/video-sumber.md), pembaruan 14 Nov) · *✅ PR #135 (16 Nov; terlambat ±1,5 hari); binzi-dev dimigrasi sebelum merge; perapian setelah demo (STATUS 16 Nov)*
- [x] 🤖 [S3-01](sprint-3/S3-01-quiz-materi.md) — Quiz materi: tombol + dialog konfirmasi (7d), aturan (7e), satu soal per layar dengan navigator (7g/7u), simpan otomatis + 28c, kumpulkan, hasil & pembahasan, nilai di Daftar materi · *✅ PR #138 (19 Nov; terlambat 2 hari); perapian masuk kartu A2 (STATUS 19 Nov)*
- [x] 👤 ~~Kartu kecil seed binzi-dev "[DEMO]"~~ — diganti (keputusan 19 Nov): kursus "[DEMO]" 2 materi + 30 soal diketik lewat CMS di Production; penonton internal
- [x] 🤖 [S5-02](sprint-5/S5-02-final-quiz-versi-demo.md) — Final Quiz versi demo: gerbang semua materi selesai, aturan 7h, runner S3-01, hasil + Nilai Akhir 60/40, status kursus Lulus/Selesai — tanpa halaman "Nilai Saya" (dipotong 14 Nov) · *✅ PR #140 (19 Nov); tes e2e 10 quiz materi diperbaiki di #141 (bukan flaky — STATUS 19 Nov); perapian masuk kartu A2*
- [ ] 👤 Akun demo per peran di Production (manual, keputusan 11 Nov) · *dipakai untuk UAT — sebelum A9*
- [ ] 👤 Ketik kursus "[DEMO]" lewat CMS (EDITOR) · kirim · setujui & terbitkan (ADMIN) · pasang video *unlisted* (`npm run video:youtube:binzi-dev`, `--durasi` = durasi asli) · `system_settings` ✓ 19 Nov (10/60/40) · *sebelum A9 (UAT)*
- [x] 👤 Region fungsi Vercel → Singapura (Settings → Functions), ukur `/belajar` sebelum & sesudah (STATUS 9 Nov) · *✅ 10 Nov: `/belajar` 1,64 s → ±0,12 s (STATUS 10 Nov)*
- [ ] ~~👤 Gladi resik · Kam 19 Nov siang~~ — diganti A9 (gladi UAT)
- [ ] ~~👤 Demo alur utuh dengan data contoh · Jum 20 Nov~~ — **dibatalkan 19 Nov**

## Jalur UAT internal 11 Des — rencana 19 Nov

Rencana lengkap, asumsi, dan aturannya ada di `STATUS.md` ("Pembaruan 19 Nov", bagian "Rencana UAT internal 11 Des"); kemajuan terbaru di "Pembaruan 20 Nov". ID kartu masih usulan. Kartu ditulis di Claude chat menjelang sesinya, terhadap `main` terbaru. Pembekuan fitur **Sen 7 Des**; posisi dicek tiap Senin.

**A. Wajib untuk UAT 11 Des** (urutan pengerjaan)

- [x] 👤 **A1** · C-11 — hapus pengecualian audit (patch, lihat "Chore terjadwal") · *✅ PR #142 (19 Nov)*
- [x] 🤖 **A2** · [S3-02](sprint-3/S3-02-perapian-quiz.md) — perapian quiz materi + Final Quiz · *✅ PR #145 (20 Nov, satu sesi); perapian putaran 2 di STATUS 20 Nov*
- [ ] 🤖 **A3** · S5-03 — Nilai Saya `/belajar/nilai` (8b, 8f) · *±2 hari*
- [ ] 🤖 **A4** · S5-04 — progres kursus `/belajar/{kursus}` (8c) + Kursus Saya `/belajar/kursus-saya` (13b, 13c) · *±2 hari*
- [ ] 🤖 **A5** · S6-02 — katalog `/kursus` + detail `/kursus/{slug}` (7a, 7b, 7m), sampul placeholder · *±2½ hari*
- [ ] 🤖 **A6** · S5-05 — profil dasar `/profil` (9c): ubah nama, ubah password, logout semua perangkat · *±2 hari*
- [ ] 🤖 **A7** · S3-03 — lapor gangguan quiz (7i, 7l) + `/cms/reset-attempt` (26a–26c) · *±3 hari*
- [ ] 🤖 **A8** · S5-06 — pengguna CMS `/cms/pengguna` (25a–25d) · *±2 hari*
- [ ] 🤖👤 **A9** — stabilisasi + gladi UAT: cek 360/768/1280, checklist §12.6, skenario UAT dijalankan sekali penuh · *±2½ hari*
- [ ] 👤 **UAT internal putaran 1** · *Jum 11 Des*

| Minggu | Kartu | Titik cek |
|---|---|---|
| Jum 20 – Kam 26 Nov | A1, A2, A3, A4 | A1 merge paling lambat Kam 26 Nov |
| Jum 27 Nov – Kam 3 Des | A5, A6, A7 (mulai) | Sen 30 Nov: bila A1–A4 belum semua di-merge, daftar B dibatalkan |
| Jum 4 – Kam 10 Des | A7 (selesai), A8, A9 | Sen 7 Des: pembekuan fitur |
| Jum 11 Des | UAT internal putaran 1 | |

**B. Cadangan** — hanya bila A selesai lebih cepat; urutannya tetap:

- [ ] 🤖 **B1** · S1-06 + S1-07 — media library + pemilih sampul (24a–24d) · *±3 hari*
- [ ] 🤖 **B2** · S6-03 — preview materi 1 tanpa login (7c) · *±1 hari*
- [ ] 🤖 **B3** · S5-07 — ulangi kursus (7k, 16a) · *±2 hari*
- [ ] 🤖 **B4** · S5-08 — hapus akun + unduh data (9e) · *±2 hari*
- [ ] 🤖 **B5** · S6-04 — filter katalog level & durasi · *±½ hari*

**Urutan tarik maju** — bila A dan B selesai lebih cepat dari jadwal, lanjut dari atas, selama perkiraannya selesai sebelum Sen 7 Des:

1. Video R2 — 👤 H-04 → 🤖 S2-02b kontrol 29a + `PlayerEngine` → 🤖 S1-05 unggah video di CMS → 🤖 C-10 migrasi YouTube → R2 · *±5–6 hari; hanya bila H-04 sudah selesai; wajib sebelum peserta penelitian*
2. 🤖 S6-05 — Tentang + halaman legal · *±2 hari, tergantung teks dari pemilik*
3. 🤖 S6-06 — pencarian `/cari` · *±2 hari*
4. 🤖 Modul artikel (S4) — CMS artikel, kategori/tag, halaman publik, SEO · *±6–7 hari*

**Putaran 2** (setelah 11 Des, perkiraan awal–pertengahan Januari): sisa urutan tarik maju; audit log; pengaturan sistem; daftar quiz CMS; impor soal CSV; S1-01b; S1-02b; alur "perlu revisi" S1-08; C-08b; C-09; upgrade keamanan Next.js; sisa Fase 1.5.

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

- [x] **Proposal CSP** — diputuskan 17 Okt: opsi (b+) (PRD v1.5 Q45), diterapkan di [A-16b](fase-0/A-16b-penegakan-csp.md).
- [x] **Jalur data demo ke binzi-dev** — diputuskan 16 Nov: konten ahli gizi belum ada, jadi akun demo dibuat manual dan kursus dipasang lewat kartu seed "[DEMO]" (`STATUS.md`, "Pembaruan 16 Nov", keputusan no. 3).
- [x] **Penonton demo 20 Nov** — diputuskan 19 Nov: internal. Kursus "[DEMO]" boleh memakai konten yang belum ditinjau ahli gizi.
- [x] **Target setelah demo 20 Nov batal** — dicatat 19 Nov: UAT internal Jum 11 Des, dua putaran (rencana di STATUS 19 Nov dan bagian "Jalur UAT internal 11 Des").
- [ ] **Teks halaman Tentang dan legal** — dibutuhkan sebelum S6-05 (urutan tarik maju no. 2).
