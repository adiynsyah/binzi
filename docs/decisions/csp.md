# Proposal CSP BINZI — nonce vs ISR (kartu A-16)

> **Status: PROPOSAL, bukan keputusan.** Dokumen ini mengumpulkan bukti dan
> membandingkan opsi. Keputusan diambil pemilik produk, lalu dicatat di PRD
> (naikkan versi). Sampai itu terjadi, CSP skrip/gaya/koneksi tetap
> report-only.

## Kondisi saat ini (sudah ditegakkan sejak A-16)

Dua header dikirim untuk semua rute lewat `headers()` di `next.config.ts`:

1. **`Content-Security-Policy` (ditegakkan)** — hanya direktif yang tidak
   menyentuh skrip, jadi aman untuk ISR (§10.4):
   `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`
2. **`Content-Security-Policy-Report-Only`** — kebijakan target §12.5 **tanpa
   nonce**, plus origin yang sudah dipakai:
   `default-src 'self'; script-src 'self' https://challenges.cloudflare.com; img-src 'self' data:; font-src 'self'; media-src 'self'; form-action 'self'; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'`
   (`'unsafe-eval'` di `script-src` hanya ditambahkan saat
   `NODE_ENV=development` — React butuh eval untuk error overlay dev.)

Belum ada: entri R2 di `img-src`/`media-src` (menyusul A-17 — domain belum
ada, tidak mengarang placeholder domain) dan Sentry (SDK peramban belum
terpasang). `media-src 'self'` sementara adalah placeholder aman, bukan
keputusan.

## Bukti: pelanggaran report-only per halaman (build produksi)

Metode: `npm run build && npm run start` (lokal), Chromium headless via
Playwright, event `securitypolicyviolation` dikelompokkan per
disposition × direktif × sumber. Alur login lengkap (daftar → verifikasi
email → peran EDITOR → login dengan Turnstile) dijalankan lebih dulu;
`/belajar` dan `/cms` diaudit dalam keadaan login. Jendela tunggu utama 3 d;
kolom "setelah 9 d" dari run konfirmasi terpisah (Turnstile menyelesaikan
widget setelah ~3–9 d dan menambah pelanggarannya).

| Halaman | `style-src-attr` inline | `script-src-elem` inline | `script-src` eval | disposition `enforce` |
|---|---|---|---|---|
| `/` | 2 | 2 | 0 | **0** |
| `/masuk` | 3 (→ 4 setelah 9 d) | 2 | 1 (Turnstile, muncul belakangan) | **0** |
| `/daftar` | 3 (→ 5 setelah 9 d) | 2 | 1 (Turnstile, muncul belakangan) | **0** |
| `/belajar` (login) | 1 | 2 | 0 | **0** |
| `/cms` (login) | 3 | 2 | 0 | **0** |

Pola yang terbaca:

- **Inline script Next ada di semua halaman** (2 × `script-src-elem`): script
  bootstrap/streaming `self.__next_f.push(...)` — tidak bisa dihilangkan dari
  aplikasi, hanya bisa diizinkan lewat nonce, `'unsafe-inline'`, atau hash.
- **Inline style ada di semua halaman** (`style-src-attr`): atribut `style`
  yang disuntikkan React/komponen — §12.5 tidak menyetel `style-src`, jadi
  jatuh ke `default-src 'self'` dan ikut terlaporkan.
- **Turnstile menambah 1 pelanggaran `eval`** di halaman yang memuat widgetnya
  (`/masuk`, `/daftar`): skrip `challenges.cloudflare.com` mengevaluasi string
  — jika CSP skrip diperketat tanpa `'unsafe-eval'`, widget uji ini akan rusak
  (perlu direkonsiliasi dengan widget produksi saat keputusan diambil).
- **Nol pelanggaran enforce** di kelima halaman — direktif yang ditegakkan
  tidak merusak apa pun.

## Percobaan SRI (opsi c) — build lokal, tidak di-commit

`experimental.sri { algorithm: "sha256" }` dinyalakan sementara, build
produksi dijalankan, halaman `/` diperiksa:

- Atribut `integrity` menempel pada **6 dari 11** `script[src]` (sisanya
  antara lain skrip Turnstile dan modulepreload).
- **Pelanggaran tidak berkurang**: tetap 2 × inline script + 2 × inline
  style. SRI memvalidasi berkas eksternal, sedangkan masalah utama kita ada
  pada script inline buatan Next yang tidak divalidasi SRI.

Kesimpulan percobaan: SRI sendiri tidak menyelesaikan inline; nilainya
hanya integritas tambahan untuk berkas eksternal, dan fiturnya masih
eksperimental.

## Opsi yang tersedia

### (a) Nonce di semua halaman lewat proxy

Proxy menghasilkan nonce per request dan menyetel header CSP + `x-nonce`;
Next otomatis memasang nonce pada script framework dan inline.

- **ISR (§10.4): hilang.** Semua halaman wajib dirender dinamis — beranda,
  katalog, artikel tidak lagi bisa `revalidate: 3600` dan tidak tersimpan di
  CDN. PPR juga tidak kompatibel.
- **Biaya Vercel Hobby:** trafik publik yang tadinya "gratis" (file statis di
  CDN) menjadi eksekusi serverless per request — konsumsi kuota fungsi naik
  drastis dan TTFB publik memburuk.
- **XSS: terkuat.** `'nonce-…' 'strict-dynamic'` menolak semua skrip inline
  lain yang disuntikkan penyerang.
- **Usaha: besar.** `src/proxy.ts` hari ini adalah guard login (setiap request
  tanpa cookie sesi dialihkan ke `/masuk`, matcher hanya area login). Contoh
  resmi Next memperluas matcher ke hampir semua rute — diterapkan apa adanya,
  semua tamu terkunci dan `/masuk` mengalihkan ke dirinya sendiri. Opsi ini
  menuntut restrukturisasi proxy (kartu tersendiri) + verifikasi regredensi
  guard.

### (b) Tanpa nonce: `'unsafe-inline'` untuk skrip

Pindahkan report-only → enforced dengan `script-src 'self' 'unsafe-inline'
https://challenges.cloudflare.com` (dan `style-src 'self' 'unsafe-inline'`;
Turnstile butuh `'unsafe-eval'` — lihat bukti di atas).

- **ISR: tetap.** Halaman statis tetap statis; nol perubahan rendering.
- **Biaya Vercel Hobby: nol tambahan.**
- **XSS: lemah untuk inline.** Skrip inline hasil injeksi (mis. konten TipTap
  yang lolos sanitasi) tetap dieksekusi; proteksi tersisa hanya memblokir
  skrip eksternal tak diizinkan. Pertimbangan: lapisan pertahanan utama BINZI
  memang whitelist node TipTap di server (§12.3, CRS-05), bukan CSP.
- **Usaha: kecil** (satu string di `next.config.ts`).
- Catatan teknis: `'unsafe-inline'` diabaikan browser bila di kebijakan yang
  sama ada nonce/hash — opsi ini tidak bisa dicampur bertahap dengan (a)/(d).

### (c) SRI murni

Lihat hasil percobaan: tidak mengurangi pelanggaran inline, eksperimental.
Sebagai keputusan tunggal tidak memenuhi tujuan §12.5.

### (d) Hibrida: nonce di area login + (b)/(c) untuk publik

Nonce hanya untuk `/belajar`, `/profil`, `/cms` — halaman yang **sudah**
dinamis (ƒ di output build) dan sudah dilewati matcher proxy saat ini.

- **ISR: tetap** untuk `(public)`; area login memang selalu SSR/CSR.
- **Biaya Vercel Hobby: minim** — hanya trafik area login (pengguna login)
  yang sudah dinamis hari ini.
- **XSS: kuat di tempat paling berisiko** (CMS yang menyunting konten,
  area privat), `'unsafe-inline'` hanya di halaman publik.
- **Usaha: menengah.** Proxy masih perlu diubah untuk menghasilkan nonce
  (kebijakan CSP berbeda per area), jadi tetap kartu tersendiri — tetapi
  risikonya lebih kecil dari (a) karena matcher-nya tidak perlu meluas ke
  rute publik.

## Yang perlu diputuskan pemilik produk

1. Pilih (a), (b), atau (d) (+(c) sebagai pelengkap integritas berkas).
2. Apakah `'unsafe-eval'` Turnstile dapat diterima di produksi, atau widget
   Turnstile diganti/diuji ulang dengan mode non-eval (butuh verifikasi
   widget produksi, bukan kunci uji).
3. Kebijakan `style-src`: mengikuti §12.5 (tanpa `style-src`, fallback
   `default-src 'self'` → wajib nonce/`'unsafe-inline'` untuk style) atau
   menambahkan `style-src 'self' 'unsafe-inline'` eksplisit.

## Usulan mekanisme pelaporan (menyusul, bukan bagian keputusan ini)

Saat ini pelanggaran hanya terlihat di konsol (tanpa `report-uri`/
`report-to`). Usulan untuk kartu berikutnya: endpoint CSP di aplikasi
(`POST /api/csp-report`) yang menerima laporan Reporting-API (`Report-To` +
`report-to`), difilter, lalu diteruskan ke Sentry saat SDK perambannya
terpasang — tanpa membuka endpoint untuk abuse (rate limit + validasi bentuk
laporan). Alternatif termurah: `report-uri` langsung ke endpoint Sentry
`{project}/security/?sentry_key=…` bila proyek Sentry sudah ada.
