> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 2. Decision Log

| # | Pertanyaan | Keputusan | Konsekuensi teknis |
|---|---|---|---|
| Q1 | Kursus berbayar? | **Nanti, tidak sekarang** | `enrollments.access_type` tetap dimodelkan; tidak ada integrasi pembayaran di MVP |
| Q2 | Sertifikat di MVP? | **Tidak** | Tabel `certificates`, job PDF, dan halaman verifikasi dihapus dari MVP. Digantikan halaman **Nilai Saya** |
| Q3 | Konten saat rilis | **3 kursus, 6 kategori, 6 artikel (1 per kategori)** | Lihat risiko R-01 |
| Q4 | Durasi & kualitas video | **3–5 menit, minimal 720p** | Tidak perlu transcoding; MP4 langsung dari R2 sudah memadai — ini yang membuat stack gratis jadi mungkin |
| Q5 | Aplikasi mobile 12 bulan? | **Belum** | Server Actions boleh dipakai bebas; tidak perlu disiplin REST API penuh. Struktur modular tetap dijaga |
| Q6 | Verifikator akurasi konten | **Ahli gizi** | Field `reviewer_id` + `reviewed_at` wajib sebelum publish |
| Q7 | Ulang kursus setelah selesai? | **Boleh** | Progress dapat di-reset; riwayat attempt & nilai lama **tetap disimpan** |
| Q8 | Quiz wajib lulus? | **Tidak wajib lulus, tetapi hanya boleh dikerjakan 1 kali.** Materi berikutnya terbuka setelah quiz dikerjakan, apa pun nilainya | Quiz murni menjadi *alat ukur*. Satu percobaan membuat nilai kredibel tanpa gerbang. Lihat §6.3 |
| Q9 | Bahasa Inggris? | **Belum** | Bahasa Indonesia saja; string tetap dipisah ke file agar siap |
| Q10 | Akun dihapus tapi punya sertifikat | **Tidak relevan** (tidak ada sertifikat) | Penghapusan akun cukup anonimkan data + hapus progress |
| Q26 | Bagaimana model pengerjaan? | **Desain UI/UX di Claude Design, kode dengan AI**, diarahkan & diverifikasi 1 orang | Peran Designer/Engineer/QA ditiadakan; verifikasi manusia jadi jalur kritis. Keputusan UX utama sudah dikunci di dokumen ini agar AI cukup mengeksekusi (§13.4, §13.5) |
| Q27 | Apakah kursus perlu kategori? | **Tidak.** Kategori hanya dibutuhkan untuk artikel | Tabel `course_categories` dan `courses.category_id` dihapus; filter kategori di katalog kursus dan CRUD kategori kursus di CMS ditiadakan. Dengan 3 kursus saat rilis, kategori kursus tidak menambah nilai navigasi |
| Q11 | Apa isi fitur Konsultasi? | **Ajakan menghubungi ahli gizi + tombol WhatsApp yang langsung membuka chat ke nomor terdaftar** | Tidak ada tabel database, tidak ada formulir, tidak ada modul CMS. Hemat ~3 hari kerja. Lihat §5 |
| Q28 | Apakah Konsultasi perlu halaman sendiri? | **Tidak.** Cukup section "Tanya Ahli Gizi" di Beranda; klik nav "Konsultasi" melakukan scroll otomatis ke section tersebut | Route `/konsultasi` dihapus; satu layar publik berkurang. Seluruh requirement KSL dipenuhi di dalam section Beranda (§5.4) |
| Q29 | Nama produk? | **BINZI** | Seluruh copy, template pesan WhatsApp (KSL-04), email, dan metadata SEO memakai BINZI |
| Q30 | Warna tombol WhatsApp? | **Netral terang, bukan hijau WhatsApp** (keputusan pemilik produk, desain 1a/1d) | Latar `fill-soft`, teks `text`, hover `primary` + teks putih, tinggi 60px, radius 10px, ikon chat bergaris (§5.4) |
| Q31 | Lebar uji desktop? | **1280px**; Beranda & Masuk juga 1440px | Desain final digambar di 1280; lebar isi maks 1200px (§1) |
| Q32 | Alur tinjau konten? | **Opsi 18d**: ahli gizi (EDITOR) menggarap konten di CMS; ADMIN menyetujui & menerbitkan | Opsi 18a–18c ditolak. Selaras dengan CMS-05 (§3.2) |
| Q33 | Visual hero Beranda? | **Ilustrasi animasi (desain 6a, dipasang seperti 6b)**, bukan kartu preview video. Copy hero tetap dari 1a (Q37) | Hormati `prefers-reduced-motion`; ilustrasi diekspor sebagai aset/komponen tersendiri, warnanya bukan token (§7.3) |
| Q34 | Fitur Should/Could CMS & notifikasi di MVP? | **Tidak.** CMS-13, CMS-14, CMS-15, NTF-03, NTF-04 pindah ke fase 2 | Menu "Terjadwal" di sidebar CMS disembunyikan; `/cms/analitik` tidak dibuat (§6.7, §6.8, §7.2) |
| Q35 | Navigasi responsif? | Hamburger + drawer di **< 640px**; menu teks mulai 640px; bottom nav area belajar di **< 768px** | Mengikuti token breakpoint desain (§7.1) |
| Q36 | Versi Next.js? | **Next.js 16.3.x** (Active LTS) | Dipilih karena berstatus Active LTS, didukung adapter Cloudflare (menjaga opsi OQ-12), dan menyediakan dokumentasi yang cocok dengan versi terpasang untuk coding agent. Konsekuensi untuk AI: pola Next.js 15 (mis. `middleware.ts`) tidak dipakai — aturan versi ada di `CLAUDE.md` |
| Q37 | Judul hero Beranda (1a vs 6b)? | **Pakai hero 1a** — judul, subjudul, CTA, dan baris peninjau dari 1a; visualnya ilustrasi 6a | Teks di layar 6b hanya contoh pemasangan ilustrasi, bukan copy final (§7.3) |
| Q38 | DNS & perlindungan edge? | **Vercel DNS + Vercel Firewall.** Cloudflare hanya dipakai untuk R2 dan Turnstile | Vercel tidak merekomendasikan reverse proxy (termasuk proxy Cloudflare) di depan deployment Vercel karena firewall kehilangan visibilitas trafik dan IP asli pengguna. R2 diakses lewat presigned URL sehingga tidak butuh domain di Cloudflare. Jika OQ-12 memilih Cloudflare Workers, DNS dipindah ke Cloudflare saat itu (bisa tanpa downtime) |
| Q39 | BINZI dipakai untuk penelitian ahli gizi — apa dampaknya ke produk? | **Tidak ada fitur tambahan.** Tanpa persetujuan komisi etik/informed consent khusus; pendaftaran **terbuka untuk umum**; **tidak ada** kebutuhan ekspor data untuk analisis; data **tidak dianonimkan** dan **disimpan selama akun aktif** | Alur daftar, skema, dan CMS tetap seperti rencana. Hak pengguna menghapus akun (AUTH-09, UU PDP) tetap berlaku — lihat §8.4 |
| Q40 | Aturan soal quiz (D-06)? | **Pilihan ganda: tepat 4 opsi (a–d), tepat 1 benar. Benar/salah: 2 opsi tetap. Pembahasan wajib untuk setiap soal** | Menggantikan QZ-04 v1.2 (2–6 opsi, pembahasan opsional). Selaras dengan kolom impor CSV di desain 22c (`opsi_a`…`opsi_d`); teks aturan "2–5 opsi" di layar 22c tidak berlaku. Pembahasan wajib konsisten dengan K-05 (pembahasan selalu ditampilkan) |
