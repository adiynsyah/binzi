# A-16b · Penegakan CSP (opsi b+)

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-16](A-16-header-keamanan-dan-proposal-csp.md) (PR #58) |
| **Tag ClickUp** | `fase-0`, `agent`, `security` |
| **Judul ClickUp** | `[F0][Agent] A-16b Penegakan CSP (opsi b+)` |

> Kartu baru 17 Okt 2026, dari keputusan CSP pemilik produk: **opsi (b+)** — PRD v1.5 Q45, §12.5, dan `docs/decisions/csp.md` (status: diputuskan).

## Tujuan
Menegakkan CSP keputusan Q45 di semua rute, menggantikan dua header CSP dari A-16, tanpa merusak Turnstile, ISR halaman publik, `next dev`, atau toolbar Vercel di Preview.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/12-keamanan.md` (§12.5 — **v1.5**)
- `docs/prd/sections/02-decision-log.md` (baris Q45 saja)
- `docs/decisions/csp.md` — bagian bukti, "Percobaan Turnstile tanpa `'unsafe-eval'`", dan (b+)
- Kode: `next.config.ts`, `src/config/security-headers.test.ts`, `src/components/shared/auth/turnstile-widget.tsx`

## Kerjakan

### 1. Satu CSP yang ditegakkan
Di `next.config.ts`, ganti kedua header CSP A-16 (CSP ditegakkan 3 direktif + `Content-Security-Policy-Report-Only`) dengan **satu** `Content-Security-Policy` yang ditegakkan, persis §12.5 v1.5:

```
default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'self'; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
```

Header report-only dihapus: tanpa endpoint pelaporan, ia hanya menambah kebisingan di konsol. Empat header §12.5 lainnya tidak berubah.

### 2. Tambahan per lingkungan — hanya ini
- **Development** (`NODE_ENV === "development"`): `'unsafe-eval'` di `script-src`. Bila HMR `next dev` terblokir `connect-src`, tambahkan sumber yang dibutuhkan **hanya di development**, lalu catat di PR.
- **Preview Vercel** (`VERCEL_ENV === "preview"`, dibaca saat build): sumber toolbar Vercel persis dokumentasi Vercel (vercel.com/docs/vercel-toolbar/managing-toolbar, bagian "Using a Content Security Policy"):
  - `script-src https://vercel.live`
  - `connect-src https://vercel.live wss://ws-us3.pusher.com`
  - `img-src https://vercel.live https://vercel.com data: blob:`
  - `frame-src https://vercel.live`
  - `style-src https://vercel.live 'unsafe-inline'`
  - `font-src https://vercel.live https://assets.vercel.com`
- **Production**: tanpa tambahan apa pun — tidak ada `'unsafe-eval'` dan tidak ada `vercel.live`.

### 3. Tes Vitest
Perbarui `src/config/security-headers.test.ts`. Tiga kasus dengan nilai **persis** (`vi.stubEnv` + `vi.resetModules`, pola A-16):
- production → kebijakan §12.5 apa adanya;
- development → + `'unsafe-eval'`;
- preview (`NODE_ENV=production`, `VERCEL_ENV=preview`) → + sumber toolbar, tanpa `'unsafe-eval'`.

Tambahkan asersi: tidak ada header `Content-Security-Policy-Report-Only`, dan nilai production tidak mengandung `unsafe-eval` maupun `vercel.live`. Lampirkan minimal tiga uji mutasi di PR: `'unsafe-eval'` bocor ke production, `vercel.live` bocor ke production, `script-src-attr 'none'` dihapus.

### 4. Catat hasil di `csp.md`
Tambahkan bagian **"Penerapan (A-16b)"** berisi hasil audit di bawah. Status dan keputusan dokumen tidak diubah.

## Bukan lingkup tugas ini
- Nonce, serta perubahan `src/proxy.ts` atau matcher-nya.
- `report-uri`/`report-to`.
- Entri R2 (menyusul S1/S2) dan SDK Sentry.
- `'unsafe-eval'` di production. Bila widget Turnstile produksi ternyata membutuhkannya, itu keputusan pemilik setelah merge (Q45).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `next.config.ts`
- `src/config/security-headers.test.ts`
- `docs/decisions/csp.md` (hanya bagian baru "Penerapan (A-16b)")

## Selesai jika
- [ ] Tabel `curl -sI` dari build produksi lokal: satu `Content-Security-Policy` persis §12.5 plus empat header lain di `/`, `/masuk`, `/api/auth/get-session`, satu aset `/_next/static/…`, dan `/brand/logo-binzi-wordmark.png`; tidak ada `Content-Security-Policy-Report-Only`.
- [ ] `/` tetap ○ di output build; status rute lain tidak berubah.
- [ ] Audit Playwright build produksi (event `securitypolicyviolation`): jumlah disposition `enforce` = 0 di `/`, `/masuk`, `/daftar`, `/lupa-password`, `/belajar` (login), dan `/cms` (login), juga selama alur login penuh dengan Turnstile. Satu-satunya pengecualian yang diterima: `eval` dari skrip Turnstile (terbukti tidak merusak di A-16) — catat jumlahnya.
- [ ] Login email penuh dengan Turnstile berhasil di build produksi lokal.
- [ ] `npm run dev`: halaman termuat dan HMR jalan (ubah satu teks, terlihat tanpa reload manual); nol pelanggaran `enforce` selain yang sudah dicatat.
- [ ] Tes tiga lingkungan lulus; uji mutasi dilampirkan.

## Sebelum membuka PR
- Bila perlu login, buat `a16b.editor@example.com` (tautan verifikasi dari log, lalu `npm run user:role`). Di PR: email & peran saja, **sandi tidak pernah** (aturan di `CLAUDE.md`).
- Keputusan yang kamu ambil tanpa bertanya **wajib** masuk "Keputusan & asumsi" di PR.
- Setelah push: cek CI dan deploy Preview (`gh pr checks`), lalu laporkan hasilnya di ringkasan.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Verifikasi oleh kamu
- [ ] **Preview, sebelum merge:** toolbar Vercel tampil dan bisa dipakai; DevTools menunjukkan header CSP berisi `vercel.live`; konsol bersih dari pelanggaran `enforce` selain `eval` Turnstile.
- [ ] **Preview, sebelum merge:** login dengan Turnstile (kunci uji) berhasil.
- [ ] **Production, setelah merge:** login di `https://binzi.vercel.app/masuk` dengan Turnstile **kunci asli** berhasil — ini verifikasi widget produksi yang diminta Q45. Coba juga login Google. Bila widget atau login gagal: Vercel → Deployments → **Instant Rollback** ke deploy sebelumnya, lalu kembali ke Claude chat.
- [ ] **Production, setelah merge:** `curl -sI https://binzi.vercel.app/` → satu header CSP tanpa `vercel.live` dan tanpa `unsafe-eval`, dan satu header HSTS.
- [ ] Hapus akun uji dengan prosedur pembersihan di STATUS.

## Catatan keputusan
- **Satu header ditegakkan** menggantikan dua header A-16. Header report-only dihapus karena tanpa endpoint pelaporan ia tidak menghasilkan data yang terkumpul.
- **Toolbar Vercel hanya di Preview**, lewat `VERCEL_ENV=preview` saat build. Tambahannya hanya sumber milik Vercel; tidak ada pelonggaran untuk skrip inline maupun eval.
- **Tanpa `'unsafe-eval'` di production.** Di A-16, `eval` Turnstile terblokir tanpa merusak widget (kunci uji). Widget produksi diverifikasi setelah merge.
- **Konteks keputusan Q45:** opsi (d) — nonce di area login — ditinjau ulang saat pratinjau CMS dibangun (S1). Kartu itu wajib memverifikasi perilaku header ganda proxy + `next.config` (koreksi di `csp.md`).

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
