# A-05 · Komponen kendali + halaman /dev/ui

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-04](A-04-design-tokens-font-dan-gaya-dasar.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `design-system`, `ui` |
| **Judul ClickUp** | `[F0][Agent] A-05 Komponen kendali + halaman /dev/ui` |

## Tujuan
Membangun komponen kendali dasar sekali saja, lengkap dengan 5 state wajib, lalu dipakai ulang di semua layar.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/design/handoff/COMPONENTS.md` (tabel Dasar)
- `docs/design/handoff/TOKENS.md`
- `docs/design/screens/17b.md + 17b.png`
- `docs/design/screens/17d.md + 17d.png`
- `docs/design/screens/3a.png, 2b.png (contoh field & error)`

## Kerjakan
- Di `src/components/ui` (turunan shadcn): **Button** (primary, secondary, dark, ghost, danger), **Input/Field** (label, hint, error per field), **Password field** (+ syarat hidup, tampil sebagai pil di mobile), **Checkbox**, **Toggle** 48×28, **Chip filter** (aktif, diam, dengan ✕), **Badge status** (6 status, satu bentuk), **Tabs** garis bawah, **Avatar** (inisial & foto).
- Setiap kendali punya 5 state: default · hover · focus · disabled (warna padat, tanpa opasitas) · loading (label jadi kata kerja berjalan + terkunci).
- Target sentuh ≥ 44px di semua lebar.
- Halaman `/dev/ui` yang meniru 17b: semua komponen di semua state. Hanya dirender di development — `notFound()` di production.
- Tes unit ringan per komponen (render + aria).

## Bukan lingkup tugas ini
- Dialog, dropdown, banner, dll. (A-06).
- Ikon kustom — pakai Lucide.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/components/ui/**`
- `src/app/(dev)/dev/ui/**`

## Selesai jika
- [ ] Semua komponen di atas ada di `/dev/ui` dengan 5 state.
- [ ] Fokus keyboard terlihat di semua kendali.
- [ ] Tidak ada hex di luar tokens (lint:hex lulus).
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run lint:hex`

## Verifikasi oleh kamu (sebelum merge)
- [ ] Buka `/dev/ui` di 360 dan 1280, bandingkan dengan `17b.png`.
- [ ] Tab ke setiap kendali: cincin fokus harus terlihat.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
