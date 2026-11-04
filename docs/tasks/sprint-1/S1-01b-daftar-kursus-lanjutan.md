# S1-01b · CMS: daftar kursus lanjutan — kartu tablet & ponsel, urutan, perapian S1-01

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | S1-01, S1-02b (kolom kuning daftar), demo 20 Nov selesai |
| **Target** | Setelah 20 Nov |
| **Branch** | `s1/s1-01b-daftar-lanjutan` |

> **Dibuat 4 Nov 2026** di Claude chat. Isinya bagian S1-01 yang ditunda demi demo 20 Nov (revisi kartu 3 Nov, keputusan pemilik 3 Nov no. 4) dan temuan kecil tinjauan PR #106 yang tidak memblokir merge. **Ini kartu cadangan, belum siap dikerjakan.** Kartu ini ditulis ulang terhadap kode `main` terbaru sebelum sesinya, dan bisa digabung dengan S1-02b bila keduanya kecil.

## Tujuan
Daftar `/cms/kursus` dan dialog 21f lengkap sesuai desain di semua lebar, plus beberapa perapian kode S1-01.

## Isi yang ditunda dari S1-01

### 1. Pola kartu 19e di bawah 1024
Sekarang daftar tetap tabel di semua lebar dan menggulir horizontal di dalam wadahnya (keputusan 3 Nov). Yang perlu dibuat:
- Di bawah 1024, setiap kursus menjadi kartu (19e): judul, "Level · penggarap", status, ringkasan materi dan Final Quiz, dan tautan "Buka".
- Catatan 19e: di 360 px CMS hanya untuk "baca + setujui/minta revisi". Putuskan bersama S1-02b apakah daftar di ponsel juga dibatasi.

### 2. Kontrol "Urut ▾" (21e)
Sekarang tampil sebagai teks tetap "Urut: Terakhir diubah". Pilihan urutannya tidak digambar desain, jadi pemilik perlu memutuskan:
- pilihan urutan apa saja yang disediakan (mis. judul, status), atau
- membiarkannya sebagai teks tetap dan meluruskan desainnya.

### 3. Dialog "Kursus baru" (21f)
- **Nama aksesibel tombol "Ubah"** di baris alamat kursus hanya "Ubah". Tambahkan konteks lewat teks `sr-only`, mis. "Ubah alamat kursus" (copy usulan).
- **Fokus setelah gagal.** `Button` dengan `loading` memasang atribut `disabled` native (`button.tsx`), sehingga fokus keyboard terlepas selama request. Setelah respons 5xx atau galat jaringan, fokus dikembalikan ke tombol kirim — pola yang dipakai panel pengaturan S1-02.

### 4. Perapian kode
- **Satu daftar kolom.** Kolom `CourseDetailRow` ditulis dua kali dan identik: di `findCourseById` dan di `.returning()` milik `createCourseWithFinalQuiz` (`src/modules/course/queries.ts`). Jadikan satu konstanta, supaya keduanya tidak bisa berbeda diam-diam.
- **Tes rollback 23505.** Hitungan `audit_logs` di tes itu selalu lulus, karena insert audit berada setelah insert kursus dan tidak pernah tercapai. Bukti rollback yang bermakna hanya hitungan `quizzes`. Luruskan komentar tesnya, atau ganti dengan asersi yang bermakna.

## Uji mutasi (usulan)
1. Daftar kartu tampil di ≥ 1024, atau tabel tampil di < 1024 → tes tata letak A-19b merah.
2. `sr-only` pada tombol "Ubah" dihapus → tes nama aksesibel merah.
3. Fokus tidak dikembalikan setelah 5xx → tes komponen merah.
