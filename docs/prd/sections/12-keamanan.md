> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 12. Keamanan

### 12.1 Autentikasi & Otorisasi
- Password di-hash dengan algoritme bawaan Better Auth (scrypt/argon2) — jangan diganti dengan MD5/SHA.
- Cookie session: `HttpOnly`, `Secure`, `SameSite=Lax`.
- Rotasi session setelah login.
- **Setiap akses data diverifikasi di server.** Menyembunyikan tombol di UI bukan keamanan.
- Cek akses materi: `isPublished && (isFreePreview || (isAuthenticated && isEnrolled && isUnlocked))`.
- Anti-IDOR: setiap query berbasis ID menyertakan kondisi kepemilikan (`WHERE id = ? AND user_id = ?`).

### 12.2 Integritas Quiz

Tetap berlaku penuh meski quiz tidak lagi menjadi gerbang — nilai adalah satu-satunya output pembelajaran di MVP, jadi harus dapat dipercaya.

| Ancaman | Mitigasi |
|---|---|
| Melihat kunci jawaban di DevTools | `is_correct` tidak pernah diserialisasi sebelum submit; gunakan whitelist field, bukan `select *` |
| Memanipulasi timer | `expires_at` dihitung & disimpan server; submit setelah kedaluwarsa ditolak (toleransi 5 detik) |
| Refresh untuk mereset timer | Attempt aktif dilanjutkan, bukan dibuat baru (partial unique index) |
| Attempt paralel | Satu `IN_PROGRESS` per user per quiz, dijamin di level database |
| Mengulang quiz lewat manipulasi request | Server menolak attempt baru bila sudah ada attempt `SUBMITTED`/`EXPIRED` (409). Pemulihan hanya lewat reset admin yang teraudit |
| Mengirim skor palsu | Klien hanya mengirim `optionId`; **seluruh penilaian di server** |
| Race condition saat submit | Transaksi + status sebagai state machine + idempotency key |

### 12.3 Konten & Input
- **Konten kaya divalidasi sebagai skema TipTap JSON di server** dengan whitelist node. Node `video`, `iframe`, `script`, `embed` **ditolak** — inilah yang menegakkan CRS-05 secara tak-terbypass.
- Sanitasi ulang saat render ke HTML (defense in depth).
- Semua payload API divalidasi dengan Zod.
- Upload: validasi **magic bytes**, batas ukuran (gambar 5 MB, video 200 MB), nama file di-generate ulang, **SVG dilarang**.
- Bucket R2 tidak boleh publik — akses hanya lewat presigned URL.

### 12.4 Rate Limiting (tabel `rate_limits`)

| Endpoint | Limit |
|---|---|
| Login / registrasi | 5 / 15 menit / IP+email |
| Lupa password | 3 / jam / email |
| Mulai quiz attempt | 10 / jam / user |
| Auto-save jawaban | 60 / menit / attempt |
| Upload media | 20 / jam / user |
| Presigned video URL | 30 / jam / user |

Ditambah Vercel Firewall di lapisan edge (aktifkan *Attack Challenge Mode* bila diserang) dan Turnstile pada form publik. Tidak memakai proxy Cloudflare di depan Vercel (Q38).

### 12.5 Header Keamanan
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{random}';
  img-src 'self' data: https://<r2-domain>; media-src https://<r2-domain>;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Ditambah: Dependabot, `npm audit` di CI, secret di secret manager (tidak pernah di repo), `.env` divalidasi Zod saat startup.

### 12.6 Checklist Verifikasi Keamanan untuk Kode Buatan AI

Pengembangan dilakukan sepenuhnya dengan bantuan AI (§13.4). Kode yang dihasilkan AI umumnya benar secara fungsional tetapi **sering melewatkan pemeriksaan yang tidak terlihat dari UI** — dan justru itu yang menjadi celah keamanan. Sepuluh item berikut **wajib diverifikasi manual**, bukan sekadar ditanyakan ulang ke AI.

| # | Yang diperiksa | Cara mengujinya |
|---|---|---|
| V-01 | `is_correct` bocor di response soal quiz | Buka DevTools → tab Network → mulai quiz → periksa payload JSON. Tidak boleh ada `is_correct` atau `explanation` sebelum submit |
| V-02 | Timer dihitung di klien | Ubah jam sistem komputer maju 1 jam → submit. Harus tetap ditolak sesuai waktu server |
| V-03 | Attempt kedua bisa dibuat lewat API | Setelah submit, panggil ulang endpoint `POST /quizzes/{id}/attempts` dengan curl. Harus 409 |
| V-04 | RBAC hanya dicek di UI | Login sebagai MEMBER, akses `/cms` dan endpoint `/api/v1/cms/*` langsung. Harus 403, bukan halaman kosong |
| V-05 | IDOR pada data milik user | Ambil ID progress/attempt user lain, panggil endpointnya. Harus 403/404, bukan datanya |
| V-06 | Gerbang materi hanya di UI | Akses URL materi ke-3 langsung padahal materi ke-2 belum dikerjakan. Harus ditolak server |
| V-07 | Bucket R2 tidak sengaja publik | Buka URL objek R2 tanpa tanda tangan di jendela penyamaran. Harus ditolak |
| V-08 | Node video/iframe lolos ke konten materi | Kirim payload berisi node `iframe` langsung ke API materi (bypass editor). Harus ditolak server |
| V-09 | Secret ikut ter-commit | `git log -p \| grep -iE "sk_\|secret\|password\|api[_-]key"` dan periksa `.env` ada di `.gitignore` |
| V-10 | Rate limit tidak terpasang | Kirim 20 request login gagal berturut-turut lewat curl. Harus diblokir setelah 5 |

**Kapan dijalankan:** V-01 sampai V-06 setiap akhir sprint yang menyentuh quiz atau akses materi. V-07 sampai V-10 sekali sebelum rilis, lalu setiap ada perubahan konfigurasi.

> Kesalahan yang paling sering muncul pada kode buatan AI di proyek seperti ini adalah **V-01 dan V-05**: mengembalikan seluruh objek dari database (`select *` atau mengembalikan hasil query mentah) alih-alih memilih field secara eksplisit. Tampilan di layar terlihat benar sempurna, tapi data sensitifnya ikut terkirim. Selalu minta AI membuat fungsi serialisasi eksplisit per entitas, dan periksa sendiri hasilnya di Network tab.
