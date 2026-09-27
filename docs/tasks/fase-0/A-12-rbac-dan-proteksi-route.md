# A-12 · RBAC & proteksi route

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | [A-09](A-09-better-auth-inti-email-password-sesi-rate-limit.md) |
| **Tag ClickUp** | `fase-0`, `agent`, `auth`, `security` |
| **Judul ClickUp** | `[F0][Agent] A-12 RBAC & proteksi route` |

## Tujuan
Hak akses ditegakkan di server, bukan hanya dengan menyembunyikan tombol (§12.1, V-04).

## Baca dulu (hanya ini)
- `CLAUDE.md`
- `docs/prd/sections/03-persona-role.md` (§3.2)
- `docs/prd/sections/12-keamanan.md` (§12.1, V-04)
- `docs/prd/sections/07-navigasi-information-architecture.md` (§7.2 sitemap)

## Kerjakan
- Helper server: `requireUser()`, `requireRole(...)`, dan matriks izin berdasarkan §3.2 (GUEST, MEMBER, EDITOR, ADMIN, SUPER_ADMIN).
- `proxy.ts` (Next.js 16) hanya untuk pengecekan cepat dan redirect: `(learn)` butuh login, `(cms)` butuh EDITOR+. **Pengecekan otoritatif tetap di server** (layout, page, route handler, server action).
- Respons: belum login → redirect ke `/masuk?next=…`; login tapi role kurang → 403 (halaman & API), bukan halaman kosong.
- Skrip CLI `npm run user:role -- <email> <ROLE>` untuk menjadikan akunmu SUPER_ADMIN (hanya dijalankan manual, tidak ada endpoint web).
- Tes untuk setiap kombinasi role × area.

## Bukan lingkup tugas ini
- Menu CMS per role (A-15).
- Policy per modul fitur (dibuat per sprint).

Jika pekerjaan menuntut menyentuh hal di luar lingkup, **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/proxy.ts`
- `src/lib/rbac.ts`
- `src/modules/user/policy.ts`
- `scripts/set-role.ts`

## Selesai jika
- [ ] Tes matriks role × area lulus.
- [ ] Endpoint `/api/cms/*` contoh mengembalikan 403 untuk MEMBER.
- [ ] Definisi selesai di `CLAUDE.md` terpenuhi (untuk tugas yang menghasilkan layar).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Verifikasi oleh kamu (sebelum merge)
- [ ] **V-04:** login sebagai MEMBER, buka `/cms` dan panggil endpoint CMS dengan curl → 403.
- [ ] Jalankan `npm run user:role -- email-kamu SUPER_ADMIN`.

## Catatan
- Kategori **berisiko tinggi**: cantumkan V-04 di ringkasan PR.

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
