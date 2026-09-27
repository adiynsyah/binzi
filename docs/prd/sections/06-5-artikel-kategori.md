> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 6. Requirement Fungsional

Prioritas: **[M]** Must (MVP) · **[S]** Should · **[C]** Could · **[W]** Won't (fase berikutnya).

### 6.5 Artikel & Kategori

| ID | Requirement | Prio |
|---|---|---|
| ART-01 | Artikel: judul, slug, ringkasan, cover, konten kaya, penulis, **reviewer ahli gizi + tanggal review**, waktu baca otomatis, status | M |
| ART-02 | Artikel wajib memiliki **tepat satu** kategori (`category_id` NOT NULL) | M |
| ART-03 | Tag many-to-many untuk discovery silang | S |
| ART-04 | URL `/artikel/{slug-kategori}/{slug-artikel}` — akses tanpa login | M |
| ART-05 | Listing per kategori, terbaru, populer; paginasi | M |
| ART-06 | "Artikel Terkait" + **CTA ke kursus terkait** di akhir artikel | M |
| ART-07 | SEO: meta title/description, canonical, Open Graph, JSON-LD `Article`, sitemap otomatis | M |
| ART-08 | Badge "Ditinjau oleh {nama ahli gizi}, {tanggal}" tampil di artikel | M |
| ART-09 | Berbagi ke WhatsApp / X / Facebook / salin tautan | S |
| ART-10 | Bookmark artikel | C |
| ART-11 | Komentar | W |

**Integritas:** menghapus kategori yang masih punya artikel **ditolak**; sediakan aksi pindah massal.
