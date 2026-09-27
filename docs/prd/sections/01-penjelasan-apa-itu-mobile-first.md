> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 1. Penjelasan: Apa Itu "Mobile First"?

Anda bertanya soal ini, dan pertanyaannya bagus karena istilah ini sering disalahpahami.

**Mobile-first bukan berarti "hanya untuk HP".** Itu adalah **urutan cara mendesain dan menulis kode**, bukan batasan platform. Hasil akhirnya persis seperti yang Anda inginkan: satu website yang bisa dibuka di laptop, tablet, maupun HP.

**Dua pendekatan untuk membuat website responsive:**

| | Desktop-first (cara lama) | Mobile-first (rekomendasi) |
|---|---|---|
| Cara kerja | Desain untuk layar besar dulu, lalu "dipaksa muat" ke layar kecil | Desain untuk layar kecil dulu, lalu *ditambahkan* ruang saat layar membesar |
| CSS | `@media (max-width: 768px)` — menimpa gaya desktop | `@media (min-width: 768px)` — menambah gaya di atas dasar mobile |
| Masalah umum | Tampilan HP terasa "sisa" — elemen dipaksa mengecil, banyak yang tersembunyi, halaman berat karena aset desktop tetap dimuat | Tampilan HP terasa dirancang khusus; desktop mendapat ruang lebih |
| Performa di HP | Buruk — browser HP tetap mengunduh aset desktop | Baik — aset besar hanya dimuat saat layar besar |

**Contoh konkret di platform Anda — halaman detail kursus:**

```
Layar HP (360–767px)      → 1 kolom. Video di atas, daftar materi
                             sebagai accordion di bawah. Menu = hamburger.

Layar tablet (768–1023px) → 2 kolom. Konten utama + sidebar sempit.
                             Menu mulai terlihat sebagian.

Layar laptop (≥1024px)    → Sidebar daftar materi menempel di kiri (sticky),
                             konten di kanan. Navigasi penuh terlihat.
```

Dengan mobile-first, kita menulis tampilan HP sebagai dasar, lalu menambahkan sidebar di breakpoint tablet & laptop. Dengan desktop-first, kita akan menulis sidebar dulu lalu menyembunyikannya di HP — dan kode CSS-nya menjadi berlapis-lapis serta rawan bug.

**Kesimpulan praktis untuk Anda:** yang Anda minta ("bisa dibuka di laptop dan juga support penuh di tablet & HP") **sama persis** dengan yang saya rekomendasikan. Mobile-first hanyalah metode untuk mencapainya dengan hasil lebih baik. Tidak ada fitur desktop yang dikorbankan.

**Breakpoint resmi proyek:**

| Nama | Lebar | Perangkat acuan |
|---|---|---|
| `base` | 360px+ | HP kecil (dasar, tanpa media query) |
| `sm` | 640px+ | HP besar / landscape |
| `md` | 768px+ | Tablet portrait |
| `lg` | 1024px+ | Tablet landscape / laptop kecil |
| `xl` | 1280px+ | Laptop / desktop |
| `2xl` | 1536px+ | Monitor besar |

Setiap halaman **wajib** diuji pada minimal 3 lebar: **360px, 768px, dan 1280px** sebelum dianggap selesai. Beranda dan Masuk juga diuji di **1440px**. Lebar isi maksimum **1200px** berlaku di semua lebar desktop. (v1.3: desain final digambar di 1280, bukan 1440.)
