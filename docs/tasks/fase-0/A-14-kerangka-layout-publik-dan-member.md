# A-14 · Kerangka layout publik & member

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-06](A-06-komponen-overlay-dan-umpan-balik.md), [A-12](A-12-rbac-dan-proteksi-route.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `layout`, `ui` |
| **Judul ClickUp** | `[F0][Agent] A-14 Kerangka layout publik & member` |

## Tujuan
Header, drawer, footer, dan menu akun yang dipakai semua halaman publik & member.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/design/handoff/COMPONENTS.md` (Kerangka layout)
- `docs/design/handoff/TOKENS.md` (Breakpoint)
- `docs/design/screens/1a.png` (header & footer saja)
- `docs/design/screens/1d.md + 1d.png` (drawer)
- `docs/design/screens/13a, 13d (.md + .png)`
- `docs/design/screens/8e.png` (bottom nav)
- `docs/design/screens/16d.md`
- `docs/prd/sections/07-navigasi-information-architecture.md` (§7.1)

## Kerjakan
- **Header publik**: Logo · Beranda · Kursus · Artikel · Konsultasi · Tentang · Cari · Masuk · Daftar Gratis.
- **Header member**: "Belajar" menggantikan Beranda, ditambah avatar + menu akun (Dashboard, Kursus Saya, Nilai Saya, Profil, Keluar).
- Ambang: < 640px hamburger + drawer (tertutup otomatis setelah item diklik); 640–1023 menu teks + avatar tanpa nama; ≥ 1024 menu teks + nama.
- "Konsultasi" = tautan `/#tanya-ahli-gizi`. State aktif Beranda tidak berpindah ke Konsultasi (§7.1). Section-nya sendiri dibangun di S6 — cukup anchor kosong sementara.
- **Bottom nav** area belajar (< 768px): Materi · Quiz · Progress — shell saja.
- **Footer**: navigasi lengkap + legal (tautan boleh ke halaman sementara).
- Layout di `(public)` dan `(learn)`, dengan halaman sementara `/belajar` yang menyapa nama user.

## Bukan lingkup tugas ini
- Isi Beranda, katalog, dan halaman lain (S4–S6).
- Header mode fokus player/quiz (S2).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/components/shared/**`
- `src/app/(public)/layout.tsx`
- `src/app/(learn)/layout.tsx`
- `src/app/(learn)/belajar/page.tsx`

## Selesai jika
- [ ] Sesuai `.png` di 360 / 768 / 1280.
- [ ] Drawer dapat dibuka/tutup dengan keyboard, dengan fokus terkunci saat terbuka.
- [ ] Tidak ada scroll horizontal di 360px (§14.1).
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run lint:hex`

## Verifikasi oleh kamu (sebelum merge)
- [ ] Uji di HP nyata: drawer, menu akun, bottom nav.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
