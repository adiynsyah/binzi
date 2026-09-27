> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 9. Rekomendasi Teknologi

### 9.1 Apa yang Berubah dan Mengapa

Anda menyampaikan dua hal yang mengubah rekomendasi saya secara signifikan:

1. **Anda belum menguasai Docker, Redis, dan BullMQ.**
2. **Anda ingin menekan biaya — idealnya semua gratis di awal.**

Ditambah satu fakta teknis dari jawaban Q4: **video hanya 3–5 menit @720p.** Ini ternyata kunci yang membuat semuanya mungkin.

**Analisisnya:** pendekatan konvensional untuk platform kursus adalah memakai layanan video terkelola, karena biasanya video panjang dan butuh adaptive bitrate. Video 4 menit @720p hanya berukuran ~45–60 MB. File sekecil itu bisa diputar langsung sebagai MP4 dari object storage tanpa transcoding sama sekali. Dan begitu transcoding tidak diperlukan, **kebutuhan akan queue (BullMQ) dan Redis ikut hilang** — karena satu-satunya pekerjaan berat di sistem ini adalah memproses video.

Berikut yang saya hapus dan penggantinya:

| Yang tidak dipakai | Alasan | Penggantinya |
|---|---|---|
| **Docker** | Hanya dipakai untuk database lokal dan deployment | Database cloud gratis untuk dev; deploy via Git push (tanpa container) |
| **Redis** | Dipakai untuk cache & rate limit | Cache bawaan Next.js + rate limit di tabel PostgreSQL + Vercel Firewall |
| **BullMQ + worker** | Dipakai untuk transcoding & PDF sertifikat | Transcoding tidak perlu; sertifikat tidak ada di MVP; cron via GitHub Actions |
| **Layanan video terkelola** | Biaya bulanan | Cloudflare R2 (gratis 10 GB, egress $0) + MP4 progressive |
| **Prisma** | Preferensi Anda | **Drizzle ORM** |

Hasilnya: **tiga teknologi yang belum Anda kuasai hilang dari MVP, dan biaya turun ke nol.** Semuanya bisa ditambahkan kembali nanti saat skala menuntut — dan pada saat itu Anda akan menambahkannya karena ada masalah nyata yang perlu diselesaikan, bukan karena "katanya perlu". Itu cara terbaik untuk belajar teknologi baru.

### 9.2 Stack Final MVP

| Lapisan | Pilihan | Biaya | Catatan |
|---|---|---|---|
| Framework | **Next.js 16.3.x (App Router) + TypeScript** | Gratis | SSR/ISR untuk SEO; satu codebase untuk 3 area. **v1.3:** 16.3 berstatus Active LTS (15.5 = Maintenance LTS). Pin versi patch terbaru — minimal **16.3.7** setelah rilis keamanan 30 Sep 2026 (Q36) |
| Styling | **Tailwind CSS v4 + shadcn/ui** | Gratis | Mobile-first secara desain; komponen dimiliki sendiri |
| **ORM** | **Drizzle ORM + drizzle-kit** | Gratis | Sesuai permintaan Anda. SQL-like, bundle kecil, migrasi eksplisit |
| Database | **Supabase Free** (PostgreSQL, region Singapura) | **$0** | 500 MB DB, 5 GB egress, 50K MAU |
| Auth | **Better Auth** | Gratis | Google OAuth + email/password + verifikasi email + rate limit, semuanya bawaan. Adapter Drizzle resmi |
| Object storage | **Cloudflare R2** | **$0** | 10 GB gratis, **egress selalu $0** — ini yang membuat video gratis |
| Video | **MP4 (H.264) di R2 + `<video>` HTML5** | $0 | Tidak perlu transcoding untuk video 3–5 menit @720p |
| Gambar | R2 + `next/image` | $0 | Optimasi AVIF/WebP otomatis |
| Rich text editor | **TipTap** (open source core) | Gratis | Mudah melarang node video/iframe. Hindari ekstensi Pro yang berbayar |
| Email | **Resend** free tier | $0 | ~3.000 email/bulan. Alternatif: Brevo (300/hari) |
| CDN, WAF, anti-bot | **Vercel CDN & Firewall** (bawaan) + **Cloudflare Turnstile** | $0 | DDoS mitigation & cache bawaan Vercel; CAPTCHA gratis. **v1.3:** tanpa proxy Cloudflare di depan Vercel (Q38) |
| Hosting | **Vercel Hobby** (dev) → lihat §9.4 | $0 (dev) | ⚠️ Ada catatan penting soal lisensi |
| Cron / job terjadwal | **GitHub Actions** (schedule) | Gratis | Memanggil API route; tidak perlu queue |
| CI/CD | **GitHub Actions** | Gratis | 2.000 menit/bulan untuk repo privat |
| Pencarian | **PostgreSQL full-text search** | $0 | Cukup untuk ribuan dokumen |
| Analitik produk | **PostHog** free | $0 | Funnel, retensi, session replay |
| Analitik web | **GA4 + Search Console** | $0 | Kebutuhan SEO |
| Error tracking | **Sentry** free | $0 | ~5.000 error/bulan |
| Form & validasi | React Hook Form + **Zod** | Gratis | Skema Zod dipakai ulang di klien & server |
| Data fetching | Server Components + **TanStack Query** (klien) | Gratis | Untuk auto-save quiz & polling |
| Testing | Vitest + Playwright | Gratis | E2E wajib untuk alur quiz |
| **Domain** | `.com` atau `.id` | **~Rp 200–500rb/tahun** | Satu-satunya biaya yang tak terhindarkan |

**Total biaya berjalan MVP: Rp 0/bulan + biaya domain tahunan.**

### 9.3 Perhitungan Kapasitas Free Tier

**Video (batas paling kritis):**
```
3 kursus × ~6 materi = 18 video
Video 4 menit @720p, H.264, ~1,5 Mbps ≈ 45 MB
Total penyimpanan ≈ 18 × 45 MB = 810 MB

R2 gratis: 10 GB penyimpanan → terpakai 8%
R2 egress: SELALU $0, berapa pun jumlah penontonnya  ← ini kuncinya
R2 Class B (baca): 10 juta/bulan gratis → jauh di atas kebutuhan

Ruang tersisa cukup untuk ± 200 video lagi sebelum perlu membayar.
Setelah 10 GB: ~$0,015/GB/bulan (sekitar Rp 250/GB) — tetap sangat murah.
```

**Database:**
```
Supabase gratis: 500 MB
Isi database Anda hampir seluruhnya teks & metadata:
  - 6 artikel + 3 kursus + 18 materi (konten JSON) ≈ 5 MB
  - ~200 soal quiz ≈ 1 MB
  - 5.000 user + progress + attempt quiz ≈ 50 MB
Total ≈ 60 MB → terpakai 12%
```
Gambar dan video **tidak** disimpan di database (hanya URL-nya), sehingga 500 MB sangat longgar.

**Kesimpulan:** free tier bukan sekadar "cukup untuk demo" — dengan volume konten Anda, ini realistis untuk produksi selama ± 12 bulan pertama.

### 9.4 ⚠️ Peringatan Penting: Lisensi Vercel Hobby

Ini hal yang harus Anda ketahui sebelum memilih hosting.

**Vercel Hobby (gratis) dibatasi untuk penggunaan non-komersial/pribadi.** Vercel mendefinisikan "komersial" secara luas — termasuk situs yang menghasilkan keuntungan finansial bagi siapa pun yang terlibat dalam pembuatannya, termasuk developer berbayar. Batasannya adalah **klausul lisensi, bukan batas kuota**.

Artinya untuk kasus Anda:

| Situasi | Status Hobby |
|---|---|
| Tahap pengembangan, belum rilis publik | ✅ Aman |
| Rilis publik, seluruh konten gratis, tanpa iklan, tanpa monetisasi | ⚠️ Area abu-abu — banyak yang melakukannya, tapi tidak dijamin |
| Ada developer/konsultan yang dibayar untuk membangunnya | ❌ Dianggap komersial |
| Kursus berbayar diaktifkan (rencana Anda "nanti") | ❌ Wajib Pro |

**Rekomendasi bertahap:**

1. **Selama pengembangan:** Vercel Hobby, gratis, tanpa keraguan.
2. **Saat rilis publik**, pilih salah satu:
   - **Vercel Pro — ~$20/bulan (± Rp 320rb).** Paling sederhana, tanpa perubahan kode, aman secara lisensi. Ini rekomendasi saya jika anggaran memungkinkan.
   - **Cloudflare Workers — gratis, penggunaan komersial diizinkan.** Next.js dapat di-deploy ke sini lewat adapter OpenNext. Benar-benar $0, tapi ada beberapa penyesuaian teknis dan komunitasnya lebih kecil.
   - **VPS murah (~Rp 80rb/bulan)** — paling murah untuk jangka panjang, tapi membutuhkan pengetahuan server (dan kemungkinan Docker) yang saat ini ingin Anda hindari.

> Verifikasi ulang syarat & harga di halaman resmi masing-masing sebelum memutuskan — kebijakan free tier berubah cukup sering.

**Catatan v1.3 — fase penelitian dan kuota Hobby.** Dalam waktu dekat hingga pertengahan, BINZI dipakai untuk **penelitian ahli gizi** dengan jumlah pengguna kecil. Untuk fase ini Vercel Hobby memadai: kuota bulanannya (per 2026: ±100 GB transfer, 1 juta Edge Request, 1 juta function invocation, 4 jam CPU aktif) jauh di atas kebutuhan, dan video/upload tidak lewat Vercel (R2 langsung). Yang perlu dipantau menjelang **rilis publik**:

- **Edge Request** kemungkinan menjadi batas pertama. Estimasi kasar di target 5.000 MAU (§8.2): ±100.000 page view/bulan × belasan request per halaman (JS, font, gambar — termasuk yang ter-cache) bisa mendekati atau melewati 1 juta.
- **Transfer data** dan **optimasi gambar** (`next/image`) menyusul.
- Melewati batas Hobby dilaporkan tidak menimbulkan tagihan, tetapi fitur terkait dijeda — bagi pengguna sama dengan situs bermasalah.
- Pantau dashboard Usage Vercel mingguan; bila salah satu metrik melewati ±70%, putuskan OQ-12.

### 9.5 Jalur Upgrade (kapan harus mulai membayar)

| Pemicu | Tindakan | Perkiraan biaya |
|---|---|---|
| Rilis publik / ada monetisasi | Vercel Pro **atau** pindah ke Cloudflare Workers | $0–20/bln |
| DB > 400 MB, atau butuh backup otomatis | Supabase Pro | $25/bln |
| Video > 10 GB | Bayar overage R2 | ~$0,015/GB |
| Video mulai > 10 menit atau banyak keluhan buffering | Pindah ke Bunny Stream / Cloudflare Stream (HLS adaptif) | $5–30/bln |
| Konten > 2.000 dokumen & pencarian terasa lambat | Meilisearch (self-host atau cloud) | $0–30/bln |
| Butuh background job berat (transcoding, laporan besar) | Baru kenalkan Redis + BullMQ | $0–10/bln |
| Email > 3.000/bulan | Resend berbayar atau Amazon SES | $0–20/bln |

**Prinsipnya:** setiap komponen di atas dapat diupgrade **secara terpisah** tanpa menyentuh yang lain. Tidak ada satu pun yang memaksa penulisan ulang aplikasi.

### 9.6 Catatan Khusus Drizzle (sesuai permintaan Anda)

Perubahan praktis dari Prisma:

| Aspek | Prisma | Drizzle |
|---|---|---|
| Definisi skema | File `schema.prisma` (DSL sendiri) | File TypeScript biasa (`schema.ts`) |
| Migrasi | `prisma migrate` (otomatis) | `drizzle-kit generate` → hasilkan file SQL → `drizzle-kit migrate` |
| Query | Abstraksi tinggi | Mirip SQL (`db.select().from(courses).where(eq(...))`) |
| Relasi | Otomatis | Dideklarasikan eksplisit lewat `relations()` |
| Bundle size | Besar | Kecil — cocok untuk serverless |
| Kurva belajar | Lebih mudah bagi pemula | Perlu paham SQL, tapi lebih transparan |

**Konvensi proyek yang saya sarankan:**
```
src/db/
├── schema/
│   ├── auth.ts          # users, sessions, accounts, verifications
│   ├── course.ts        # courses, sections, lessons
│   ├── quiz.ts          # quizzes, questions, options, attempts, answers
│   ├── progress.ts      # enrollments, lesson_progress
│   ├── article.ts       # articles, categories, tags
│   ├── media.ts         # media_assets
│   ├── system.ts        # audit_logs, settings, rate_limits
│   └── index.ts         # re-export semua + relations
├── migrations/          # SQL hasil drizzle-kit (COMMIT ke git)
├── seed.ts
└── index.ts             # instance koneksi db
```

Aturan: **selalu tinjau file SQL yang dihasilkan `drizzle-kit generate` sebelum commit.** Ini keunggulan Drizzle dibanding Prisma — Anda melihat persis apa yang akan dijalankan di database.

Gunakan **connection pooler Supabase (Supavisor, port 6543)** dengan driver `postgres-js`, bukan koneksi langsung, karena lingkungan serverless membuka banyak koneksi singkat.

### 9.7 Development Tanpa Docker

Anda tidak perlu Docker sama sekali:

| Kebutuhan | Cara tanpa Docker |
|---|---|
| Database lokal | Buat **project Supabase kedua** khusus development (free tier mengizinkan 2 project aktif). Cukup ganti `DATABASE_URL` di `.env.local` |
| Menjalankan aplikasi | `npm run dev` |
| Migrasi database | `npx drizzle-kit generate` lalu `npx drizzle-kit migrate` |
| Deploy | `git push` → Vercel build & deploy otomatis |
| Job terjadwal | GitHub Actions memanggil `POST /api/cron/{nama}` dengan header rahasia |

Alternatif jika ingin database benar-benar lokal: pasang PostgreSQL langsung di komputer (installer resmi tersedia untuk Windows/macOS) — tetap tanpa Docker.
