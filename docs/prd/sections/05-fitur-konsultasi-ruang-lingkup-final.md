> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 5. Fitur Konsultasi (ruang lingkup final)

### 5.1 Keputusan

Konsultasi adalah **section "Tanya Ahli Gizi" di Beranda** (bukan halaman terpisah) berisi ajakan menghubungi ahli gizi, dengan tombol WhatsApp yang langsung membuka percakapan ke nomor terdaftar. Item nav "Konsultasi" melakukan **scroll otomatis** ke section ini. **Tidak ada halaman `/konsultasi`, tidak ada formulir, tidak ada penyimpanan data, tidak ada modul CMS.**

Ini lebih sederhana dari opsi yang saya usulkan sebelumnya, dan menurut saya pilihan yang tepat untuk MVP. Tiga alasannya:

1. **Anda tidak membangun apa pun yang belum terbukti dibutuhkan.** Jika ternyata hanya 3 orang per bulan yang menghubungi, Anda tidak rugi waktu membangun sistem tiket.
2. **WhatsApp adalah kanal yang paling dikenal pengguna Indonesia.** Tidak ada friksi belajar antarmuka baru.
3. **Beban kepatuhan data turun drastis.** Karena keluhan kesehatan tidak pernah masuk ke database Anda, kewajiban UU PDP untuk kategori data ini praktis hilang — percakapan terjadi di WhatsApp, di luar sistem Anda.

Penghematan: **± 3 hari kerja** dibanding opsi formulir, dan satu tabel database serta satu modul CMS tidak perlu dibangun.

### 5.2 Yang Perlu Diperhatikan (dan cara menanganinya)

| Konsekuensi | Mitigasi |
|---|---|
| **Tidak ada catatan permintaan.** Anda tidak bisa tahu berapa banyak orang yang butuh konsultasi | Lacak klik tombol WhatsApp sebagai event analitik (KSL-06). Angka klik = ukuran permintaan, tanpa menyimpan data pribadi apa pun |
| **Nomor WhatsApp terekspos publik** → berpotensi spam | Gunakan **WhatsApp Business** dengan nomor khusus, bukan nomor pribadi ahli gizi. Jangan tulis nomornya sebagai teks di halaman — cukup tombol dengan tautan `wa.me` |
| **Percakapan tidak terhubung ke riwayat belajar user** | Pesan otomatis (`?text=`) dapat menyertakan konteks halaman asal, sehingga ahli gizi tahu dari mana user datang |
| **Tidak ada antrian atau SLA** | Cantumkan jam operasional & estimasi waktu balas di halaman, agar ekspektasi terkendali |
| **Ahli gizi menerima pesan tanpa penyaringan apa pun** | Pesan otomatis diawali template yang mengarahkan user menuliskan pertanyaan secara terstruktur |

### 5.3 Requirement

| ID | Requirement | Prio |
|---|---|---|
| KSL-01 | Section **"Tanya Ahli Gizi"** di Beranda dengan anchor `id="tanya-ahli-gizi"`, publik **tanpa perlu login**: penjelasan layanan, cakupan yang dilayani, apa yang **tidak** dilayani, jam operasional, estimasi waktu balas, biaya (gratis/berbayar). **Tidak ada halaman `/konsultasi` terpisah** | M |
| KSL-13 | Item nav "Konsultasi" (desktop & drawer mobile) menautkan ke `/#tanya-ahli-gizi`. Di Beranda: smooth scroll ke section (instan bila `prefers-reduced-motion`). Dari halaman lain: pindah ke Beranda lalu langsung ke section. Drawer mobile tertutup otomatis setelah diklik | M |
| KSL-14 | Section memakai `scroll-margin-top` setinggi header sticky, sehingga judul section tidak tertutup header setelah scroll | M |
| KSL-15 | Fokus keyboard dipindahkan ke judul section setelah scroll (aksesibilitas) | S |
| KSL-02 | **Profil ahli gizi** (ringkas, di dalam section): foto, nama, kredensial, nomor STR, pengalaman singkat. Profil lengkap tetap di Tentang Kami (ABT-02) | M |
| KSL-03 | **Tombol WhatsApp** dengan tautan `https://wa.me/62xxxxxxxxxx?text={pesan-template}`. Membuka aplikasi WhatsApp di HP, WhatsApp Web di desktop | M |
| KSL-04 | Pesan template otomatis, contoh: `Halo, saya {kosong} dan ingin bertanya seputar gizi. Saya menemukan halaman ini dari BINZI.` | M |
| KSL-05 | **Disclaimer medis menonjol** di atas tombol: layanan bersifat edukasi gizi, bukan diagnosis medis, bukan untuk kondisi darurat | M |
| KSL-06 | Event analitik `consultation_whatsapp_clicked` dengan properti status login. Ditambah event `consultation_nav_clicked` saat item nav "Konsultasi" diklik, dengan properti halaman asal — untuk membedakan user yang sengaja mencari konsultasi dari yang menemukannya saat menggulir Beranda | M |
| KSL-07 | **Jalur darurat**: teks jelas "Untuk kondisi darurat, segera hubungi 119 atau fasilitas kesehatan terdekat" | M |
| KSL-08 | Nomor WhatsApp disimpan di `system_settings` (bukan hardcode), agar dapat diganti tanpa deploy ulang | M |
| KSL-09 | Pertanyaan umum seputar konsultasi (apa yang bisa ditanyakan, berapa lama dibalas, apakah berbayar) digabung ke section **FAQ Beranda** (§7.3 no. 7), bukan FAQ terpisah | S |
| KSL-10 | Fallback email untuk pengguna tanpa WhatsApp | S |
| KSL-11 | Formulir + pencatatan permintaan di CMS | W (fase 2) |
| KSL-12 | Booking slot kalender + reminder | W (fase 2) |

### 5.4 Struktur Section "Tanya Ahli Gizi" di Beranda (`/#tanya-ahli-gizi`)

Karena kini berada di dalam Beranda, section ini harus **ringkas** — cukup untuk membangun kepercayaan dan menegaskan batasan, tanpa membuat Beranda terasa seperti dua halaman yang ditumpuk.

```
1. Judul + subjudul       "Tanya Ahli Gizi Kami"  ← target anchor
                          Satu kalimat menjelaskan apa yang bisa dibantu

2. Profil ahli gizi       Foto, nama, kredensial, nomor STR (ringkas)
                          → ini yang membangun kepercayaan, bukan tombolnya
                          → tautan "Kenali tim kami" ke /tentang

3. Apa yang bisa          3–4 contoh pertanyaan yang cocok
   ditanyakan             (mis. "Bagaimana menyusun menu seimbang untuk keluarga?")

4. Apa yang TIDAK         Daftar batasan yang tegas
   dilayani               (diagnosis, resep obat, interpretasi hasil lab,
                          kondisi darurat)

5. Jam operasional        Mis. Senin-Jumat 09.00-17.00 WIB, balas dalam 1x24 jam

6. DISCLAIMER             Kotak menonjol, berisi juga jalur darurat 119
   + JALUR DARURAT        → wajib berada SEBELUM tombol WhatsApp

7. [Tombol WhatsApp]      Besar (tinggi 60px, radius 10px), latar netral
                          terang `fill-soft`, teks `text`, ikon chat bergaris.
                          Hover: latar `primary` + teks putih.
                          BUKAN hijau WhatsApp (keputusan desain final, Q30)
```

**Tata letak responsif:** di HP (360px) semua elemen satu kolom berurutan seperti di atas. Mulai `lg` (≥1024px), profil ahli gizi dapat diletakkan di kolom kiri dan poin 3–7 di kolom kanan, agar tombol WhatsApp terlihat tanpa menggulir jauh setelah anchor dituju.

**Catatan mobile:** tombol WhatsApp **tidak** dibuat sticky — karena kini berada di Beranda, tombol sticky akan menutupi konten section lain (kursus, artikel) sepanjang halaman. Tombol cukup berada di dalam section; nav "Konsultasi" sudah mengantar user langsung ke sana.

**Integritas URL:** route `/konsultasi` tidak dibuat. Jika pernah dibagikan (mis. di materi promosi), tambahkan redirect 308 `/konsultasi` → `/#tanya-ahli-gizi` di `next.config` (S).

### 5.5 Peringatan Kepatuhan (tetap berlaku)

Meski Anda tidak menyimpan data apa pun, tanggung jawab atas **layanannya** tetap ada:

1. **Konsultasi gizi harus dilakukan oleh Nutrisionis/Dietisien bersertifikat dengan STR aktif.** Tampilkan kredensial dan nomor STR — ini kewajiban sekaligus pembangun kepercayaan.
2. **Jangan pernah memberikan diagnosis, resep obat, atau interpretasi hasil lab** — baik di halaman maupun di percakapan WhatsApp. Batasan ini harus tertulis eksplisit.
3. **Percakapan WhatsApp tetap berisi data kesehatan.** Meski di luar sistem Anda, ahli gizi tetap wajib menjaga kerahasiaannya. Buat panduan internal singkat: jangan bagikan tangkapan layar, jangan gunakan untuk pemasaran, hapus percakapan lama secara berkala.
4. **Sediakan jalur darurat** yang jelas (119).
5. **Tinjau halaman ini ke penasihat hukum sebelum rilis.**

> **Rekomendasi penamaan:** gunakan **"Tanya Ahli Gizi"** sebagai judul section, meski item navigasinya tetap tertulis "Konsultasi". Kata "konsultasi" memunculkan ekspektasi sesi klinis personal; "tanya" menempatkannya sebagai layanan edukatif. Perbedaan ini kecil di layar, tapi material dalam menurunkan paparan risiko Anda.
