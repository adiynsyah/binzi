# A-06 · Komponen overlay & umpan balik

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-05](A-05-komponen-kendali-halaman-dev-ui.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `design-system`, `ui` |
| **Judul ClickUp** | `[F0][Agent] A-06 Komponen overlay & umpan balik` |

## Tujuan
Melengkapi komponen dasar yang dipakai hampir semua layar untuk state memuat, kosong, dan error.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/design/handoff/COMPONENTS.md` (tabel Dasar)
- `docs/design/screens/17b.png`
- `docs/design/screens/28d.md + 28d.png` (skeleton & gagal memuat)
- `docs/design/screens/28e.png` (filter kosong)
- `docs/design/screens/28c.png` (banner)
- `docs/design/screens/13c.png` (empty state)

## Kerjakan
- **Dialog**: modal 560 di ≥ 640px, **sheet bawah** (radius atas 18) di < 640px, scrim `rgba(18,14,12,.52)`, fokus terkunci & kembali ke pemicu.
- **Dropdown/Menu** dengan bayangan menu.
- **Banner** info/error/sukses: `role="alert"` untuk error, `role="status"` untuk sukses; sukses hilang sendiri setelah 4 detik. Tidak ada komponen toast terpisah.
- **Skeleton** (kartu & baris) yang muncul setelah 300 ms.
- **Empty state** (kosong · filter kosong · gagal memuat): selalu 1 aksi utama + 1 alternatif.
- **Progress bar** 7–8px (hijau = progress kursus, primary = sedang berjalan).
- **Pagination** (9 per halaman).
- Tambahkan semuanya ke `/dev/ui`.

## Bukan lingkup tugas ini
- Komponen domain (kartu kursus, player, quiz) — dibangun di sprint masing-masing.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/components/ui/**`
- `src/app/(dev)/dev/ui/**`

## Selesai jika
- [ ] Semua komponen ada di `/dev/ui`.
- [ ] Dialog berubah menjadi sheet di < 640px.
- [ ] Animasi mati saat `prefers-reduced-motion`.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run lint:hex`

## Verifikasi oleh kamu (sebelum merge)
- [ ] Buka dialog dengan keyboard, lalu tekan Esc: fokus harus kembali ke tombol pemicu.
- [ ] Aktifkan *reduce motion* di OS, lalu periksa skeleton & dialog.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
