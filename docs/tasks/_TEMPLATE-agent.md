# <ID> · <Judul tugas>

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | <ID tugas> |
| **Tag ClickUp** | `<sprint>`, `agent`, `<area>` |
| **Judul ClickUp** | `[S1] <ID> <Judul>` |

## Tujuan
<1–2 kalimat: hasil apa yang ada setelah tugas ini, dan kenapa penting.>

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/<bagian>.md` (§x.y — sebut subbagian bila berkas panjang)
- `docs/design/screens/<ID>.md + <ID>.png` (layar utama + ID state dari SCREENS.md)

## Kerjakan
- <Poin konkret. Sebut ID requirement (mis. QZ-08) dan ID layar.>

## Bukan lingkup tugas ini
- <Hal yang menggoda untuk ikut dikerjakan tapi punya kartunya sendiri.>

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `<path>`

## Selesai jika
- [ ] <Kriteria yang bisa dibuktikan, mis. acceptance criteria §14 yang relevan.>
- [ ] Semua state layar di SCREENS.md ada.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e` (bila menyentuh alur kritis)

## Verifikasi oleh kamu (sebelum merge)
- [ ] <Langkah manual. Untuk tugas berisiko tinggi: item V-xx dari §12.6.>

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
