# K-05 · Template spreadsheet soal (impor CSV)

| | |
|---|---|
| **Pemilik** | Kamu + tim konten / ahli gizi |
| **Kapan** | Minggu 2 |
| **Bergantung pada** | [K-01](K-01-putuskan-oq-01-dan-oq-02.md) |
| **Tag ClickUp** | `konten` |
| **Judul ClickUp** | `[Konten] K-05 Template spreadsheet soal (impor CSV)` |

## Tujuan
Soal ditulis di spreadsheet sejak awal agar bisa diimpor massal (QZ-15, R-02). Formatnya harus cocok dengan layar impor 22c dan aturan soal PRD Q40.

## Langkah
1. Buat spreadsheet dengan kolom persis layar 22c: `pertanyaan`, `tipe` (`pg` = pilihan ganda, `bs` = benar/salah), `opsi_a`, `opsi_b`, `opsi_c`, `opsi_d`, `kunci`, `pembahasan`.
2. Aturan pengisian (PRD Q40):
   - `pg`: **keempat** kolom opsi wajib terisi; `kunci` = `a`/`b`/`c`/`d`.
   - `bs`: kolom opsi dikosongkan; `kunci` = `benar`/`salah`.
   - `pembahasan` **wajib** terisi di setiap baris. Baris tanpa pembahasan akan ditolak saat impor.
3. Tambahkan kolom bantu yang **tidak** diimpor: kursus, materi, status tinjau, catatan reviewer.
4. Isi 3 soal contoh berlabel jelas "CONTOH" (bukan konten final), lalu minta reviewer mengecek format.
5. Simpan template di `docs/content/template-soal.csv` agar agent bisa membuat validator impor yang cocok di Sprint S3.

## Selesai jika
- [ ] Template disepakati penulis soal & reviewer, dan tersimpan di repo.

## Catatan
Beban terbesar proyek: ±240 soal ≈ 32 jam kerja murni (§13.2). Soal ambigu tidak bisa diperbaiki lewat pengulangan quiz — kualitas soal kritis.

> AI boleh membantu merapikan format dan bahasa, tetapi setiap klaim gizi ditulis atau diverifikasi ahli gizi (PRD §13.4).
