> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 6. Requirement Fungsional

Prioritas: **[M]** Must (MVP) · **[S]** Should · **[C]** Could · **[W]** Won't (fase berikutnya).

### 6.8 Pencarian & Notifikasi

| ID | Requirement | Prio |
|---|---|---|
| SRC-01 | Pencarian global (kursus + artikel) dengan PostgreSQL full-text search | M |
| SRC-02 | Filter katalog kursus: level, durasi | M |
| SRC-03 | Filter artikel: kategori, tag, terbaru/populer | M |
| NTF-01 | Email transaksional: verifikasi, reset password, selamat datang | M |
| NTF-03 | Email pengingat belajar (tidak aktif 7 hari) | W (fase 2, Q34) |
| NTF-04 | Notifikasi in-app | W (fase 2, Q34) |
