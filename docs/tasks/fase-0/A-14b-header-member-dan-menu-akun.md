# A-14b · Header member, menu akun & layout area belajar

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-14a](A-14a-kerangka-layout-publik.md), [A-09](A-09-better-auth-inti-email-password-sesi-rate-limit.md), [A-12](A-12-rbac-dan-proteksi-route.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `layout`, `ui` |
| **Judul ClickUp** | `[F0][Agent] A-14b Header member & menu akun` |

## Tujuan
Setelah login, header berubah ke versi member — di halaman publik maupun area belajar — dengan menu akun dan Keluar. Layout `(learn)` siap dipakai, lengkap dengan bottom nav ponsel dan halaman `/belajar` sementara.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/design/handoff/COMPONENTS.md` (Header member, Drawer mobile, Bottom nav, Dropdown / Menu, Avatar)
- `docs/design/handoff/TOKENS.md` (Tipografi, Breakpoint, Garis/fokus/bayangan)
- `docs/design/screens/13a.md` + `13a.png` · `8a.png` (header saja) · `8t.png` (header saja — **abaikan** baris tab Dashboard/Kursus Saya/Nilai Saya)
- `docs/design/screens/13d.md` + `13d.png` + `13d.html` — **hanya panel kiri gambar** (`13d-1`: header ponsel + menu akun dalam keadaan terbuka). Panel kanan (halaman Kursus Saya) bukan lingkup kartu ini.
- `docs/design/screens/8e.png` + `8e.html` (header ponsel & bottom nav saja)
- `docs/design/screens/28a.md` (copy sapaan)
- `docs/prd/sections/07-navigasi-information-architecture.md` (§7.1)
- Kode yang sudah ada dari A-14a: header tamu, menu ponsel, file konstanta di `src/components/shared/` (tujuan tautan, fungsi state aktif, **tinggi header per breakpoint**). Juga: `src/lib/rbac.ts`, `src/app/(learn)/layout.tsx`, klien auth Better Auth (cari `createAuthClient`), `src/components/shared/auth/auth-errors.ts`

## Kerjakan

**Header member** (memakai kerangka header A-14a)
- **≥ 1024 (13a):** logo · Belajar · Kursus · Artikel · Konsultasi · Tentang Kami · [Cari] · tombol akun berupa pil: nama + avatar inisial + ▾. Nama dipotong dengan ellipsis bila panjang.
- **640–1023 (8t):** logo · Belajar · Kursus · Artikel · Konsultasi · Tentang · [Cari] · avatar saja.
- **< 640 (13d, 8e):** logo di kiri · avatar 36 di kanan. Tanpa ☰ dan tanpa tombol Cari di header — navigasi utama ada di drawer akun.
- **Tinggi header** per breakpoint sama dengan header tamu dan diambil dari konstanta tinggi header A-14a (sumber tunggal, dipakai S6 untuk `scroll-margin-top`). Jangan membuat konstanta kedua. Bila header member tidak muat di tinggi itu, **berhenti dan tanyakan**.
- "Belajar" → `/belajar`, aktif di `/belajar/**` dan `/profil` (perluas fungsi state aktif A-14a + tesnya).
- Tombol akun: `aria-label="Menu akun"`, `aria-expanded`, dan `aria-haspopup` sesuai yang dibukanya (`menu` untuk dropdown ≥ 640, `dialog` untuk drawer < 640).

**Item halaman aktif (dropdown & drawer)** — item menu akun yang cocok dengan halaman saat ini diberi latar `fill-soft`, teks lebih tebal, dan `aria-current="page"` (13d menandai "Kursus Saya" saat berada di `/belajar/kursus-saya`). Pakai fungsi state aktif yang sama, bukan perbandingan path tersendiri di komponen.

**Menu akun ≥ 640 (dropdown)** — pakai komponen Dropdown/Menu yang sudah ada. `13a.png` tidak menangkap keadaan terbuka; spesifikasinya (dari kanvas desain):
- Lebar 268, padding 8, radius 14, garis `border-strong`, bayangan menu TOKENS, rata kanan dengan tombol akun.
- Kepala: avatar 40 + nama (700, 14.5) + email (Plex Mono 11.5, `text-meta`, ellipsis), dipisah garis `border-soft`.
- Item (tinggi min 44, radius 8–10, 14.5 / 700, hover `fill-soft`): Dashboard (`/belajar`) · Kursus Saya (`/belajar/kursus-saya`) · Nilai Saya (`/belajar/nilai`) · Profil & pengaturan (`/profil`).
- Garis `border-soft`, lalu **Keluar** (teks `danger`, hover `danger-tint`).

**Drawer akun < 640 (13d)** — **panel lebar penuh yang turun tepat di bawah header**, pola yang sama dengan menu ponsel tamu A-14a (1d). **Bukan** panel yang bergeser dari samping.
- Dibangun di atas primitif dialog A-06 (Radix) dengan cara yang sama seperti menu ponsel A-14a — jangan menulis focus trap sendiri.
- **Baris atas sendiri:** logo di kiri, tombol **✕ di posisi avatar** (`aria-label="Tutup menu akun"`, area sentuh sama dengan ✕ menu ponsel A-14a). Alasannya sama dengan A-14a: pemicu tidak bisa diketuk saat dialog modal terbuka, dan ponsel tidak punya Esc. Ini penyimpangan sadar dari 13d, yang menggambar avatar di posisi itu.
- Perilaku modal: scrim, fokus terkunci, Esc / ketuk scrim / ✕ menutup, fokus kembali ke avatar, scroll body terkunci, tertutup setelah item diklik dan saat lebar menjadi ≥ 640.
- **Tinggi panel:** isinya lebih tinggi dari layar 360×640. Tinggi maksimum = tinggi layar dikurangi header; isi digulir di dalam panel. Keluar harus bisa dicapai dengan menggulir.
- Ukuran dari `13d.html` (ukuran huruf & bobot dipetakan ke tabel Tipografi TOKENS, bukan angka mentah): isi panel padding 16.
- Urutan isi:
  1. **Kartu nama:** avatar 48 · nama · email (Plex Mono, `text-meta`, ellipsis); padding 16, radius 14, garis `border`, latar `surface-2`.
  2. **Item akun** (jarak antarbaris 2, margin atas 14): Dashboard · Kursus Saya · Nilai Saya · Profil & pengaturan. Baris tinggi min 52, padding samping 14, radius 10, teks 16.
  3. Garis `border-soft`, lalu **navigasi utama** dengan gaya baris yang sama: Kursus · Artikel · Konsultasi (keterangan `di beranda ↓` seperti A-14a) · Tentang Kami · Cari (`/cari`). "Belajar" tidak diulang — sudah diwakili Dashboard.
  4. Garis `border-soft`, lalu **Keluar** (teks `danger`).

**Bottom nav area belajar (< 768, 8e)** — hanya di layout `(learn)`.
- Tiga item: **Materi** · **Quiz** · **Progress**. Tinggi 62; label 11 / 700; ikon garis Lucide 20px (kotak/lingkaran di 8e adalah placeholder ikon). Aktif: ikon & label `primary-deep`; diam: `text-muted`. Garis atas `border-soft`, latar `surface`.
- **Tujuan sementara** (satu konstanta tersendiri, diberi komentar "sementara — final di S2, isu D-07"):

  | Item | Tujuan sementara | Aktif di |
  |---|---|---|
  | Materi | `/belajar` | `/belajar` persis |
  | Quiz | `/belajar/kursus-saya` | `/belajar/kursus-saya` |
  | Progress | `/belajar/nilai` | `/belajar/nilai` |

  Rute `/belajar/**` lain dan `/profil`: tidak ada item aktif.
- Elemen `<nav aria-label="Navigasi belajar">`, tautan dengan `aria-current="page"`, target sentuh per item ≥ 44.
- `position: fixed` di bawah, `padding-bottom: env(safe-area-inset-bottom)`, dan `<main>` diberi ruang bawah setinggi bottom nav agar konten terakhir tidak tertutup.
- Mulai 768 bottom nav tidak tampil. Tab horizontal tablet (8t) **tidak** dibuat di kartu ini.

**Avatar** — komponen Avatar A-05, inisial saja: huruf pertama nama; bila nama kosong, huruf pertama email. Foto menyusul di AUTH-09.

**Keluar** — `signOut()` dari klien auth yang sudah ada → `router.replace("/")` + `router.refresh()`. Selama proses: item terkunci. Gagal: menu tetap terbuka + Banner error dengan pesan generik dari `auth-errors.ts` (tanpa copy baru).

**Sumber data user**
- **`(public)`:** sesi sisi klien (`useSession` dari klien auth yang sudah ada — jangan membuat klien kedua).
  - **Selama sesi dimuat dan bila tidak ada sesi: header tamu A-14a apa adanya.** Header member menggantikannya begitu sesi tersedia.
  - **Jangan merender placeholder atau skeleton di header.** HTML statis `/` selalu berisi header tamu (Masuk & Daftar Gratis), dan render awal di klien sama dengan HTML itu (tanpa hydration mismatch).
  - Pergantian sekilas dari header tamu ke header member untuk pengguna yang sudah login **diterima** (keputusan revisi 12 Okt).
  - `/` harus tetap statis (○).
- **`(learn)`:** data user dari guard server yang sudah ada, dikirim sebagai prop ke header — tanpa pergantian. Panggilan `requireUser`/`requireRole` **wajib tetap ada**; ganti tampilannya saja.
- Header hanya menerima nama, email, dan inisial — bukan objek sesi/user utuh (CLAUDE.md: DTO per audiens).

**Layout `(learn)`** — tautan lewati dari A-14a · header member · `<main id="konten-utama">` · bottom nav. Tanpa footer. Kerangka tinggi & latar mengikuti layout `(public)` A-14a (`min-h-dvh`, `<main>` `flex-1` berlatar `surface`).

**`/belajar` sementara** — satu judul halaman "Selamat datang, {nama depan}" (copy 28a). Tanpa isi lain.

## Bukan lingkup tugas ini
- Tab horizontal area belajar di tablet (8t) dan tujuan final bottom nav (isu desain D-07, diputuskan sebelum S2).
- Isi dashboard dan halaman tujuan menu akun & bottom nav (S5, AUTH-09).
- Badge jumlah di "Kursus Saya" (butuh data enrollment, S5).
- Foto avatar (AUTH-09) dan logout semua perangkat (AUTH-06, halaman profil).
- Tautan ke CMS untuk staf — PRD §7.1: staf masuk lewat `/cms`, bukan nav publik.
- `POST_LOGIN_DEFAULT_PATH` (di `shared/auth/`) — chore terpisah setelah kartu ini.
- Header mode fokus player/quiz (S2).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/components/shared/**` (kecuali `src/components/shared/auth/**`)
- `src/app/(public)/layout.tsx`
- `src/app/(learn)/layout.tsx` (tampilan saja)
- `src/app/(learn)/belajar/page.tsx`

## Selesai jika
- [ ] Header member, dropdown, drawer akun, dan bottom nav sesuai `.png` di 360 / 768 / 1280. Screenshot dilampirkan di PR.
- [ ] Drawer akun berupa panel lebar penuh di bawah header (13d), bukan panel samping; ✕ di posisi avatar menutup panel dan fokus kembali ke avatar.
- [ ] Di 360×640, semua isi drawer akun (sampai Keluar) bisa dicapai dengan menggulir panel.
- [ ] Item halaman aktif ditandai (`fill-soft` + `aria-current`) di dropdown dan drawer — dites lewat fungsi state aktif.
- [ ] Tanpa scroll horizontal di 360 dan 640, juga dengan nama 40 karakter.
- [ ] Tinggi header member = tinggi header tamu di setiap breakpoint (konstanta A-14a).
- [ ] Keyboard: dropdown (Enter/Space membuka, panah berpindah, Esc menutup, fokus kembali ke tombol akun); drawer akun (fokus terkunci, Esc, fokus kembali ke avatar).
- [ ] Bottom nav hanya muncul di `(learn)` di bawah 768; item aktif benar di ketiga rute (dites lewat fungsi state aktif); konten terakhir `/belajar` tidak tertutup bottom nav.
- [ ] `/` tetap ○ di output build (baris output ditempel di PR).
- [ ] HTML `/` dari build produksi (`curl -s`) memuat tautan Masuk dan Daftar Gratis, tanpa placeholder header (potongan output ditempel di PR).
- [ ] Tanpa sesi, `/belajar` → `/masuk?next=%2Fbelajar`.
- [ ] Keluar dari `/` dan dari `/belajar` → Beranda dengan header tamu; refresh `/belajar` setelahnya → `/masuk?next=%2Fbelajar`.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Sebelum membuka PR (pelajaran A-13 & A-14a)
- `npm run build && npm run start`, lalu buka `/` dan `/belajar` dalam keadaan belum login dan sudah login (akun lokal, `MAIL_TRANSPORT=log`). Ketuk ketiga item bottom nav — `/belajar/kursus-saya` dan `/belajar/nilai` 404 masih diharapkan.
- Screenshot (Playwright lewat `npx`, tanpa menambah dependensi) di 360 / 768 / 1280, termasuk drawer akun terbuka di 360 dan dropdown terbuka di 1280. Bandingkan dengan `.png` dan cocokkan ukuran huruf dengan tabel TOKENS. Perbaiki dulu, baru buka PR.
- **Bila kamu tidak bisa melihat screenshot sendiri** (mis. setelah compaction), **katakan sebelum membuka PR**. Audit angka atau computed style tidak menggantikan perbandingan visual — temuan A-14a (footer melayang, latar krem, item aktif menu ponsel) hanya terlihat dari screenshot.
- Setelah push: cek status deploy Preview (`gh pr checks`).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run lint:hex`

## Verifikasi oleh kamu (sebelum merge)
- [ ] HP nyata: login → header member di `/` dan `/belajar`; buka drawer akun, gulir sampai Keluar, tutup dengan ✕ dan dengan ketuk scrim; pakai item navigasi utama di dalamnya; bottom nav terjangkau jempol dan tidak tertutup bar sistem; Keluar.
- [ ] HP nyata, belum login: `/` langsung menampilkan header tamu tanpa kedip placeholder.
- [ ] Tablet / 768: avatar tanpa nama, semua item muat, bottom nav tidak tampil.
- [ ] Cabut sesi lewat `npm run user:role`, refresh `/belajar` → `/masuk?next=%2Fbelajar` (item terbuka di STATUS sejak A-12).
- [ ] Preview & Production: setelah login, header member muncul di `/` (sesi klien jalan di domain deploy).

## Catatan keputusan (tinjauan 11 Okt 2026)
- **Tentang tetap ada di header member.** PRD §7.1 hanya mengganti Beranda dengan Belajar; desain 8a/13a/8t menghilangkan Tentang. Aturan handoff: perilaku ikut PRD.
- **Header ponsel member mengikuti 13d** (logo + avatar). Navigasi utama dan Cari dipindah ke drawer akun, di bawah item akun.
- **Bottom nav dibangun dengan tujuan sementara** (tabel di atas). Tujuan final per kursus (materi berjalan, quiz materi, progress kursus) diputuskan sebelum S2 — isu D-07.
- Label "Profil & pengaturan" mengikuti copy 13a/13d.
- Halaman publik membaca sesi di klien, bukan server, supaya ISR halaman publik tidak hilang.

## Revisi 12 Okt 2026 (sebelum sesi, setelah A-14a di-merge)
- **Bentuk drawer akun dikoreksi.** Versi sebelumnya menulis "panel dari kiri" — salah tafsir dari "panel kiri" gambar 13d. Di 13d, menu akun adalah panel lebar penuh di bawah header, pola yang sama dengan menu ponsel tamu A-14a.
- **✕ di posisi avatar** (pola ✕-di-posisi-☰ dari A-14a) dan **penanda item aktif** (`fill-soft`, terlihat di 13d) ditambahkan. Panel boleh digulir karena isinya lebih tinggi dari layar 360×640.
- **Placeholder header dihapus.** Header tamu dan member berbeda susunan di < 640, jadi "placeholder tanpa lompatan" tidak mungkin. Selama sesi dimuat, header tamu tampil — mayoritas pengunjung halaman publik adalah tamu dan HTML statis tetap memuat Masuk/Daftar. Member yang sudah login menerima pergantian sekilas.
- **Tinggi header** member memakai konstanta A-14a (sumber tunggal untuk S6).
- **Pelajaran (g) dari A-14a** masuk ke "Sebelum membuka PR".

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
