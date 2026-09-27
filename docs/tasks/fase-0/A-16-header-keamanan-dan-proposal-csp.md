# A-16 · Header keamanan & proposal CSP

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-14](A-14-kerangka-layout-publik-dan-member.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `security` |
| **Judul ClickUp** | `[F0][Agent] A-16 Header keamanan & proposal CSP` |

## Tujuan
Memasang header keamanan §12.5 sejak awal, sehingga masalah kompatibilitas ketahuan dini.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/12-keamanan.md` (§12.5)
- `docs/prd/sections/10-arsitektur-system-design.md` (§10.4 caching/ISR)

## Kerjakan
- Pasang HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, dan `frame-ancestors 'none'` persis §12.5.
- **CSP dipasang dalam mode `Content-Security-Policy-Report-Only` dulu.** CSP berbasis nonce (§12.5) memaksa halaman dirender dinamis, sehingga bertentangan dengan ISR untuk halaman publik (§10.4). Jangan memilih sendiri: tulis `docs/decisions/csp.md` berisi 2–3 opsi (mis. nonce hanya untuk area login, hash/SRI untuk halaman statis) beserta dampaknya, untuk diputuskan pemilik produk.
- Pastikan Turnstile, Sentry, dan `next/font` tidak melanggar CSP report-only (cek konsol).

## Bukan lingkup tugas ini
- Mengaktifkan CSP penuh sebelum keputusan diambil.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `next.config.ts`
- `src/proxy.ts`
- `docs/decisions/csp.md`

## Selesai jika
- [ ] Header terpasang (terlihat di DevTools → Network).
- [ ] Konsol bersih dari pelanggaran CSP report-only di halaman auth & layout.
- [ ] `docs/decisions/csp.md` ada.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Verifikasi oleh kamu (sebelum merge)
- [ ] Baca `docs/decisions/csp.md` lalu putuskan. Keputusannya dicatat di PRD (naikkan versi).

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
