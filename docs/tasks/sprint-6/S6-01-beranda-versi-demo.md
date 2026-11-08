# S6-01 · Beranda versi demo

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | A-14a, A-14b (layout publik), A-07 (seed `consultation.*`) — semuanya sudah di `main` |
| **Tag ClickUp** | `s6`, `agent`, `publik` |
| **Judul ClickUp** | `[S6] S6-01 Beranda versi demo` |
| **Branch** | `s6/s6-01-beranda-demo` |

> **Dibuat 8 Nov 2026** di Claude chat, ditinjau terhadap `main` `e53cb26`. Klaim teknis di kartu ini dijalankan dulu di sandbox (PGlite, Chromium 153, Tailwind 4.3.3 repo) — buktinya di "Catatan tinjauan 8 Nov" paling bawah.
>
> **Keputusan pemilik 8 Nov** (dicantumkan di PR sebagai keputusan yang sudah disetujui):
> 1. Beranda versi demo dikerjakan di slot **Sen 9**, menggantikan impor soal CSV. CSV pindah ke setelah demo.
> 2. **Hero:** semua teks dan tombol dari **1a** di semua lebar (Q37); visual di kanan = **ilustrasi 6a** (Q33), dipasang seperti 6b. Di bawah 1024 tata letaknya mengikuti 1t/1d (ditumpuk).
> 3. **Ilustrasi bergerak terus** seperti 6a, dengan **tombol kecil "Jeda animasi"** (WCAG 2.2.2; PRD §8 menargetkan WCAG 2.1 AA). Pengguna dengan "Kurangi gerakan" melihat frame diam.
> 4. **Section:** Hero · Cara kerjanya · Tanya Ahli Gizi · CTA penutup. **Ditunda:** Kursus unggulan, Artikel terbaru, Kredibilitas, FAQ.
> 5. **Data ahli gizi** mengikuti desain sesuai OQ-08: nama & gelar dari desain, **STR dummy**, foto dari `docs/design/source/`. Semuanya di satu berkas konstanta supaya pemilik bisa mengeditnya sendiri.
> 6. **Halaman "Segera hadir"** untuk `/kursus`, `/artikel`, `/tentang`, `/cari`, supaya tautan header tidak 404 saat demo. Ini membalik catatan A-14a "no placeholder pages" di `nav-items.ts`.
> 7. **Nomor WhatsApp dibaca saat diklik**, lewat route redirect, bukan saat build (alasan di bagian 4).

## Tujuan
Tamu yang membuka `/` melihat Beranda sungguhan untuk demo 20 Nov: hero dengan ilustrasi bergerak, cara kerja, section Tanya Ahli Gizi yang membuka WhatsApp ahli gizi dengan pesan pembuka, dan CTA penutup. Tautan header tidak lagi 404. `/` tetap halaman statis (○).

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD: `docs/prd/sections/07-navigasi-information-architecture.md` (§7.3 Beranda), `05-fitur-konsultasi-ruang-lingkup-final.md` (KSL-01…14), `08-requirement-non-fungsional.md` (aksesibilitas, `prefers-reduced-motion`), `02-decision-log.md` (Q33, Q37), `16-pertanyaan-terbuka.md` (OQ-08), `14-acceptance-criteria.md` (§14.7).
- Desain (`docs/design/screens/`):
  - `1a.md` + `1a.png` — copy dan tata letak desktop: hero (bagian kiri), Cara kerjanya, Tanya Ahli Gizi, CTA penutup;
  - `1d.md` + `1d.png` — tata letak < 640; `1t.md` + `1t.png` — tata letak 640–1023 (copy hero tetap 1a, bukan copy lama 1t);
  - `6a.md` + `6a.html` + `6a.png` — ilustrasi 720 × 520: elemen, warna, durasi, delay, iterasi;
  - `6b.md` + `6b.html` — pemasangan di hero 1280 (`scale(0.7778)` → 560 × 404).
- Keyframes ilustrasi di `docs/design/source/Binzi Landing Hero.dc.html` — berkas 1,7 MB, **jangan dibaca utuh**: ambil hanya blok `@keyframes` yang dipakai 6a (`il*` sebanyak 12, `breathe`, `pulse`, `dBob`) lewat `grep`.
- `docs/design/handoff/TOKENS.md` (Gerak, permukaan gelap, aturan teks `primary`).
- Kode:
  - `src/app/(public)/layout.tsx`, `src/app/(public)/page.tsx` (placeholder + anchor `#tanya-ahli-gizi`);
  - `src/components/shared/nav-items.ts` (`PUBLIC_HREFS`, `HEADER_HEIGHT`, komentar kepala), `page-container.tsx`, `site-footer.tsx` (pola section `ink-surface` + focus ring di latar gelap);
  - `src/app/globals.css` (aturan `prefers-reduced-motion` global);
  - `scripts/check-hex.mjs` (pengecualian folder `src/components/public/hero-illustration/`);
  - `src/db/seed.ts` (kunci `consultation.*`, `DUMMY_WHATSAPP_NUMBER`), `src/modules/quiz/queries.ts` (pola baca `system_settings` — lihat catatan jsonb di bagian 4), `src/app/api/health/route.ts` (pola route publik ƒ);
  - `.github/workflows/ci.yml` langkah **Build** (`DATABASE_URL` dummy tanpa server).
- E2E: `e2e/layout/helpers.ts` (`GUEST_PAGES`), `e2e/layout/keyboard.spec.ts` (tes skip link "tamu di /"), `e2e/layout/touch-targets.spec.ts`, `e2e/layout/axe.spec.ts`, `e2e/layout/no-horizontal-scroll.spec.ts`, `e2e/fixtures.ts` (`withE2eDb`).

## Kerjakan

### 1. Halaman `/` dan konten
- `src/app/(public)/page.tsx` menjadi Beranda: urutan section Hero → Cara kerjanya → Tanya Ahli Gizi → CTA penutup. Latar section boleh selebar layar; isinya dibungkus `PageContainer`.
- **Tetap statis (○):** tanpa akses DB, `cookies()`, `headers()`, atau sesi di halaman maupun komponennya (A-14a, PRD §10.4). Selain aturan layout publik, ini juga syarat CI: langkah Build memakai `DATABASE_URL` dummy tanpa server, jadi halaman statis yang membaca DB gagal di-prerender.
- `metadata.description` = subjudul hero. `title` tetap dari root layout.
- **Satu berkas konten:** `src/components/public/beranda/beranda-content.ts` memuat data ahli gizi, statistik hero, contoh pertanyaan, jam layanan, waktu balas, dan templat pesan WhatsApp. Pemilik mengedit di sini tanpa menyentuh komponen.
  - Ahli gizi (OQ-08): nama `Pundra Dara Avindharin S.Tr.Gz, M.K.M`, kredensial `Nutrisionis`, STR `1234 5678 9012 3456` (**dummy** — wajib diganti sebelum rilis, PRD §14.9), pengalaman dari 1a, foto `/images/ahli-gizi/pundra-dara.jpg`.
  - Statistik hero dari 1a: 3 kursus terkurasi · 6 kategori artikel · 10 soal per materi.
  - Jam & waktu balas sebagai copy 1a: "Senin–Jumat · 09.00–17.00 WIB", "Dibalas dalam 1×24 jam kerja".
- **Foto:** buat `public/images/ahli-gizi/pundra-dara.jpg` 256 × 256 (kualitas ±82) dari `docs/design/source/foto-pundra-face.jpg` (berkasnya PNG 640 × 640, 710 KB, meski berekstensi `.jpg`). Pakai `sharp` yang sudah ada di `node_modules` lewat satu perintah `node -e`; skrip konversinya tidak di-commit. Tampilkan dengan `next/image`. Foto ini sudah ada di repo publik (`docs/design/source/`), jadi tidak ada data baru yang terbuka.

### 2. Hero
- **Copy 1a di semua lebar:** h1 "Belajar gizi dari penjelasan yang **benar**", subjudul, tombol, baris peninjau, statistik.
  - Kata "benar" disorot `bg-primary-tint` dengan teks `text-primary-deep` (4,85:1). Teks tidak pernah memakai `primary` (aturan C-07).
  - "Mulai Belajar Gratis" (primary) → `PUBLIC_HREFS.daftar`; "Baca Artikel" (secondary) → `PUBLIC_HREFS.artikel` (halaman "Segera hadir", bagian 6).
  - Baris peninjau: foto bulat 40 px (`alt=""`, karena nama tertulis di sebelahnya), "Seluruh materi ditinjau **{nama}**", baris kedua "{kredensial} · STR {str}".
  - Statistik: angka mono + label.
- **Tata letak:**

  | Lebar | Susunan | Ilustrasi |
  |---|---|---|
  | ≥ 1024 | dua kolom `lg:grid-cols-[minmax(0,1fr)_560px]`, teks kiri | kanan, 560 × 404 (`scale(0.7778)`, 6b) |
  | 640–1023 | ditumpuk (1t), tombol berdampingan | di bawah statistik, di tengah, 576 × 416 (`scale(0.8)`) |
  | < 640 | ditumpuk (1d), tombol selebar kolom bertumpuk | di bawah statistik, 324 × 234 (`scale(0.45)`) |

  Lebar isi `PageContainer`: 584 px di 640, 328 px di 360. Kedua ukuran muat.

### 3. Ilustrasi 6a
- **Folder** `src/components/public/hero-illustration/` (dikecualikan dari cek hex sejak A-04):
  - `hero-illustration.tsx` — markup (server component);
  - `hero-illustration.module.css` — keyframes dan aturan animasi. CSS Module memberi nama keyframes yang ter-scope otomatis;
  - `illustration-frame.tsx` — komponen klien yang membungkus markup (sebagai `children`) dan memegang status jeda.
- **Markup dari `6a.html`:** kotak 720 × 520 dengan elemen, durasi, delay, dan iterasi yang sama dengan 6a. Warna yang punya padanan di TOKENS.md memakai token (`var(--…)`). Warna khusus ilustrasi tetap hex di folder ini dan **tidak** dijadikan token (lihat catatan ⚠️ di `1a.md`).
- **Dekoratif:** seluruh gambar diberi `aria-hidden="true"`. Teks di dalamnya ("72% nilai kuis", "Zat besi 27 mg", "Ditinjau ahli gizi") adalah bagian gambar.
- **Penskalaan:** pembungkus `relative overflow-hidden` dengan lebar × tinggi **hasil skala** (tabel bagian 2). Kotak 720 × 520 di dalamnya `absolute left-0 top-0 origin-top-left` dengan `transform: scale(s)`.
  - Alasannya: `transform` tidak mengubah tinggi tata letak. Tanpa pembungkus berukuran tetap, di 360 tersisa **ruang kosong 286 px** di bawah ilustrasi (diukur di Chromium: pembungkus 520 px, gambar berakhir di 234 px). Gulir samping tidak terjadi, karena luapan dihitung dari kotak setelah transform.
- **Frame diam = gaya dasar elemen.**
  - Aturan global di `globals.css` membuat setiap animasi berdurasi 0,01 ms dan satu iterasi saat "Kurangi gerakan" aktif. Animasi tak hingga (fill-mode `none`) lalu **kembali ke gaya dasarnya**. Jadi gaya dasar setiap elemen beranimasi harus frame yang bermakna:
    - cincin nilai `stroke-dashoffset: 74` (72%, akhir `ilRing`);
    - bilah progres video penuh (akhir `ilBar`);
    - centang dan chip ber-`opacity: 1`;
    - uap cangkir boleh `opacity: 0`.
  - Elemen `ilRise` (fill-mode `both`) berakhir di keadaan `to`.
  - Jangan menambah aturan reduced-motion kedua yang bertentangan dengan aturan global.
- **Tombol jeda** (`illustration-frame.tsx`):
  - letak: pojok kanan bawah ilustrasi, di luar subtree `aria-hidden`;
  - target sentuh ≥ 44 × 44; latar `surface` dengan garis, focus ring standar;
  - ikon jeda/putar, nama aksesibel **"Jeda animasi" ↔ "Putar animasi"** (nama yang berganti, tanpa `aria-pressed`);
  - saat dijeda, pembungkus mendapat atribut `data-paused` dan CSS Module menerapkan `animation-play-state: paused !important` ke semua turunannya;
  - disembunyikan saat `prefers-reduced-motion` (`motion-reduce:hidden`), karena tidak ada yang bergerak;
  - status tidak disimpan.

### 4. Tanya Ahli Gizi (KSL)
- **Section gelap** `bg-ink-surface` (token untuk "dark sections: Tanya Ahli Gizi, footer, CTA"). Judul putih; teks pendukung `text-ink-surface-text` (5,93:1). Focus ring di latar gelap mengikuti pola `site-footer.tsx`.
- `section id="tanya-ahli-gizi"` dan `scroll-mt` yang sudah ada dipertahankan (KSL-14).
- **Isi dan copy dari 1a:**
  - eyebrow "KONSULTASI", h2 "Tanya Ahli Gizi Kami", subjudul;
  - kartu profil (KSL-02): foto, nama, pil "Nutrisionis", pil mono "STR …", pengalaman, tautan "Kenali tim kami →" ke `/tentang`;
  - "Contoh yang bisa ditanyakan": empat contoh dari 1a;
  - "Tidak dilayani: …" (KSL-01);
  - chip jam layanan, waktu balas, dan "Gratis". Titik status memakai `success` dan bersifat dekoratif;
  - kotak disclaimer "Edukasi gizi, bukan layanan medis" berisi teks darurat 119 (KSL-05, KSL-07). Latar 1a (`#3a211b`) tidak ada di TOKENS.md: pakai token dengan modifier opasitas (mis. `bg-primary-deep/15`, `border-primary-deep/40`), tanpa hex baru di luar folder ilustrasi. Kontrasnya diputuskan oleh axe;
  - tombol "Chat Ahli Gizi di WhatsApp" dan catatan "Membuka WhatsApp dengan pesan pembuka yang sudah terisi. Riwayat chat tidak kami simpan.".
- **Tombol WhatsApp:**
  - `<a href="/api/konsultasi/whatsapp" target="_blank" rel="noopener noreferrer">` bergaya tombol primary (putih di atas `primary-deep` 5,61:1);
  - nama aksesibel diawali "Chat Ahli Gizi di WhatsApp", dengan sufiks `sr-only` " (membuka tab baru)".
- **Route `GET /api/konsultasi/whatsapp`** (baru, ƒ). Kode di modul baru `src/modules/consultation/` (`queries.ts`, `service.ts`); route hanya memanggil service.
  - **Baca nilainya dengan `jsonb_typeof(value)` dan `value #>> '{}'`, bukan `value::text`.** Untuk string JSON, `::text` mengembalikan tanda kutipnya (`"6280000000000"` lengkap dengan kutip; dicek di PGlite 8 Nov). Pola `selectMinQuestionsText` cocok untuk angka, tidak untuk string.
  - Sah bila tipenya `string` dan nilainya cocok `^62\d{8,13}$`. Seed: `6280000000000`.
  - Berhasil → **302** ke `https://wa.me/{nomor}?text={encodeURIComponent(TEMPLAT)}` dengan `Cache-Control: no-store`, karena nomor bisa diganti tanpa deploy (KSL-08). `TEMPLAT` = "Halo, saya ___ dan ingin bertanya seputar gizi. Saya menemukan halaman ini dari BINZI." (KSL-04, desain).
  - **Gagal tertutup:** baris hilang, bukan string, atau tidak cocok → `console.error` tanpa menulis nilainya, lalu **503** JSON `{ "error": { "code": "CONSULTATION_UNAVAILABLE", "message": "Layanan konsultasi sedang tidak tersedia." } }` dengan `Cache-Control: no-store`. Tidak ada nomor cadangan.
- **Kenapa lewat route, bukan dibaca di halaman:** membaca `system_settings` di Beranda membuat `/` dinamis, atau membuat build gagal di CI (bagian 1). Route redirect menjaga `/` tetap ○, bekerja tanpa JavaScript, dan memakai nomor terbaru setiap klik.
- **Jam layanan dan waktu balas** juga ada di `system_settings` (`consultation.operating_hours`, `consultation.response_sla`). Untuk demo keduanya ditulis sebagai copy statis (bagian 1), dengan alasan yang sama.

### 5. Cara kerjanya & CTA penutup
- **Cara kerjanya:** judul, pengantar, tiga kartu 01–03 dengan copy 1a. Tiga kolom di ≥ 1024, ditumpuk di bawahnya (1d/1t).
- **CTA penutup:** judul "Mulai dari satu materi hari ini", teks, tombol "Mulai Belajar Gratis" → `/daftar` dan "Baca Artikel" → `/artikel`. Tata letak dan latarnya mengikuti 1a/1d.
- **Klaim yang baru benar setelah S6** ("Materi pertama bisa ditonton dulu tanpa akun", "Tidak perlu akun untuk materi pertama", "Tiga kursus tersedia") tetap mengikuti desain. Klaim ini didaftar di "Keputusan & asumsi" PR sebagai copy yang harus dicek sebelum rilis publik.

### 6. Halaman "Segera hadir"
- `src/app/(public)/{kursus,artikel,tentang,cari}/page.tsx` memakai komponen baru `src/components/public/coming-soon.tsx`:
  - h1 = nama halaman ("Kursus", "Artikel", "Tentang Kami", "Cari");
  - teks *(usulan)* "Halaman ini sedang disiapkan.";
  - tautan "Kembali ke Beranda" (`/`) dan "Tanya Ahli Gizi" (`/#tanya-ahli-gizi`).
- Statis (○), `metadata.robots = { index: false }`, `title` "{Nama} — BINZI".
- `nav-items.ts`: **hanya** komentar kepala yang diubah, mencatat keputusan 8 Nov. `PUBLIC_HREFS` dan logika tidak berubah.
- `/kursus/{slug}` dan `/artikel/{slug}` tetap 404.

### 7. Tes lama yang berubah
- `e2e/layout/keyboard.spec.ts`, tes "tamu di /": perketat seperti yang diminta komentar di tes itu. Setelah skip link lalu Tab, fokus jatuh pada elemen fokus **pertama di dalam** `#konten-utama`, yaitu "Mulai Belajar Gratis".
- `e2e/layout/helpers.ts`: `GUEST_PAGES` ditambah `/kursus`, `/artikel`, `/tentang`, `/cari`. Halaman-halaman ini ikut axe, cek gulir samping, dan screenshot di semua lebar.
- **Sebelum menulis kode:** cari tes yang mengasersi isi placeholder Beranda, isi `main` yang kosong, atau ketiadaan sesuatu di `/` (`"BINZI"`, `toHaveCount(0)`, `toEqual` pada daftar tautan). Sebutkan hasilnya di rencana. Tes lain yang harus diubah di luar dua berkas di atas → **berhenti dan tanyakan**.

### 8. Tes baru
- **Unit/komponen (Vitest):**
  - `consultation`: pembangun URL (hasil persis `https://wa.me/6280000000000?text=Halo%2C%20saya%20___%20dan%20ingin%20bertanya%20seputar%20gizi.%20Saya%20menemukan%20halaman%20ini%20dari%20BINZI.`); validasi nomor — sah `6280000000000`, `628123456789`; tidak sah `0812345678`, `+6281234567`, `62`, 16 digit, string kosong;
  - `illustration-frame`: nama tombol berganti dan `data-paused` terpasang/terlepas; markup ilustrasi `aria-hidden`;
  - Hero: `href` kedua CTA, kata "benar" di elemen sorotan, isi baris peninjau dari `beranda-content.ts`;
  - Tanya Ahli Gizi: `href`, `target`, `rel` tombol WhatsApp; tidak ada tautan email;
  - `coming-soon`: h1 dan kedua tautan.
- **Integrasi (PGlite)** untuk service `consultation`: string sah → URL; baris hilang → error; nilai JSON berupa angka (`6280000000000` tanpa kutip) → error; string kosong → error.
- **E2E `e2e/beranda.spec.ts`** (project `chromium`):
  1. `/` → 200; h1; `href` CTA `/daftar` dan `/artikel`; ilustrasi `aria-hidden`.
  2. Jeda: `document.getAnimations()` yang target-nya di dalam ilustrasi — ada yang `running`; klik "Jeda animasi" → semuanya `paused` dan tombol bernama "Putar animasi"; klik lagi → ada yang `running`.
  3. `page.emulateMedia({ reducedMotion: "reduce" })` lalu muat ulang → tombol jeda tidak terlihat; tidak ada animasi `running`; `stroke-dashoffset` cincin nilai terhitung `74px`.
  4. `request.get("/api/konsultasi/whatsapp", { maxRedirects: 0 })` → 302, `location` persis URL di atas, `cache-control` memuat `no-store`. Lalu, dalam `test.describe.serial` dengan `try/finally`, ubah setting di `binzi_e2e` lewat `withE2eDb` menjadi `"0812"` → 503 dengan kode `CONSULTATION_UNAVAILABLE`; kembalikan ke `6280000000000`.
  5. `/#tanya-ahli-gizi` di 1280 dan 360 → h2 "Tanya Ahli Gizi Kami" terlihat di viewport, dan sisi atasnya ≥ sisi bawah header sticky (KSL-14).
  6. Tinggi pembungkus ilustrasi = tinggi gambar hasil skala (± 1 px) di viewport 360, 768, dan 1280.
  7. `/kursus`, `/artikel`, `/tentang`, `/cari` → 200, h1, `meta[name="robots"]` berisi `noindex`; di `/kursus` item nav "Kursus" ber-`aria-current="page"`.
- **`e2e/layout/touch-targets.spec.ts`** — satu tes baru di w360: kedua CTA hero, "Jeda animasi", "Kenali tim kami", tombol WhatsApp, kedua CTA penutup, dan "Kembali ke Beranda" di `/kursus`.

## Bukan lingkup tugas ini
- Kursus unggulan, Artikel terbaru, Kredibilitas, FAQ (sisa §7.3, S6).
- Animasi judul per kata dan sorotan yang menyapu dari 1a (catatan framer-motion). Ilustrasi 6a sendiri murni CSS.
- Fallback email KSL-10, analitik KSL-06 (belum ada alat analitik terpasang), smooth scroll KSL-13.
- Menyatukan jam layanan dan waktu balas dengan `system_settings`.
- Isi `/kursus` (katalog, detail, preview), `/tentang`, dan fungsi `/cari`.
- Mengubah header, footer, menu ponsel, atau `PUBLIC_HREFS`.
- Dependensi baru. Tidak ada; `sharp` hanya dipakai sekali dari `node_modules` untuk menyiapkan foto.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/app/(public)/page.tsx`
- `src/app/(public)/kursus/page.tsx`, `artikel/page.tsx`, `tentang/page.tsx`, `cari/page.tsx` (baru)
- `src/app/api/konsultasi/whatsapp/route.ts` (baru)
- `src/components/public/beranda/*` (baru) + tes
- `src/components/public/hero-illustration/*` (baru) + tes
- `src/components/public/coming-soon.tsx` (baru) + tes
- `src/components/public/.gitkeep` (hapus)
- `src/modules/consultation/queries.ts`, `service.ts` (baru) + tes unit dan integrasi
- `src/components/shared/nav-items.ts` (komentar kepala saja)
- `public/images/ahli-gizi/pundra-dara.jpg` (baru)
- `e2e/beranda.spec.ts` (baru), `e2e/layout/helpers.ts` (`GUEST_PAGES`), `e2e/layout/keyboard.spec.ts` (tes skip link "/"), `e2e/layout/touch-targets.spec.ts` (satu tes baru)

## Selesai jika
- [ ] `/`, `/kursus`, `/artikel`, `/tentang`, `/cari` bertanda **○** dan `/api/konsultasi/whatsapp` bertanda **ƒ** di output `npm run build`. Baris tabel rutenya ditempel di PR.
- [ ] Hero, Cara kerjanya, Tanya Ahli Gizi, dan CTA penutup sesuai bagian 2–5 di 360, 768, 1280, dan 1440.
- [ ] Ilustrasi bergerak, bisa dijeda dan diputar lagi, dan diam dengan frame bermakna saat "Kurangi gerakan" aktif.
- [ ] Tombol WhatsApp membuka `wa.me` dengan nomor dari `system_settings` dan pesan pembuka; setting tidak sah → 503 tanpa nomor cadangan.
- [ ] Semua tes di bagian 7–8; axe, cek gulir samping, dan screenshot berjalan untuk lima halaman publik di semua lebar.
- [ ] `node scripts/check-hex.mjs` lulus: hex hanya di folder ilustrasi.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e` (prasyarat: Docker, `npm run dev:db`, `npm run e2e:db`).
- Baseline Vitest = angka di `main` saat sesi dimulai, disebut di rencana. PR melaporkan baseline + jumlah tes baru, dan menyebut tes lama yang berubah satu per satu.
- `git diff --stat main -- package.json package-lock.json src/db` kosong.

## Sebelum membuka PR
- Gate audit di awal sesi dan sekali lagi sebelum PR (`node scripts/check-audit.mjs`); laporkan angkanya.
- Prettier hanya untuk berkas baru dan berkas yang diubah di bagian yang disentuh; berkas lama tidak diformat ulang. Staging per nama berkas; `git status` hanya berisi berkas yang diizinkan.
- **Uji mutasi** — commit dulu, `git status` bersih, satu mutasi per kali, kembalikan dengan `git restore`. Laporkan tes yang merah per mutasi; bila tidak sesuai harapan, cari dulu lapis yang menutupnya.
  1. Query membaca `value::text` → integrasi "string sah → URL" dan E2E no. 4 merah.
  2. Validasi pola nomor dihapus → integrasi/unit "nomor tidak sah" dan E2E no. 4 (503) merah.
  3. `Cache-Control: no-store` dihapus dari 302 → E2E no. 4 merah.
  4. `data-paused` tidak dipasang saat tombol diklik → E2E no. 2 merah. Tes komponen nama tombol boleh tetap hijau.
  5. Gaya dasar cincin `stroke-dashoffset: 264` → E2E no. 3 merah.
  6. Pembungkus ilustrasi tanpa ukuran hasil skala → E2E no. 6 merah.
  7. `aria-hidden` dilepas dari ilustrasi → tes komponen dan E2E no. 1 merah.
- **Screenshot** lokal dengan `E2E_SCREENSHOT_DIR=~/binzi-s6-01-screenshots` (konvensi A-19b, `animations: "disabled"`): kelima halaman publik di semua lebar (lewat `GUEST_PAGES`), ditambah `/#tanya-ahli-gizi` di 360 dan 1280.
- **"Keputusan & asumsi" di PR:** keputusan 1–7 di atas; copy usulan (halaman "Segera hadir", sufiks "(membuka tab baru)"); klaim copy yang baru benar setelah S6 (bagian 5); data dummy (STR, nomor WhatsApp seed).
- Setelah push: `gh pr checks`.

## Verifikasi oleh kamu (sebelum merge)
- [ ] Buka preview Vercel PR di HP dan laptop. Ilustrasi bergerak; "Jeda animasi" menghentikannya; "Putar animasi" menjalankannya lagi.
- [ ] Nyalakan "Kurangi gerakan" lalu muat ulang: ilustrasi diam, tombol jeda hilang, cincin tetap 72%. Letaknya di iPhone: Pengaturan → Aksesibilitas → Gerakan → Kurangi Gerakan; di macOS: Pengaturan Sistem → Aksesibilitas → Tampilan → Kurangi gerakan. **Matikan lagi setelahnya.**
- [ ] Klik "Chat Ahli Gizi di WhatsApp": WhatsApp terbuka dengan pesan pembuka. Nomornya masih dummy `6280000000000` sampai kamu menggantinya di binzi-dev (persiapan demo di STATUS).
- [ ] Klik Kursus, Artikel, Tentang Kami, dan ikon cari di header: halaman "Segera hadir", bukan 404.
- [ ] Unggah folder screenshot ke Claude chat untuk dibandingkan dengan 1a, 1d, 1t, dan 6b.
- [ ] Bila perlu, ubah data ahli gizi di `src/components/public/beranda/beranda-content.ts`, sebelum merge atau di PR terpisah.

## Rencana agent (sebelum menulis kode)
Rencana memuat:
- daftar berkas; server/klien per komponen; signature ekspor baru;
- cara memindahkan markup 6a: elemen mana yang memakai token, dan warna mana yang tetap hex;
- ukuran skala per rentang lebar;
- hasil pencarian tes lama (bagian 7);
- daftar tes per bagian 8;
- ekspektasi merah untuk mutasi 1–7.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.

## Catatan tinjauan 8 Nov
Klaim yang dijalankan di sandbox Claude chat (berkas probe tidak masuk repo):

| Klaim | Bukti |
|---|---|
| `value::text` mengembalikan tanda kutip untuk string JSON | PGlite: `'"6280000000000"'::jsonb` → `::text` = `"6280000000000"` (dengan kutip), `#>> '{}'` = `6280000000000`, `jsonb_typeof` = `string`; nilai angka → `number` |
| Pembungkus berukuran hasil skala diperlukan | Chromium 153 di 360: tanpa pembungkus, wadah 520 px sementara gambar berakhir di 234 px (ruang kosong 286 px); gulir samping **tidak** terjadi (luapan dari kotak setelah transform). Dengan pembungkus: 234 px, rapat |
| `data-paused` + `animation-play-state` menjeda semua animasi | Chromium: `ilRing`/`ilChip` `running` → `paused` |
| Aturan reduced-motion global mengembalikan animasi tak hingga ke gaya dasar | Chromium + `emulateMedia({ reducedMotion: "reduce" })`: tidak ada animasi berjalan; cincin bergaya dasar 74 → `74px`; `ilRise` (fill `both`) → `opacity: 1` |
| URL `wa.me` | `encodeURIComponent` templat KSL-04 = string di bagian 8 |
| Kontras | `primary-deep` di `primary-tint` 4,85:1; `ink-surface-text` di `ink-surface` 5,93:1; putih di `primary-deep` 5,61:1 |
| Kode yang ada | Kunci `consultation.*` di seed sejak A-07 (`ab38c14`), jadi ada di binzi-dev; pengecualian hex folder ilustrasi di `check-hex.mjs`; komentar tes skip link meminta pengetatan saat Beranda berisi; `GUEST_PAGES` memuat `/`; CI Build tanpa server DB |

Belum diperiksa dari sandbox: render penuh 6a di dalam halaman Next (port markup dikerjakan agent), font Lato, Safari/iOS, dan preview Vercel.
