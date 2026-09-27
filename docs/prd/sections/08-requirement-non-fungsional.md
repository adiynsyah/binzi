> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 8. Requirement Non-Fungsional

### 8.1 Performa

| Metrik | Target (p75, mobile 4G) |
|---|---|
| LCP | < 2,5 s |
| INP | < 200 ms |
| CLS | < 0,1 |
| TTFB (halaman ter-cache) | < 300 ms |
| Video mulai diputar | < 3 s |
| Submit quiz | < 1 s |
| JS bundle awal | < 200 KB gzip |
| Halaman artikel | < 1 MB total |

### 8.2 Skala Target

- Awal: 5.000 MAU, 200 pengguna serentak, 3 kursus, 6 artikel.
- Dirancang tumbuh ke 50.000 MAU tanpa perombakan arsitektur — hanya perlu naik tier layanan.
- Aplikasi *stateless* → dapat di-scale horizontal kapan saja.

### 8.3 Keandalan

- Uptime target 99% (MVP dengan free tier), 99,9% setelah pindah ke tier berbayar.
- **Backup:** free tier Supabase tidak menyediakan backup otomatis → wajib `pg_dump` harian via GitHub Actions ke R2 (gratis). Uji restore setiap bulan.
- RPO ≤ 24 jam, RTO ≤ 8 jam.
- Degradasi anggun: jika video gagal dimuat, teks materi tetap dapat dibaca dan quiz tetap bisa dikerjakan.

### 8.4 Privasi & Kepatuhan

- **UU No. 27/2022 (PDP)**: persetujuan eksplisit, hak akses & penghapusan, retensi terdefinisi.
- **Retensi (v1.3, Q39):** data akun, progress, dan nilai **disimpan selama akun aktif, tanpa batas waktu dan tanpa penghapusan otomatis karena tidak aktif**, dan tidak dianonimkan. Data dihapus hanya bila pengguna menghapus akunnya sendiri (AUTH-09: soft delete → purge 30 hari, data dianonimkan sesuai Q10) atau atas permintaan resmi. Kebijakan ini dituliskan eksplisit di Kebijakan Privasi — itulah bentuk "retensi terdefinisi". Persetujuan saat daftar tetap berupa persetujuan S&K + Kebijakan Privasi biasa; tidak ada alur consent penelitian.
- Karena data disimpan jangka panjang, **backup harian + uji restore** (§10.5, R-10) menjadi semakin penting sebelum pengguna pertama mendaftar.
- Data disimpan di region **Singapura (ap-southeast-1)** — latensi ~20–40 ms dari Jakarta.
- Wajib ada sebelum rilis: Kebijakan Privasi, Syarat & Ketentuan, Disclaimer Medis, banner cookie.
- **Tidak ada data kesehatan yang disimpan di sistem.** Konsultasi berlangsung sepenuhnya di WhatsApp, sehingga kewajiban PDP untuk kategori data spesifik tidak muncul di aplikasi. Ahli gizi tetap terikat panduan kerahasiaan internal (§5.5).

### 8.5 Aksesibilitas

- Target **WCAG 2.1 AA**: kontras ≥ 4,5:1, navigasi keyboard penuh, focus state terlihat, semantic HTML + ARIA.
- Target sentuh ≥ 44×44 px.
- Dukungan `prefers-reduced-motion`.
- Ukuran font dasar 16px (jangan lebih kecil — persona P3 berusia 45+).

### 8.6 SEO

- SSR/ISR untuk semua halaman publik.
- JSON-LD: `Course`, `Article`, `BreadcrumbList`, `FAQPage`, `Organization`, `Person` (ahli gizi).
- `sitemap.xml` dinamis, `robots.txt`, canonical, slug bahasa Indonesia.
- E-E-A-T: penulis & reviewer berkredensial, tanggal update, daftar rujukan.

### 8.7 Browser

Chrome, Safari, Firefox, Edge (2 versi terakhir). Safari iOS ≥ 15. Diuji pada 360px, 768px, 1280px (+1440px untuk Beranda & Masuk).
