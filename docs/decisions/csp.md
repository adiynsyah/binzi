# Proposal CSP BINZI — nonce vs ISR (kartu A-16)

> **Status: DIPUTUSKAN 17 Okt 2026 — opsi (b+)** (PRD v1.5, Q45, §12.5).
> CSP tanpa nonce ditegakkan di semua rute lewat `next.config.ts`:
> `'unsafe-inline'` untuk skrip & gaya, `script-src-attr 'none'`, tanpa
> `'unsafe-eval'` di produksi. Penerapan: kartu A-16b. Opsi (d) ditinjau
> ulang saat pratinjau CMS dibangun (S1). Isi di bawah adalah proposal dan
> bukti yang menjadi dasar keputusan, dengan dua koreksi bertanda
> **[Koreksi 17 Okt]**.

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

Catatan tambahan dari tabel: **tidak ada satu pun pelanggaran
`script-src-attr`** di kelima halaman — atribut event inline tidak dipakai
aplikasi (dipakai untuk varian (b+) di bawah).

Pola yang terbaca:

- **Inline script Next ada di semua halaman** (2 × `script-src-elem`): script
  bootstrap/streaming `self.__next_f.push(...)` — tidak bisa dihilangkan dari
  aplikasi, hanya bisa diizinkan lewat nonce, `'unsafe-inline'`, atau hash.
- **Inline style ada di semua halaman** (`style-src-attr`): atribut `style`
  yang disuntikkan React/komponen — §12.5 tidak menyetel `style-src`, jadi
  jatuh ke `default-src 'self'` dan ikut terlaporkan.
- **Turnstile**: pelanggaran `eval` di halaman widget berasal dari skrip
  `challenges.cloudflare.com` — lihat "Percobaan Turnstile tanpa
  `'unsafe-eval'`": terblokir saat ditegakkan **tanpa merusak alur**.
- **Nol pelanggaran enforce** di kelima halaman — direktif yang ditegakkan
  tidak merusak apa pun.

## Percobaan Turnstile tanpa `'unsafe-eval'` (review PR #58)

Dokumentasi resmi Cloudflare
(`developers.cloudflare.com/turnstile/reference/content-security-policy`)
hanya meminta `script-src` dan `frame-src`
`https://challenges.cloudflare.com`, dan menyatakan Turnstile mendukung
nonce + `strict-dynamic`. Untuk menguji klaim itu pada aplikasi ini, header
report-only **sementara** dipromosikan menjadi CSP yang ditegakkan (build
lokal, **tidak di-commit**): tanpa `'unsafe-eval'`, dengan `'unsafe-inline'`
di `script-src` dan `style-src` supaya inline Next tidak mematikan halaman.

Hasil (Chromium headless, event `securitypolicyviolation` disposition
enforce + konsol):

- **Widget Turnstile tetap berfungsi dan login email penuh berhasil**:
  alur `lupa-password` → reset password (200) → login di `/masuk` dengan
  Turnstile (`sign-in/email` 200) → mendarat di `/masuk/lanjut`. Nol
  pelanggaran enforce selama alur tersebut.
- Dengan jendela tunggu lebih panjang (9 d), `/masuk` dan `/daftar`
  masing-masing mencatat **1 × `enforce | script-src | eval`** — evaluasi
  string oleh skrip Turnstile memang terblokir, tetapi **tidak merusak**
  widget maupun alur login (jalur yang butuh eval tampaknya opsional/fallback
  pada widget uji).
- Kesimpulan: pelanggaran `eval` yang tercatat report-only **belum membuktikan
  widget rusak**; untuk widget uji, `'unsafe-eval'` tidak diperlukan.

**Batasan:** diuji dengan **kunci uji** (widget produksi mungkin memakai
jalur berbeda). Widget produksi diverifikasi ulang setelah keputusan CSP
diambil — itulah butir keputusan no. 2 di bawah.

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
- **Turnstile:** `TurnstileWidget` memuat `api.js` lewat tag `<script>` buatan
  sendiri (`document.createElement`) — dengan nonce, tag itu wajib menerima
  dan memasang nonce (baca dari `headers()` di server) agar tidak diblokir;
  Cloudflare mendokumentasikan dukungan nonce + `strict-dynamic`.

### (b) Tanpa nonce: `'unsafe-inline'` untuk skrip

Pindahkan report-only → enforced dengan `script-src 'self' 'unsafe-inline'
https://challenges.cloudflare.com` (dan `style-src 'self' 'unsafe-inline'`).
`'unsafe-eval'` tidak diperlukan untuk widget uji (lihat percobaan di atas).

- **ISR: tetap.** Halaman statis tetap statis; nol perubahan rendering.
- **Biaya Vercel Hobby: nol tambahan.**
- **XSS: lemah untuk inline.** Skrip inline hasil injeksi (mis. konten TipTap
  yang lolos sanitasi) tetap dieksekusi; proteksi tersisa hanya memblokir
  skrip eksternal tak diizinkan. Pertimbangan: lapisan pertahanan utama BINZI
  memang whitelist node TipTap di server (§12.3, CRS-05), bukan CSP.
- **Usaha: kecil** (satu string di `next.config.ts`).
- Catatan teknis: `'unsafe-inline'` diabaikan browser bila **dalam satu
  kebijakan** yang sama ada nonce/hash. Opsi ini tetap bisa dipakai pada
  rute publik sementara area login memakai kebijakan nonce (opsi (d)),
  karena (d) memakai kebijakan berbeda per rute dan beberapa header CSP
  dievaluasi browser sebagai irisan (yang paling ketat menang).
  **[Koreksi 17 Okt]** Itu perilaku browser, belum perilaku Next: percobaan
  Turnstile di atas mengamati Next hanya mengirim satu header untuk kunci
  yang sama, dan belum diuji apa yang terjadi bila proxy dan `next.config.ts`
  sama-sama memasang `Content-Security-Policy`. Kartu yang menerapkan (d)
  wajib memverifikasinya, atau mengecualikan area login dari pola `source`
  di `next.config.ts` sehingga setiap rute hanya punya satu kebijakan skrip.

### (b+) Varian (b): tambah `script-src-attr 'none'`

Data audit menunjukkan **nol pelanggaran `script-src-attr`** di kelima
halaman, jadi `script-src-attr 'none'` bisa ditegakkan bersama (b) tanpa
merusak apa pun. Ini memblokir atribut event inline (`onerror=…`,
`onclick=…` — vektor umum bypass sanitasi karena menyisip kode lewat
atribut, bukan elemen `<script>`), walau tidak memblokir elemen
`<script>` yang tersisip di HTML SSR. Usaha: satu direktif tambahan di
string (b).

### (c) SRI murni

Lihat hasil percobaan: tidak mengurangi pelanggaran inline, eksperimental.
Sebagai keputusan tunggal tidak memenuhi tujuan §12.5.

### (d) Hibrida: nonce di area login + (b)/(c) untuk publik

Nonce hanya untuk `/belajar`, `/profil`, `/cms` — halaman yang **sudah**
dinamis (ƒ di output build) dan sudah dilewati matcher proxy saat ini.

- **ISR: tetap** untuk `(public)`; area login memang selalu SSR/CSR.
- **Biaya Vercel Hobby: minim** — hanya trafik area login (pengguna login)
  yang sudah dinamis hari ini.
- **XSS: kuat di tempat konten itu dirender sebelum terbit.** Yang dilindungi
  nonce adalah konten yang dirender **di dalam area login** — terutama
  pratinjau admin di `/cms` sebelum konten terbit (alur 18d): skrip sisipan
  pada konten yang belum tervalidasi tidak akan jalan di sesi staf. Namun
  setelah terbit, konten yang sama dirender di halaman publik yang memakai
  `'unsafe-inline'` — skrip sisipan di sana berjalan di origin yang sama dan
  bisa memanggil API (termasuk `/api/cms/*`) atas nama **pengunjung yang
  sedang login**, termasuk staf (cookie `httpOnly` mencegah token
  **dicuri**, bukan **dipakai** — request dari skrip di origin yang sama
  tetap membawa cookie). Jadi untuk konten terbit, (b) dan (d) sama-sama
  bergantung pada §12.3 (whitelist node TipTap di server) sebagai pertahanan
  utama.
- **Usaha: menengah.** Proxy masih perlu diubah untuk menghasilkan nonce
  (kebijakan CSP berbeda per area), jadi tetap kartu tersendiri — tetapi
  risikonya lebih kecil dari (a) karena matcher-nya tidak perlu meluas ke
  rute publik.
- **Turnstile: [Koreksi 17 Okt] tidak perlu nonce di opsi ini.**
  `TurnstileWidget` hanya dipakai di form auth (`/masuk`, `/daftar`,
  `/lupa-password`, kirim ulang verifikasi) — semuanya halaman publik di luar
  area yang dikenai nonce, jadi widget berada di bawah kebijakan (b)/(b+).
  Nonce untuk Turnstile hanya relevan di opsi (a).

## Yang perlu diputuskan pemilik produk

1. Pilih (a), (b)/(b+), atau (d) (+(c) sebagai pelengkap integritas berkas).
2. **Turnstile & `'unsafe-eval'`:** percobaan kunci uji menunjukkan widget
   dan login tetap berfungsi tanpa `'unsafe-eval'` (eval terblokir tanpa
   merusak). Keputusan yang tersisa: cukup verifikasi ulang dengan widget
   **produksi** setelah kebijakan dipasang — kalau widget produksi butuh
   eval, `'unsafe-eval'` ditambahkan kembali sebagai pengecualian yang
   diperdebatkan, bukan default.
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

## Penerapan (A-16b)

Ditegakkan 17 Okt 2026 (kartu A-16b, PR sesuai kartu): **satu** header
`Content-Security-Policy` persis §12.5 v1.5 di semua rute lewat
`next.config.ts`; header `Content-Security-Policy-Report-Only` dari A-16
**dihapus** (tanpa endpoint pelaporan, ia hanya menambah kebisingan konsol).
Empat header §12.5 lainnya tidak berubah. Tambahan per lingkungan, sumber
toolbar Vercel **selalu setelah** sumber dasar §12.5:

- **Development** (`NODE_ENV=development`): `'unsafe-eval'` di `script-src`.
  HMR `next dev` berfungsi tanpa tambahan `connect-src` — `'self'` (CSP3)
  sudah mencakup websocket host sama.
- **Preview Vercel** (`VERCEL_ENV=preview`, dibaca saat build): sumber
  toolbar persis dokumentasi Vercel (vercel.live, ws-us3.pusher.com,
  vercel.com, assets.vercel.com, `blob:` di `img-src`).
- **Production** (`VERCEL_ENV=production` maupun build lokal/CI tanpa
  `VERCEL_ENV`): tanpa tambahan apa pun.

### Hasil audit (build produksi lokal, `next start` :3100)

`curl -sI` — jumlah header per URL (semua bernilai persis §12.5 untuk CSP;
`Report-Only` = 0 di semua URL):

| URL | CSP | HSTS | XCTO | Ref-Pol | Perm-Pol | Report-Only |
|---|---|---|---|---|---|---|
| `/` | 1 | 1 | 1 | 1 | 1 | 0 |
| `/masuk` | 1 | 1 | 1 | 1 | 1 | 0 |
| `/api/auth/get-session` | 1 | 1 | 1 | 1 | 1 | 0 |
| `/_next/static/chunks/3s6nzrbk-8mnv.js` | 1 | 1 | 1 | 1 | 1 | 0 |
| `/brand/logo-binzi-wordmark.png` | 1 | 1 | 1 | 1 | 1 | 0 |

Output build: `/` tetap ○ (statis); status rute lain tidak berubah.

Audit Playwright (Chromium headless, event `securitypolicyviolation`,
jendela 3 d / 9 d untuk halaman widget):

| Halaman | enforce non-eval | enforce eval | keterangan |
|---|---|---|---|
| `/` | 0 | 0 | |
| `/masuk` | 0 | 1 | probe zod (lihat bawah) |
| `/daftar` | 0 | 1 | probe zod |
| `/lupa-password` | 0 | 1 | probe zod |
| `/reset-password` (tanpa token) | 0 | 0 | state link kedaluwarsa |
| `/daftar/verifikasi` (kirim ulang, `?error=`) | 0 | 1 | probe zod |
| `/belajar` (login) | 0 | 0 | |
| `/cms` (login EDITOR) | 0 | 1 | probe zod, hanya pada dokumen pertama |
| alur login penuh + Turnstile | 0 | 1 | probe zod |

**Koreksi atribusi A-16:** satu-satunya pelanggaran `enforce` yang tersisa
bukan dari skrip Turnstile, melainkan **probe `allowsEval` zod v4** —
`new Function("")` di dalam try/catch untuk mendeteksi dukungan eval, jalan
sekali per realm saat chunk form pertama termuat (`sourceFile` = chunk
`/_next/static` lokal, `blockedURL` kosong). Zod sendiri mendokumentasikan
perilaku ini di komentarnya: CSP ketat melaporkan panggilan yang tertangkap
itu meski lemparannya ditelan; zod lalu memakai mode non-JIT. **Tidak ada
kerusakan fungsional**: pendaftaran 200, verifikasi email sukses, login
email + Turnstile 200, dashboard CMS termuat. Pelanggaran eval yang di A-16
diatribusikan ke Turnstile ("muncul setelah 9 d") memiliki tanda tangan
yang sama dan kini terbukti berasal dari probe zod ini. Opsi pembersihan
menyusul bila diinginkan: `globalConfig.jitless` zod (di luar lingkup A-16b).

**Turnstile di headless:** widget kunci uji menghasilkan token (tombol
submit aktif, alur lengkap lulus) tanpa merender iframe yang terlihat di
Chromium headless; nol pelanggaran eval yang bersumber
`challenges.cloudflare.com`. Widget produksi (kunci asli) tetap diverifikasi
pasca-merge sesuai butir keputusan no. 2 di atas.

**Development:** `next dev` memuat halaman + HMR terbukti (ubah satu teks di
Beranda, tampil tanpa reload manual); nol pelanggaran (`'unsafe-eval`
membuat probe zod lolos tanpa peristiwa).

### Uji mutasi (tes tiga+satu lingkungan, `src/config/security-headers.test.ts`)

| Mutasi | Hasil yang diharapkan & tercapai |
|---|---|
| `isDev = true` (`'unsafe-eval'` bocor ke production) | kedua kasus production merah; preview merah; dev tetap hijau (3 gagal) |
| `isVercelPreview = true` (`vercel.live` bocor ke production) | kedua kasus production merah; dev merah (3 gagal) |
| `script-src-attr 'none'` dihapus | keempat kasus merah |
| pengecekan preview → `Boolean(VERCEL_ENV)` (truthy) | hanya kasus Vercel Production (VERCEL_ENV=production) yang merah |

Akun uji audit: `a16b.editor@example.com` (EDITOR) — dihapus dengan prosedur
pembersihan di STATUS setelah verifikasi produksi.
