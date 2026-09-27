# Design Tokens — BINZI

Sumber: layar 17a–17c di file desain. Dinamai menurut **peran**, bukan rupa.

> ⚠️ **Penting:** file desain memakai ±150 kode hex berbeda karena digambar layar per layar — kebanyakan varian abu-hangat yang selisihnya tak terlihat mata. **Jangan menyalin hex dari file desain.** Petakan setiap warna ke token terdekat memakai tabel "Pemetaan warna desain" di bawah. Kode hanya boleh memakai token di file ini.

## Warna
| Token | Hex | Peran |
|---|---|---|
| `surface` | `#ffffff` | Kartu, dialog, isi halaman |
| `surface-2` | `#fbfaf8` | Kepala tabel, blok tenang |
| `surface-3` | `#f3f1ec` | Latar kanvas, area di balik modal |
| `text` | `#1a1614` | Judul, teks utama, tombol gelap |
| `text-muted` | `#5b554f` | Paragraf pendukung (7.1:1) |
| `text-body` | `#4d4741` | Badan teks panjang (artikel, materi) |
| `text-meta` | `#6b645c` | Metadata, placeholder, teks status (5.8:1) |
| `text-subtle` | `#8a8378` | **Hanya** label mono huruf besar kecil yang isinya diulang teks lain (3.8:1) |
| `border` | `#e7e2db` | Garis kartu & tabel |
| `border-strong` | `#dcd6ce` / `#e0d9d0` | Tombol sekunder, chip diam, input |
| `border-soft` | `#eeeae4` | Pemisah di dalam kartu, garis header |
| `primary` | `#f04030` | Aksi utama, progress berjalan |
| `primary-deep` | `#c42d1e` | Teks di atas primary-tint, tautan, hover tombol utama |
| `primary-tint` | `#ffeae6` | Latar badge & peringatan lembut |
| `success` | `#157f5f` | Lulus, nilai memenuhi ambang, video selesai |
| `success-tint` | `#e6f3ee` | Latar notifikasi berhasil (teks: `#0f5f47`) |
| `danger` | `#b3261e` | Hapus, gagal simpan, nilai di bawah ambang |
| `danger-tint` | `#fdf1ef` | Latar banner error (teks: `#7a2318`, garis `#e9b5ad`) |
| `warning` | `#e2b04a` | Tanda ragu-ragu di quiz |
| `warning-tint` | `#fff8ea` | Banner peringatan (teks `#6b5a2a`, garis `#f0dcae`) |
| `pending-tint` | `#fff4e0` | Badge "Menunggu persetujuan" (teks `#8a5a00`) |
| `cycle-tint` | `#ece7f5` | Badge "Siklus ke-n" (teks `#4a3a7a`) |
| `video-bg` | gradien `148deg #3a2c24 → #17120f` | Placeholder video/thumbnail |
| `ink-surface` | `#2a2320` | Latar section gelap (Tanya Ahli Gizi, footer, CTA penutup) |
| `ink-surface-text` | `#a89f95` | Teks pendukung di atas `ink-surface` (judul tetap `#ffffff`) |
| `text-nav` | `#3f3a35` | Item menu sidebar CMS & navigasi sekunder |
| `fill` | `#f2efe9` | Latar chip/angka kecil, hover baris, track progress |
| `fill-soft` | `#f7f5f2` | Latar kotak info tenang, kotak timer quiz |
| `border-dashed` | `#d8d1c8` | Garis putus-putus empty state & utilitas |

### Pemetaan warna desain → token
Warna di file desain yang tidak ada di tabel atas diperlakukan sebagai token terdekat:

| Jika menemukan | Pakai token |
|---|---|
| `#f4f1ec` `#f1ede7` `#f7f4ef` `#f2efea` `#f1ece5` `#f4f0ea` `#efe9e1` `#ebe5dd` `#f6f4f0` `#f5f3ef` | `fill` / `fill-soft` / `border-soft` (pilih sesuai fungsi: latar vs garis) |
| `#ddd6cd` `#cfc8bf` `#ece7e0` `#e8e3dd` `#c9c1b6` `#cdc6bf` `#eae5de` `#e3ddd4` `#e0d9d0` | `border` / `border-strong` / `border-dashed` |
| `#b5ada3` `#8a8279` `#7a736b` `#bdb5ac` `#b9b2a9` | `text-subtle` (atau `ink-surface-text` bila di latar gelap) |
| `#14100d` `#0f0c0b` `#100d0b` `#2c2420` `#332b26` `#2f2a26` `#241f1c` `#33281f` | `ink-surface` / `video-bg` |
| `#e8b04a` | `warning` |
| `#8c1d17` `#8f1e18` `#7a1b11` | teks di atas `danger-tint` (`#7a2318`) |
| `#f0c4be` `#f6cdc6` `#f3d5d1` `#fdf6f5` `#fdf3f1` `#fffaf9` | `danger-tint` / garis `#e9b5ad` |
| `#e8f4ef` `#eef7f3` `#eaf6f1` `#f4faf7` `#effaf5` `#c9e4d9` `#a9d8c5` `#147a58` `#0f5c44` | `success-tint` / `success` / teks `#0f5f47` |
| `#fffaf0` `#f0d9a8` `#5c3c00` `#3a2c10` `#8a6a1e` | `warning-tint` / `pending-tint` beserta teksnya |
| `#4ade80` | titik status "online" — ganti `success` |
| Warna ilustrasi di turn 6 (hijau daun, oranye, biru, dst.) | **Hanya** untuk ilustrasi hero 6a — ekspor sebagai aset SVG/komponen tersendiri, jangan jadi token |
| `rgba(...)` | Hanya untuk overlay (scrim dialog `rgba(18,14,12,.52)`), bayangan, dan pola garis placeholder |

Aturan kontras: teks di atas warna penuh selalu putih; teks di atas `*-tint` memakai pasangan gelapnya. Tidak ada teks beropasitas di atas warna. Minimum 4.5:1 (judul besar 3:1).

## Tipografi
Dua typeface: **Lato** untuk semua teks, **IBM Plex Mono** untuk label kecil, metadata, dan angka nilai.

Google Fonts: `Lato:ital,wght@0,300;0,400;0,700;0,900;1,400` + `IBM+Plex+Mono:wght@400;500`.

> ⚠️ Lato hanya punya bobot 300/400/700/900. File desain masih menulis 500/600/800 (sisa font sebelumnya) — browser membulatkannya. **Di kode, tulis bobot yang benar-benar dirender:** desain 800 → **900**, 600 → **700**, 500 → **400**.

| Peran | Bobot (kode) | Ukuran / line-height | Letter-spacing |
|---|---|---|---|
| Display (hero) | 900 | 46 / 1.06 | -0.03em |
| Judul halaman | 900 | 32–40 / 1.12–1.16 | -0.024 s/d -0.028em |
| Judul bagian | 900 | 22–24 / 1.24–1.3 | -0.02em |
| Judul kartu | 900 | 18–19 / 1.3 | -0.015em |
| Badan artikel/materi | 400 | 16–17 / 1.72–1.78, maks 68ch | 0 |
| Badan antarmuka | 400 | 14.5–15.5 / 1.6–1.65 | 0 |
| Label kendali / tombol | 700 | 13.5–15.5 | 0 |
| Label mono (huruf besar) | Plex Mono 500 | 10.5–11.5 | +0.12 s/d +0.16em |
| Angka nilai | Plex Mono 500 | 26–30 / 1 | 0 |

Ukuran teks dasar minimum 16px untuk badan (persona 45+). `text-wrap: pretty` untuk paragraf, `balance` untuk judul pendek.

## Spasi (kelipatan 4)
- Dalam komponen: 8 · 12 · 16
- Antar komponen: 18 · 20 · 26
- Antar bagian: 34 · 40 · 46
- Padding halaman: 40 desktop · 28 tablet · 16 mobile
- Lebar isi maks 1200; teks panjang maks 68 karakter

## Radius
| Elemen | Radius |
|---|---|
| Pil, avatar, chip | 999 |
| Kartu | 14 |
| Dialog, kartu besar | 16 |
| Tombol, input | 8–10 |
| Sheet mobile (atas) | 18 |

## Tinggi kendali
Tombol utama 50–54 · sekunder 46–48 · input 52 · chip 38–40 · **minimum sentuh 44 di semua lebar**.

## Garis, fokus, bayangan
- Garis 1px `border`; tombol sekunder 1.5px `border-strong`
- Fokus: cincin 2px `#1a1614` dengan jeda 3px, sama untuk semua kendali
- Disabled: warna padat (`#efe9e1` latar, `#8a8378` teks), **tanpa opasitas**
- Loading: label jadi kata kerja berjalan ("Menyimpan…"), tombol terkunci
- Bayangan menu/dropdown: `0 18px 40px rgba(26,22,20,.16)`
- Bayangan dialog: `0 22px 50px rgba(26,22,20,.14)`
- Kartu: **tanpa bayangan** — pakai garis

## Gerak
160–220ms, ease-out. Hover kartu: `translateY(-4px)` + bayangan lembut. Semua animasi mati/instan bila `prefers-reduced-motion`.

## Breakpoint
| | Mobile 360 | Tablet 768 | Desktop 1280 |
|---|---|---|---|
| Padding | 16 | 28 | 40 |
| Grid kartu | 1 kolom | 2 kolom | 3 kolom |
| Navigasi | hamburger + drawer | menu teks, avatar tanpa nama | menu teks + nama |
| Sidebar isi | kartu di atas isi | panel di bawah isi | kolom menempel |
| Dialog | sheet dari bawah | modal 560 | modal 560 |
| Area belajar | bottom nav (Materi · Quiz · Progress) | tab horizontal | menu akun |

Ambang CSS: `< 640` hamburger & sheet · `< 768` bottom nav · `≥ 1024` tata letak desktop. Aturan tablet lengkap: layar 16d.
