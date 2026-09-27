> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 10. Arsitektur & System Design

### 10.1 Diagram (disederhanakan — tanpa Redis, queue, dan worker)

```
                    ┌──────────────────────────────┐
                    │ Browser (HP / Tablet / Laptop)│
                    └───────────────┬──────────────┘
                                    │ HTTPS
                    ┌───────────────▼──────────────┐
                    │  Vercel CDN & Firewall        │
                    │  DNS · cache · DDoS (bawaan)  │
                    └───────────────┬──────────────┘
                                    │
   ┌────────────────────────────────▼─────────────────────────────────┐
   │              Next.js 16 App  (Vercel / Cloudflare Workers)        │
   │                                                                   │
   │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
   │  │  Publik    │  │  Belajar   │  │    CMS     │  │ API Routes │  │
   │  │  ISR/SSR   │  │  SSR+CSR   │  │  CSR+SSR   │  │ + Actions  │  │
   │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │
   │  ──────────────────── Modul Domain ────────────────────────────  │
   │   auth │ course │ lesson │ quiz │ progress │ article             │
   │   media │ user │ notification                                    │
   │  ──────────────────── Infrastruktur ───────────────────────────  │
   │   db (Drizzle) │ storage (R2) │ mail (Resend) │ ratelimit (DB)   │
   └──────┬───────────────────────┬──────────────────────┬────────────┘
          │                       │                      │
   ┌──────▼────────┐   ┌──────────▼─────────┐   ┌────────▼─────────┐
   │  PostgreSQL   │   │  Cloudflare R2     │   │     Resend       │
   │  (Supabase)   │   │  video MP4, gambar │   │  email transaksi │
   │  Singapura    │   │  egress GRATIS     │   └──────────────────┘
   └───────────────┘   └────────────────────┘
          ▲
          │ POST /api/cron/* (header rahasia)
   ┌──────┴──────────────┐
   │  GitHub Actions     │  cron harian: backup DB, pengingat,
   │  (pengganti queue)  │  bersih-bersih media yatim
   └─────────────────────┘
```

Dibanding arsitektur konvensional untuk platform sejenis, **empat komponen infrastruktur tidak diperlukan sama sekali** (Redis, worker BullMQ, penyedia video terkelola, Docker). Yang tersisa hanya tiga layanan eksternal, semuanya dikonfigurasi lewat environment variable.

### 10.2 Struktur Kode

```
src/
├── app/
│   ├── (public)/        # beranda (termasuk section konsultasi), kursus, artikel, tentang — ISR
│   ├── (auth)/          # masuk, daftar, reset
│   ├── (learn)/         # dashboard, player, quiz, nilai — protected
│   ├── (cms)/           # CMS — protected + RBAC
│   └── api/
│       ├── auth/[...all]/     # Better Auth handler
│       ├── upload/            # presigned URL R2
│       ├── progress/          # tracking video & materi
│       ├── quiz/              # attempt, autosave, submit
│       └── cron/              # dipanggil GitHub Actions
│
├── modules/             # inti bisnis, terisolasi per domain
│   ├── auth/  course/  lesson/  quiz/  progress/
│   ├── article/  media/  user/  notification/
│   └── (tiap modul: service.ts | queries.ts | schema.ts | policy.ts)
│
├── components/
│   ├── ui/              # shadcn primitives
│   └── public/  learn/  cms/  shared/
│
├── db/                  # Drizzle: schema, migrations, seed
├── lib/                 # storage, mail, auth, sanitize, ratelimit, utils
└── config/              # env (validasi Zod), constants
```

**Aturan:** modul berkomunikasi lewat `service.ts` masing-masing; tidak boleh saling mengimpor `queries.ts`. Ini yang menjaga batas tetap rapi jika suatu saat perlu dipecah.

### 10.3 Alur Video (tanpa transcoding)

```
UPLOAD (admin)
1. Admin pilih file → POST /api/upload/video
2. Server: cek role, validasi tipe & ukuran (maks 200 MB) → buat presigned PUT URL R2
3. Browser upload LANGSUNG ke R2 (progress bar); tidak melewati server aplikasi
4. Server catat lessons.video_key, video_status = READY (langsung, tanpa proses)
5. Ekstrak durasi video di sisi klien lewat elemen <video> lalu kirim ke server

PEMUTARAN (member)
1. Member buka materi → server cek: login? enrolled? materi terbuka?
2. Server buat presigned GET URL R2 (TTL 2 jam)
3. <video src={signedUrl} preload="metadata"> — browser melakukan range request
4. Progress dikirim tiap 10 detik (throttled) → POST /api/progress/video
```

**Batasan yang perlu Anda terima (dan mengapa dapat diterima):**

| Batasan | Dampak | Mengapa dapat diterima sekarang |
|---|---|---|
| Tidak ada adaptive bitrate | User di koneksi lambat menunggu lebih lama | File 45 MB terunduh progresif; untuk video 4 menit, buffering awal masih wajar |
| Satu resolusi saja | User HP mengunduh kualitas penuh | 720p @1,5 Mbps masih hemat dibanding standar video panjang |
| Presigned URL dapat dibagikan selama TTL | Kebocoran terbatas | TTL 2 jam + konten gratis = risiko rendah. Bila kursus jadi berbayar, ganti dengan Cloudflare Worker penjaga token |

**Kapan harus pindah ke HLS:** jika video melebihi 10 menit, atau muncul keluhan buffering dari pengguna di luar Jawa. Migrasinya terisolasi di `lib/storage/video.ts` — hanya satu file yang berubah.

**Panduan wajib untuk admin sebelum upload** (masukkan ke dokumentasi CMS):
```
Format   : MP4 (H.264 + AAC)
Resolusi : 1280×720
Bitrate  : 1,2–1,8 Mbps (video), 128 kbps (audio)
Ukuran   : usahakan < 60 MB per video
Faststart: WAJIB aktif (agar video bisa diputar sebelum unduhan selesai)
Alat     : HandBrake (gratis) — preset "Fast 720p30", centang "Web Optimized"
```
Jika video melebihi 200 MB, sistem menolak dan menampilkan panduan di atas.

### 10.4 Strategi Caching (tanpa Redis)

| Lapisan | Konten | Strategi |
|---|---|---|
| Vercel CDN | Aset statis (JS, CSS, font) & gambar hasil `next/image` | Cache lama; nama file ber-hash |
| Cloudflare R2 (langsung) | Video & berkas asli | Diakses lewat presigned URL; tidak melewati Vercel sehingga tidak memakan kuota transfer Vercel |
| Next.js ISR | Beranda, katalog, artikel, halaman tentang | `revalidate: 3600` + **revalidasi on-demand saat admin publish** |
| Next.js `unstable_cache` | Daftar kategori artikel, kursus populer | 5–15 menit, invalidasi berbasis tag |
| React Query | Data dashboard user | `staleTime` 60 detik |
| Tidak di-cache | Progress, nilai quiz, seluruh CMS | Selalu segar |

Cache Next.js menggantikan peran Redis di skala ini. Redis baru dibutuhkan saat aplikasi berjalan di banyak instance yang perlu berbagi cache — jauh di atas 50.000 MAU.

### 10.5 Job Terjadwal (tanpa queue)

Semua dijalankan GitHub Actions yang memanggil API route terlindungi:

| Job | Jadwal | Fungsi |
|---|---|---|
| `backup-db` | Harian 02:00 WIB | `pg_dump` → unggah ke R2 (menutupi ketiadaan backup di free tier) |
| `keep-alive` | Tiap 3 hari | Satu query ringan agar project Supabase tidak auto-pause |
| `cleanup-media` | Mingguan | Hapus aset tidak terpakai > 30 hari |
| `purge-accounts` | Harian | Hapus permanen akun soft-deleted > 30 hari |
| `learning-reminder` | Harian (fase 1.5) | Email pengingat untuk user tidak aktif 7 hari |

Contoh:
```yaml
# .github/workflows/cron.yml
on:
  schedule:
    - cron: '0 19 * * *'   # 02:00 WIB
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST "${{ secrets.APP_URL }}/api/cron/backup-db" \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
```

### 10.6 Environment

| Environment | Database | Hosting |
|---|---|---|
| Local | Supabase project #2 (dev) | `npm run dev` |
| Preview (per PR) | Supabase project #2 (dev) | Vercel preview otomatis |
| Production | Supabase project #1 | Vercel production |

Migrasi dijalankan manual & sengaja (`drizzle-kit migrate`) sebelum deploy produksi — bukan otomatis, agar tidak ada perubahan skema yang tidak disadari.
