# A-15 · Kerangka layout CMS

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-14](A-14-kerangka-layout-publik-dan-member.md), [A-12](A-12-rbac-dan-proteksi-route.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `layout`, `cms`, `ui` |
| **Judul ClickUp** | `[F0][Agent] A-15 Kerangka layout CMS` |

## Tujuan
Sidebar CMS terpisah dari nav publik, dengan menu sesuai peran (menu tanpa hak akses tidak ditampilkan).

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/design/handoff/SCREENS.md` (bagian CMS)
- `docs/design/screens/19a, 19b, 19e (.md + .png)`
- `docs/design/screens/18d.md`
- `docs/prd/sections/07-navigasi-information-architecture.md` (§7.2 sitemap CMS)
- `docs/prd/sections/06-7-cms.md`

## Kerjakan
- Layout `(cms)`: sidebar 248px; tablet = rel ikon; ponsel = drawer.
- Menu per peran mengikuti §7.2 v1.3: Ringkasan, Konten (`/cms/konten`), Artikel, Kursus, Kategori, Media, Pengguna (ADMIN+), Reset attempt (ADMIN+), Pengaturan (SUPER_ADMIN), Audit log.
- Menu **"Terjadwal" tidak ditampilkan** (CMS-15 = fase 2).
- Halaman `/cms` sementara: versi ahli gizi (19a) vs admin (19b) — kerangka saja, tanpa data.
- Rute menu lain → halaman sementara "Segera hadir" yang tetap dilindungi RBAC.

## Bukan lingkup tugas ini
- Fungsi CMS apa pun (S1).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/app/(cms)/**`
- `src/components/cms/**`

## Selesai jika
- [ ] EDITOR tidak melihat menu Pengguna/Pengaturan, dan tidak bisa membukanya lewat URL.
- [ ] Sesuai `.png` di 1280 / 768 / 360.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run lint:hex`

## Verifikasi oleh kamu (sebelum merge)
- [ ] Login dengan tiga role berbeda (pakai `user:role`), lalu bandingkan menunya.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
