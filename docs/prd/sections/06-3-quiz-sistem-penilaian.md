> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 6. Requirement Fungsional

Prioritas: **[M]** Must (MVP) · **[S]** Should · **[C]** Could · **[W]** Won't (fase berikutnya).

### 6.3 Quiz & Sistem Penilaian

Model final: **satu quiz, satu kesempatan, nilai tercatat sekali.** Quiz wajib dikerjakan agar materi ditandai selesai, tetapi tidak wajib lulus.

| ID | Requirement | Prio |
|---|---|---|
| QZ-01 | Quiz: judul, instruksi, `duration_minutes` (1–180), `passing_score_percent` (default 70 — hanya penentu label Lulus/Belum Lulus), **`max_attempts` = 1 (dikunci untuk quiz materi)**, `shuffle_questions`, `shuffle_options`, `explanation_policy` (default **`ALWAYS`**) | M |
| QZ-02 | Validasi saat **publish**: soal ≥ `system.quiz.min_questions` (default **10**). Maksimum bebas. Draft boleh kurang dari 10 | M |
| QZ-03 | Tipe soal MVP: pilihan ganda satu jawaban & benar/salah | M |
| QZ-04 | Soal: teks, gambar opsional, bobot poin (default 1), **pembahasan wajib**. Pilihan ganda: **tepat 4 opsi (a–d)**, tepat 1 benar. Benar/salah: 2 opsi tetap (Benar, Salah), tepat 1 benar. (v1.3, Q40) | M |
| QZ-05 | **Mode ujian**: timer dihitung server dari `started_at`; sisa waktu tampil; auto-submit saat habis; menutup tab tidak menghentikan timer | M |
| QZ-06 | Navigator soal: pindah antar soal, tandai ragu-ragu, ringkasan sebelum submit | M |
| QZ-07 | Kunci jawaban **tidak pernah** dikirim ke klien sebelum submit | M |
| QZ-08 | Satu attempt aktif per user per quiz; refresh melanjutkan attempt yang sama | M |
| QZ-09 | Auto-save jawaban setiap perubahan — **kritis**, karena tidak ada kesempatan kedua | M |
| QZ-10 | Hasil setelah submit: skor, persentase, jumlah benar/salah, waktu pengerjaan, status **LULUS / BELUM LULUS**, dan **pembahasan lengkap seluruh soal** — ditampilkan apa pun nilainya | M |
| QZ-11 | **Hanya 1 kali pengerjaan.** Setelah submit, quiz terkunci permanen. Tombol berubah menjadi "Lihat Hasil & Pembahasan" | M |
| QZ-12 | **Nilai resmi = nilai dari satu-satunya percobaan.** Tidak ada nilai tertinggi, tidak ada rata-rata percobaan | M |
| QZ-13 | Final Quiz: terbuka setelah semua materi selesai. Juga **1 kali pengerjaan**. Kelulusannya menentukan badge "Lulus" pada kursus | M |
| QZ-14 | Question bank + ambil acak N dari M soal — mengurangi penyebaran soal antar user | C (fase 2) |
| QZ-15 | Bulk import soal (CSV/XLSX) dengan template & validasi | **M** |
| QZ-16 | Analitik butir soal + peringatan bila pass rate < 40% (indikasi soal salah kalibrasi) | S |
| QZ-17 | Deteksi perpindahan tab (dicatat, tidak memblokir) | C |
| QZ-18 | **Layar konfirmasi wajib sebelum memulai quiz** — lihat §6.3.2 | **M** |
| QZ-19 | **CMS: admin dapat mereset attempt seorang user** (jalur pemulihan) — lihat §6.3.3 | **M** |
| QZ-20 | Setelah dikerjakan, hasil & pembahasan dapat dibuka kembali kapan pun dari "Nilai Saya" | M |
| QZ-21 | Quiz yang belum dikerjakan dapat ditunda; user boleh kembali lain waktu tanpa memulai timer | M |

### 6.3.1 Mengapa Model Ini Bersih

Keputusan ini menyelesaikan sekaligus dua masalah yang saling bertentangan di versi-versi sebelumnya:

| Masalah | Bagaimana terselesaikan |
|---|---|
| **Farming nilai** (mengulang sampai 100%) | Tidak ada pengulangan. Tidak ada yang bisa di-*farming*. Nilai otomatis kredibel |
| **Drop-off karena tersangkut quiz** | Tidak ada gerbang kelulusan. Tidak ada user yang bisa terjebak |
| **Pembahasan bocor jadi kunci jawaban** | Tidak relevan — tidak ada percobaan berikutnya. Pembahasan bisa ditampilkan penuh, selalu |
| **Beban question bank 2× soal** | Tidak dibutuhkan. Beban tetap ~240 soal |
| **Cooldown, batas percobaan, kebijakan pembahasan bersyarat** | Semua kompleksitas ini hilang. Logikanya jadi satu jalur lurus |

Efek sampingnya positif untuk implementasi: mesin quiz menjadi jauh lebih sederhana. Tidak ada state percobaan ke-n, tidak ada perhitungan nilai tertinggi, tidak ada countdown cooldown, tidak ada percabangan tampilan pembahasan.

### 6.3.2 ⚠️ Konsekuensi Terpenting: Satu Kesempatan Berarti Tidak Ada Pengaman

Ini satu-satunya risiko serius dari model ini, dan harus ditangani sejak awal.

Kalau koneksi user putus, baterainya habis, atau dia tidak sengaja membuka quiz lalu meninggalkannya sampai waktu habis, **nilainya terkunci permanen** — mungkin 0 — tanpa cara apa pun untuk memperbaikinya sendiri. Pada model pengulangan tak terbatas, masalah teknis hanyalah gangguan kecil. Di sini, masalah teknis menjadi kerusakan permanen.

Tiga pengaman wajib:

**1. Layar konfirmasi sebelum memulai (QZ-18).** Bukan sekadar tombol "Mulai". Layar terpisah berisi:
```
┌──────────────────────────────────────────────┐
│  Quiz: Dasar Gizi Seimbang                    │
│                                               │
│  • 10 soal                                    │
│  • Waktu 15 menit                             │
│  • ⚠ Hanya dapat dikerjakan SATU KALI         │
│  • Timer berjalan terus meski halaman ditutup │
│  • Nilai akan tercatat permanen               │
│                                               │
│  Pastikan koneksi stabil dan Anda siap.       │
│                                               │
│  [ Nanti Saja ]        [ Mulai Sekarang ]     │
└──────────────────────────────────────────────┘
```
Peringatan bahwa timer terus berjalan adalah bagian terpenting — inilah yang paling sering mengejutkan user.

**2. Auto-save yang andal (QZ-09).** Setiap perubahan jawaban langsung disimpan ke server dengan retry otomatis. Jika koneksi terputus di menit ke-12, 11 menit jawaban yang sudah diisi tetap dinilai. Indikator status penyimpanan harus terlihat user.

**3. Reset attempt oleh admin (QZ-19).** Ini bukan fitur opsional — ini satu-satunya jalan pemulihan yang tersisa. Di CMS, admin dapat mencari user, melihat attempt-nya, dan meresetnya dengan alasan tercatat di audit log. Sediakan juga tautan "Ada kendala teknis? Hubungi kami" di halaman hasil, agar user tahu jalur ini ada.

> Tanpa QZ-19, setiap gangguan teknis akan berakhir menjadi user yang meninggalkan platform tanpa pernah memberi tahu Anda.

### 6.3.3 Interaksi dengan "Ulangi Kursus" (CRS-12)

User boleh mengulang kursus yang sudah selesai. Ini menciptakan pertanyaan: apakah mengulang kursus memberi kesempatan quiz baru?

**Rekomendasi: ya.** Mereset kursus berarti mengulang seluruh materi dari awal — friksinya jauh lebih besar daripada sekadar menekan "ulangi quiz", jadi ini bukan celah farming yang praktis. Justru ini menjadi jalur pemulihan mandiri yang wajar bagi user yang merasa nilainya tidak mencerminkan pemahamannya.

**Aturan pencatatan nilai:**
```
Nilai utama yang ditampilkan  = nilai dari SIKLUS TERAKHIR
Riwayat siklus sebelumnya     = tetap tersimpan & dapat dilihat
Label                          = "Siklus ke-2" dst. bila reset_count > 0
```

> Jika Anda ingin menutup celah ini sepenuhnya, alternatifnya adalah menjadikan nilai siklus pertama sebagai nilai resmi permanen. Menurut saya tidak perlu — tanpa sertifikat, tidak ada yang cukup berharga untuk diperjuangkan lewat mengulang seluruh kursus.

### 6.3.4 Yang Perlu Dipantau

Karena nilai kini hanya berasal dari satu percobaan, kualitas soal jadi jauh lebih menentukan. Soal yang ambigu langsung merusak nilai seseorang secara permanen.

| Sinyal | Ambang | Tindakan |
|---|---|---|
| Pass rate sebuah quiz | < 40% | Soal terlalu sulit atau materinya kurang jelas — tinjau bersama ahli gizi |
| Sebuah butir soal dijawab salah oleh | > 70% user | Kemungkinan besar soalnya ambigu atau kuncinya keliru — periksa |
| User membuka quiz tapi tidak menyelesaikan | > 15% | Layar konfirmasi mungkin terlalu menakutkan, atau durasi terlalu pendek |
| Permintaan reset attempt | > 5% dari attempt | Ada masalah teknis sistemik, bukan sekadar kasus individual |

Kalibrasi ulang soal setelah 4 minggu data pertama. Perbaikan soal **tidak** mengubah nilai yang sudah tercatat — jika sebuah soal terbukti keliru, gunakan reset attempt untuk user yang terdampak.
