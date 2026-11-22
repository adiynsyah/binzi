# S5-05 · Profil dasar `/profil`: ubah nama, ubah password, keluar dari semua perangkat

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | **A-09/A-10** (Better Auth, `binzi-guard`, tabel `rate_limits`), **A-12** (RBAC: `/profil` MEMBER+, matcher proxy), **A-13** (`PasswordField`, form reset, `auth-errors.ts`), **A-14b** (menu akun "Profil & pengaturan" sudah menaut ke `/profil`), **S5-01** (pola route API `progress`). Semua sudah di `main`. **Tidak bergantung pada A5 (S6-02).** Satu berkas yang disentuh keduanya: `e2e/layout/axe.spec.ts` (A5 menambah langkah di tes yang ada, A6 menambah tes baru di akhir `describe`) |
| **Target** | A6 rencana UAT internal 11 Des (STATUS 19 Nov). Perkiraan ±2 hari |
| **Branch** | `s5/s5-05-profil-dasar` |

> **Dibuat 22 Nov 2026** di Claude chat terhadap `main` `f43e2f0` (#151). Fakta kode yang dirujuk ada di "Catatan tinjauan 22 Nov" di akhir kartu.
>
> **Keputusan teknis kartu** (usulan Claude chat, disetujui bersama kartu):
>
> 1. **Tanpa migrasi, tanpa dependensi baru, tanpa token warna baru, CSP tidak berubah.** Satu route API baru: `PATCH /api/user/profile`.
> 2. **Satu halaman menggulir di semua lebar.** Ini menyimpang dari 9d/9e: di < 768 desain memakai daftar baris yang masing-masing membuka layar rincian. Field dan copy layar rincian 9e tetap dipakai, tetapi di dalam bagian halaman. Alasannya:
>    - A6 hanya punya tiga aksi;
>    - layar rincian butuh sub-rute (`/profil/…`), padahal matcher proxy hanya `/profil` dan matriks RBAC memakai `match: "exact"`. Cara lainnya adalah keadaan tampilan di klien;
>    - satu halaman menggulir juga aturan 9t ("bukan tab yang mengganti konten").
> 3. **Tanpa daftar isi (9c) dan pil (9t).** Halaman hanya punya dua bagian. Keduanya ditambahkan saat B4 menambah bagian ketiga.
> 4. **Ubah nama lewat modul `user`, bukan lewat `/update-user` Better Auth.**
>    - `PATCH /api/user/profile` menerima body persis `{ name }`. Id user diambil dari sesi, tidak pernah dari body.
>    - Batas nama disamakan dengan pendaftaran, yaitu **128**. Sekarang `updateProfileInput` membatasi 100, sedangkan `signUpSchema` 128. Akibatnya akun dengan nama 101–128 karakter tidak bisa menyimpan profilnya.
> 5. **`/update-user` Better Auth dimatikan** (`disabledPaths`). Endpoint ini sekarang terbuka untuk setiap sesi: body `z.record(z.any())`, nama tanpa batas panjang, dan `image` bebas diisi URL apa pun. Aplikasi tidak memakainya.
> 6. **Ubah password lewat `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`** (AUTH-06, AUTH-09; copy 9e "Setelah password diganti, sesi di perangkat lain otomatis keluar."). Better Auth menghapus semua sesi user, membuat sesi baru, dan memasang cookie baru. Sesi baru lewat `databaseHooks.session.create.before`, jadi staf tetap mendapat 8 jam (AUTH-07).
> 7. **Kebijakan password huruf + angka ditegakkan di server untuk `/change-password` dan `/reset-password`.** Sekarang hook hanya memeriksa `/sign-up/email`; Better Auth sendiri hanya memeriksa panjang. Celah `/reset-password` sama dan ditutup di sini juga. Pola dan kode galatnya sama dengan sign-up (`PASSWORD_POLICY`).
> 8. **Rate limit `/change-password`: 5 percobaan / 15 menit / user** (tabel `rate_limits`, `reserveAttempt`). Ini tambahan di luar tabel PRD §12.4: sesi yang dicuri tidak boleh dipakai untuk menebak password saat ini tanpa batas.
>    - Urutan di before-hook: baca sesi → cek kebijakan → pesan slot.
>    - Tanpa sesi, hook tidak memesan apa pun; endpoint sendiri menjawab 401.
>    - Setiap percobaan yang lolos cek kebijakan dihitung, termasuk yang berhasil. Bucket **tidak** dibersihkan saat sukses (lebih sederhana dari login; ganti password jarang dilakukan).
>    - 429 memakai copy `login_locked` yang sudah ada.
> 9. **"Keluar dari semua perangkat"** = `authClient.revokeSessions()` (semua sesi, termasuk perangkat ini) → `authClient.signOut()` (hanya untuk membersihkan cookie; galatnya diabaikan) → `/masuk`.
>    - Tanpa dialog konfirmasi: desain tidak menggambarnya dan tidak ada data yang hilang.
>    - Daftar perangkat per sesi dan "Keluarkan perangkat ini" (9e) tidak dibangun. Baris "Sesi aktif" hanya menampilkan "{n} perangkat".
> 10. **Akun tanpa password** (masuk dengan Google saja): form ubah password tidak dirender. Baris "Password" berisi teks dan tautan ke `/lupa-password`; `resetPassword` Better Auth membuat akun credential bila belum ada. Baris "Akun Google tertaut" hanya informasi, tanpa "Lepas tautan".
> 11. **Field "Password baru" memakai `PasswordField`** (pil syarat 3a, sama dengan `/daftar` dan reset), bukan meter "Kuat" 9e. Meter itu butuh rumus kekuatan yang tidak ada di PRD. Kalimat bantu 9e ("Minimal 8 karakter, memuat huruf dan angka. Hindari tanggal lahir.") tidak ditampilkan; pil sudah memuat syarat yang sama.
> 12. **Avatar hanya inisial.** `users.image` (foto Google) tidak ditampilkan, jadi `img-src` CSP tidak berubah. "Ganti foto" tidak dibangun.
> 13. **Email read-only**, dengan baris "Email terverifikasi" (9d). Kalimat 9c "perubahan email butuh verifikasi ulang" tidak dipakai karena ubah email tidak ada.
> 14. **Tanpa `loading.tsx` di `(learn)/profil/`**: `redirect()` dari `requireRole` di bawah `loading.tsx` menjadi 200 + meta refresh (komentar `src/lib/learn-route-structure.test.ts`).

## Tujuan
Peserta (dan staf) membuka "Profil & pengaturan" dari menu akun, mengganti nama tampilan, mengganti password, dan mengeluarkan semua perangkat. Mengganti password mengeluarkan perangkat lain; perangkat yang dipakai tetap masuk. Ini menutup AUTH-06 ("logout semua perangkat") dan bagian nama + password AUTH-09 untuk UAT. Sekaligus, dua celah di jalur auth ditutup: kebijakan password yang bisa dilewati lewat `/change-password` dan `/reset-password`, serta `/update-user` yang terbuka.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD: `docs/prd/sections/06-1-autentikasi-akun.md` (AUTH-01, AUTH-06, AUTH-07, AUTH-08, AUTH-09); `12-keamanan.md` (§12.4 — dibaca untuk keputusan 8).
- Desain:
  - `docs/design/screens/9c.md` + `.png` (buka `9c.html` untuk ukuran): bagian "Data akun" dan "Keamanan";
  - `9e.md` + `.png`: panel "Ubah data akun" dan "Ubah password" (field dan copy);
  - `9d.png` dan `9t.png` hanya untuk keputusan 2–3.
- Kode:
  - `src/modules/README.md`; `src/modules/user/{schema,policy,queries,serializer,service}.ts` + `schema.test.ts`, `serializer.test.ts`;
  - `src/modules/auth/better-auth.ts` (`binziGuardPlugin`, `readBodyField`, `emailAndPassword`, `session`, `databaseHooks`) + `better-auth.integration.test.ts` (harness `auth.handler(Request)`, tes rate limit dan sesi staf);
  - `src/modules/auth/schema.ts` (`passwordSchema`, `signUpSchema`); `src/lib/ratelimit.ts` (`reserveAttempt`, pola kunci);
  - `src/app/api/progress/courses/[courseId]/enroll/route.ts` (pola route), `src/lib/request-body.ts`, `src/lib/rbac.ts` (`requireRole`, `requireApiRole`);
  - `src/app/(learn)/layout.tsx`, `src/app/(learn)/belajar/nilai/page.tsx`, `src/lib/learn-route-structure.test.ts`;
  - `src/components/shared/auth/{auth-client,auth-errors,reset-password-form}.tsx|ts`, `src/components/shared/use-sign-out.ts`;
  - `src/components/ui/{password-field,field,input,button,banner,avatar}.tsx`; `src/components/learn/my-grades.tsx` (kelas eyebrow, ukuran h1); `src/components/learn/start-course-button.tsx` (copy 401); `src/lib/datetime.ts` (`formatWibDate`).
- Better Auth 1.7.7 di `node_modules/better-auth/dist/api/routes/`: `update-user.mjs` (`updateUser`, `changePassword`), `password.mjs` (`resetPassword`), `session.mjs` (`revokeSessions`), `sign-out.mjs`.
- E2E: `e2e/fixtures.ts` (`createRoleAccount`, `signInViaApi`, `randomPassword`, `newCollectedContext`), `e2e/layout/helpers.ts` (`expectNoHorizontalScroll`, `expectTouchTarget`, `maybeScreenshot`, `waitStableForMeasure`, `openAccountDropdown`), `e2e/layout/axe.spec.ts`, `e2e/lockout.spec.ts` (pola dua konteks), `e2e/README.md`.

## Kerjakan

### 1. Modul `user`
**Schema** (`schema.ts`):
- Satu field nama bersama: `trim`, min 1 "Nama wajib diisi", max **128** "Nama maksimal 128 karakter" (copy pendaftaran). `updateProfileInput.name` memakainya; harapan 100 di `schema.test.ts` disesuaikan.
- `updateNameInput = z.strictObject({ name })` baru: kontrak body route dan form klien. Kunci lain (`userId`, `phone`, `role`, `email`, `image`) ditolak.

**Queries** (`queries.ts`):
- Ubah nama: pakai ulang `updateUserProfile(userId, { name })` (sudah memfilter `notDeleted`; `phone` tidak dikirim, jadi tidak berubah).
- Ringkasan keamanan akun, nama bebas. Kolom yang dibaca:
  - dari `accounts`: `provider_id`, dan apakah `password` terisi;
  - dari `sessions`: hitungan sesi user itu dengan `expires_at > now()`. Pakai `sql\`now()\`` atau `gt(…, sql\`now()\`)`, bukan `Date` mentah di fragmen `sql` (STATUS 19 Nov, pelajaran no. 3).

  Tidak membaca token, `user_agent`, `ip_address`, `access_token`, atau kolom rahasia lain.

**Serializer + service** — dua ekspor service baru:
```ts
export type AccountSecurityDTO = {
  hasPassword: boolean;        // ada akun provider "credential" dengan password terisi
  googleLinked: boolean;       // ada akun provider "google"
  activeSessionCount: number;  // sesi belum kedaluwarsa, termasuk sesi ini
};
```
- `updateMyName(actor, input: unknown): Promise<UserPrivateDTO>`: `updateNameInput.parse(input)`, lalu tulis ke `actor.id`. Tidak ada id di input. User terhapus (soft delete) → `NotFoundError`.
- `getAccountSecurity(actor): Promise<AccountSecurityDTO>`: hanya milik `actor.id`.
- Allowlist `Object.keys` `AccountSecurityDTO` dites. `updateUserProfile` yang lama tidak diubah.

### 2. Auth (`src/modules/auth/better-auth.ts`, `src/lib/ratelimit.ts`)
- **`disabledPaths: ["/update-user"]`** di opsi Better Auth (keputusan 5). Better Auth menjawab 404 lewat HTTP.
- **Before-hook `/change-password`** (keputusan 7–8), di `binziGuardPlugin`:
  1. Baca sesi di hook (mis. `getSessionFromCtx` dari `better-auth/api`, sudah diekspor di 1.7.7; jelaskan caranya di rencana). Tanpa sesi → `return` tanpa memesan slot.
  2. `passwordSchema.safeParse(newPassword)` (`readBodyField`) → gagal: `APIError("BAD_REQUEST", { code: "PASSWORD_POLICY", … })`, pola sign-up.
  3. `reserveAttempt(db, passwordChangeRateLimitKey(userId), LOGIN_RATE_LIMIT.max, LOGIN_RATE_LIMIT.windowSeconds)` → tidak diizinkan: `APIError("TOO_MANY_REQUESTS", { code: "RATE_LIMITED", … })`. Kunci baru di `ratelimit.ts` mengikuti pola kunci yang ada (5 / 15 menit).
- **Before-hook `/reset-password`** (POST, tepat path itu — bukan GET `/reset-password/:token` yang sudah dijaga redirect guard): cek kebijakan `newPassword` saja. Hook berjalan sebelum token dipakai, jadi token yang sama masih berlaku untuk percobaan berikutnya (dites).
- Semua tes hook lewat **jalur HTTP** (`auth.handler(Request)`, harness yang ada), bukan `auth.api`. Bila `readBodyField` tidak bisa membaca body di jalur itu, berhenti dan laporkan.

### 3. Route `PATCH /api/user/profile` (`src/app/api/user/profile/route.ts`, baru)
Pola route enroll:
1. `requireApiRole("MEMBER", request)`;
2. `readJsonBody(request, 2048)`;
3. `updateMyName(sessionUser, body)` → 200 `{ data: { name } }`.

Galat lewat `toErrorResponse`: Zod → 400, 401, 404; hanya galat ≥ 500 yang di-log.

### 4. Halaman `src/app/(learn)/profil/page.tsx` (baru)
- `requireRole("MEMBER")` → `Promise.all([getUserProfile(actor, { userId: actor.id }), getAccountSecurity(actor)])` → `<PageContainer className="pt-8"><ProfileSettings … /></PageContainer>`.
- Komponen klien **hanya** menerima field yang ditampilkan: `name`, `email`, `emailVerified`. `UserPrivateDTO` utuh tidak menyeberang ke klien (pola header di `(learn)/layout.tsx`).
- "Anggota sejak {tanggal}" dibentuk di server dengan `formatWibDate(new Date(createdAt))` ("24 Agu 2026").
- Tanpa metadata halaman (pola halaman `(learn)` lain). Tanpa `loading.tsx` (keputusan 14).
- `src/lib/learn-route-structure.test.ts`: `(learn)/profil/page.tsx` ada; `loading.tsx` di `(learn)/profil/` tidak ada.

### 5. Komponen (`src/components/learn/profile/`, baru) — 9c, isi 9e
Nama berkas bebas; sebut di rencana. Pembagian yang disarankan:
- `ProfileSettings` (server): kepala dan dua bagian;
- `ProfileNameForm` (klien);
- `PasswordRow` (klien: tombol buka-tutup + form);
- `RevokeAllSessionsButton` (klien).

Satu h1. Semua tombol dan tautan ≥ 44 px. Kontrol dikunci selama permintaan berjalan (TOKENS: loading mengunci kontrol).

**Kepala:**
- eyebrow "Belajar / Profil" — konstanta lokal dengan kelas eyebrow Nilai Saya (`font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-subtle`);
- h1 "Profil & pengaturan" (ukuran h1 Nilai Saya).

**Kolom isi:** satu kolom rata kiri, `max-w-[59rem]` (944 px = kolom kartu 9c pada 1280). Bagian berupa `<section aria-labelledby>` + h2: `rounded-card border border-border bg-surface`, padding 9c (±24 px), jarak antarbagian ±20 px.

**Bagian "Data akun"** (h2 "Data akun"):
- Baris identitas: `Avatar` ukuran `lg` (56 px; desain ±64 px, ukuran yang ada dipakai), **tanpa** `src` (keputusan 12). Di sebelahnya nama (bold ±21 px, `wrap-anywhere`) dan "Anggota sejak {tanggal}" (`text-text-muted`).
- `ProfileNameForm` (`noValidate`, react-hook-form + `updateNameInput`):
  - **Field:** "Nama lengkap" (`autoComplete="name"`) dan "Email" (`readOnly`, latar `fill-soft`, tanpa atribut `name`). Dua kolom ≥ 768 (9c), bertumpuk < 768 (9e).
  - **Baris "Email terverifikasi":** ikon centang `success` (dekoratif) + teks `text-success-tint-text`. Hanya tampil bila `emailVerified`.
  - **Tombol `primary` "Simpan perubahan":** `w-full` < 640 (9e), lebar otomatis ≥ 640 (9c).
  - **Kirim:** `fetch` `PATCH /api/user/profile` dengan body `{ name }`.
    - 200 → `Banner` sukses "Nama disimpan." *(usulan)* dan `router.refresh()` (nama di header dan baris identitas ikut berubah).
    - 401 → "Sesi Anda berakhir. Muat ulang halaman untuk masuk lagi." (teks persis `StartCourseButton`).
    - Lainnya → "Terjadi kesalahan. Coba lagi." (`unknownNotice`).

**Bagian "Keamanan"** (h2 "Keamanan"). Baris-barisnya berupa kartu dalam (`rounded-card border border-border-soft bg-surface-2`, ±16 px), dengan susunan:
- teks (judul 15 px bold + keterangan 13 px `text-text-muted`, `min-w-0 flex-1`) di kiri;
- aksi `secondary` di kanan; aksi `w-full` < 640 dan otomatis ≥ 640;
- `flex flex-wrap items-center justify-between gap-x-4 gap-y-3`.

Wadah aksi atau form **hanya dirender bila ada isinya** (STATUS 22 Nov, pelajaran no. 6). Komponen yang merender lebih dari satu elemen dibungkus elemen blok sebelum masuk wadah flex (pelajaran no. 5). Ketiga baris di bawah ini memakai pola yang sama; perbaikan tata letak di satu baris diterapkan ke semuanya (pelajaran no. 4).

1. **Password**, bila `hasPassword`:
   - judul "Password", tanpa keterangan "Terakhir diubah…" (datanya tidak akurat: `accounts.updated_at` sama dengan waktu daftar);
   - tombol "Ubah password" dengan `aria-expanded` dan `aria-controls` (pola disclosure; fokus tetap di tombol saat dibuka).
   - **Form terbuka** (blok `basis-full` di bawah baris, `max-w-md`, copy 9e):
     - "Password saat ini" (`Input type="password" autoComplete="current-password"`; kosong → "Password saat ini wajib diisi." *(usulan)*);
     - "Password baru" (`PasswordField` + `passwordSchema`, keputusan 11);
     - "Ulangi password baru" (`autoComplete="new-password"`; beda → "Ulangan belum sama dengan password baru.");
     - tombol `primary` "Simpan password";
     - catatan "Setelah password diganti, sesi di perangkat lain otomatis keluar." (`text-text-muted`, 13 px).
   - **Kirim:** `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`. Galat dipetakan lewat `mapChangePasswordError` baru di `auth-errors.ts`:
     - 400 `INVALID_PASSWORD` → galat field "Password saat ini" "Password saat ini salah." *(usulan)*, lalu fokus ke field itu;
     - 429 → `login_locked`;
     - 400 `PASSWORD_POLICY` → `password_policy`;
     - 401 → teks sesi berakhir di atas;
     - lainnya → `unknown`.

     Galat selain field memakai `Banner` error di dalam form.
   - **Sukses:** form ditutup dan fokus pindah ke tombol "Ubah password". `Banner` sukses "Password baru disimpan." (copy form reset) di dalam baris.

   Bila **tidak** `hasPassword` (keputusan 10): judul "Password", keterangan "Akun ini belum punya password." *(usulan)*, dan tautan bergaya tombol `secondary` "Buat password lewat email" *(usulan)* → `/lupa-password`. `PasswordRow` tidak dirender.
2. **Akun Google tertaut**, hanya bila `googleLinked`: judul "Akun Google tertaut", keterangan "{email} · bisa dipakai untuk masuk satu klik" (9c; `wrap-anywhere`), tanpa aksi. Email akun sama dengan email Google: penautan Better Auth mencocokkan email, dan email tidak bisa diubah.
3. **Sesi aktif:** judul "Sesi aktif", keterangan "{n} perangkat", aksi "Keluar dari semua perangkat" (9e) — `RevokeAllSessionsButton` (keputusan 9).
   - Galat `revokeSessions` → `Banner` error "Terjadi kesalahan. Coba lagi.", tanpa navigasi, `signOut` tidak dipanggil.
   - Sukses → `signOut` → `router.replace("/masuk")` + `router.refresh()`.

**Tidak dirender:** daftar isi, pil, "Ganti foto", "Lepas tautan", notifikasi email, "Data & privasi", "Hapus akun", tombol "Keluar" 9d (sudah ada di laci akun).

### 6. Tes lama yang berubah (yang sudah diketahui)
- `src/modules/user/schema.test.ts`: batas nama 100 → 128, bila ada asersinya.
- `src/lib/learn-route-structure.test.ts`: asersi `/profil` ditambahkan (bagian 4).

Cari sendiri tes lain yang berubah:
- tes yang memakai password tanpa angka atau tanpa huruf di `/reset-password` atau `/change-password` (kini ditolak server);
- tes yang memanggil `/update-user`;
- asersi bahwa `/profil` menjawab 404.

## Bukan lingkup tugas ini
- Daftar perangkat per sesi dan "Keluarkan perangkat ini" (9e); "Terakhir diubah" password; foto profil dan "Ganti foto"; "Lepas tautan" Google; ubah email; notifikasi email; ekspor data dan hapus akun (B4); daftar isi dan pil.
- Layar rincian 9e sebagai sub-rute (keputusan 2); meter kekuatan password (keputusan 11); pesan di `/masuk` setelah keluar dari semua perangkat.
- Perapian form reset (`reset-password-form.tsx`) untuk kode `PASSWORD_POLICY` dari server: validasi kliennya sudah sama.
- Rate limit untuk endpoint lain; pembersihan tabel `rate_limits` (butir STATUS).
- **Tidak diubah:** `src/db/**`, `package.json`, `package-lock.json`, `src/lib/rbac.ts`, `src/proxy.ts`, `next.config.ts`, `.github/**`, `src/app/(auth)/**`, `src/app/(public)/**`, `src/app/api/**` kecuali route baru, `src/modules/` selain `user/` dan `auth/better-auth.ts` (+ tesnya), `src/components/ui/**`, `src/components/shared/**` kecuali `auth/auth-errors.ts` (+ tesnya), `src/components/learn/` selain folder `profile/` baru, `src/styles/tokens.css`.
- **Jangan menjalankan `next upgrade`.** Pengingat keamanan Next 16.4.1 menghentikan `next build`/`next dev` sekali saat mendeteksi agent; jalankan ulang perintah yang sama.

Pekerjaan di luar lingkup → **berhenti dan tanyakan.**

## Berkas yang boleh dibuat/diubah
- `src/modules/user/{schema,queries,serializer,service}.ts` + `schema.test.ts`, `serializer.test.ts`, dan satu tes integrasi **baru** `src/modules/user/profile.integration.test.ts` (PGlite, harness pola `src/modules/course/service.integration.test.ts`)
- `src/modules/auth/better-auth.ts` + `better-auth.integration.test.ts` (`describe` baru di akhir berkas)
- `src/lib/ratelimit.ts` (hanya fungsi kunci baru) + `ratelimit.test.ts`
- `src/app/api/user/profile/route.ts` (baru)
- `src/app/(learn)/profil/page.tsx` (baru)
- `src/components/learn/profile/*.tsx` + tesnya (baru)
- `src/components/shared/auth/auth-errors.ts` + `auth-errors.test.ts` (pemetaan galat ubah password)
- `src/lib/learn-route-structure.test.ts` (hanya asersi `/profil`)
- `e2e/profil.spec.ts` (baru), `e2e/layout/axe.spec.ts` (satu tes baru di akhir `describe`)

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- **Hash basis dan baseline Vitest yang diukur.** Basisnya `main` terbaru saat sesi dimulai (setelah PR docs kartu ini; bila A5 sudah di-merge, termasuk A5). Claude chat mengukur **133 berkas / 1624 tes** pada `6188302`; `f43e2f0` hanya mengubah `docs/`. Bila basismu memuat A5, angkanya naik — sebut keduanya;
- cara hook membaca sesi dan `newPassword` di jalur HTTP; nama kunci rate limit;
- kueri ringkasan keamanan (kolom, filter, cara menghitung) dan tanda tangan DTO;
- pembagian komponen, props komponen klien, cara tes memalsukan `authClient` (`vi.mock` `auth-client`), `fetch`, dan `useRouter`;
- daftar tes lama yang berubah, satu per satu, dengan alasannya (bagian 6), ditambah hasil pencarianmu sendiri;
- urutan commit;
- **tabel mutasi dengan prediksi per baris** — nama tes yang diharapkan merah, bukan "integrasi/komponen". Prediksi dicocokkan dengan tes yang benar-benar ada (STATUS 22 Nov, pelajaran no. 3).

## Selesai jika
Data uji memenuhi semua syarat kecuali yang sedang diuji (STATUS 14 Nov, pelajaran no. 6). Setiap tes membuat aktornya sendiri: DB PGlite dipakai bersama oleh semua tes dalam satu berkas.

- [ ] **Integrasi modul `user`** (`profile.integration.test.ts`):
  - **`updateMyName`:**
    - nama di-`trim` dan tersimpan;
    - 128 karakter lolos, 129 → `ZodError`, kosong atau spasi → `ZodError`;
    - setiap kunci selundupan (`userId` milik user lain, `role`, `phone`, `email`, `image`) → `ZodError`, dan **baris user mana pun tidak berubah**;
    - dua user dalam satu tes: A mengubah namanya, nama B tetap;
    - user ber-`deleted_at` → `NotFoundError`.
  - **`getAccountSecurity`**, tiga user dalam **satu tes** (STATUS 22 Nov, pelajaran no. 2):
    - A: credential + google, 2 sesi aktif + 1 kedaluwarsa → `{ true, true, 2 }`;
    - B: google saja, 3 sesi aktif → `{ false, true, 3 }`;
    - C: credential dengan `password` null, 1 sesi → `{ false, false, 1 }`.
- [ ] **Integrasi auth** (`better-auth.integration.test.ts`, jalur HTTP):
  - `/change-password` dengan password baru tanpa angka → 400 `PASSWORD_POLICY`; password lama masih bisa dipakai masuk;
  - `/reset-password` dengan password tanpa huruf → 400 `PASSWORD_POLICY`; **token yang sama** lalu berhasil dengan password yang memenuhi syarat;
  - sukses dengan `revokeOtherSessions: true`:
    - cookie sesi lain tidak berlaku lagi (`/get-session` → null);
    - cookie baru dari respons berlaku;
    - masuk dengan password lama → 401, dengan password baru → 200;
  - akun EDITOR: sesi baru hasil ganti password berumur 8 jam (±1 menit), pola tes AUTH-07 yang ada;
  - rate limit:
    - 5 percobaan dengan password saat ini salah → 400 `INVALID_PASSWORD`;
    - percobaan ke-6, **meski benar**, → 429 `RATE_LIMITED`;
    - setelah jendela dimundurkan (pola tes AUTH-08 yang ada) → berhasil;
  - bucket per user: user A diblokir, user B dari IP yang sama tetap bisa mengganti password;
  - tanpa sesi → 401, dan **tidak ada** baris `rate_limits` baru;
  - `POST /update-user` dengan sesi sah → 404, nama di DB tidak berubah.
- [ ] **Serializer:** allowlist `Object.keys` `AccountSecurityDTO`.
- [ ] **Komponen** (jsdom):
  - `ProfileSettings`:
    - satu h1 dan eyebrow;
    - "Anggota sejak 24 Agu 2026" dari ISO;
    - "Email terverifikasi" ada/tidak sesuai `emailVerified`;
    - email `readOnly` dengan nilainya;
    - baris Google ada/tidak sesuai `googleLinked`;
    - "{n} perangkat";
    - `hasPassword: false` → tidak ada tombol "Ubah password"; ada tautan "Buat password lewat email" → `/lupa-password`;
    - avatar tanpa `<img>`.
  - `ProfileNameForm`:
    - kosong dan 129 karakter → galat field tanpa `fetch`;
    - sukses → `fetch` dengan method `PATCH`, URL, dan body **persis** `{ name }`; Banner sukses; `router.refresh` dipanggil;
    - 401 → teks sesi berakhir; 500 → teks umum;
    - tombol terkunci selama permintaan.
  - `PasswordRow`:
    - `aria-expanded` false → klik → true dan form tampil;
    - ulangan beda → galat 9e tanpa panggilan;
    - password lemah → tanpa panggilan;
    - sukses → `changePassword` dipanggil dengan argumen **persis** (termasuk `revokeOtherSessions: true`), form tertutup, fokus di tombol, Banner "Password baru disimpan.";
    - `INVALID_PASSWORD` → galat di field "Password saat ini";
    - 429 → copy `login_locked`.
  - `RevokeAllSessionsButton`:
    - sukses → `revokeSessions` lalu `signOut` (urutan dites) lalu `router.replace("/masuk")`;
    - galat → Banner error, `signOut` dan `replace` tidak dipanggil.
  - `mapChangePasswordError`: kelima cabang.
- [ ] **Struktur:** bagian 4.
- [ ] **E2E** `e2e/profil.spec.ts` (proyek `chromium`, **paling banyak 3 tes**). Setiap tes memakai akun baru (`createRoleAccount`) supaya jumlah sesi pasti.
  1. **Ubah nama + tata letak.**
     - Masuk → buka menu akun → "Profil & pengaturan" → `/profil`.
     - Ganti "Nama lengkap" dengan nama bertoken → "Simpan perubahan" → "Nama disimpan.".
     - Muat ulang: field, baris identitas, dan header (pil nama ≥ 1024) memuat nama baru.
     - Lebar 360, 768, 1024, 1280: tanpa gulir samping.
     - Di 360: "Simpan perubahan", "Ubah password", dan "Keluar dari semua perangkat" ≥ 44 × 44.
     - Screenshot `profil-{360,768,1024,1280}`, lalu buka form password → `profil-password-{360,1280}`. Tunggu h1 sebelum mengukur atau memotret.
  2. **Ubah password mengeluarkan perangkat lain.**
     - Konteks A dan B masuk dengan akun yang sama.
     - Di A: "Ubah password" → password saat ini salah → "Password saat ini salah." → isi benar + password baru (`randomPassword()`) → "Password baru disimpan.".
     - A memuat ulang `/profil` → tetap di halaman (200).
     - B membuka `/belajar` → mendarat di `/masuk`.
     - Masuk lewat API dengan password lama → 401, dengan password baru → 200.
  3. **Keluar dari semua perangkat.**
     - Konteks A dan B masuk; A di `/profil` melihat "2 perangkat".
     - Klik "Keluar dari semua perangkat" → A mendarat di `/masuk`.
     - A dan B membuka `/belajar` → keduanya di `/masuk`.

  Pencocokan teks dibatasi ke bagian atau baris yang tepat dengan `exact: true` (STATUS 20 Nov, pelajaran no. 4). Ukur durasi tes; bila > 45 dtk, `test.setTimeout` dengan alasan yang benar.
- [ ] **axe** (`axe.spec.ts`, w360 + w1280): satu tes baru "MEMBER: /profil (S5-05)" di akhir `describe` — akun baru → `/profil` → scan → buka form password → scan lagi.
- [ ] **E2E lain tetap hijau.**
- [ ] **Screenshot** — `E2E_SCREENSHOT_DIR=~/binzi-s5-05-screenshots` (kosongkan folder dulu), jalankan **hanya** `profil.spec.ts`. Harapan **6 berkas**: `profil-{360,768,1024,1280}`, `profil-password-{360,1280}`. Sebut jumlahnya di PR.
- [ ] **Uji mutasi** — commit lokal dulu dan `git status` bersih sebelum mutasi pertama; kembalikan dengan `git restore`. Mutasi yang dijalankan harus persis yang tertulis.

  Setiap mutasi kueri dan hook dijalankan juga dengan `-t` pada tes yang diprediksi merah saja, supaya merahnya tidak berasal dari data tes lain (STATUS 22 Nov, pelajaran no. 1). Laporkan per mutasi nama tes yang merah + pesannya:
  1. Batas nama kembali 100.
  2. `updateNameInput` memakai `z.object` (bukan `strictObject`).
  3. Ubah nama tanpa filter `notDeleted`.
  4. Hitungan sesi tanpa syarat `expires_at > now()`.
  5. Hitungan sesi tanpa filter `user_id`.
  6. `hasPassword` tanpa syarat `password` terisi.
  7. `googleLinked` membaca provider `credential`.
  8. Hook `/change-password` tanpa cek kebijakan.
  9. Hook `/reset-password` tanpa cek kebijakan.
  10. Kunci rate limit tanpa id user (satu bucket untuk semua).
  11. Batas rate limit 6.
  12. Slot dipesan sebelum sesi dibaca (tanpa sesi tetap membuat baris).
  13. `disabledPaths` tanpa `/update-user`.
  14. Klien: `revokeOtherSessions` tidak dikirim.
  15. Klien: "Keluar dari semua perangkat" tanpa `signOut`.
  16. Klien: `INVALID_PASSWORD` dipetakan ke pesan umum.
  17. Form ubah password dirender untuk akun tanpa password.
  18. `loading.tsx` ditambahkan di `src/app/(learn)/profil/`.
  19. `AccountSecurityDTO` ikut membawa daftar sesi (`sessions`).

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR. Harapan `0 excused / 0 blocking / OK` (21 info/low/moderate di sandbox 22 Nov). Temuan high/critical baru → berhenti dan tempel output lengkapnya.
- **Build dan rute:**
  - `npm run build`: `/profil` ƒ; `/api/user/profile` ƒ.
  - `curl -sI` tanpa cookie: `/profil` → 307 ke `/masuk?next=%2Fprofil`.
  - `curl -s -X PATCH` tanpa cookie ke `/api/user/profile` → 401 JSON.
- **Prettier:** berkas yang sudah ada tetap apa adanya; berkas baru boleh dirapikan.
- **`lint:hex`** menolak `#` diikuti 3/6 karakter hex di `src/`, termasuk komentar — tulis "PR 150", bukan "PR #150".
- **Anotasi desain:** grep perubahan untuk `\([A-Z]{1,4}-[0-9]+\)` dan `§` di teks yang dirender (`CLAUDE.md`).
- **Sandi akun uji tidak pernah ditulis di PR**, termasuk di log tes yang ditempel.
- **`npm run e2e` penuh** sebelum PR. Bila satu tes gagal dengan `UNKNOWN_ERROR` dari siteverify Turnstile, salin blok galatnya sebelum menjalankan ulang (butir "Kandidat tes flaky" di STATUS) dan laporkan di PR.
- **`npm run check` di commit akhir:** tempel 5 baris terakhir output di PR.
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas (`AGENTS.md` tetap untracked).
- **"Keputusan & asumsi" di PR** memuat keputusan 1–14, semua copy *(usulan)*, dan keputusan yang diambil tanpa bertanya.
- **Setelah push:** buat PR segera begitu e2e lokal hijau, lalu kerjakan mutasi selagi CI berjalan. Perbarui isi PR dengan tabel mutasi. Cek CI (`gh pr checks`, job `ci` dan `e2e`), lalu laporkan durasi job `e2e` dibanding PR 150 (8m40s).

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`
- Baseline + jumlah tes baru; tes lama yang berubah disebut satu per satu.
- `git diff --stat main -- package-lock.json package.json src/db src/lib/rbac.ts src/proxy.ts next.config.ts .github "src/app/(auth)" "src/app/(public)" src/modules/attempt src/modules/quiz src/modules/lesson src/modules/course src/modules/progress src/modules/consultation src/components/ui src/components/public src/components/learn/quiz src/styles` kosong.

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Screenshot `~/binzi-s5-05-screenshots` (6 berkas) diunggah ke Claude chat untuk ditinjau terhadap 9c/9e.
- [ ] Lokal (Docker menyala):
  ```bash
  cd ~/Project/React/binzi-new && git fetch origin && git switch s5/s5-05-profil-dasar && git pull --ff-only && npm run dev:db && npm run dev
  ```
  1. Masuk dengan akun MEMBER → menu akun → "Profil & pengaturan" → ganti nama → nama di header ikut berubah.
  2. Browser biasa + jendela privat masuk dengan akun yang sama. Di salah satunya ganti password. Jendela lain: buka halaman apa pun di `/belajar` → mendarat di `/masuk`. Password lama ditolak, password baru diterima.
  3. Dua jendela lagi → "Keluar dari semua perangkat" → keduanya di `/masuk`.
  4. Lima kali password saat ini salah → percobaan keenam menampilkan "Terlalu banyak percobaan…".
  5. Akun ADMIN: `/profil` terbuka; ganti password → tetap masuk di jendela itu.
  6. DevTools 360: bagian dan baris utuh, form password terbuka tanpa gulir samping, semua aksi bisa diketuk.
- [ ] **binzi-dev:** kartu ini tanpa migrasi.

## Catatan jadwal
- **Urutan commit yang disarankan:**
  1. `user`: schema + kueri + serializer + service + tes;
  2. auth: `disabledPaths`, hook kebijakan `/change-password` dan `/reset-password`, rate limit + tes integrasi;
  3. route + halaman + komponen + `auth-errors` + tes komponen + tes struktur;
  4. e2e + axe + screenshot.

  Commit + push di antara bagian.
- **Bila terlambat**, yang dipotong lebih dulu:
  1. baris "Akun Google tertaut";
  2. keterangan "{n} perangkat" (dengan kueri sesinya);
  3. lebar 1024 di e2e (360/768/1280 tetap).

  **Tidak dipotong:** ubah nama, ubah password + kebijakan server + rate limit, keluar dari semua perangkat, `disabledPaths`, cabang akun tanpa password, axe.

## Catatan untuk kartu berikutnya
- **A8 (S5-06, pengguna CMS):** ubah role dan status wajib mencabut semua sesi user itu (butir "Kartu manajemen user" di STATUS). Pola `deleteUserSessions` ada di `scripts/set-role.ts` dan `better-auth.ts:489`.
- **B4 (S5-08, hapus akun + unduh data):** bagian "Data & privasi" 9c, daftar isi 9c, dan pil 9t ditambahkan ke halaman ini.
- **Nanti:** daftar perangkat per sesi + "Keluarkan perangkat ini" (9e); "Terakhir diubah" password (butuh kolom sendiri); foto profil (CSP `img-src` untuk foto Google, STATUS); pesan di `/masuk` setelah keluar dari semua perangkat.

## Catatan tinjauan 22 Nov (fakta kode di `f43e2f0`)
| Klaim | Cara dicek | Hasil |
|---|---|---|
| Basis | `git diff --stat 6188302 f43e2f0 -- . ':!docs'` | Kosong — baseline sama dengan `6188302` |
| Baseline | `npm run check` di sandbox pada `6188302` | 133 berkas / 1624 tes |
| Rute `/profil` | `find "src/app/(learn)"`, `src/lib/rbac.ts:72`, `src/proxy.ts:53`, `nav-items.ts:98,146` | Halaman belum ada (404). RBAC `{ path: "/profil", match: "exact", minRole: "MEMBER" }`; matcher proxy `/profil` persis; menu akun "Profil & pengaturan" sudah menaut |
| `changePassword` | `update-user.mjs:76–188` (1.7.7) | Hanya cek panjang. `INVALID_PASSWORD` bila password saat ini salah; `CREDENTIAL_ACCOUNT_NOT_FOUND` tanpa akun credential. `revokeOtherSessions` → `deleteUserSessions` + `createSession` + cookie baru |
| `resetPassword` | `password.mjs:150–170` | Hanya cek panjang; tanpa akun credential → dibuat; `revokeSessionsOnPasswordReset` aktif di config |
| `revokeSessions` / `signOut` | `session.mjs:420–449`, `sign-out.mjs:42–54` | `revokeSessions` menghapus semua sesi tanpa menghapus cookie; `signOut` menghapus cookie walau sesinya sudah tidak ada |
| `/update-user` terbuka | `update-user.mjs:12–75`; grep `updateUser` di `src`, `e2e` | Body `z.record(z.string(), z.any())`; `name` tanpa batas, `image` bebas; tidak dipakai aplikasi |
| `disabledPaths` | `@better-auth/core` `init-options.d.mts:1528`, `api/index.mjs:166–168` | Didukung; path terdaftar → 404 |
| Kebijakan password | `better-auth.ts:299–311` + matcher `binziGuardPlugin` | `passwordSchema` hanya di cabang sign-up |
| Rate limit | `better-auth.ts:269–297`, `ratelimit.ts:31,80` | `reserveAttempt(db, key, max, windowSeconds)` atomik; Better Auth `rateLimit` mati |
| Sesi | `better-auth.ts:659–664` | Tanpa `cookieCache` → sesi yang dicabut langsung tidak berlaku |
| Batas nama | `user/schema.ts:18–31`, `auth/schema.ts:91–95` | 100 di profil, 128 di pendaftaran |
| Komponen yang ada | `password-field.tsx`, `reset-password-form.tsx`, `auth-errors.ts`, `start-course-button.tsx:23`, `avatar.tsx:22–28`, `button-variants.ts` | Pil 3a; "Password baru disimpan."; `login_locked`; teks 401; avatar `sm/md/lg` = 32/44/56; varian `primary/secondary/ghost/danger` |
| Tanggal | `datetime.ts:24` | `formatWibDate` → "24 Agu 2026" |
| E2E | `fixtures.ts:50,150,167`, `axe.spec.ts:165` | `randomPassword()` berisi huruf + angka; tes MEMBER axe juga diubah A5 → A6 memakai tes baru |
| Kontras (dihitung di sandbox) | rumus WCAG atas `tokens.css` | `success-tint-text` di `surface` 7,64 · `success` di `surface` 4,96 · `text-muted` di `surface-2` 7,05 · `text-muted` di `fill-soft` 6,75 · `text` di `fill-soft` 16,51 |

Yang **belum** dicek dari sandbox: perilaku `getSessionFromCtx` di before-hook dan pembacaan `newPassword` di jalur HTTP (dibuktikan oleh tes integrasi agent), tampilan dengan font Lato asli, dan Safari iOS (verifikasi pemilik).

---
Akhiri sesi dengan **ringkasan PR** sesuai format di `docs/tasks/README.md`.
