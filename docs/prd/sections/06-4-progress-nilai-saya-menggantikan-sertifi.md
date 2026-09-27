> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 6. Requirement Fungsional

Prioritas: **[M]** Must (MVP) · **[S]** Should · **[C]** Could · **[W]** Won't (fase berikutnya).

### 6.4 Progress & Nilai Saya (menggantikan Sertifikat)

| ID | Requirement | Prio |
|---|---|---|
| PRG-01 | Progress materi: `NOT_STARTED` / `IN_PROGRESS` / `COMPLETED`, persen video, posisi terakhir (detik), status quiz | M |
| PRG-02 | Progress kursus: persen selesai, waktu belajar total, terakhir diakses | M |
| PRG-03 | Widget "Lanjutkan Belajar" di dashboard → materi terakhir yang belum selesai | M |
| PRG-04 | **Halaman "Nilai Saya"**: tabel per kursus berisi nilai tiap quiz materi, nilai Final Quiz, **Nilai Akhir kursus**, status Lulus/Belum Lulus, tanggal pengerjaan, dan tautan ke pembahasan | M |
| PRG-05 | Perhitungan **Nilai Akhir Kursus** = **(rata-rata nilai seluruh quiz materi × 60%) + (nilai Final Quiz × 40%)** | M |
| PRG-06 | Badge status kursus: Belum Mulai / Sedang Berjalan / Selesai / **Lulus** | M |
| PRG-10 | Pada daftar materi, tampilkan status per materi: Terkunci / Sedang Dipelajari / **Quiz Belum Dikerjakan** / Selesai, beserta nilainya bila sudah ada | M |
| PRG-07 | Halaman detail progress per kursus dengan daftar materi & status masing-masing | M |
| PRG-08 | Ekspor Nilai Saya ke PDF sederhana (transkrip nilai — bukan sertifikat) | C |
| PRG-09 | Sertifikat | W (fase 2) |

> Bobot 60/40 pada PRG-05 adalah usulan saya dan dapat diubah lewat `system_settings` tanpa perubahan kode.
