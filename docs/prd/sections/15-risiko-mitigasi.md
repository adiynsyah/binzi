> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 15. Risiko & Mitigasi

| # | Risiko | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|---|
| **R-01** | **6 artikel terlalu sedikit untuk menghasilkan trafik organik** | Tinggi | **Tinggi** | Lihat catatan di bawah |
| R-02 | ~210 soal quiz tidak selesai tepat waktu | Tinggi | Tinggi | Mulai minggu 1; bulk import CSV (QZ-15) dinaikkan ke Must; tulis soal di spreadsheet. Beban tidak jadi naik ke 420 karena question bank tidak lagi wajib (§6.3.1) |
| R-03 | Free tier berubah kebijakan atau project di-pause | Sedang | Sedang | Cron keep-alive; backup harian ke R2; semua komponen punya pengganti setara |
| R-04 | Klausul non-komersial Vercel Hobby | Sedang | Sedang | Hobby dipakai selama fase penelitian (trafik kecil, non-komersial). Pindah ke Vercel Pro ($20) atau Cloudflare Workers saat rilis publik atau bila ada monetisasi / pihak yang dibayar untuk membangunnya (§9.4) |
| R-05 | Video buffering di koneksi lambat karena tanpa adaptive bitrate | Sedang | Sedang | Batasi 5 menit & 60 MB; panduan kompresi wajib; siapkan migrasi ke HLS di fase 2 |
| R-06 | Konten kesehatan tidak akurat → risiko reputasi & hukum | **Sangat tinggi** | Sedang | Review ahli gizi wajib sebelum publish; disclaimer; kredensial ditampilkan; daftar rujukan |
| R-07 | Fitur Konsultasi menimbulkan ekspektasi klinis / risiko regulasi | **Tinggi** | Sedang | Judul section "Tanya Ahli Gizi"; daftar batasan tertulis; jalur darurat 119; panduan internal untuk ahli gizi; tinjauan hukum |
| R-13 | Nomor WhatsApp publik menjadi sasaran spam atau penyalahgunaan | Sedang | Sedang | Gunakan WhatsApp Business bernomor khusus; jangan tulis nomor sebagai teks (hanya tautan `wa.me`); siap ganti nomor lewat `system_settings` tanpa deploy |
| R-14 | Permintaan konsultasi tidak terukur karena tidak dicatat | Rendah | Tinggi | Lacak klik tombol sebagai event analitik — cukup untuk memutuskan apakah formulir/booking layak dibangun di fase 2 |
| R-08 | Nilai di-*farming* | **Hilang** | — | Tidak ada pengulangan, jadi tidak ada yang bisa di-farming (§6.3.1) |
| R-09 | Drop-off karena tersangkut quiz | **Hilang** | — | Tidak ada gerbang kelulusan; user selalu bisa lanjut (§6.3.1) |
| R-15 | **User kehilangan satu-satunya kesempatan karena masalah teknis** (koneksi putus, salah buka, baterai habis) | **Tinggi** | **Sedang** | Layar konfirmasi wajib (QZ-18) + auto-save andal (QZ-09) + reset attempt oleh admin (QZ-19) + tautan bantuan di halaman hasil. Lihat §6.3.2 |
| R-16 | Soal ambigu merusak nilai user secara permanen | Sedang | Sedang | Review ahli gizi; analitik butir soal (QZ-16); reset attempt untuk user terdampak bila soal terbukti keliru (§6.3.4) |
| R-17 | Soal & pembahasan disebarkan antar user (screenshot) | Rendah | Sedang | Dampak rendah karena tanpa sertifikat tidak ada taruhan. Question bank di fase 2 bila jadi masalah |
| R-18 | **Kode buatan AI lolos verifikasi dengan celah keamanan yang tidak terlihat dari UI** | **Sangat tinggi** | **Tinggi** | Checklist §12.6 dijalankan sebagai prosedur wajib tiap akhir sprint, bukan pemeriksaan ad hoc. Tes E2E untuk alur quiz & akses materi |
| R-19 | **Inkonsistensi UI antar layar** karena tiap sesi AI menghasilkan gaya berbeda | Sedang | Sedang | Bangun design system di Claude Design sebagai artefak pertama dan rujuk di setiap sesi; arahkan ke repositori setelah Fase 0; token juga dicantumkan di CLAUDE.md (§13.5) |
| R-22 | **State kosong, error, dan gagal-simpan tidak dibuat** karena AI hanya menghasilkan happy path | Sedang | **Sangat tinggi** | Tabel state wajib (§13.5) disertakan dalam setiap permintaan desain layar, bukan sebagai tindak lanjut |
| R-23 | Desain dibuat desktop-first lalu dikecilkan, sehingga tampilan mobile terasa sisa | Sedang | Tinggi | Tinjau di 360px lebih dulu, bukan terakhir; instruksi mobile-first eksplisit di CLAUDE.md (§1, §13.5) |
| R-20 | **AI menghasilkan klaim gizi yang salah atau tidak berlaku di Indonesia** | **Sangat tinggi** | **Tinggi** | Konten kesehatan tidak boleh dihasilkan AI tanpa verifikasi. `reviewer_id` wajib terisi sebelum publish (§13.4) |
| R-21 | Satu orang menjadi titik kegagalan tunggal (pengarah sekaligus pemverifikasi) | Tinggi | Sedang | Checklist §12.6 dibuat sebagai prosedur konkret yang dapat dijalankan orang lain; tes E2E sebagai jaring pengaman otomatis |
| R-10 | Supabase free tanpa backup otomatis → kehilangan data | **Tinggi** | Rendah | Cron `pg_dump` harian ke R2 + uji restore bulanan (wajib, bukan opsional) |
| R-11 | Kepatuhan UU PDP | Sedang | Sedang | Persetujuan eksplisit saat registrasi, hak akses & hapus, retensi terdefinisi. Risiko turun karena data kesehatan tidak masuk sistem |
| R-12 | Scope creep sebelum MVP rilis | Tinggi | Tinggi | Backlog fase 2 & 3 tertulis; penambahan harus menggeser item lain |

### Catatan R-01 (perlu perhatian Anda)

Rencana "6 kategori × 1 artikel" menciptakan masalah struktural, bukan sekadar masalah jumlah:

1. **Halaman kategori akan terlihat kosong.** Membuka `/artikel/kehamilan` dan menemukan satu artikel memberi kesan platform belum jadi.
2. **Google memberi sedikit trafik pada situs dengan 6 halaman konten.** Otoritas topikal terbentuk dari kedalaman, bukan keluasan.
3. **Fitur "Artikel Terkait" tidak akan punya bahan** — tidak ada artikel lain dalam kategori yang sama.

**Rekomendasi alternatif dengan jumlah tulisan yang sama:**

| | Rencana Anda | Usulan saya |
|---|---|---|
| Kategori | 6 | **3** |
| Artikel per kategori | 1 | **2** |
| Total artikel | 6 | **6** (sama) |
| Halaman kategori | Terlihat kosong | Terisi wajar |
| Artikel Terkait | Kosong | Berfungsi |
| Otoritas topikal | Menyebar tipis | Terfokus |

Beban kerja identik — hanya distribusinya yang berbeda. Tiga kategori sisanya dapat ditambahkan di bulan ke-2 setelah masing-masing punya 2–3 artikel. Struktur database tetap mendukung berapa pun jumlah kategori, jadi ini murni keputusan konten.
