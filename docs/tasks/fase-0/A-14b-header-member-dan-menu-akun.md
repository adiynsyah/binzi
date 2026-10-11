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
- `docs/design/handoff/COMPONENTS.md` (Header member, Bottom nav, Dropdown / Menu, Avatar)
- `docs/design/handoff/TOKENS.md` (Breakpoint, Garis/fokus/bayangan)
- `docs/design/screens/13a.md` + `13a.png` · `8a.png` (header saja) · `8t.png` (header saja — **abaikan** baris tab Dashboard/Kursus Saya/Nilai Saya)
- `docs/design/screens/13d.md` + `13d.png` (header & drawer akun — panel kiri saja)
- `docs/design/screens/8e.png` + `8e.html` (header ponsel & bottom nav saja)
- `docs/design/screens/28a.md` (copy sapaan)
- `docs/prd/sections/07-navigasi-information-architecture.md` (§7.1)
- Kode yang sudah ada: header, konstanta tautan & fungsi state aktif dari A-14a, `src/lib/rbac.ts`, `src/app/(learn)/layout.tsx`, klien auth Better Auth (cari `createAuthClient`), `src/components/shared/auth/auth-errors.ts`

## Kerjakan

**Header member** (memakai kerangka header A-14a)
- **≥ 1024 (13a):** logo · Belajar · Kursus · Artikel · Konsultasi · Tentang Kami · [Cari] · tombol akun berupa pil: nama + avatar inisial + ▾. Nama dipotong dengan ellipsis bila panjang.
- **640–1023 (8t):** logo · Belajar · Kursus · Artikel · Konsultasi · Tentang · [Cari] · avatar saja.
- **< 640 (13d, 8e):** logo di kiri · avatar di kanan. Tanpa ☰ dan tanpa tombol Cari di header — navigasi utama ada di drawer akun.
- "Belajar" → `/belajar`, aktif di `/belajar/**` dan `/profil` (perluas fungsi state aktif A-14a + tesnya).
- Tombol akun: `aria-label="Menu akun"`, `aria-haspopup`, `aria-expanded`.

**Menu akun ≥ 640 (dropdown)** — pakai komponen Dropdown/Menu yang sudah ada. `13a.png` tidak menangkap keadaan terbuka; spesifikasinya (dari kanvas desain):
- Lebar 268, padding 8, radius 14, garis `border-strong`, bayangan menu TOKENS, rata kanan dengan tombol akun.
- Kepala: avatar 40 + nama (700, 14.5) + email (Plex Mono 11.5, `text-meta`, ellipsis), dipisah garis `border-soft`.
- Item (tinggi min 44, radius 8–10, 14.5 / 700, hover `fill-soft`): Dashboard (`/belajar`) · Kursus Saya (`/belajar/kursus-saya`) · Nilai Saya (`/belajar/nilai`) · Profil & pengaturan (`/profil`).
- Garis `border-soft`, lalu **Keluar** (teks `danger`, hover `danger-tint`).

**Drawer akun < 640 (13d)** — panel dari kiri, dibuka dari avatar. Perilaku modal: scrim, fokus terkunci, Esc dan ketuk scrim menutup, fokus kembali ke avatar, scroll body terkunci, tertutup setelah item diklik dan saat lebar menjadi ≥ 640. Pakai primitif dialog A-06 yang sama dengan menu ponsel A-14a. Urutan isi:
1. Kartu nama + email (13d).
2. Dashboard · Kursus Saya · Nilai Saya · Profil & pengaturan (tampilan baris 13d).
3. Garis `border-soft`, lalu navigasi utama dengan gaya baris yang sama: Kursus · Artikel · Konsultasi (keterangan `di beranda ↓` seperti A-14a) · Tentang Kami · Cari. "Belajar" tidak diulang — sudah diwakili Dashboard.
4. Garis, lalu **Keluar** (teks `danger`).

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

**Avatar** — inisial saja: huruf pertama nama; bila nama kosong, huruf pertama email. Foto menyusul di AUTH-09.

**Keluar** — `signOut()` dari klien auth yang sudah ada → `router.replace("/")` + `router.refresh()`. Selama proses: item terkunci. Gagal: menu tetap terbuka + Banner error dengan pesan generik dari `auth-errors.ts` (tanpa copy baru).

**Sumber data user**
- **`(public)`:** sesi sisi klien (`useSession` dari klien auth yang sudah ada — jangan membuat klien kedua). Selama sesi dimuat: placeholder selebar area kanan header, tanpa lompatan tata letak. Tanpa sesi → header tamu A-14a. `/` harus tetap statis (○).
- **`(learn)`:** data user dari guard server yang sudah ada, dikirim sebagai prop ke header — tanpa placeholder. Panggilan `requireUser`/`requireRole` **wajib tetap ada**; ganti tampilannya saja.
- Header hanya menerima nama, email, dan inisial — bukan objek sesi/user utuh (CLAUDE.md: DTO per audiens).

**Layout `(learn)`** — tautan lewati dari A-14a · header member · `<main id="konten-utama">` · bottom nav. Tanpa footer.

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
- [ ] Tanpa scroll horizontal di 360 dan 640, juga dengan nama 40 karakter.
- [ ] Keyboard: dropdown (Enter/Space membuka, panah berpindah, Esc menutup, fokus kembali ke tombol akun); drawer akun (fokus terkunci, Esc, fokus kembali ke avatar).
- [ ] Bottom nav hanya muncul di `(learn)` di bawah 768; item aktif benar di ketiga rute (dites lewat fungsi state aktif); konten terakhir `/belajar` tidak tertutup bottom nav.
- [ ] `/` tetap ○ di output build (baris output ditempel di PR).
- [ ] Tanpa sesi, `/belajar` → `/masuk?next=%2Fbelajar`.
- [ ] Keluar dari `/` dan dari `/belajar` → Beranda dengan header tamu; refresh `/belajar` setelahnya → `/masuk?next=%2Fbelajar`.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Sebelum membuka PR (pelajaran A-13)
- `npm run build && npm run start`, lalu buka `/` dan `/belajar` dalam keadaan belum login dan sudah login (akun lokal, `MAIL_TRANSPORT=log`). Ketuk ketiga item bottom nav — `/belajar/kursus-saya` dan `/belajar/nilai` 404 masih diharapkan.
- Screenshot (Playwright lewat `npx`, tanpa menambah dependensi) di 360 / 768 / 1280, bandingkan dengan `.png`.
- Setelah push: cek status deploy Preview (`gh pr checks`).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run lint:hex`

## Verifikasi oleh kamu (sebelum merge)
- [ ] HP nyata: login → header member di `/` dan `/belajar`; buka drawer akun, pakai item navigasi utama di dalamnya; bottom nav terjangkau jempol dan tidak tertutup bar sistem; Keluar.
- [ ] Tablet / 768: avatar tanpa nama, semua item muat, bottom nav tidak tampil.
- [ ] Cabut sesi lewat `npm run user:role`, refresh `/belajar` → `/masuk?next=%2Fbelajar` (item terbuka di STATUS sejak A-12).
- [ ] Preview & Production: setelah login, header member muncul di `/` (sesi klien jalan di domain deploy).

## Catatan keputusan (tinjauan 11 Okt 2026)
- **Tentang tetap ada di header member.** PRD §7.1 hanya mengganti Beranda dengan Belajar; desain 8a/13a/8t menghilangkan Tentang. Aturan handoff: perilaku ikut PRD.
- **Header ponsel member mengikuti 13d** (logo + avatar). Navigasi utama dan Cari dipindah ke drawer akun, di bawah item akun.
- **Bottom nav dibangun dengan tujuan sementara** (tabel di atas). Tujuan final per kursus (materi berjalan, quiz materi, progress kursus) diputuskan sebelum S2 — isu D-07.
- Label "Profil & pengaturan" mengikuti copy 13a/13d.
- Halaman publik membaca sesi di klien, bukan server, supaya ISR halaman publik tidak hilang.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
