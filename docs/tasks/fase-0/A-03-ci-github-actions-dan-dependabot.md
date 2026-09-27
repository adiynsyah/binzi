# A-03 · CI GitHub Actions & Dependabot

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-01](A-01-scaffold-proyek-next-js-16.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `foundation`, `ci` |
| **Judul ClickUp** | `[F0][Agent] A-03 CI GitHub Actions & Dependabot` |

## Tujuan
Setiap PR otomatis diperiksa, sehingga kesalahan agent tertangkap sebelum sampai ke kamu.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/12-keamanan.md` (§12.5)
- `docs/prd/sections/13-4-model-eksekusi-dengan-ai.md` (ritme kerja)

## Kerjakan
- Workflow `ci.yml` pada `pull_request` dan push ke `main`: `npm ci` → typecheck → lint → test → build → `npm audit --audit-level=high`.
- Cache npm. Env untuk build diisi nilai dummy aman (bukan secret asli), cukup agar validasi env lolos.
- `.github/dependabot.yml` untuk npm dan github-actions, mingguan.
- Nama job stabil supaya bisa dijadikan *required check* di branch protection.
- **File tipe yang di-generate Next.js** (`next-env.d.ts`, `.next/types`) di-ignore dan tidak ada di CI sebelum dibuat. Pastikan langkah typecheck tidak bergantung pada file yang belum ada: buat tipe Next lebih dulu dengan perintah resmi Next.js untuk versi terpasang (cek dokumentasinya), atau jalankan typecheck setelah build. **Jangan** meng-commit `next-env.d.ts` dan jangan mengubah `.gitignore` untuk mengakalinya.

## Bukan lingkup tugas ini
- Job E2E — ditambahkan di A-19.

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `.github/workflows/ci.yml`
- `.github/dependabot.yml`

## Selesai jika
- [ ] CI hijau di PR ini.
- [ ] Job gagal bila typecheck, lint, atau test gagal (buktikan dengan satu commit rusak sementara, lalu revert).
- [ ] Simulasi clone bersih lolos: hapus `next-env.d.ts`, `.next/`, dan `node_modules/`, lalu jalankan langkah CI persis dengan urutan yang sama → semua lulus. Tulis hasilnya di ringkasan PR.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- Lihat tab Actions di GitHub.

## Verifikasi oleh kamu (sebelum merge)
- [ ] Tandai job CI sebagai *required status check* di branch protection (H-01).

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
