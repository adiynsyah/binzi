> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 13. Roadmap

### 13.4 Model Eksekusi dengan AI

#### Pembagian kerja

| Kategori | Aman diserahkan ke AI | Wajib diverifikasi manusia |
|---|---|---|
| **Sangat cocok** | Komponen UI, form, halaman CRUD, layout responsive, skema Drizzle, migrasi, seed data, tes E2E, boilerplate API, penulisan tipe, refactor | Verifikasi visual di 360/768/1280px |
| **Cocok dengan pengawasan** | Logika progress, perhitungan nilai, upload R2, integrasi Better Auth, editor TipTap | Uji manual alur ujung-ke-ujung |
| **Berisiko tinggi** | Serialisasi respons quiz, pemeriksaan RBAC, kepemilikan data (IDOR), timer server, presigned URL, sanitasi konten, rate limit | **Wajib — checklist §12.6** |
| **Jangan serahkan ke AI** | Isi materi gizi & kesehatan, teks artikel, soal & pembahasan quiz, klaim medis | Ditulis manusia, diverifikasi ahli gizi |

#### ⚠️ Konten kesehatan tidak boleh dihasilkan AI tanpa verifikasi

Ini pengecualian terpenting. AI dapat menghasilkan klaim gizi yang terdengar meyakinkan tetapi salah, ketinggalan zaman, atau tidak berlaku untuk konteks Indonesia. Untuk topik kesehatan, kesalahan semacam ini membawa risiko reputasi dan hukum yang nyata (R-06), dan Google secara eksplisit menilai kredibilitas sumber pada kategori konten ini.

Aturannya: AI boleh membantu menyusun kerangka, merapikan bahasa, dan memformat — tetapi **setiap klaim faktual harus berasal dari atau diverifikasi oleh ahli gizi**, dengan sumber rujukan tercatat. `articles.reviewer_id` yang wajib terisi sebelum publish adalah penegakan teknis dari aturan ini.

#### Urutan pengerjaan yang cocok untuk AI

Urutan ini meminimalkan pengulangan kerja, karena setiap tahap menjadi kontrak yang dipatuhi tahap berikutnya:

```
1. Design tokens & komponen dasar   → kunci warna, tipografi, spacing, komponen
                                       shadcn. Semua layar disusun dari sini,
                                       bukan diciptakan ulang tiap kali.
2. Skema Drizzle lengkap            → jadi sumber kebenaran tipe untuk semua kode
3. Skema Zod + fungsi serialisasi   → tentukan eksplisit field apa yang boleh keluar
4. Auth & RBAC + policy per modul   → dibangun sebelum fitur, bukan ditambal sesudah
5. Fitur, satu modul per sesi       → CMS dulu (butuh data untuk menguji sisi user)
6. Tes E2E untuk alur kritis        → quiz, akses materi, login
```

**Kenapa desain didahulukan:** ini penyebab inkonsistensi nomor satu pada UI buatan AI. Tanpa token dan komponen yang dikunci di awal, setiap sesi akan menghasilkan tombol, spacing, dan warna yang sedikit berbeda — dan pada layar ke-20, aplikasinya terlihat seperti dibuat lima orang berbeda. Kunci token dulu, lalu larang AI membuat komponen baru bila komponen yang ada sudah cukup.

**Kenapa skema didahulukan:** skema Drizzle memberi AI konteks tipe yang konsisten lintas sesi. Tanpa itu, AI akan mengarang nama field yang berbeda-beda di tiap file.

#### File konteks repositori

Buat satu file di root repositori (`CLAUDE.md` atau `AGENTS.md`) berisi aturan yang harus dipatuhi AI di **setiap** sesi. Tanpa ini, konteks hilang setiap kali sesi baru dimulai dan konsistensi ikut hilang. Isi minimalnya:

```
- Stack & versi: Next.js 16.3 App Router, TypeScript strict, Drizzle, Tailwind v4, shadcn/ui
- Struktur folder wajib (§10.2) — modul tidak boleh saling impor queries.ts
- Design tokens: daftar warna, skala tipografi, spacing yang boleh dipakai
- Aturan keamanan: SELALU serialisasi eksplisit, JANGAN kembalikan objek DB mentah,
  SELALU cek kepemilikan di query, SELALU validasi input dengan Zod
- Aturan quiz: is_correct tidak pernah dikirim sebelum submit; timer dihitung server
- Bahasa UI: Indonesia. Bahasa kode & komentar: Inggris.
- Mobile-first: tulis gaya dasar untuk 360px, tambahkan dengan min-width
```

#### Ritme kerja yang disarankan

| Praktik | Alasan |
|---|---|
| Satu modul per sesi, jangan lintas modul | Menjaga konteks tetap fokus dan keluaran tetap konsisten |
| Commit kecil dan sering, satu fitur satu commit | Memudahkan menemukan penyebab saat ada yang rusak |
| Minta AI menulis tes bersamaan dengan fiturnya | Tes menjadi jaring pengaman untuk perubahan berikutnya |
| Jalankan `tsc --noEmit` dan lint sebelum menerima kode | Menangkap sebagian besar kesalahan integrasi secara otomatis |
| Sebelum mulai sesi, tunjukkan kode terkait yang sudah ada | Mencegah AI membuat versi kedua dari sesuatu yang sudah ada |
| Jangan minta fitur besar sekaligus | Semakin besar permintaan, semakin besar peluang AI mengarang detail |

#### Dampak pada jadwal

Penulisan kode akan lebih cepat, tetapi **verifikasi menjadi jalur kritis baru** dan produksi konten sama sekali tidak terbantu.

| Aktivitas | Konvensional | Dengan AI |
|---|---|---|
| Fase 0 — fondasi | 2 minggu | ~1 minggu |
| Fase 1 — kode fitur | 9 minggu | ~6 minggu |
| Verifikasi & perbaikan | (bagian dari sprint) | **+2 minggu** — jangan dihilangkan |
| Produksi konten (240 soal, 18 video, 6 artikel) | 10 minggu | **10 minggu — tidak berubah** |
| **Total realistis** | ~12 minggu | **~10–11 minggu**, dibatasi produksi konten |

Kesimpulannya: **konten, bukan kode, yang menentukan tanggal rilis Anda.** Mulai produksi konten di minggu pertama.
