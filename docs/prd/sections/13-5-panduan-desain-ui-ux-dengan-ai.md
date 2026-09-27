> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 13. Roadmap

### 13.5 Panduan Desain UI/UX dengan AI

> **Status v1.3: tahap desain selesai.** Desain final ada di handoff Claude Design BINZI (lihat §17.4). Untuk implementasi, acuan tampilannya adalah `TOKENS.md`, `COMPONENTS.md`, dan `SCREENS.md` di folder desain — bukan tabel token di bawah. Bagian ini dipertahankan sebagai catatan proses dan sebagai checklist review. Beberapa pola di daftar "hindari" (label mono huruf besar, panah pada sebagian CTA) dipakai secara terbatas di desain final dan **diterima sebagai bagian desain final**; jangan menambahkannya di luar tempat yang sudah didesain.

#### Yang perlu diluruskan lebih dulu: UX-nya sudah selesai

"Desain" mencakup dua hal yang sangat berbeda tingkat kesulitannya untuk AI:

| | **UX** — struktur, alur, navigasi, hierarki informasi | **UI** — warna, tipografi, spacing, komponen |
|---|---|---|
| Sumbernya | Pemahaman terhadap pengguna & tujuan produk | Sistem visual yang konsisten |
| Kemampuan AI | Lemah — cenderung menyalin pola umum tanpa alasan | Kuat — sangat cepat begitu tokennya dikunci |
| Status di proyek ini | **Sudah ditentukan** di dokumen ini | Belum — perlu dikerjakan |

Keputusan UX yang penting sudah tertulis: sitemap dan navigasi (§7.1–7.2), struktur beranda (§7.3), tiga alur kritis (§7.4), struktur section konsultasi di Beranda (§5.4), dan aturan gerbang materi (§6.2). Jadi **AI tidak perlu menciptakan UX — ia perlu mengeksekusinya.** Ini penting karena UX adalah tempat AI paling sering salah: ia akan menghasilkan sesuatu yang terlihat masuk akal namun tidak mempertimbangkan bahwa pengguna Anda membaca artikel di HP saat jam istirahat dengan kuota terbatas.

Praktiknya: setiap kali meminta AI mendesain sebuah layar, **sertakan bagian PRD yang relevan sebagai konteks**, bukan sekadar nama layarnya.

#### Alur kerja dengan Claude Design

Desain UI/UX dikerjakan di **Claude Design** — kanvas visual dari Anthropic Labs yang menghasilkan HTML/CSS langsung dan dapat diserahkan ke Claude Code sebagai *handoff bundle*. Ini menghilangkan tahap penerjemahan mockup ke kode yang biasanya memakan waktu terbanyak.

```
1. Wireframe kasar 12 layar utama    → kotak & label saja, tanpa warna.
                                        Boleh di kertas atau Excalidraw.
                                        Tujuannya menyepakati tata letak.

2. Bangun DESIGN SYSTEM di Claude    → warna, tipografi, spacing, radius,
   Design sebagai artefak pertama       komponen dasar. Ini artefak yang akan
                                        dirujuk seluruh layar berikutnya.

3. Desain layar per area, bukan       → mulai dari area Belajar (paling
   satu per satu acak                   kompleks), lalu Publik, lalu CMS.
                                        Rujuk design system di setiap sesi.

4. Minta SEMUA state per layar        → gunakan tabel state wajib di bawah
   secara eksplisit                     sebagai bagian dari prompt.

5. Tinjau di 360 / 768 / 1280         → sebelum layar dianggap selesai.

6. Handoff bundle → Claude Code       → desain menjadi kode tanpa
                                        penerjemahan manual.
```

**Kenapa design system dibangun lebih dulu:** Claude Design dapat membaca design system yang sudah ada — tipografi, token warna, komponen — lalu menerapkannya konsisten ke seluruh keluaran berikutnya. Ini menjawab langsung risiko R-19 (inkonsistensi antar sesi), tetapi **hanya jika sistemnya dibuat lebih dulu dan dirujuk secara eksplisit**. Kalau Anda langsung minta "buatkan halaman detail kursus" di sesi pertama, tidak ada sistem yang bisa dirujuk dan setiap layar berikutnya akan sedikit berbeda.

**Setelah Fase 0 selesai, arahkan Claude Design ke repositori kode.** Claude Design bisa membaca codebase, sehingga layar-layar berikutnya dibuat mengikuti komponen yang benar-benar sudah ada, bukan komponen versi baru yang mirip.

**Urutan area yang disarankan: Belajar → Publik → CMS.** Area Belajar berisi layar tersulit (player materi, quiz mode ujian, hasil quiz) dan paling banyak state-nya. Mendesainnya lebih dulu memaksa design system menghadapi kasus tersulit sejak awal; kalau CMS didahulukan, sistemnya akan terbentuk dari layar tabel-dan-form yang sederhana lalu kewalahan saat sampai ke player.

#### Yang tetap harus Anda kerjakan sendiri

Claude Design mempercepat pembuatan, tetapi empat hal berikut tidak diselesaikan olehnya:

| Hal | Kenapa tetap manual |
|---|---|
| **Meminta state kosong & error** | Keluaran default adalah *happy path*. Tabel state wajib di bawah harus disertakan dalam prompt, bukan sebagai tindak lanjut |
| **Verifikasi mobile-first di 360px** | Kanvas cenderung menghasilkan tata letak lebar dulu. Tinjau 360px lebih dulu, bukan terakhir |
| **Menyediakan konten asli** | Judul kursus asli sepanjang 48 karakter merusak tata letak yang dirancang untuk teks placeholder pendek |
| **Memeriksa kontras & target sentuh** | Perlu diuji dengan alat pemeriksa kontras dan di perangkat nyata |

#### Catatan status produk

Claude Design berstatus **research preview**, tersedia untuk pengguna Claude Pro, Max, Team, dan Enterprise tanpa biaya tambahan di luar langganan. Tiga hal yang perlu diantisipasi:

- **Hanya satu editor pada satu waktu** — tidak masalah untuk tim satu orang, tapi perlu koordinasi bila nanti bertambah.
- **Tidak ada impor/ekspor Figma bawaan.** Jika suatu saat Anda perlu menyerahkan desain ke desainer eksternal, ekspornya berupa HTML, PDF, PPTX, atau Canva — bukan `.fig`.
- **Masih berkembang.** Karena berstatus preview, jangan menjadikan satu fitur spesifiknya sebagai satu-satunya jalur kerja. *Handoff bundle* ke Claude Code adalah jalur utama; ekspor HTML tersedia sebagai cadangan.

Periksa kondisi terkini di https://www.anthropic.com/news/claude-design-anthropic-labs sebelum menyusun jadwal yang bergantung padanya.

#### Token yang harus dikunci sebelum layar pertama dibuat

| Kategori | Yang perlu diputuskan |
|---|---|
| Warna | 4–6 warna bernama berdasarkan peran, bukan rupa: `surface`, `text`, `text-muted`, `primary`, `success`, `danger`. Tambah warna khusus untuk status quiz (Lulus / Belum Lulus) |
| Tipografi | 1–2 typeface. Jika 2, perbedaannya harus jelas. Skala ukuran tetap (mis. 12/14/16/20/24/32/40) dengan peran masing-masing |
| Spacing | Satu skala (mis. kelipatan 4px). Semua jarak diambil dari sini, tidak ada angka lepas |
| Radius & elevasi | Maksimal 2–3 nilai. Radius berbeda untuk hierarki berbeda, bukan satu radius untuk semua |
| Panjang baris | Teks materi & artikel maksimal ~70 karakter per baris — ini konten baca-panjang |
| Ukuran font dasar | **16px minimum.** Persona P3 berusia 45+; jangan pakai 14px untuk teks isi |

**Hindari lima pola berikut** — semuanya adalah default yang muncul di hampir semua UI buatan AI dan langsung terbaca sebagai hasil generate:

1. Latar krem hangat + serif kontras tinggi + aksen terakota
2. Semua konten dipotong menjadi kartu bersudut membulat identik, dengan bayangan abu-abu lembut yang sama di semuanya
3. Label ALL-CAPS ber-*letter-spacing* di atas setiap judul
4. Panah `→` ditempelkan di akhir teks tombol dan tautan
5. Animasi *fade-and-slide-up* pada setiap seksi saat digulir

Untuk platform gizi & kesehatan yang dibaca masyarakat umum, arah yang lebih tepat adalah **tenang, terang, dan mudah dibaca** — kredibilitas datang dari kejelasan, bukan dari dekorasi. Satu elemen boleh berani (misalnya perlakuan tipografi di hero); selebihnya tenang.

#### Inventaris layar

Ini yang menentukan besarnya pekerjaan desain, dan angkanya lebih besar dari yang biasanya diperkirakan:

| Area | Jumlah layar |
|---|---|
| Publik | 11 (beranda — termasuk section Tanya Ahli Gizi, katalog, detail kursus, preview materi, artikel ×3, tentang, pencarian, auth ×3) |
| Member | 9 (dashboard, kursus saya, progress kursus, player materi, konfirmasi quiz, quiz, hasil quiz, nilai saya, profil) |
| CMS | 9 (dashboard, kursus, editor materi, quiz builder, artikel, kategori artikel, media, pengguna, pengaturan) |
| **Total** | **~30 layar** |

Dikalikan 3–4 *state* per layar, totalnya sekitar **100 tampilan**. Inilah alasan token harus dikunci lebih dulu — tanpa itu, konsistensi mustahil dijaga di angka sebesar ini.

#### State wajib per layar (bagian yang paling sering dilupakan AI)

AI hampir selalu menghasilkan *happy path* saja. State berikut harus diminta eksplisit:

| Jenis layar | State yang wajib ada |
|---|---|
| Daftar (katalog, artikel, kursus saya) | Normal · **Kosong** · Memuat · Gagal memuat · **Hasil filter kosong** |
| Detail (kursus, artikel, materi) | Normal · Memuat · **Tidak ditemukan (404)** · **Terkunci** (belum login / materi belum terbuka) |
| Formulir (auth, profil, CMS) | Kosong · Terisi · **Error validasi per field** · Sedang mengirim · Berhasil |
| Player materi | Video memuat · **Video gagal dimuat** · **Materi tanpa video** · Video selesai |
| Quiz | Konfirmasi mulai · Sedang berjalan · **Sisa waktu < 2 menit** · **Auto-save gagal** · Waktu habis |
| Hasil quiz | Lulus · Belum lulus · Dibuka kembali dari Nilai Saya |
| Dashboard member | **Pengguna baru (belum ada kursus)** · Pengguna aktif |
| CMS editor | Menyimpan · **Tersimpan** · **Gagal menyimpan** · Konflik/kadaluwarsa |

Dua yang paling kritis untuk produk ini: **dashboard pengguna baru** (kesan pertama setelah registrasi — kalau kosong dan tanpa arahan, user langsung pergi) dan **auto-save gagal saat quiz** (karena hanya ada satu kesempatan, user harus tahu seketika bila jawabannya tidak tersimpan).

#### Kesalahan khas AI dalam UI/UX dan cara mencegahnya

| Kesalahan | Cara mencegah |
|---|---|
| Mendesain desktop lalu mengecilkannya | Minta eksplisit: "tulis gaya dasar untuk 360px, tambahkan dengan `min-width`". Tinjau di 360px lebih dulu, bukan terakhir |
| Memakai teks placeholder pendek | Selalu berikan konten asli. "Gizi Seimbang untuk Ibu Hamil Trimester Pertama" (48 karakter) merusak tata letak yang dirancang untuk "Judul Kursus" |
| Membuat komponen baru padahal sudah ada | Sebelum sesi, tunjukkan daftar komponen yang sudah dibangun dan larang membuat duplikat |
| Melupakan state kosong & error | Sertakan tabel di atas sebagai bagian dari permintaan, bukan sebagai tindak lanjut |
| Kontras rendah pada teks sekunder | Uji dengan pemeriksa kontras; minimum 4,5:1. `text-gray-400` di atas putih hampir selalu gagal |
| Target sentuh terlalu kecil | Minimum 44×44px. Ikon-saja tanpa area sentuh tambahan adalah pelanggaran paling umum |
| Focus state dihapus | `outline: none` tanpa pengganti membuat navigasi keyboard mustahil |
| Inkonsistensi antar sesi | Token di CLAUDE.md + tunjukkan 1–2 layar yang sudah jadi sebagai acuan gaya di awal sesi |

#### Checklist review per layar

Sebelum sebuah layar dianggap selesai:

- [ ] Terlihat benar di 360px, 768px, dan 1280px (+1440px untuk Beranda & Masuk)
- [ ] Semua state dari tabel di atas sudah ada
- [ ] Konten yang dipakai adalah konten asli, bukan placeholder
- [ ] Warna, font, dan spacing seluruhnya berasal dari token — tidak ada nilai lepas
- [ ] Tidak ada komponen baru yang menduplikasi komponen yang sudah ada
- [ ] Kontras teks ≥ 4,5:1
- [ ] Dapat dinavigasi penuh dengan keyboard, focus state terlihat
- [ ] Target sentuh ≥ 44×44px
- [ ] Teks tombol memakai kata kerja aktif yang menyebut akibatnya ("Simpan perubahan", bukan "Kirim")
