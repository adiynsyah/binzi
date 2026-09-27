# Tugas BINZI

> **Bingung mulai dari mana? Buka [`URUTAN-KERJA.md`](URUTAN-KERJA.md)** — satu daftar lurus dari langkah 1 sampai selesai, dengan keterangan siapa yang mengerjakan (👤 kamu, 🤖 agent, 📝 konten).

Satu berkas = satu tugas = satu task di ClickUp. **Status dilacak di ClickUp**, bukan di berkas ini; berkas ini adalah spesifikasinya. Jangan menyalin isi kartu ke ClickUp — cukup judul dan tautan ke berkasnya.

| Folder | Isi |
|---|---|
| [`URUTAN-KERJA.md`](URUTAN-KERJA.md) | **Mulai di sini** — urutan langkah 1–30 + jalur konten |
| [`fase-0/`](fase-0/INDEX.md) | Kartu Fase 0: H = 👤 kamu (11), A = 🤖 agent (19) |
| [`konten/`](konten/INDEX.md) | K = 📝 jalur konten minggu 1–2 (paralel, bukan untuk agent) |
| [`_TEMPLATE-agent.md`](_TEMPLATE-agent.md) | Template untuk menulis kartu sprint berikutnya |
| `clickup-import-fase-0.csv` | Semua tugas di atas dalam format CSV, bila ingin memakai fitur impor CSV ClickUp alih-alih mengetik manual |

## Cara menjalankan satu tugas agent

1. Pastikan semua tugas di kolom **Bergantung pada** sudah selesai.
2. Buat branch: `f0/<id>-<nama-singkat>` (mis. `f0/a-09-better-auth`).
3. Buka sesi agent **baru**, lalu kirim prompt pembuka di bawah.
4. Tinjau PR dengan bagian **Verifikasi oleh kamu** di kartu. CI harus hijau.
5. Merge, lalu tandai selesai di ClickUp.

### Prompt pembuka sesi

```text
Kerjakan tugas docs/tasks/fase-0/<BERKAS>.md.
Baca CLAUDE.md, lalu HANYA berkas di bagian "Baca dulu" pada kartu itu.
Sebelum menulis kode: ringkas rencanamu dalam 5–10 poin, sebutkan berkas yang
akan diubah, dan tanyakan jika ada yang ambigu. Tunggu persetujuanku.
Jangan kerjakan apa pun di luar bagian "Kerjakan".
```

### Format ringkasan PR (wajib di akhir sesi)

```text
## Yang dikerjakan
## Keputusan & asumsi (termasuk yang perlu kamu setujui)
## Item checklist §12.6 yang relevan (untuk tugas berisiko tinggi)
## Hasil verifikasi otomatis (typecheck, lint, test, build, ...)
## Cara memverifikasi manual
## Belum selesai / di luar lingkup yang ditemukan
```

## Environment variables

Dipakai A-02 untuk `src/config/env.ts` dan `.env.example`. **Nilainya diisi kamu (H-10)**, tidak pernah ditulis agent.

| Variabel | Sumber | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | — | `http://localhost:3000` di lokal |
| `DATABASE_URL` | H-02 | Transaction pooler (6543), dipakai aplikasi |
| `MIGRATION_DATABASE_URL` | H-02 | Session pooler (5432), dipakai `drizzle-kit` |
| `BETTER_AUTH_SECRET` | H-10 | Acak, ≥ 32 byte |
| `BETTER_AUTH_URL` | — | Sama dengan `NEXT_PUBLIC_APP_URL` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | H-06 | |
| `MAIL_TRANSPORT` | — | `log` (dev) atau `resend` |
| `RESEND_API_KEY` / `MAIL_FROM` | H-07 | Wajib bila `MAIL_TRANSPORT=resend` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | H-05 | Kunci uji di dev & CI |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | H-04 | |
| `NEXT_PUBLIC_SENTRY_DSN` | H-09 | |
| `SENTRY_AUTH_TOKEN` | H-09 | Hanya di CI/Vercel |
| `CRON_SECRET` | H-10 | Acak; juga disimpan di GitHub Secrets |

## Menulis kartu untuk sprint berikutnya

Setelah Fase 0 (dan evaluasi di A-13), susun kartu Sprint S1 memakai `_TEMPLATE-agent.md`. Sumbernya: tabel fase di `docs/design/handoff/README.md` (layar per sprint) dan `docs/prd/INDEX.md` (bagian PRD per sprint). Aturan ukuran: satu kartu = satu sesi = satu PR yang bisa kamu tinjau dalam ±30 menit.
