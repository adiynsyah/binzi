# H-08 · Vercel: hubungkan repo

| | |
|---|---|
| **Pemilik** | Kamu (tidak dikerjakan agent) |
| **Perkiraan** | 20 menit |
| **Bergantung pada** | [H-01](H-01-repo-github-dan-dokumen-proyek.md) |
| **Tag ClickUp** | `fase-0`, `manual`, `setup`, `deploy` |
| **Judul ClickUp** | `[F0][Kamu] H-08 Vercel: hubungkan repo` |

## Tujuan
Preview otomatis per PR (PRD §10.6). Selama pengembangan pakai Hobby (lihat §9.4 soal lisensi).

## Langkah
1. Import repo GitHub ke Vercel (Hobby).
2. Build pertama boleh gagal sampai A-01 selesai — itu wajar.
3. Setelah H-10: isi Environment Variables untuk **Preview** memakai nilai **dev** (DB dev, bucket dev, kunci Turnstile asli).
4. Beri nama project yang rapi (mis. `binzi`), sehingga URL produksi bawaannya stabil: `https://binzi.vercel.app`. Selama belum punya domain, URL ini dipakai sebagai lingkungan uji tetap (untuk Turnstile dan cron keep-alive).
5. Isi env **Production** dengan nilai **dev** juga (DB & bucket dev) selama pengembangan. Produksi sungguhan disiapkan menjelang rilis (OQ-12: Vercel Pro atau Cloudflare Workers).

## Selesai jika
- [ ] Setiap PR menghasilkan preview URL yang bisa dibuka.
- [ ] URL `https://<project>.vercel.app` bisa dibuka.
