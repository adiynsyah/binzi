# A-16 · Header keamanan & proposal CSP

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-14b](A-14b-header-member-dan-menu-akun.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `security` |
| **Judul ClickUp** | `[F0][Agent] A-16 Header keamanan & proposal CSP` |

> **Revisi 17 Okt 2026** (sebelum sesi). Versi lama mengizinkan perubahan `src/proxy.ts` dan memasang seluruh CSP dalam mode report-only, termasuk `frame-ancestors`. Keduanya diubah: proxy **tidak disentuh**, dan direktif yang aman untuk ISR langsung ditegakkan. Alasannya di "Catatan keputusan".

## Tujuan
Memasang header keamanan §12.5 di semua rute sejak awal, menegakkan bagian CSP yang tidak bertentangan dengan ISR, dan mengumpulkan bukti untuk keputusan CSP skrip (nonce vs ISR) — tanpa memilihnya sendiri.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/12-keamanan.md` (§12.5)
- `docs/prd/sections/10-arsitektur-system-design.md` (§10.4 caching/ISR)
- `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` — panduan Next 16: nonce lewat proxy, "Without Nonces", dan SRI (eksperimental)
- Kode: `next.config.ts`, `src/proxy.ts` (**baca saja** — lihat Catatan keputusan), `src/app/layout.tsx` (`next/font`), `src/components/shared/auth/turnstile-widget.tsx`

## Kerjakan

### 1. Header untuk semua rute — di `next.config.ts`
`headers()` dengan `source: "/(.*)"` (halaman, API, aset statis). Nilai persis §12.5:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

Header ini tidak boleh membuat halaman publik dinamis: `/` tetap ○ di output build.

### 2. CSP dalam dua header
- **Ditegakkan** (`Content-Security-Policy`): hanya `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`. Ketiganya tidak menyentuh skrip, jadi aman untuk ISR. `frame-ancestors` di header report-only tidak melindungi apa pun — report-only tidak pernah menegakkan.
- **Report-only** (`Content-Security-Policy-Report-Only`): kebijakan target §12.5 **tanpa nonce**, ditambah sumber yang sudah diketahui: Turnstile (`script-src` dan `frame-src` `https://challenges.cloudflare.com`), `'unsafe-eval'` di `script-src` **hanya** saat development. Tujuannya mencatat apa yang akan rusak bila skrip diperketat. Tulis kebijakan lengkapnya di PR.
- Tanpa `report-uri`/`report-to` — pelanggaran dibaca dari konsol. Mekanisme pelaporan (mis. endpoint CSP Sentry) cukup diusulkan di `csp.md`.
- Belum ada entri R2 (`img-src`/`media-src`, menyusul A-17) dan Sentry (SDK peramban belum terpasang — tidak ada paket `@sentry/*`).

### 3. Tes Vitest untuk nilai header
Satu berkas tes yang memanggil `headers()` dari `next.config.ts` dan memastikan nilai keempat header §12.5 dan CSP yang ditegakkan **persis**, serta bahwa header report-only ada. Impor relatif (Vitest belum punya alias `@/`).

### 4. `docs/decisions/csp.md` — proposal, bukan keputusan
Tulis 3–4 opsi beserta dampaknya pada ISR (§10.4), biaya Vercel Hobby, perlindungan XSS, dan usaha:
- **(a) Nonce di semua halaman lewat proxy** — catat bahwa proxy sekarang adalah guard login (setiap request tanpa cookie sesi dialihkan ke `/masuk`), jadi opsi ini butuh restrukturisasi proxy, dan semua halaman menjadi dinamis.
- **(b) Tanpa nonce**: `'unsafe-inline'` untuk skrip; halaman statis tetap statis.
- **(c) SRI** (`experimental.sri`): boleh dicoba di build lokal **tanpa di-commit**; laporkan pelanggaran yang tersisa.
- **(d) Hibrida**: nonce hanya di area login (`/belajar`, `/profil`, `/cms` — sudah dinamis dan sudah dilewati proxy) + (b) atau (c) untuk halaman publik.

Sertakan daftar pelanggaran report-only per halaman dari **build produksi** (`npm run build && npm run start`, bukan `next dev`): `/`, `/masuk` (Turnstile), `/daftar`, `/belajar`, `/cms`.

## Bukan lingkup tugas ini
- Mengubah `src/proxy.ts` atau matcher-nya.
- Menegakkan CSP untuk skrip, gaya, atau koneksi (menunggu keputusan dari `csp.md`).
- `report-uri`/`report-to`, entri R2, dan pemasangan SDK Sentry.
- Mendaftar ke hstspreload.org.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `next.config.ts`
- satu berkas tes Vitest untuk header (mis. `src/config/security-headers.test.ts`)
- `docs/decisions/csp.md`

## Selesai jika
- [ ] Keenam header (4 header §12.5 + CSP ditegakkan + CSP report-only) ada di `/`, `/masuk`, `/api/auth/get-session`, satu aset `/_next/static/…`, dan `/brand/logo-binzi-wordmark.png` — dibuktikan tabel `curl -sI` di PR. Untuk `/belajar` tanpa cookie (307 dari proxy), catat hasilnya apa adanya.
- [ ] `/` tetap ○ di output build; status rute lain tidak berubah.
- [ ] Konsol bersih dari pelanggaran CSP yang **ditegakkan**; pelanggaran report-only tercatat di `csp.md`.
- [ ] Login email dengan Turnstile di `/masuk` tetap berhasil (build produksi lokal).
- [ ] Tes Vitest header lulus, dan merah bila satu nilai diubah (uji mutasi, lampirkan di PR).
- [ ] `docs/decisions/csp.md` ada.

## Sebelum membuka PR
- `npm run build && npm run start`, lalu tabel `curl -sI` dan daftar pelanggaran konsol per halaman seperti di atas.
- Akun uji (bila perlu login): email & peran saja di PR, **sandi tidak pernah** (aturan di `CLAUDE.md`).
- Keputusan yang kamu ambil tanpa bertanya **wajib** masuk "Keputusan & asumsi" di PR.
- Setelah push: cek status CI dan deploy Preview (`gh pr checks`) dan laporkan hasilnya di ringkasan.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Verifikasi oleh kamu (sebelum merge)
- [ ] Preview: DevTools → Network → dokumen `/masuk` → keenam header ada. Konsol: catat apakah toolbar Vercel (`vercel.live`, hanya di Preview) memicu pelanggaran report-only.
- [ ] Preview: login dengan Turnstile di `/masuk` tetap berhasil.
- [ ] Baca `docs/decisions/csp.md`, lalu putuskan. Keputusannya dicatat di PRD (naikkan versi).
- [ ] Setelah merge: `curl -sI https://binzi.vercel.app/` → hanya satu header `Strict-Transport-Security` (Vercel juga memasang HSTS sendiri).

## Catatan keputusan (revisi 17 Okt 2026)
- **Proxy tidak disentuh.** `src/proxy.ts` adalah guard login optimistis: setiap request yang cocok dengan matcher dan tidak membawa cookie sesi dialihkan ke `/masuk`. Contoh resmi Next 16 untuk nonce memperluas matcher ke hampir semua rute; diterapkan apa adanya, semua tamu terkunci dan `/masuk` mengalihkan ke dirinya sendiri. Bila opsi (a) atau (d) dipilih nanti, restrukturisasi proxy menjadi kartu tersendiri.
- **CSP dua header.** `frame-ancestors`, `base-uri`, dan `object-src` ditegakkan sekarang karena report-only tidak melindungi dari clickjacking dan ketiganya tidak menyentuh skrip/ISR. Sisanya report-only sampai keputusan `csp.md`.
- **HSTS `preload`** di header tidak mendaftarkan apa pun. Jangan mendaftar ke hstspreload.org sebelum domain sendiri final (H-03) — pendaftaran preload sulit dibatalkan dan mengikat semua subdomain.
- **Sentry** belum punya SDK peramban, jadi tidak perlu entri CSP; ditambahkan saat SDK dipasang.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
