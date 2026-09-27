# Dokumentasi BINZI

| Folder | Isi | Dibaca oleh |
|---|---|---|
| `STATUS.md` | Posisi pekerjaan saat ini, pekerjaan kecil yang terbuka, dan prompt untuk melanjutkan di chat baru | Kamu (dan Claude di chat baru) |
| `prd/` | PRD v1.3 utuh + dipecah per bagian (`prd/INDEX.md`) | Anda & AI agent (per bagian) |
| `design/handoff/` | README, TOKENS, COMPONENTS, SCREENS | AI agent di setiap tugas UI |
| `design/screens/` | 147 layar: `<ID>.png` · `<ID>.md` · `<ID>.html` (`screens/INDEX.md`) | AI agent, per layar |
| `design/OPEN-ISSUES.md` | Hal desain yang belum diputuskan | Anda |
| `design/source/` | Kanvas Claude Design asli — buka di browser | Anda (bukan AI agent) |
| `tasks/` | Kartu tugas: `fase-0/` (H = kamu, A = agent), `konten/`, template, CSV untuk ClickUp | Kamu (semua) · agent (hanya kartu A yang diminta) |

Aturan untuk AI agent ada di `/CLAUDE.md`.

## Memperbarui dokumen
- **Perubahan perilaku/lingkup** → ubah PRD, naikkan versi, perbarui riwayat revisi, lalu pecah ulang `prd/sections/`.
- **Perubahan tampilan** → ekspor ulang dari Claude Design, lalu buat ulang `design/screens/` dengan cara yang sama (screenshot + ringkasan per ID).
- Jangan mengedit `prd/sections/` secara manual — itu turunan dari `PRD-v1.3.md`.
