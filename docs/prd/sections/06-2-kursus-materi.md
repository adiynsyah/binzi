> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 6. Requirement Fungsional

Prioritas: **[M]** Must (MVP) · **[S]** Should · **[C]** Could · **[W]** Won't (fase berikutnya).

### 6.2 Kursus & Materi

| ID | Requirement | Prio |
|---|---|---|
| CRS-01 | Kursus: judul, slug, ringkasan, deskripsi kaya, thumbnail, level, estimasi durasi, status, tanggal publish. **Kursus tidak memiliki kategori** (K-14) | M |
| CRS-02 | Kursus berisi ≥1 materi berurutan (`order_index`). Tabel `sections` disiapkan di skema, UI disembunyikan di MVP | M |
| CRS-03 | Materi: **1 video (opsional, 3–5 menit, ≥720p)** + **konten teks kaya (wajib)** | M |
| CRS-04 | Editor teks mendukung: paragraf, H2–H4, bold/italic/underline, list, blockquote, tabel, link, callout, **gambar (alt text + caption)**, pemisah | M |
| CRS-05 | Editor teks **tidak boleh** menyisipkan video atau iframe apa pun — divalidasi di editor **dan** di server | M |
| CRS-06 | Setiap materi memiliki tepat 1 quiz | M |
| CRS-07 | Setiap kursus memiliki tepat 1 Final Quiz, terbuka setelah semua materi selesai | M |
| CRS-08 | `is_sequential` per kursus (default true) — materi berikutnya terbuka setelah quiz materi sebelumnya **DIKERJAKAN** (lulus atau tidak) | M |
| CRS-09 | Materi pertama dapat ditandai `is_free_preview` — dapat diakses tanpa login | M |
| CRS-10 | Player video: HTML5 native, kontrol kecepatan, fullscreen, resume posisi terakhir, pelacakan progress tiap 10 detik, pilihan subtitle jika tersedia | M |
| CRS-11 | Enrollment gratis sebelum akses materi non-preview | M |
| CRS-12 | **Ulangi kursus**: user yang sudah selesai dapat me-reset progress; riwayat nilai lama tetap tersimpan dan tetap terlihat di Nilai Saya | M |
| CRS-13 | Lampiran materi yang dapat diunduh (PDF) | C |
| CRS-14 | Catatan pribadi per materi | C |

**Definisi "Materi Selesai":**
```
(video_watched_percent >= 90 ATAU lesson.video_id IS NULL)
DAN quiz sudah dikerjakan (1 kali)   ← LULUS ATAU TIDAK, keduanya sah
```
> Quiz **wajib dikerjakan**, tetapi **tidak wajib lulus**. Inilah yang memastikan
> setiap user punya data nilai, tanpa ada satu pun user yang tersangkut.

**Definisi "Kursus Selesai" & "Kursus Lulus":**
```
SELESAI  = SEMUA materi berstatus COMPLETED
           DAN Final Quiz sudah dikerjakan

LULUS    = SELESAI DAN final_quiz.is_passed = true
           → badge "Lulus" tampil di Nilai Saya
           → Nilai Akhir dihitung (§6.4)
           → TIDAK ada sertifikat di MVP
```
> "Lulus" murni sebuah label pencapaian — tidak mengunci atau membuka apa pun.
