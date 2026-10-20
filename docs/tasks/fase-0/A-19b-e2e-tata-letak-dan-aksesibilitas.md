# A-19b · E2E: tata letak per lebar & aksesibilitas

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-19](A-19-e2e-baseline-playwright.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `testing`, `a11y` |
| **Judul ClickUp** | `[F0][Agent] A-19b E2E tata letak per lebar & aksesibilitas` |

> **Dibuat 19 Okt 2026** dari pemecahan kartu A-19 (ditinjau terhadap kode `main` `e642da2`). Memakai harness A-19 apa adanya: DB E2E, server build produksi, fixture akun berperan, dan penangkap pelanggaran CSP.
>
> **Ditinjau ulang 20 Okt 2026** terhadap kode A-19 yang di-merge (`340d909`): semua berkas di "Baca dulu" ada dan keenam target uji mutasi cocok dengan kode. Ditambahkan: pemisahan berkas antar-project (bagian 1), locator menu CMS (bagian 3), dan cara memverifikasi mutasi di branch uji ("Verifikasi oleh kamu").

## Tujuan
Mengunci perilaku responsif dan aksesibilitas dasar yang sejauh ini hanya tertangkap lewat screenshot dan verifikasi manual (A-14a, A-14b, A-15): tanpa scroll horizontal, menu & drawer per ambang, target sentuh, keyboard, dan axe — di lebar yang mencakup setiap rentang breakpoint.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `e2e/README.md`, `playwright.config.ts`, dan fixture di `e2e/` (hasil A-19)
- `docs/prd/sections/14-acceptance-criteria.md` (§14.1 saja)
- `docs/prd/sections/07-navigasi-information-architecture.md` (§7.1 saja)
- Kode: `src/components/shared/{site-header,mobile-menu,member-header,account-menu,learn-bottom-nav,session-header,skip-link}.tsx`, `src/components/shared/nav-items.ts`, `src/components/cms/{cms-sidebar,cms-rail,cms-mobile-bar,cms-account-menu}.tsx`, `src/app/(learn)/belajar/page.tsx`
- Dokumentasi resmi `@axe-core/playwright` untuk versi yang dipasang.

## Kerjakan

### 1. Project per lebar
Setiap rentang breakpoint punya satu titik uji. Pelajaran A-15: ambang `md:` lolos karena tidak ada lebar uji di 640–767.

| Project | Lebar × tinggi | Rentang |
|---|---|---|
| `w360` | 360 × 780 | < 640 (ponsel) |
| `w700` | 700 × 900 | 640–767 |
| `w768` | 768 × 1024 | 768–1023 (titik desain tablet) |
| `w1280` | 1280 × 800 | ≥ 1024 |
| `w1440` | 1440 × 900 | hanya `/` dan `/masuk` (definisi selesai di `CLAUDE.md`) |

Tes alur A-19 tetap di project 1280-nya; tes kartu ini berjalan di project-project di atas. Chromium saja.

Project A-19 bernama `chromium` (1280 × 800) dan namanya tidak diubah. Memisahkan berkas antar-project lewat `testMatch`/`testIgnore` — di project `chromium` dan di project baru — termasuk "penambahan project": boleh tanpa bertanya. Tes A-19 tidak boleh ikut berjalan di project lebar, dan tes kartu ini tidak boleh berjalan di project `chromium`.

### 2. Tanpa scroll horizontal (§14.1)
Di setiap lebar, `document.documentElement.scrollWidth <= clientWidth` pada:
- tamu: `/`, `/masuk`, `/daftar`, `/lupa-password`, `/reset-password` (tanpa token), `/daftar/verifikasi`;
- MEMBER: `/` (header member) dan `/belajar`;
- EDITOR dan SUPER_ADMIN: `/cms` dan `/cms/kursus`;
- halaman 403 ("Akses ditolak");
- setiap menu atau drawer dalam keadaan terbuka.

Tambahan: akun dengan **nama 40 karakter tanpa spasi** (pelajaran A-14b — overflow 217 px di 360) di `/belajar` dan `/cms`, pada semua lebar.

### 3. Menu & drawer per ambang
- **Isi header tamu per lebar (Q41, D-08):** < 640 "Buka menu" + "Cari", tanpa Masuk dan Daftar Gratis di header; 640–1023 (`w700`, `w768`) "Cari" + Masuk, tanpa "Buka menu" dan tanpa Daftar Gratis; ≥ 1024 "Cari" + Masuk + Daftar Gratis. Diperiksa lewat visibilitas, bukan keberadaan di DOM — tombol yang tersembunyi tetap ada di DOM.
- **Menu ponsel tamu (`w360`):** "Buka menu" membuka menu; "Tutup menu" berada di posisi "Buka menu" (selisih kotak ≤ 2 px); Esc menutup dan fokus kembali ke "Buka menu".
- **Member:** tepat satu tombol "Menu akun" di setiap lebar (regresi PR #53).
  - < 640: drawer akun lebar penuh di bawah header; "Tutup menu akun" di posisi avatar; Esc menutup dan fokus kembali ke "Menu akun".
  - 640–1023 (`w700`, `w768`): dropdown terbuka rata kanan di bawah pemicunya (`align="end"`; toleransi diusulkan agent di rencana). Bug A-14b: panel menempel di x = 0. Esc mengembalikan fokus ke pemicu.
  - ≥ 1024: pemicu berupa pil nama.
- **Bottom nav "Navigasi belajar"** di `(learn)`: ada di `w360` dan `w700`, tidak ada di `w768` dan `w1280`.
- **CMS:** < 640 bar + "Buka menu CMS" → drawer + "Tutup menu CMS"; 640–1023 rel ikon (lebar 72) dengan tooltip saat fokus; ≥ 1024 sidebar (lebar 248). Lebar diukur dengan `getBoundingClientRect`.
  - DOM `/cms` memuat **dua** `<nav aria-label="Menu CMS">` di setiap lebar: sidebar (`cms-sidebar.tsx`) dan rel (`cms-rail.tsx`); yang tidak sesuai lebar `display: none`. Nav ketiga (`cms-mobile-bar.tsx`) hanya ada saat drawer terbuka. `page.locator('nav[aria-label="Menu CMS"]')` cocok dua elemen (strict mode gagal); `getByRole("navigation", { name: "Menu CMS" })` hanya menghitung yang terlihat. Asersi per lebar menyasar nav yang terlihat.
- **Drawer yang lebih tinggi dari layar** (drawer akun dan drawer CMS, viewport 360 × 640): baris ✕ tetap terlihat setelah isi digulir ke bawah.

### 4. Target sentuh ≥ 44 px (§14.1)
Di `w360`, lebar dan tinggi ≥ 44 px untuk: tombol header ("Buka menu", "Menu akun", "Cari", "Buka menu CMS"), item menu dan drawer, item bottom nav, tombol kirim form auth, tombol tampilkan password, dan semua tombol ✕. Tautan teks di dalam kalimat tidak termasuk.

### 5. Keyboard
Di `w360` dan `w1280`: alur masuk tanpa mouse — "Lewati ke konten utama" → email → password → tunggu token Turnstile → Enter → mendarat di `/belajar`. Setiap elemen yang menerima fokus punya indikator fokus yang terlihat (computed `outline-style` atau `box-shadow` bukan `none`).

### 6. axe
- `@axe-core/playwright`, tag WCAG 2.1 A/AA.
- Halaman: `/`, `/masuk`, `/daftar`, `/lupa-password`, `/reset-password`, `/daftar/verifikasi`, `/belajar`, `/cms`, dan halaman 403 — di `w360` dan `w1280`, ditambah state menu/drawer terbuka di `w360`.
- Pelanggaran berdampak `serious` atau `critical` menggagalkan tes. `moderate` dan `minor` dilampirkan ke laporan Playwright dan didaftar di PR.
- Wadah widget Turnstile dikecualikan (iframe lintas origin milik Cloudflare). Pengecualian aturan lain hanya dengan persetujuan pemilik.

### 7. Screenshot untuk tinjauan
Bila env `E2E_SCREENSHOT_DIR` di-set, simpan screenshot halaman penuh untuk setiap halaman × lebar di bagian 2 dan setiap state menu terbuka ke folder itu (mis. `~/binzi-a19b-screenshots/`, di luar repo). Ini bahan perbandingan visual di Claude chat (pelajaran l), bukan baseline, dan tidak di-commit.

### 8. Paket
`@axe-core/playwright`, versi dipin eksak dan dirilis ≥ 14 hari sebelum sesi. Sebutkan di ringkasan PR. `node scripts/check-audit.mjs` tetap hijau.

## Bukan lingkup tugas ini
- Regresi visual berbasis piksel (`toHaveScreenshot`): baseline butuh lingkungan render yang stabil; ditinjau ulang setelah S1.
- Memperbaiki temuan di `src/**`. Aturan "Bila tes menemukan bug" di A-19 berlaku: berhenti, laporkan, tunggu keputusan pemilik.
- Halaman yang belum ada (`/kursus`, `/artikel`, `/tentang`, `/cari`, `/profil`), WebKit/Firefox, dan perangkat nyata (H-11).
- Mengubah harness A-19 di luar penambahan project dan fixture. Bila harness perlu diubah, **berhenti dan tanyakan**.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `e2e/**`
- `playwright.config.ts` (project per lebar)
- `package.json`, `package-lock.json` (`@axe-core/playwright` saja)

## Selesai jika
- [ ] Semua tes hijau lokal dan di job `e2e` CI.
- [ ] Uji mutasi dilampirkan di PR. Masing-masing dijalankan lokal, wajib membuat tes merah, lalu dikembalikan:
  1. `sm:inline-flex` pada tombol Masuk gelap (640–1023) di `site-header.tsx` diganti `md:inline-flex` (kasus ambang A-15) → tes isi header `w700` merah;
  2. pemicu "Menu akun" dipecah jadi dua tombol yang disembunyikan bergantian per breakpoint → regresi PR #53 merah;
  3. `break-words` dihapus dari sapaan di `/belajar` → tes nama panjang di `w360` merah;
  4. tombol "Buka menu" dikecilkan ke 40 px → tes target sentuh merah;
  5. `aria-label="Buka menu"` dihapus → axe atau tes menu merah;
  6. `md:hidden` di bottom nav diganti `lg:hidden` → tes `w768` merah.
- [ ] Durasi job `e2e` sebelum dan sesudah kartu ini dicatat di PR.

## Sebelum membuka PR
- `npm run check`, `npm run build`, `npm run e2e` (dua kali berturut-turut).
- Jalankan sekali dengan `E2E_SCREENSHOT_DIR=~/binzi-a19b-screenshots` dan sebutkan jumlah berkasnya di PR. Agent tidak menilai screenshot itu sendiri; perbandingan visual dilakukan pemilik di Claude chat.
- Keputusan yang kamu ambil tanpa bertanya **wajib** masuk "Keputusan & asumsi" di PR (toleransi posisi, daftar elemen target sentuh, pengecualian axe).
- Setelah push: cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check`
- `npm run build`
- `npm run e2e`

## Verifikasi oleh kamu (sebelum merge)
- [ ] `npx playwright show-report`: project `w360`, `w700`, `w768`, `w1280`, `w1440` tampil dan hijau. Lampiran axe `moderate`/`minor` dibaca — putuskan mana yang jadi item STATUS.
- [ ] Unggah folder screenshot ke Claude chat untuk perbandingan dengan desain (13a, 13d, 8e, 8t, 1d, 19a–19c).
- [ ] Satu mutasi di branch uji **yang dibuat dari branch PR** (bukan `main` — tes kartu ini belum ada di sana) lewat PR draft → job `e2e` merah **dengan tes A-19b yang diharapkan di daftar gagal**: `gh run view --job <id> --log-failed | grep -E "✘|[0-9]+ (failed|passed)"`. Langkah "Run E2E tests" yang merah saja belum bukti, karena langkah itu juga menjalankan `next build`. Lalu tutup PR dan hapus branch (`gh pr close <n> --delete-branch`).

## Catatan keputusan
- **Lebar 700 ditambahkan** karena 360/768/1280 tidak menyentuh rentang 640–767, tempat ambang `sm:` dan `md:` berbeda. 1440 hanya untuk Beranda dan Masuk, sesuai definisi selesai.
- **Tanpa baseline piksel.** Font dan antialiasing berbeda antara Mac dan runner Linux, sehingga baseline yang dibuat di satu tempat gagal di tempat lain. Perbandingan visual tetap lewat screenshot yang ditinjau di Claude chat.
- **axe memblokir hanya `serious`/`critical`.** Temuan yang lebih ringan dicatat lebih dulu agar pemilik bisa memilah, bukan membuat CI merah di hari pertama karena hal kosmetik.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
