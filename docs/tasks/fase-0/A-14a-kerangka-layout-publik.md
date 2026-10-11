# A-14a · Kerangka layout publik (header tamu, menu ponsel, footer)

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-05](A-05-komponen-kendali-halaman-dev-ui.md), [A-06](A-06-komponen-overlay-dan-umpan-balik.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `layout`, `ui` |
| **Judul ClickUp** | `[F0][Agent] A-14a Kerangka layout publik` |

## Tujuan
Header tamu (sticky), menu ponsel, dan footer untuk semua halaman `(public)` — tanpa membuat halaman publik kehilangan ISR (PRD §10.4).

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/design/handoff/README.md` (bagian **Assets** dan **Interactions & Behavior** saja)
- `docs/design/handoff/COMPONENTS.md` (Kerangka layout)
- `docs/design/handoff/TOKENS.md` (Breakpoint, Tipografi, Spasi, Garis/fokus/bayangan)
- `docs/design/screens/1a.png` + `1a.html` — **header & footer saja**, abaikan isi Beranda
- `docs/design/screens/1t.md` + `1t.png` (header tablet) · `1d.png` (header & footer ponsel) · `7a.png` (header saja)
- `docs/design/screens/16d.md`
- `docs/prd/sections/07-navigasi-information-architecture.md` (§7.1)
- `docs/prd/sections/05-fitur-konsultasi-ruang-lingkup-final.md` (baris KSL-13 & KSL-14 saja)
- Kode yang sudah ada: `src/app/layout.tsx`, `src/app/(public)/**`, `src/app/page.tsx` (bila ada), komponen Button & dialog/sheet dari A-05/A-06

## Kerjakan

**Header tamu** — sticky, latar `surface`, garis bawah `border-soft`, isi maks 1200, padding 16 / 28 / 40. Logo = `logo-binzi-wordmark.png` saja (tabel Assets), tautan ke `/`.
- **≥ 1024 (1a):** logo · Beranda · Kursus · Artikel · Konsultasi · Tentang Kami · [Cari] · Masuk (ghost, seperti 1a) · Daftar Gratis (primary).
- **640–1023 (1t):** logo · Kursus · Artikel · Konsultasi · Tentang · [Cari] · Masuk (tombol gelap). Beranda dan Daftar Gratis disembunyikan — tidak muat di 640; logo menjadi jalan ke Beranda.
- **< 640 (1d):** ☰ · logo di tengah · [Cari].
- [Cari] = tombol ikon 40×40, `aria-label="Cari"`, tautan ke `/cari`. Ikon dari Lucide.

**Menu ponsel (< 640)** — tampilan 1d: panel lebar penuh tepat di bawah header, baris tinggi 48, radius baris 8–10.
- Isi: Beranda · Kursus · Artikel · Konsultasi (dengan keterangan mono kecil `di beranda ↓`, `text-subtle`) · Tentang Kami, lalu tombol **Masuk** dan **Daftar Gratis** (PRD §7.1; desain tidak menggambar tombol ini — susun dengan token).
- Perilaku modal: scrim, fokus terkunci, Esc dan ketuk scrim menutup, fokus kembali ke ☰, scroll body terkunci, ☰ memakai `aria-expanded` + `aria-controls`. Menutup otomatis setelah item diklik (KSL-13) dan saat lebar menjadi ≥ 640.
- Bangun di atas primitif dialog yang sudah ada dari A-06 (Radix), jangan menulis focus trap sendiri.

**Tujuan tautan** — satu file konstanta di `src/components/shared/` (dipakai ulang footer dan A-14b): `/` · `/kursus` · `/artikel` · `/#tanya-ahli-gizi` · `/tentang` · `/cari` · `/masuk` · `/daftar`. Halaman yang belum ada boleh 404 sampai sprint-nya (S4–S6). **Jangan membuat halaman sementara.**

**State aktif** — `aria-current="page"` + garis bawah 2px `primary`. Ditentukan oleh satu fungsi murni (path → item) yang dites Vitest:
- Beranda hanya di `/` persis · Kursus di `/kursus/**` · Artikel di `/artikel/**` · Tentang di `/tentang`.
- Konsultasi **tidak pernah** aktif (§7.1).

**Konsultasi** — `Link` biasa ke `/#tanya-ahli-gizi`. Ekspor tinggi header per breakpoint sebagai konstanta agar S6 bisa memakainya untuk `scroll-margin-top` (KSL-14).

**Footer (1a, latar `ink-surface`)**
- Kolom merek: wordmark · tagline (copy 1a) · pil "Ditinjau ahli gizi ber-STR aktif".
- **Belajar:** Semua kursus (`/kursus`) · Nilai Saya (`/belajar/nilai`).
- **Artikel:** hanya "Semua kategori" (`/artikel`). Tautan per kategori ditambahkan di S4 (kategori belum final, K-04).
- **BINZI:** Tanya Ahli Gizi (`/#tanya-ahli-gizi`) · Tentang Kami (`/tentang`).
- **Ketentuan:** Kebijakan Privasi (`/kebijakan-privasi`) · Syarat & Ketentuan (`/syarat-ketentuan`) · Disclaimer medis (`/disclaimer`).
- Cincin fokus di footer (latar gelap): override `--focus-ring` ke `var(--surface)` (catatan keputusan di STATUS).
- Baris bawah: `© {tahun berjalan} BINZI`. **Ikon media sosial tidak dipasang** (akun & URL belum ada).
- Ponsel: susunan kolom mengikuti footer di 1d.

**Layout `(public)/layout.tsx`** — tautan lewati "Lewati ke konten utama" (muncul saat fokus) · header · `<main id="konten-utama">` · footer.

**Beranda `/`** — pastikan berada di `src/app/(public)/page.tsx`; bila sekarang di `src/app/page.tsx`, pindahkan. Isi placeholder yang ada tidak diubah, hanya ditambah `<section id="tanya-ahli-gizi" aria-label="Tanya Ahli Gizi">` kosong sebagai target tautan Konsultasi.

**Larangan ISR** — layout `(public)` dan semua komponen header/footer **tidak boleh** memanggil `cookies()`, `headers()`, atau mengambil sesi di server. Itu membuat semua halaman publik dinamis. Di kartu ini header selalu versi tamu; versi member menyusul di A-14b lewat sesi sisi klien.

## Bukan lingkup tugas ini
- Header member, drawer akun, dan bottom nav area belajar (A-14b). Menu ponsel di kartu ini hanya untuk tamu.
- Isi Beranda, section Tanya Ahli Gizi, smooth scroll + pindah fokus ke judul section, event `consultation_nav_clicked` (S6).
- Halaman tujuan tautan (S4–S6) dan halaman 404 khusus (14a).
- Header mode fokus player/quiz (S2).
- `src/app/(auth)/**` — layar auth tetap tanpa header/footer (2a).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/components/shared/**` (kecuali `src/components/shared/auth/**`)
- `src/app/(public)/layout.tsx`
- `src/app/(public)/page.tsx` (hanya pindah + anchor), dan menghapus `src/app/page.tsx` bila dipindahkan

## Selesai jika
- [ ] Header sesuai `.png` di 360 / 640 / 768 / 1280; footer di 360 / 1280. Screenshot dilampirkan di PR.
- [ ] Tidak ada scroll horizontal di 360 dan tepat 640 (§14.1).
- [ ] Menu ponsel bisa dibuka/tutup dengan keyboard saja; fokus terkunci saat terbuka, Esc menutup, fokus kembali ke ☰; tertutup setelah item diklik.
- [ ] Output `npm run build` menandai `/` sebagai statis (○) — tempel barisnya di PR.
- [ ] `/masuk` dan `/daftar` tetap tanpa header & footer.
- [ ] Target sentuh ≥ 44, cincin fokus sesuai TOKENS, ukuran huruf dari tabel Tipografi (nilai arbitrer, bukan skala bawaan Tailwind).
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Sebelum membuka PR (pelajaran A-13)
- `npm run build && npm run start`, lalu buka/curl `/`, `/masuk`, `/daftar`, dan satu tautan yang belum ada (mis. `/kursus` → 404).
- Ambil screenshot di lebar di atas (Playwright lewat `npx`, **tanpa** menambah dependensi), bandingkan dengan `.png`, cocokkan ukuran huruf dengan TOKENS. Perbaiki dulu, baru buka PR.
- Setelah push: cek status deploy Preview (`gh pr checks`), bukan hanya build lokal.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run lint:hex`

## Verifikasi oleh kamu (sebelum merge)
- [ ] HP nyata: buka/tutup menu, ketuk item (menu menutup), tidak bisa digeser ke samping.
- [ ] Desktop, keyboard saja: Tab dari tautan lewati sampai footer; urutan fokus masuk akal.
- [ ] Preview: header & footer tampil di `/`; `/masuk` tanpa header.

## Catatan keputusan (tinjauan 11 Okt 2026)
- **Label & gaya:** "Tentang Kami" di ≥ 1024, menu ponsel, dan footer; "Tentang" di 640–1023 (1t). "Daftar Gratis" mengikuti COMPONENTS & 7a; gaya Masuk ghost mengikuti 1a.
- **Logo** wordmark saja di header (tabel Assets), walau 1a/1d menggambar lockup.
- **Menu ponsel** memakai tampilan panel 1d dengan perilaku modal; Masuk/Daftar Gratis ditambahkan karena PRD §7.1 mewajibkannya.
- Perbedaan PRD ↔ desain di atas dicatat agent di ringkasan PR (aturan handoff: perilaku ikut PRD).

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
