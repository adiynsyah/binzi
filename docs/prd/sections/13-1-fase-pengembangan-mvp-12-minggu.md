> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 13. Roadmap

### 13.1 Fase Pengembangan (MVP: 12 minggu)

**Fase 0 — Fondasi (2 minggu)**
Setup repo & CI/CD, dua project Supabase, skema Drizzle + migrasi awal, Better Auth (Google + email/password + verifikasi), RBAC, sistem desain & komponen dasar (mobile-first), layout tiga area, konfigurasi R2 + Turnstile. Domain & DNS (Vercel) boleh menyusul — tidak memblokir Fase 0.
*Deliverable: user dapat mendaftar, login, dan melihat halaman yang benar sesuai role, di HP maupun laptop.*

**Fase 1 — MVP (9 minggu)**

| Sprint | Minggu | Fokus |
|---|---|---|
| S1 | 3–4 | CMS: CRUD kursus & materi, editor TipTap + upload gambar, media library |
| S2 | 5–6 | Upload & pemutaran video (R2 presigned), player, pelacakan progress |
| S3 | 7–8 | Mesin quiz: builder di CMS, mode ujian, timer server, penilaian, riwayat attempt |
| S4 | 9 | Artikel + kategori + tag di CMS; halaman artikel publik; SEO teknis |
| S5 | 10 | Dashboard member, progress, **Nilai Saya**, Final Quiz, ulangi kursus |
| S6 | 11 | Beranda (termasuk section **Tanya Ahli Gizi** + nav scroll), katalog kursus, pencarian, **Tentang Kami** |

**Fase 1.5 — Stabilisasi (1 minggu)**
QA lintas perangkat (360 / 768 / 1280, +1440 untuk Beranda & Masuk), audit performa & aksesibilitas, uji keamanan dasar, seeding konten, pelatihan admin, UAT, uji restore backup.

**Fase 2 — Pertumbuhan**
Sertifikat, question bank & bulk import soal, formulir & booking konsultasi, analitik konten, monetisasi, versioning konten, gamifikasi ringan, notifikasi in-app.

**Fase 3 — Ekspansi**
Aplikasi mobile, forum, live class, learning path, rekomendasi personal, HLS adaptif, multi-bahasa.
