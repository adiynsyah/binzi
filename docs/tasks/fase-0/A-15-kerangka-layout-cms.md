# A-15 · Kerangka layout CMS

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-14b](A-14b-header-member-dan-menu-akun.md), [A-12](A-12-rbac-dan-proteksi-route.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `layout`, `cms`, `ui` |
| **Judul ClickUp** | `[F0][Agent] A-15 Kerangka layout CMS` |

> **Revisi 16 Okt 2026** (sebelum sesi, bersama PRD v1.4). Versi lama kartu ini menyebut menu yang tidak punya rute dan melarang menyentuh `rbac.ts`. Keputusan barunya: PRD v1.4 Q42 (rute menu), Q43 (Audit log), Q44 (pendaratan staf — **bukan** lingkup kartu ini), dan D-10/D-11 di `docs/design/OPEN-ISSUES.md`.

## Tujuan
Kerangka area CMS untuk staf: sidebar terpisah dari nav publik yang isinya mengikuti peran (menu tanpa hak akses tidak ditampilkan), dalam tiga bentuk — sidebar (≥ 1024), rel ikon (640–1023), dan drawer (< 640) — plus topbar, blok user dengan jalan Keluar, dan halaman sementara yang tetap dilindungi RBAC. S1 tinggal mengisi halamannya.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/07-navigasi-information-architecture.md` (§7.2 bagian CMS — **v1.4**)
- `docs/prd/sections/03-persona-role.md` (§3.2, termasuk label peran)
- `docs/prd/sections/02-decision-log.md` (baris Q42 dan Q43 saja)
- `docs/design/handoff/SCREENS.md` (bagian CMS) · `docs/design/handoff/TOKENS.md` (Tipografi, Breakpoint, Garis/fokus/bayangan)
- `docs/design/screens/19a.md` + `19a.png` + `19a.html` — sidebar ahli gizi, topbar, blok user
- `docs/design/screens/19b.png` — sidebar admin (**abaikan** Materi, Terjadwal, Audit log, dan semua hitungan)
- `docs/design/screens/27a.png` — **sidebar saja**: sidebar Super admin dengan item "Sistem"
- `docs/design/screens/19e.md` + `19e.png` + `19e.html` — rel ikon 768 dan bar ponsel 360
- Kode yang sudah ada: `src/app/(cms)/**`, `src/lib/rbac.ts` (+ tesnya), `src/components/shared/mobile-menu.tsx` (pola drawer + ✕ di posisi ☰), `src/components/shared/account-menu.tsx` (pola dropdown & **satu pemicu per menu**), `src/components/shared/use-sign-out.ts`, `src/components/shared/member-user.ts`, `src/components/shared/skip-link.tsx`, `src/components/ui/{avatar,dropdown-menu,dialog}.tsx`, `src/modules/user/service.ts` (`getUserProfile`), `src/app/(learn)/layout.tsx` (pola guard + data user untuk header)

## Kerjakan

### 1. Menu per peran — satu konfigurasi, dites
Satu berkas konfigurasi di `src/components/cms/` (mis. `cms-nav.ts`) adalah sumber tunggal item, grup, ikon, dan peran. Urutan dan label **persis** tabel ini:

| Grup (label mono) | Item | Tujuan | Ahli gizi (EDITOR) | Admin | Super admin |
|---|---|---|---|---|---|
| — | Ringkasan | `/cms` | ✓ | ✓ | ✓ |
| KONTEN | Artikel | `/cms/artikel` | ✓ | ✓ | ✓ |
| KONTEN | Kursus | `/cms/kursus` | ✓ | ✓ | ✓ |
| KONTEN | Quiz | `/cms/quiz` | ✓ | ✓ | ✓ |
| KONTEN | Media | `/cms/media` | ✓ | ✓ | ✓ |
| PENGIRIMAN | Menunggu persetujuan | `/cms/konten?status=menunggu` | ✓ | — | — |
| PENGIRIMAN | Perlu revisi | `/cms/konten?status=perlu-revisi` | ✓ | — | — |
| PENERBITAN | Persetujuan | `/cms/konten?status=menunggu` | — | ✓ | ✓ |
| PENGATURAN | Kategori | `/cms/kategori` | — | ✓ | ✓ |
| PENGATURAN | Pengguna & peran | `/cms/pengguna` | — | ✓ | ✓ |
| PENGATURAN | Reset attempt | `/cms/reset-attempt` | — | ✓ | ✓ |
| PENGATURAN | Audit log | `/cms/audit-log` | — | — | ✓ |
| PENGATURAN | Sistem | `/cms/pengaturan` | — | — | ✓ |

- **Tidak ditampilkan:** Materi (tidak ada layar daftar materi — materi dibuka dari builder kursus, Q42), Terjadwal (CMS-15, fase 2), dan Audit log untuk Admin (Q43). Grup yang tidak punya item untuk sebuah peran tidak dirender.
- **Aturan tampil:** item tampil hanya bila `pathAllows(user, path)` dari `src/lib/rbac.ts` lolos **dan** peran user ada di kolom ✓. Menu tidak boleh pernah menampilkan item yang ditolak matriks. Grup PENGIRIMAN hanya untuk EDITOR persis (bukan EDITOR+), karena admin menerbitkan langsung.
- **Ikon** garis Lucide 18px yang paling mirip desain, mis. LayoutGrid · FileText · SquarePlay · SquareCheck · Image · Clock · Pencil · CircleCheck · Diamond · User · RotateCw · ScrollText · SlidersHorizontal.
- **Tanpa hitungan** di kanan item (butuh data — S1).
- **Tes Vitest** (impor relatif, tanpa alias `@/`): untuk setiap peran (EDITOR, ADMIN, SUPER_ADMIN) daftar item yang tampil persis tabel di atas; setiap item yang tampil lolos `pathAllows` untuk peran itu; dan `minRoleForPath` untuk setiap tujuan **bukan** SUPER_ADMIN kecuali Audit log dan Sistem — penjaga agar tidak ada item yang diam-diam jatuh ke catch-all fail-closed.

### 2. Matriks RBAC — satu baris baru
Di `src/lib/rbac.ts`, tambahkan `{ path: "/cms/quiz", match: "prefix", minRole: "EDITOR" }` di blok EDITOR+ (sebelum catch-all), plus tesnya di `src/lib/rbac.test.ts`. **Hanya baris ini.** Baris lain (mis. `/cms/artikel` dan `/cms/konten` menjadi prefix untuk `/{id}`) diubah di sprint yang membangun halamannya.

### 3. State aktif — satu fungsi murni, dites
`getActiveCmsItem(pathname, status, role)` → item atau null, dites Vitest:
- `/cms` persis → Ringkasan. `/cms/artikel/**` → Artikel; sama untuk Kursus, Quiz, Media, Kategori, Pengguna & peran, Reset attempt, Audit log, Sistem (`/cms/pengaturan`).
- `/cms/konten` dengan `status=perlu-revisi` → Perlu revisi (EDITOR). Dengan `status=menunggu`, **tanpa `status`, atau nilai tak dikenal** → Menunggu persetujuan (EDITOR) atau Persetujuan (ADMIN+).
- Item aktif: latar `text`, teks `surface`, `aria-current="page"` — sama di sidebar, rel, dan drawer.
- Nilai `status` adalah kontrak URL; pemetaannya ke model data dikerjakan di S1.

### 4. Layout `(cms)` dan data user
- `src/app/(cms)/layout.tsx`: `requireRole("EDITOR")` **tetap ada**, lalu `getUserProfile` (pola layout `(learn)`) untuk nama. Kirim ke komponen kerangka **hanya** `{ name, role }` — bukan objek sesi/user utuh.
- Susunan: tautan lewati (`SkipLink` yang ada) · sidebar/rel (≥ 640) atau bar ponsel (< 640) · kolom kanan berisi topbar (≥ 640) dan `<main id="konten-utama">`. Tanpa header & footer publik.
- Latar halaman `surface`. Sidebar dan rel `sticky top-0 h-dvh`, isinya digulir sendiri bila lebih tinggi dari layar, blok user tetap di bawah.
- **Label peran** (fungsi kecil + tes): EDITOR → "Ahli gizi", ADMIN → "Admin", SUPER_ADMIN → "Super admin" (PRD §3.2 v1.4).

### 5. Sidebar ≥ 1024 (19a, 19b, 27a)
- Lebar 248 **ditambah** garis kanan 1px `border-soft` (total 249, seperti 19a), latar `surface-2`.
- **Baris merek:** padding 18 / 16 / 14, garis bawah `border-soft`; wordmark (`/brand/logo-binzi-wordmark.png`, alt "BINZI") tinggi 22, tautan ke `/cms`; label "CMS" Plex Mono 500 10.5, huruf besar, letter-spacing 0.14em, `text-subtle`, padding 3 / 7, garis `border`, radius kecil seperti 19a.
- **Nav:** padding 10 / 10 / 0. Label grup: Plex Mono 500 10.5, letter-spacing 0.16em, `text-meta`, padding 16 / 12 / 6.
- **Item:** tinggi **44** (desain 42 — dinaikkan ke minimum sentuh), padding samping 12, item dalam grup menjorok (padding kiri 28), radius `rounded-control`, ikon + label Lato 700 13.5. Diam `text-nav`; hover latar `fill`; aktif lihat langkah 3.
- **Blok user (bawah):** padding 14 / 14 / 16, garis atas `border-soft`; avatar 36 gaya gelap (`bg-text text-surface` lewat `className`, seperti A-14b), nama Lato 700 13.5 dengan ellipsis, label peran Lato 700 10.5 — "Ahli gizi" berwarna `cycle-tint-text`, "Admin"/"Super admin" `text-muted`. Seluruh blok adalah **pemicu menu akun CMS** (langkah 8).

### 6. Rel ikon 640–1023 (19e kiri)
- Lebar 72 **ditambah** garis kanan 1px `border-soft` (total 73, seperti 19e), latar `surface-2`; isi rata tengah.
- Atas: logo mark (`/brand/logo-binzi-mark.png`, alt "BINZI CMS", tinggi ±28), tautan ke `/cms`.
- Item: tombol ikon 44×44, radius `rounded-control`, `aria-label` = label item; aktif seperti langkah 3, diam `text-muted`. Grup dipisah jarak/garis tipis, tanpa label grup.
- Label tampil sebagai **tooltip saat hover/fokus**. Buat `src/components/ui/tooltip.tsx` gaya shadcn di atas Tooltip dari paket `radix-ui` yang sudah terpasang — **tanpa dependensi baru**.
- Bawah: avatar 36 gaya gelap sebagai **pemicu menu akun CMS** (`aria-label="Menu akun"`).

### 7. Ponsel < 640 (19e kanan)
- **Bar atas** (tinggi 68, padding samping 16, garis bawah `border-soft`, latar `surface`): tombol ☰ 44×44 (desain 38 — dinaikkan) dengan garis `border`, `aria-label="Buka menu CMS"`, `aria-expanded`, `aria-controls` · wordmark tinggi 20 + label "CMS" · avatar 34 gaya gelap di kanan, **dekoratif** (`aria-hidden`, bukan tombol).
- **Drawer:** pola menu ponsel A-14a, di atas primitif dialog A-06 — panel lebar penuh, baris atas sendiri dengan ✕ **di posisi ☰** (`aria-label="Tutup menu CMS"`) + wordmark + label CMS. Isi: grup & item yang sama dengan sidebar (baris tinggi min 48), lalu garis `border-soft`, kartu user (avatar · nama · label peran), lalu baris **Lihat situs** (`/`) dan **Keluar** (teks `danger`). Perilaku modal sama dengan A-14a: scrim, fokus terkunci, Esc / ketuk scrim / ✕ menutup, fokus kembali ke ☰, scroll body terkunci, tertutup setelah item diklik dan saat lebar menjadi ≥ 640. Isi digulir di dalam panel; Keluar harus bisa dicapai di 360×640.
- Tanpa topbar di ponsel — judul halaman langsung di isi (19e).

### 8. Menu akun CMS ≥ 640
- Dropdown A-06 berisi **Lihat situs** (`/`) dan **Keluar** (teks `danger`, hover `danger-tint`). Keluar memakai `useSignOut` yang sudah ada (→ `/` + refresh, item terkunci selama proses, gagal → Banner error generik). Desain CMS tidak menggambar Keluar; ini tambahan sadar — catat di PR.
- **Satu `DropdownMenu` = satu pemicu** (pelajaran PR #53). Sidebar ≥ 1024 dan rel 640–1023 masing-masing punya instance menu sendiri dengan satu pemicunya; jangan memasang dua pemicu di satu menu.
- Pemicu: `aria-haspopup="menu"`, `aria-expanded`; Enter/Space membuka, panah berpindah, Esc menutup, fokus kembali ke pemicu.

### 9. Topbar ≥ 640 (19a)
- Tinggi 58 (640–1023) / 62 (≥ 1024), padding samping 22 / 28 (19e / 19a), garis bawah `border-soft`.
- Isi: **breadcrumb** label mono (Plex Mono 500 11.5, huruf besar, letter-spacing 0.1em, `text-subtle`), dibentuk dari item aktif: "RINGKASAN", "KONTEN / ARTIKEL", "PENGIRIMAN / PERLU REVISI", "PENERBITAN / PERSETUJUAN", "PENGATURAN / SISTEM", dst. Teks biasa, bukan tautan.
- Kotak "Cari konten…" dan tombol aksi (mis. "Artikel baru", "Buka antrean") **tidak** dibuat di kartu ini.

### 10. Area isi
- CMS lebih padat dari sisi publik dan punya skala padding sendiri dari desain: samping **16 / 22 / 28** (< 640 / 640–1023 / ≥ 1024), atas 16 / 22 / 26. Isi maks 1200, **rata kiri** di samping sidebar. Ini kolom CMS, **bukan** `PageContainer` (padding publik 16/28/40 dan rata tengah tidak berlaku di sini).
- Angka target tepi kiri → kanan isi: **360** → 16…344 · **768** → 95…746 (rel 72 + garis 1 + 22) · **1024** → 277…996 · **1280** → 277…1252 (sidebar 248 + garis 1 + 28) · **1440** → 277…1412.

### 11. Halaman
- **`/cms`** sementara: satu judul per peran — EDITOR: "Halo, {nama depan}" (19a; `firstNameOf` yang ada, tanpa koma & nama bila kosong); ADMIN dan SUPER_ADMIN: "Ringkasan" (19b). **Tanpa** subjudul dan kartu angka — data karangan dilarang (CLAUDE.md).
- **Halaman sementara** untuk setiap tujuan menu lain: `/cms/artikel`, `/cms/kursus`, `/cms/quiz`, `/cms/media`, `/cms/konten`, `/cms/kategori`, `/cms/pengguna`, `/cms/reset-attempt`, `/cms/pengaturan`, `/cms/audit-log`. Isi: judul = label item aktif (untuk `/cms/konten` sesuai status & peran) + paragraf "Segera hadir." Setiap `page.tsx` memanggil `requireRole(<peran baris matriksnya>)` sendiri (guard berlapis), lalu merender komponen dari `src/components/cms/` — `page.tsx` tetap tipis karena Vitest belum bisa merender berkas yang mengimpor `@/`.
- Gaya judul CMS mengikuti 19a (Lato 900 28 / 1.16, letter-spacing -0.022em) — CMS lebih padat dari sisi publik.

## Bukan lingkup tugas ini
- Fungsi CMS apa pun, hitungan di sidebar, kotak Cari konten, tombol aksi topbar, dan isi dashboard (S1, S5).
- **Pendaratan staf ke `/cms` setelah login** (Q44) — chore tersendiri setelah kartu ini.
- Perilaku "di ponsel CMS hanya baca + setujui/minta revisi" (19e) dan "editor tidak dibuka di ponsel" (20e) — milik halaman masing-masing (S1).
- Baris RBAC selain `/cms/quiz`; model data status "Perlu revisi".
- Varian gelap di komponen Avatar (`src/components/ui/avatar.tsx`) — tetap lewat `className` seperti A-14b; dirapikan di chore tersendiri.
- Tautan ke CMS dari header publik (PRD §7.1: tidak ada).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/app/(cms)/**`
- `src/components/cms/**`
- `src/components/ui/tooltip.tsx` (+ tesnya) — baru
- `src/lib/rbac.ts` dan `src/lib/rbac.test.ts` — **hanya** baris `/cms/quiz` dan tesnya

## Selesai jika
- [ ] Menu tiap peran persis tabel langkah 1 — dibuktikan tes Vitest per peran, termasuk penjaga "tidak ada item yang jatuh ke catch-all".
- [ ] Lewat URL: EDITOR membuka `/cms/kategori`, `/cms/pengguna`, `/cms/reset-attempt`, `/cms/pengaturan`, `/cms/audit-log` → 403; ADMIN membuka `/cms/pengaturan` dan `/cms/audit-log` → 403; MEMBER membuka `/cms` → 403; tamu → `/masuk?next=%2Fcms`.
- [ ] Sidebar ≥ 1024, rel 640–1023, drawer < 640 — sesuai `.png` 19a/19b/27a (1280) dan 19e (768, 360).
- [ ] Tepi isi cocok dengan angka target langkah 10 (±1px); sidebar 248 + garis 1, rel 72 + garis 1, item sidebar & rel tinggi 44.
- [ ] Tanpa scroll horizontal di 360 dan 640, juga dengan nama 40 karakter tanpa spasi (blok user, kartu user drawer).
- [ ] Keyboard: urutan Tab masuk akal dari tautan lewati ke sidebar ke isi; menu akun dan drawer seperti langkah 7–8; tooltip rel muncul saat fokus.
- [ ] Keluar dari menu akun (≥ 640) dan dari drawer (< 640) → `/` dengan header tamu; `/cms` sesudahnya → `/masuk?next=%2Fcms`.
- [ ] Target sentuh ≥ 44, cincin fokus sesuai TOKENS (juga di latar gelap item aktif).
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Sebelum membuka PR (pelajaran A-13 s/d PR #55)
- Buat tiga akun lokal `a15.editor@example.com`, `a15.admin@example.com`, `a15.super@example.com` (daftar + tautan verifikasi dari log, `MAIL_TRANSPORT=log`), lalu set perannya dengan `npm run user:role` (perintah ini mencabut sesi — login ulang). Ditambah satu akun nama 40 karakter tanpa spasi. Daftarkan semua akun di PR — DB ini juga dipakai Production.
- `npm run build && npm run start`, lalu buka/curl **setiap** rute menu untuk ketiga peran dan untuk MEMBER (cek 403 dan redirect di atas), termasuk `/cms/konten` dengan `status=menunggu`, `status=perlu-revisi`, tanpa `status`, dan `status=asal`.
- Ukur dengan Playwright lewat `npx` (tanpa menambah dependensi) di 360 / 768 / 1024 / 1280 / 1440: lebar sidebar/rel, tinggi item, tepi kiri & kanan `<main>`. Tempel tabel hasil ukur di PR.
- Screenshot ke `~/binzi-a15-screenshots/`: tiap peran di 1280 (`/cms`), 768 (rel + satu tooltip terbuka), 360 (bar + drawer terbuka, termasuk digulir sampai Keluar), menu akun terbuka di 1280 dan 768, satu halaman "Segera hadir", dan nama 40 karakter di 1280 & 360. **Periksa setiap state interaktif di semua lebar tempat ia muncul.** Bandingkan dengan `.png`, cocokkan ukuran huruf dengan TOKENS; nilai yang tidak punya baris di TOKENS (10.5, 13.5, 28) daftarkan di PR. Sebutkan screenshot mana yang benar-benar kamu buka — perbandingan visual juga dilakukan di Claude chat.
- Keputusan yang kamu ambil tanpa bertanya (mis. aturan state aktif, nilai `status`) **wajib** masuk "Keputusan & asumsi" di PR.
- Branch yang sudah punya PR tidak di-rebase lokal; perbarui dengan `git merge origin/main`.
- Setelah push: cek status deploy Preview (`gh pr checks`).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run lint:hex`

## Verifikasi oleh kamu (sebelum merge)
- [ ] Login dengan tiga peran (pakai `npm run user:role`), bandingkan menunya dengan tabel langkah 1. Coba buka rute yang tidak ada di menu lewat URL → 403.
- [ ] HP nyata: buka drawer, gulir sampai Keluar, tutup dengan ✕ dan ketuk scrim, pakai satu item menu, lalu Keluar.
- [ ] Tablet / 768: rel ikon dengan tooltip, menu akun dari avatar bawah.
- [ ] Unggah folder screenshot ke Claude chat untuk perbandingan visual.

## Catatan keputusan (revisi 16 Okt 2026)
- **Rute menu (Q42, D-10):** satu daftar per jenis; `/cms/konten` = antrean status; Materi disembunyikan. Rute baru `/cms/quiz` masuk matriks di kartu ini; sub-path `/{id}` di sprint masing-masing.
- **Audit log (Q43, D-11):** hanya Super admin. Sidebar admin 19b yang menampilkannya tidak berlaku.
- **Grup PENGIRIMAN** hanya untuk ahli gizi; admin mendapat PENERBITAN (19a vs 19b).
- **Keluar & Lihat situs** lewat menu dari blok user — tambahan karena desain CMS tidak menggambar Keluar. Avatar di bar ponsel dekoratif; jalan Keluar di ponsel ada di drawer.
- **Ambang** mengikuti proyek: < 640 drawer, 640–1023 rel, ≥ 1024 sidebar. Target sentuh 44 menggantikan 42/38 di desain.
- **Isi CMS** rata kiri dengan padding 16 / 22 / 28 dari desain (19a, 19e) — CMS lebih padat dan bukan halaman publik, jadi `PageContainer` tidak dipakai.
- **Sementara:** tanpa hitungan, tanpa Cari & tombol aksi, `/cms` hanya judul. Halaman "Segera hadir" tetap dilindungi RBAC (berbeda dari area publik/member, yang membiarkan tautan 404 sampai sprint-nya).

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
