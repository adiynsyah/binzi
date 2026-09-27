> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 14. Acceptance Criteria

### 14.1 Responsive (baru, sesuai penekanan Anda)
- **Ketika** halaman mana pun dibuka pada lebar 360px, **maka** tidak ada scroll horizontal, tidak ada teks terpotong, dan semua tombol dapat disentuh dengan nyaman (≥44px).
- **Ketika** halaman player materi dibuka di 1280px, **maka** daftar materi tampil sebagai kolom samping sticky **di kanan** (desain 7d) dan video tidak melebihi lebar maksimum yang nyaman dibaca.
- **Ketika** perangkat diputar dari portrait ke landscape saat video sedang diputar, **maka** posisi pemutaran tidak ter-reset.

### 14.2 Autentikasi
- **Diberikan** pengunjung belum login, **ketika** klik "Masuk dengan Google" dan menyetujui, **maka** akun dibuat dengan role `MEMBER` dan diarahkan **kembali ke halaman asal**, bukan ke beranda.
- **Diberikan** email Google sama dengan akun email/password terverifikasi, **ketika** login dengan Google, **maka** akun ditautkan, bukan diduplikasi.
- **Diberikan** 5 kali gagal login, **ketika** mencoba lagi, **maka** ditolak dengan pesan yang tidak mengungkap apakah email terdaftar.

### 14.3 Materi & Video
- **Diberikan** pengunjung belum login, **ketika** membuka detail kursus, **maka** seluruh outline materi terlihat dengan ikon gembok, dan materi preview dapat diputar penuh.
- **Diberikan** kursus `is_sequential`, materi 1 belum selesai, **ketika** user mengakses URL materi 2 langsung, **maka** server menolak (403) dan mengarahkan ke materi 1.
- **Diberikan** user menonton sampai 91% lalu menutup browser, **ketika** kembali, **maka** video melanjutkan dari posisi terakhir.
- **Diberikan** admin mengunggah file 250 MB, **ketika** upload dimulai, **maka** ditolak dengan pesan berisi panduan kompresi (§10.3).

### 14.4 Quiz & Nilai
- **Diberikan** quiz `duration_minutes = 15`, **ketika** attempt dimulai, **maka** `expires_at` = waktu server + 15 menit dan tidak dapat diubah dari klien.
- **Ketika** user menekan "Kerjakan Quiz", **maka** muncul layar konfirmasi yang menyebut jumlah soal, durasi, peringatan satu kesempatan, dan peringatan bahwa timer terus berjalan; **timer belum dimulai** sampai user menekan "Mulai Sekarang".
- **Diberikan** user menekan "Nanti Saja", **maka** tidak ada attempt yang dibuat dan quiz tetap dapat dikerjakan lain waktu.
- **Diberikan** attempt berjalan, **ketika** user menutup browser dan kembali 5 menit kemudian, **maka** attempt yang sama dilanjutkan dengan sisa waktu berkurang 5 menit dan seluruh jawaban yang sudah diisi masih ada.
- **Diberikan** koneksi terputus di menit ke-12, **maka** jawaban yang tersimpan sebelum putus tetap dinilai saat auto-submit.
- **Diberikan** waktu habis, **maka** server menilai jawaban tersimpan dan menandai attempt `EXPIRED` — jawaban tidak hilang.
- **Ketika** memeriksa response API soal quiz sebelum submit, **maka** tidak ada field `is_correct` maupun `explanation`.
- **Diberikan** user submit dengan nilai 40 (di bawah 70), **maka** ditampilkan status BELUM LULUS **beserta pembahasan lengkap semua soal**, materi ditandai SELESAI, dan materi berikutnya terbuka.
- **Diberikan** quiz sudah disubmit, **ketika** user membuka halaman quiz lagi, **maka** yang tampil adalah hasil & pembahasan, bukan soal — dan tombolnya berbunyi "Lihat Hasil & Pembahasan".
- **Diberikan** quiz sudah disubmit, **ketika** klien memaksa membuat attempt baru lewat API, **maka** server menolak dengan 409.
- **Diberikan** admin mereset attempt seorang user dengan alasan, **maka** user dapat mengerjakan quiz itu sekali lagi dan aksi reset tercatat di audit log.
- **Diberikan** semua materi selesai dan Final Quiz sudah dikerjakan, **maka** status kursus SELESAI; badge "Lulus" muncul hanya bila Final Quiz lulus.
- **Diberikan** quiz dengan 9 soal, **ketika** admin mencoba publish, **maka** ditolak dengan pesan yang menyebut minimum 10.

### 14.5 Ulangi Kursus
- **Diberikan** kursus berstatus SELESAI, **ketika** user menekan "Ulangi Kursus" dan mengonfirmasi, **maka** progress materi di-reset, `reset_count` bertambah 1, **seluruh quiz dapat dikerjakan kembali sekali lagi**, dan **riwayat nilai siklus sebelumnya tetap terlihat** di Nilai Saya dengan label siklus.

### 14.6 Artikel
- **Diberikan** artikel `PUBLISHED`, **ketika** diakses tanpa login, **maka** konten tampil penuh, dirender di server, dan lolos validasi structured data Google.
- **Ketika** admin mencoba menghapus kategori berisi artikel, **maka** ditolak dengan opsi memindahkan artikel.
- **Ketika** admin mem-publish artikel tanpa reviewer ahli gizi, **maka** ditolak.

### 14.7 Konsultasi (section Beranda)
- **Ketika** pengunjung yang belum login mengklik nav "Konsultasi" dari halaman mana pun, **maka** diarahkan ke Beranda dan langsung berada di section "Tanya Ahli Gizi" tanpa diminta login.
- **Ketika** nav "Konsultasi" diklik saat sudah di Beranda, **maka** halaman scroll halus ke section (instan bila `prefers-reduced-motion` aktif), dan judul section tidak tertutup header sticky.
- **Ketika** nav "Konsultasi" diklik dari drawer mobile, **maka** drawer tertutup dan halaman scroll ke section.
- **Ketika** URL `/#tanya-ahli-gizi` dibuka langsung (mis. dari tautan yang dibagikan), **maka** halaman terbuka tepat di section tersebut.
- **Ketika** tombol WhatsApp ditekan di HP, **maka** aplikasi WhatsApp terbuka dengan nomor tujuan benar dan pesan template sudah terisi; **ketika** ditekan di desktop, **maka** WhatsApp Web terbuka dengan hasil yang sama.
- **Ketika** nav "Konsultasi" diklik, **maka** event `consultation_nav_clicked` terkirim beserta halaman asal; **ketika** tombol WhatsApp ditekan, **maka** event `consultation_whatsapp_clicked` terkirim.
- **Ketika** section ditampilkan, **maka** disclaimer medis dan jalur darurat (119) berada sebelum tombol WhatsApp dalam urutan baca.
- **Ketika** admin mengubah nomor WhatsApp di pengaturan sistem, **maka** tautan berubah tanpa perlu deploy ulang.
- **Ketika** section dibuka di 360px, **maka** seluruh isi tampil satu kolom tanpa scroll horizontal dan tombol WhatsApp berukuran ≥ 44px.

### 14.8 CMS
- **Ketika** admin menyisipkan URL video ke editor teks materi, **maka** editor menolak; dan jika payload dipaksa lewat API, server juga menolak.
- **Diberikan** admin sedang mengedit materi, **ketika** koneksi terputus 30 detik, **maka** perubahan tidak hilang (auto-save + indikator status).

### 14.9 Gerbang Rilis
- [ ] Lighthouse mobile ≥ 90 (Performance), ≥ 95 (Accessibility, SEO) pada beranda, artikel, detail kursus
- [ ] Diuji manual pada 360px, 768px, 1280px (+1440px untuk Beranda & Masuk) + perangkat Android & iOS nyata
- [ ] **Checklist review desain per layar (§13.5) dijalankan untuk seluruh ~30 layar**
- [ ] Alur kritis tercakup tes E2E dan hijau
- [ ] **Checklist verifikasi keamanan §12.6 (V-01 s/d V-10) dijalankan seluruhnya dan lolos**
- [ ] Seluruh konten kesehatan sudah ditandatangani ahli gizi (`reviewer_id` terisi)
- [ ] Backup harian berjalan **dan restore sudah diuji minimal sekali**
- [ ] Sentry, uptime monitor, dan GitHub Actions cron aktif
- [ ] Kebijakan Privasi, S&K, Disclaimer Medis, section Tanya Ahli Gizi di Beranda ditinjau (idealnya oleh penasihat hukum)
- [ ] **Data dummy sudah diganti data asli:** nomor STR ahli gizi (tampil di Beranda, Tentang Kami, artikel) dan nomor WhatsApp di `system_settings` (OQ-08, OQ-09)
- [ ] Nomor WhatsApp diuji dari HP Android & iOS serta dari desktop; scroll nav "Konsultasi" diuji dari Beranda, halaman lain, dan drawer mobile
- [ ] 3 kursus + 6 artikel terbit, seluruhnya sudah direview ahli gizi
- [ ] Admin dilatih & dokumentasi CMS + panduan kompresi video tersedia
- [ ] Prosedur rollback terdokumentasi
