> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 3. Persona & Role

### 3.1 Persona

**P1 — Rina, 29 th, karyawan kantoran (utama).** Menemukan artikel dari Google di HP. Koneksi 4G, kuota terbatas. Butuh halaman ringan dan bisa dilanjutkan nanti.

**P2 — Dimas, 22 th, mahasiswa gizi.** Belajar di laptop, sesi panjang. Peduli pada nilai quiz dan akurasi materi.

**P3 — Sari, 45 th, ibu rumah tangga.** Awam teknologi. Login pakai Google karena tidak mau mengingat password. Tertarik pada fitur Konsultasi.

**P4 — Admin Konten.** Non-developer. Menyusun kursus, unggah video pendek, tulis materi, buat 10 soal per materi.

**P5 — Ahli Gizi (Reviewer/Konsultan).** Memverifikasi akurasi konten dan menerima pertanyaan pengguna langsung lewat WhatsApp.

### 3.2 Role & Hak Akses

| Role | Akses |
|---|---|
| `GUEST` | Beranda, katalog kursus (outline terkunci), materi preview gratis, semua artikel, section Tanya Ahli Gizi di Beranda, Tentang Kami |
| `MEMBER` | + konsumsi materi, quiz, progress, Nilai Saya, profil |
| `EDITOR` | + CMS dalam status Draft, submit for review. Dipakai oleh **ahli gizi** yang menggarap konten (alur 18d) |
| `ADMIN` | + menyetujui & publish/unpublish, kelola kategori artikel, kelola user, reset attempt quiz |
| `SUPER_ADMIN` | + kelola role, pengaturan sistem, audit log |

> Rekomendasi: pisahkan `EDITOR` dan `ADMIN`. Untuk MVP Anda cukup membuat 1 akun ADMIN dan 1 akun EDITOR (untuk ahli gizi). Biayanya nol sekarang, mahal kalau ditambahkan belakangan.
