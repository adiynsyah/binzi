# Indeks Layar Desain — BINZI

Satu baris = satu layar di kanvas desain. Tiap layar punya tiga berkas di folder ini: `<ID>.png` (screenshot), `<ID>.md` (status, rute, catatan, pemetaan warna → token, copy final), `<ID>.html` (markup hasil render).

**Cara pakai untuk AI agent:** cari rute di `../handoff/SCREENS.md` → buka `<ID>.md` dan lihat `<ID>.png` → baru buka `<ID>.html` bila butuh ukuran/struktur persis. Jangan membaca kanvas utuh di `../source/`.

Status: ✅ dipakai · ℹ️ tidak terdaftar di SCREENS.md (referensi/eksplorasi) · ⛔ jangan dipakai

| Turn | ID | Status | Deskripsi | Route (dari SCREENS.md) |
|---|---|---|---|---|
| t1 | [1a](1a.md) | ✅ | HERO DIGANTI → 6b Desktop 1440px — beranda penuh §7.3: Hero · Kursus Unggulan · Cara Kerjanya · Artikel Terbaru · Tanya Ahli Gizi · Kredibil | `/` Beranda |
| t1 | [1d](1d.md) | ✅ | Mobile 360px — beranda penuh §7.3 (Cara Kerjanya, Kredibilitas, FAQ, CTA penutup); hamburger membuka menu; Konsultasi menggulir ke section T | `/` Beranda |
| t1 | [1t](1t.md) | ✅ | Beranda tablet 768px (§8.7) — hero menumpuk, kartu kursus 2 kolom · aturan lengkap di 16d | `/` Beranda |
| t2 | [2a](2a.md) | ✅ | /masuk desktop 1440px — interaktif: coba isi lalu tekan Masuk (validasi, mengirim, berhasil) | `/masuk` |
| t2 | [2b](2b.md) | ✅ | State wajib — error per field · gagal login (tanpa bocor) · terkunci 5× · berhasil | `/masuk` |
| t2 | [2c](2c.md) | ✅ | Modal masuk di tengah alur belajar (§7.4 A) — konteks halaman tidak hilang | `/masuk` |
| t2 | [2d](2d.md) | ✅ | /masuk mobile 360px — Google di atas, field 52px, tanpa kolom kiri | `/masuk` |
| t2 | [2t](2t.md) | ✅ | Masuk tablet 768px (§8.7) · aturan lengkap di 16d | `/masuk` |
| t3 | [3a](3a.md) | ✅ | /daftar desktop 1280px — interaktif: syarat password hidup, centang wajib, submit → layar verifikasi | `/daftar` + verifikasi |
| t3 | [3b](3b.md) | ✅ | Lupa & reset password — interaktif: kirim tautan (tanpa bocor) lalu buat password baru | `/lupa-password` |
| t3 | [3c](3c.md) | ✅ | State tepi — error per field · tautan kedaluwarsa/terpakai · akun Google ditautkan · email terverifikasi | `/daftar` + verifikasi, `/lupa-password` |
| t3 | [3d](3d.md) | ✅ | /daftar mobile 360px — Google di atas, field 52px, syarat password sebagai pil | `/daftar` + verifikasi |
| t3 | [3t](3t.md) | ✅ | Daftar tablet 768px (§8.7) · aturan lengkap di 16d | `/daftar` + verifikasi |
| t4 | [4a](4a.md) | ✅ | /tentang desktop 1280px — apa itu BINZI, metodologi konten, tim & peninjau, kontak | `/tentang` |
| t4 | [4b](4b.md) | ✅ | /tentang mobile 360px — urutan sama, formulir kontak target sentuh ≥44px | `/tentang` |
| t4 | [4t](4t.md) | ✅ | Tentang Kami tablet 768px (§8.7) · aturan lengkap di 16d | `/tentang` |
| t5 | [5a](5a.md) | ✅ | /artikel desktop 1280px — semua artikel; urutan terbaru/populer interaktif, chip kategori menuju 5e | `/artikel` |
| t5 | [5b](5b.md) | ✅ | /artikel/gizi-ibu-anak/kebutuhan-zat-besi-ibu-hamil desktop 1280px — detail + rujukan + blok peninjau + kembali ke kategori | `/artikel/{kategori}/{slug}` |
| t5 | [5c](5c.md) | ✅ | /artikel mobile 360px — chip kategori bisa digulir dan menuju 5f ; urutan berbagi state dengan 5a ) | `/artikel` |
| t5 | [5d](5d.md) | ✅ | detail artikel mobile 360px — isi tulisan, berbagi, rujukan, blok peninjau, Tanya Ahli Gizi, kembali ke kategori | `/artikel/{kategori}/{slug}` |
| t5 | [5e](5e.md) | ✅ | /artikel/{kategori} desktop 1280px — pola untuk keenam kategori (contoh: gizi-ibu-anak): hero kategori, 1 artikel (state jujur), kursus terk | `/artikel/{kategori}` |
| t5 | [5f](5f.md) | ✅ | /artikel/{kategori} mobile 360px — pola yang sama untuk keenam kategori; chip bisa digulir, kartu artikel penuh | `/artikel/{kategori}` |
| t5 | [5g](5g.md) | ✅ | Kategori dengan 2–5 artikel — kartu besar untuk yang terbaru, sisanya jadi baris (grid 3 kolom akan menyisakan sel kosong) | `/artikel/{kategori}` |
| t5 | [5h](5h.md) | ✅ | Kategori dengan 6+ artikel — grid 3 kolom, kontrol urutan, paginasi 9 per halaman (ART-05, SRC-03) | `/artikel/{kategori}` |
| t5 | [5i](5i.md) | ✅ | Kategori 2–5 artikel mobile 360px — versi mobile dari 5g : kartu bertumpuk, bukan baris 160px | `/artikel/{kategori}` |
| t5 | [5j](5j.md) | ✅ | Kategori 6+ artikel mobile 360px — versi mobile dari 5h : urutan bisa digulir, “Muat 9 lagi” menggantikan paginasi bernomor | `/artikel/{kategori}` |
| t5 | [5t](5t.md) | ✅ | Tablet 768px (§8.7) — indeks artikel & detail artikel · aturan lengkap di 16d | `/artikel/{kategori}/{slug}`, `/artikel` |
| t6 | [6a](6a.md) | ✅ | Ilustrasi 720×520 — full animate, loop terus | `/` Beranda |
| t6 | [6b](6b.md) | ✅ | Dipasang di hero 1280px — menggantikan kartu preview video 1a | `/` Beranda |
| t7 | [7a](7a.md) | ✅ | /kursus desktop 1280px — katalog 3 kursus, filter level, badge Preview Gratis | `/kursus` |
| t7 | [7b](7b.md) | ✅ | /kursus/gizi-ibu-hamil-trimester-1 desktop 1280px — outline penuh tergembok (CRS-03) + kartu daftar | `/kursus/{slug}` |
| t7 | [7c](7c.md) | ✅ | /kursus/{slug}/preview/materi-1 desktop 1280px — preview publik, gerbang daftar muncul setelah preview habis | `/kursus/{slug}/preview/{materi}` |
| t7 | [7d](7d.md) | ✅ | /belajar/{slug}/materi-2 desktop 1280px — player member + degradasi anggun kalau video gagal (§8.3) · klik “Tandai selesai & mulai quiz” unt | `/belajar/{slug}/{materi}` Player |
| t7 | [7e](7e.md) | ✅ | Quiz materi — interaktif: ringkasan aturan (gerbang satu kesempatan ada di 7d ) → jawab → nilai + pembahasan (§6.3, §7.4 B) | `…/{materi}/quiz` Quiz materi |
| t7 | [7f](7f.md) | ✅ | Mobile 360px — katalog · player (bottom nav area belajar §7.1) · quiz | `/belajar/{slug}/{materi}` Player, `/kursus`, `…/{materi}/quiz` Quiz materi |
| t7 | [7g](7g.md) | ✅ | Final Quiz interaktif 10 soal — timer 20 menit, navigator soal, tandai ragu-ragu, ringkasan sebelum submit, hasil + Nilai Akhir. Kartu mobil | `/belajar/{slug}/final-quiz`, `…/{materi}/quiz` Quiz materi |
| t7 | [7h](7h.md) | ✅ | Final Quiz — konfirmasi satu kesempatan (bobot 40%) & hasil + Nilai Akhir kursus | `/belajar/{slug}/final-quiz` |
| t7 | [7i](7i.md) | ✅ | Reset attempt QZ-19 (§6.3.2) — tiga langkah: lapor gangguan · menunggu ditinjau · hasil | Lapor gangguan quiz |
| t7 | [7j](7j.md) | ✅ | Quiz ditunda tanpa attempt (QZ-21) desktop + mobile — konsekuensi dari dialog konfirmasi di 7d | `…/{materi}/quiz` Quiz materi |
| t7 | [7k](7k.md) | ✅ | Kursus selesai + Ulangi Kursus (CRS-12) — penutup setelah Final Quiz 7h | Kursus selesai + Ulangi |
| t7 | [7l](7l.md) | ✅ | Mobile 360px — lapor gangguan & kursus selesai | Kursus selesai + Ulangi, Lapor gangguan quiz |
| t7 | [7m](7m.md) | ✅ | Mobile 360px — detail kursus (kartu daftar menetap di bawah) & preview materi publik | `/kursus/{slug}/preview/{materi}`, `/kursus/{slug}` |
| t7 | [7n](7n.md) | ✅ | Final Quiz mobile 360px — aturan & navigator · soal berjalan · hasil + Nilai Akhir (versi mobile 7g / 7h ) | `/belajar/{slug}/final-quiz` |
| t7 | [7t](7t.md) | ✅ | Tablet 768px (§8.7) — katalog · detail kursus · player materi · aturan lengkap di 16d | `/belajar/{slug}/{materi}` Player, `/kursus/{slug}`, `/kursus` |
| t7 | [7u](7u.md) | ✅ | Quiz tablet 768px (§8.7) — quiz materi · hasil & pembahasan · Final Quiz · konfirmasi · kursus selesai · aturan lengkap di 16d | `/belajar/{slug}/final-quiz`, `…/{materi}/quiz` Quiz materi |
| t8 | [8a](8a.md) | ✅ | /belajar desktop 1280px — Lanjutkan Belajar, statistik, Kursus Saya | `/belajar` Dashboard |
| t8 | [8b](8b.md) | ✅ | /belajar/nilai desktop 1280px — tabel nilai per kursus + Nilai Akhir 60/40 (PRG-04, PRG-05) | `/belajar/nilai` Nilai Saya |
| t8 | [8c](8c.md) | ✅ | /belajar/gizi-ibu-hamil-trimester-1 desktop 1280px — progress kursus + status tiap materi (PRG-10) | `/belajar/{slug}` progress kursus |
| t8 | [8e](8e.md) | ✅ | Mobile 360px — dashboard & Nilai Saya (bottom nav area belajar) | `/belajar/nilai` Nilai Saya, `/belajar` Dashboard |
| t8 | [8f](8f.md) | ✅ | Nilai Saya — state kosong desktop + mobile (belum ada quiz dikerjakan), pasangan 8b | `/belajar/nilai` Nilai Saya |
| t8 | [8t](8t.md) | ✅ | Area member tablet 768px (§8.7) — dashboard & Nilai Saya · aturan lengkap di 16d | `/belajar/nilai` Nilai Saya, `/belajar` Dashboard |
| t9 | [9c](9c.md) | ✅ | /profil desktop 1280px — satu halaman menggulir; menu kiri adalah daftar isi, bukan tab (data akun · keamanan · notifikasi · hak PDP) | `/profil` |
| t9 | [9d](9d.md) | ✅ | /profil mobile 360px — daftar pengaturan berkelompok (sama dengan bagian di 9c ); tiap baris membuka layar sendiri di 9e | `/profil` |
| t9 | [9e](9e.md) | ✅ | Layar rincian mobile 360px — ubah data akun · ubah password · sesi aktif · konfirmasi hapus akun (di mobile jadi layar terpisah, bukan in-pl | `/profil` |
| t9 | [9t](9t.md) | ✅ | Profil & pengaturan tablet 768px (§8.7) · aturan lengkap di 16d | `/profil` |
| t10 | [10a](10a.md) | ✅ | Peta alur — 5 zona + baris utilitas, kotak bisa diklik ke layarnya · diperbarui sampai turn 29 | 10a |
| t11 | [11a](11a.md) | ✅ | /cari desktop 1280px — interaktif: ketik untuk menyaring, filter tipe, hitungan hasil | `/cari` |
| t11 | [11b](11b.md) | ✅ | /cari mobile 360px — kolom pencarian penuh, filter bisa digulir (berbagi state dengan 11a ) | `/cari` |
| t11 | [11c](11c.md) | ✅ | State kosong 760px — bentuk final tanpa perlu mengetik apa pun | `/cari` |
| t11 | [11t](11t.md) | ✅ | /cari tablet 768px (§8.7) · aturan lengkap di 16d | `/cari` |
| t12 | [12c](12c.md) | ✅ | /kebijakan-privasi desktop 1280px — pola halaman legal: navigasi isi menempel, isi maksimal 72 karakter per baris | `/kebijakan-privasi` |
| t12 | [12d](12d.md) | ✅ | /syarat-ketentuan 860px — kolom isi (header & navigasi isi sama dengan 12c ) | `/syarat-ketentuan` |
| t12 | [12e](12e.md) | ✅ | /disclaimer 860px — batas layanan medis (§5.5), jalur darurat 119 ditonjolkan | `/disclaimer` |
| t12 | [12f](12f.md) | ✅ | Halaman legal mobile 360px — pola sama untuk ketiganya; navigasi isi jadi kartu di atas, bukan kolom menempel | `/disclaimer`, `/kebijakan-privasi`, `/syarat-ketentuan` |
| t12 | [12t](12t.md) | ✅ | Halaman legal tablet 768px (§8.7) — pola sama untuk ketiganya · aturan lengkap di 16d | `/disclaimer`, `/kebijakan-privasi`, `/syarat-ketentuan` |
| t13 | [13a](13a.md) | ✅ | Menu akun desktop 1280px — interaktif: klik avatar untuk buka/tutup (§7.1) | Menu akun (header) |
| t13 | [13b](13b.md) | ✅ | /belajar/kursus-saya desktop 1280px — tiga status, aksi berbeda per status | `/belajar/kursus-saya` |
| t13 | [13c](13c.md) | ✅ | Kursus Saya — state kosong (belum ikut kursus apa pun) | `/belajar/kursus-saya` |
| t13 | [13d](13d.md) | ✅ | Mobile 360px — menu akun (drawer) & Kursus Saya | Menu akun (header), `/belajar/kursus-saya` |
| t13 | [13t](13t.md) | ✅ | Kursus Saya tablet 768px (§8.7) · aturan lengkap di 16d | `/belajar/kursus-saya` |
| t14 | [14a](14a.md) | ✅ | 404 dan 500 desktop 560px — jalan keluar konkret, bukan sekadar “terjadi kesalahan” | 404 / 500, `/artikel/{kategori}/{slug}`, `/kursus/{slug}` |
| t14 | [14b](14b.md) | ✅ | 404 mobile 360px | 404 / 500 |
| t14 | [14t](14t.md) | ✅ | 404 tablet 768px (§8.7) — 500 memakai kerangka yang sama · aturan lengkap di 16d | 404 / 500 |
| t15 | [15a](15a.md) | ✅ | Tiga email — badan surat 566px di dalam kerangka klien 600px | Email transaksional |
| t15 | [15b](15b.md) | ✅ | Mobile 360px & state tautan kedaluwarsa | Email transaksional, `/lupa-password` |
| t16 | [16a](16a.md) | ✅ | Ulangi kursus — konfirmasi (desktop & sheet mobile) lalu kartu setelah reset | Kursus selesai + Ulangi |
| t16 | [16b](16b.md) | ✅ | Nilai Saya dengan riwayat siklus 1280px — badge Lulus (PRG-06) & nilai siklus lama tetap terlihat | `/belajar/nilai` Nilai Saya |
| t16 | [16c](16c.md) | ✅ | Sistem badge status (PRG-06 + siklus) — satu bentuk, dipakai di semua layar | 16c |
| t16 | [16d](16d.md) | ✅ | Aturan tablet 768px (§8.7) — layar tabletnya dipasang di turn masing-masing | 16d · 16e |
| t16 | [16e](16e.md) | ✅ | Satu layar di tiga lebar — katalog kursus 1280 · 768 · 360, disandingkan untuk membaca aturan turunannya | 16d · 16e, `/kursus` |
| t17 | [17a](17a.md) | ✅ | Token — warna, tipografi, spasi | 17a |
| t17 | [17b](17b.md) | ✅ | Komponen & lima state wajib | 17b |
| t17 | [17c](17c.md) | ✅ | Breakpoint & aturan grid | 17c |
| t17 | [17d](17d.md) | ✅ | Checklist state per layar & aksesibilitas | 17d |
| t18 | [18a](18a.md) | ⛔ | DITOLAK → 18d Ahli gizi punya akun & layar tinjau sendiri |  |
| t18 | [18b](18b.md) | ⛔ | DITOLAK → 18d Tinjau di luar sistem, admin mencatat hasilnya |  |
| t18 | [18c](18c.md) | ⛔ | DITOLAK → 18d Antrean tinjau di CMS, tombol tetap di admin |  |
| t18 | [18d](18d.md) | ✅ | Keputusan yang dipakai — ahli gizi menggarap seluruh konten, admin menyetujui & menerbitkan |  |
| t19 | [19a](19a.md) | ✅ | Ringkasan ahli gizi 1280px — sidebar tanpa blok penerbitan | `/cms` Ringkasan |
| t19 | [19b](19b.md) | ✅ | Ringkasan admin 1280px — sidebar penuh, antrean jadi kartu pertama · kini lengkap CMS-01: jumlah pengguna & enrollment terbaru | `/cms` Ringkasan |
| t19 | [19c](19c.md) | ✅ | Daftar konten 1280px — satu jenis per menu sidebar, filter status di halaman | Daftar konten |
| t19 | [19d](19d.md) | ✅ | Layar keputusan terbit 1280px — pratinjau + checklist validasi + tiga aksi | Keputusan terbit |
| t19 | [19e](19e.md) | ✅ | Tablet 768px (sidebar jadi rel ikon) & ponsel 360px (sidebar jadi drawer) | Daftar konten, `/cms` Ringkasan |
| t20 | [20a](20a.md) | ✅ | Editor artikel 1280px — toolbar ikon satu baris, kanvas tulis tanpa bingkai, metadata jadi daftar | Editor artikel |
| t20 | [20b](20b.md) | ✅ | Penolakan node video (CRS-05) — menolak sambil menawarkan jalan keluar | Editor artikel |
| t20 | [20c](20c.md) | ✅ | State penyimpanan — menyimpan · tersimpan · gagal · konflik versi | Editor artikel |
| t20 | [20d](20d.md) | ✅ | Kirim untuk persetujuan — validasi pra-kirim, tombol terkunci sampai lengkap | Editor artikel |
| t20 | [20e](20e.md) | ✅ | Editor tablet 768px — metadata jadi panel lipat; di ponsel editor tidak dibuka | Editor artikel |
| t21 | [21a](21a.md) | ✅ | Builder kursus 1280px — outline materi yang bisa diseret, syarat terbit per baris | Builder kursus |
| t21 | [21b](21b.md) | ✅ | Editor materi 1280px — video di atas, teks di bawah, quiz menempel di kaki | Editor materi |
| t21 | [21c](21c.md) | ✅ | Unggah video — siap · mengunggah · berhasil · ditolak >200MB dengan setelan ekspor | Editor materi |
| t21 | [21d](21d.md) | ✅ | Builder kursus tablet 768px | Builder kursus |
| t21 | [21e](21e.md) | ✅ | Daftar kursus 1280px — /cms/kursus, pintu masuk ke builder 21a ; kelengkapan terlihat per baris | `/cms/kursus` |
| t21 | [21f](21f.md) | ✅ | “+ Kursus baru” — dialog singkat 3 isian (CRS-01), bukan formulir panjang; normal & galat | `/cms/kursus` |
| t21 | [21g](21g.md) | ✅ | Setelah “Buat” — builder 21a dalam keadaan kosong: satu ajakan jelas, syarat terbit sebagai daftar tugas | `/cms/kursus` |
| t21 | [21h](21h.md) | ✅ | “+ Tambah materi” — dialog 2 isian: judul & posisi; isinya ditulis di editor, bukan di dialog | Editor materi |
| t21 | [21i](21i.md) | ✅ | Editor materi baru — keadaan kosong dari 21b : tiga bagian, masing-masing dengan ajakannya sendiri | Editor materi |
| t22 | [22a](22a.md) | ✅ | Editor quiz 1280px — daftar soal dengan status kunci & pembahasan, aturan di kanan | Editor quiz |
| t22 | [22b](22b.md) | ✅ | Editor satu soal — kunci ditandai langsung di opsinya, pembahasan wajib | Editor quiz |
| t22 | [22c](22c.md) | ✅ | Impor CSV — unggah, baris sah masuk, baris gagal dilaporkan & bisa diunduh ulang | Editor quiz |
| t22 | [22d](22d.md) | ✅ | Dua state penjaga — kurang dari 10 soal & menyunting quiz yang sudah dikerjakan | Editor quiz |
| t22 | [22e](22e.md) | ✅ | Editor quiz tablet 768px | Editor quiz |
| t22 | [22f](22f.md) | ✅ | Daftar quiz 1280px — kolom Jenis & Milik , tanpa tombol “Quiz baru” | Daftar quiz |
| t22 | [22g](22g.md) | ✅ | Beda Quiz materi vs Final Quiz — asal, jumlah soal, bobot nilai | Daftar quiz |
| t22 | [22h](22h.md) | ✅ | Editor quiz materi 1280px — dibuka dari “Sunting quiz” di editor materi; batas 5–10 soal, kembali ke materinya | Editor quiz |
| t23 | [23a](23a.md) | ✅ | /cms/kategori 1280px — tiga tab (artikel · kursus · tag), urutan diseret, panel sunting di kanan | `/cms/kategori` |
| t23 | [23b](23b.md) | ✅ | Hapus ditolak — sistem tidak bilang “gagal”, tapi menunjukkan isinya & jalan keluarnya | `/cms/kategori` |
| t23 | [23c](23c.md) | ✅ | Pindah massal (CMS-07) — pilih artikel, pilih tujuan, lihat perubahan alamat sebelum menyetujui | `/cms/kategori` |
| t23 | [23d](23d.md) | ✅ | Tab Tag — tag bebas dibuat penulis, admin yang merapikan (gabung & hapus) | `/cms/kategori` |
| t23 | [23t](23t.md) | ✅ | Kelola kategori tablet 768px — panel sunting jadi lembar penuh | `/cms/kategori` |
| t24 | [24a](24a.md) | ✅ | /cms/media 1280px — grid aset dengan jumlah pemakaian di setiap kartu, detail & daftar “dipakai di” di kanan | `/cms/media` |
| t24 | [24b](24b.md) | ✅ | Hapus aset — dua keadaan: ditolak karena masih dipakai, dan konfirmasi bila tidak dipakai | `/cms/media` |
| t24 | [24c](24c.md) | ✅ | Unggah — seret banyak file, progres per file, galat dijelaskan per file, teks alt diminta saat itu juga | `/cms/media` |
| t24 | [24d](24d.md) | ✅ | Pemilih media dari editor — dipanggil tombol “Gambar” di editor artikel/materi; hanya gambar, video diblok (CRS-05) | `/cms/media` |
| t24 | [24t](24t.md) | ✅ | Media tablet 768px — grid 3 kolom, detail jadi lembar bawah | `/cms/media` |
| t25 | [25a](25a.md) | ✅ | /cms/pengguna 1280px — cari, saring per peran & status; satu baris = siapa, peran, keaktifan | `/cms/pengguna` |
| t25 | [25b](25b.md) | ✅ | Detail pengguna 1280px — progress & nilai (CMS-09), akun & sesi, riwayat tindakan admin | `/cms/pengguna` |
| t25 | [25c](25c.md) | ✅ | Ubah peran — hanya Super admin (§3.2); menaikkan peran menampilkan konsekuensinya | `/cms/pengguna` |
| t25 | [25d](25d.md) | ✅ | Nonaktifkan — dialog dengan akibat yang jelas, dan yang dilihat pemilik akun saat mencoba masuk | `/cms/pengguna` |
| t25 | [25t](25t.md) | ✅ | Pengguna tablet 768px — baris jadi kartu, status & peran tetap terlihat | `/cms/pengguna` |
| t26 | [26a](26a.md) | ✅ | /cms/reset-attempt 1280px — antrean laporan gangguan dari user ( 7i ), diurutkan dari tenggat terdekat | `/cms/reset-attempt` |
| t26 | [26b](26b.md) | ✅ | Tinjau laporan 1280px — cerita user di samping catatan sistem; keputusan & alasan wajib di kanan | `/cms/reset-attempt` |
| t26 | [26c](26c.md) | ✅ | Reset tanpa laporan — mis. user mengeluh lewat WhatsApp/email: cari user → pilih attempt → alasan (CMS-10) | `/cms/reset-attempt` |
| t26 | [26t](26t.md) | ✅ | Antrean tablet 768px — laporan jadi kartu; tinjau membuka layar penuh bertumpuk (catatan sistem → keputusan) | `/cms/reset-attempt` |
| t27 | [27a](27a.md) | ✅ | /cms/pengaturan 1280px — hanya Super admin; hal yang boleh diganti tanpa deploy (system_settings) | `/cms/pengaturan` |
| t27 | [27b](27b.md) | ✅ | Tinjau & simpan — sebelum/sesudah ditampilkan, dampak bobot dijelaskan, alasan wajib | `/cms/pengaturan` |
| t27 | [27c](27c.md) | ✅ | /cms/audit-log 1280px — siapa · apa · kapan · sebelum → sesudah (CMS-12); hanya baca, tidak bisa dihapus | `/cms/audit-log` |
| t27 | [27t](27t.md) | ✅ | Audit log tablet 768px — entri jadi kartu, sebelum/sesudah bertumpuk | `/cms/audit-log` |
| t28 | [28a](28a.md) | ✅ | /belajar pengguna baru 1280px — belum ikut kursus apa pun; satu langkah jelas, bukan dashboard berisi nol | `/belajar` Dashboard |
| t28 | [28b](28b.md) | ✅ | Pengguna baru mobile 360px | `/belajar` Dashboard |
| t28 | [28c](28c.md) | ✅ | Quiz — auto-save gagal (§13.5, kritis): mencoba ulang → gagal → tersambung lagi. Timer tetap berjalan, jawaban ditahan di perangkat | `/belajar/{slug}/final-quiz`, `…/{materi}/quiz` Quiz materi |
| t28 | [28d](28d.md) | ✅ | Daftar memuat & gagal memuat — contoh katalog; pola sama untuk artikel, Kursus Saya, Nilai Saya | 28d, `/artikel`, `/belajar/kursus-saya`, `/kursus` |
| t28 | [28e](28e.md) | ✅ | Hasil filter kosong — katalog (SRC-02) & artikel (SRC-03); sebut penyebabnya, tawarkan pelonggaran satu klik | 28e, `/artikel`, `/kursus` |
| t28 | [28f](28f.md) | ✅ | Player — video memuat & video selesai (pelengkap “gagal dimuat” di 7d ) | `/belajar/{slug}/{materi}` Player |
| t28 | [28g](28g.md) | ✅ | Mobile 360px — auto-save gagal · filter kosong · video selesai | `/belajar/{slug}/{materi}` Player, `/kursus`, `…/{materi}/quiz` Quiz materi |
| t29 | [29a](29a.md) | ✅ | Diputar 1280px — resume dari posisi terakhir, menu kecepatan terbuka | `/belajar/{slug}/{materi}` Player |
| t29 | [29b](29b.md) | ✅ | Mobile 360px — kontrol besar ≥44px, kecepatan & subtitle jadi lembar bawah | `/belajar/{slug}/{materi}` Player |
