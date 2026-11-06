# S1-04 · Editor teks materi dan deskripsi kursus (simpan manual)

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | **S1-03b** sudah merge (`RichTextEditor`), **S1-03a** sudah merge (`validateContentDoc`, `contentDocSchema`, `RichContent`), S1-02 (builder, outline, placeholder editor materi) |
| **Target** | Sabtu 7 Nov, setelah S1-03b. Langkah kelima jalur demo 20 Nov |
| **Branch** | `s1/s1-04-editor-materi-deskripsi` |

> **Dibuat 5 Nov 2026** di Claude chat. **Ditinjau ulang terhadap `main` `2e9a44f`** (S1-03a, PR #110) pada hari yang sama: `validateContentDoc`, `contentDocSchema`, `ContentDoc`, `EMPTY_DOC`, dan `RichContent` ada dengan nama yang sama. Props editor mengikuti kartu S1-03b. C-04 (`d3eab7f`, 6 Nov) tidak menyentuh `src/`. **Sebelum sesi, kartu ini ditinjau sekali lagi setelah S1-03b merge.**
>
> **Disetujui pemilik 5 Nov:**
> - tanpa cek versi untuk demo (simpan terakhir yang menang);
> - deskripsi di halaman sendiri;
> - Ctrl+S untuk menyimpan;
> - semua copy bertanda *(usulan)* di kartu ini;
> - daftar "Bukan lingkup tugas ini".
>
> Copy tersebut tetap dicantumkan di "Keputusan & asumsi" PR sebagai copy yang sudah disetujui.
>
> **Keputusan yang berlaku:**
> - Simpan manual, tanpa simpan otomatis 20 detik (3 Nov).
> - Deskripsi kursus masuk kartu ini, memakai editor yang sama (4 Nov no. 3).
> - Editor materi wajib punya jalan kembali ke builder (catatan STATUS 4 Nov malam).

## Tujuan
Ahli gizi bisa menulis teks materi dan deskripsi kursus lalu menyimpannya. Dengan begitu syarat terbit 4 ("Deskripsi lengkap") dan bagian teks syarat 6 ("Semua materi lengkap") bisa dipenuhi lewat CMS, bukan hanya lewat seed. Server menyimpan **hanya** dokumen hasil validator S1-03a, sehingga V-08 berlaku di endpoint, bukan sekadar di editor.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD: `docs/prd/sections/06-2-kursus-materi.md` (CRS-03, CRS-04, CRS-05), `12-keamanan.md` (§12.3, baris V-08)
- Desain:
  - `docs/design/screens/21i.md` + `.png` + `.html`: kepala halaman editor materi, judul, label "Teks materi".
  - `20c.md`: copy indikator simpan.
  - `21g.md`: baris "+ Tulis deskripsi lengkap".
- Kode S1-02:
  - `src/app/api/cms/courses/[id]/route.ts` (pola route);
  - `src/modules/course/{schema,service,queries,errors}.ts`, khususnya `updateCourseIfDraft`;
  - `src/modules/lesson/{schema,service,queries,policy}.ts`, khususnya `createLessonWithQuiz`;
  - `src/components/cms/course-builder.tsx` (pola simpan: `inFlight`, banner, `pendingSaveFocus`) dan `course-settings-panel.tsx` (baris "Deskripsi");
  - `src/app/(cms)/cms/kursus/[id]/materi/[lessonId]/page.tsx` (placeholder yang diganti).
- Kode S1-03: `src/components/cms/rich-text-editor.tsx` (props), `src/lib/content-doc-validator.ts` (ekspor), `src/components/shared/rich-content.tsx`
- `src/lib/errors.ts`, e2e `cms-materi-builder.spec.ts`, `e2e/layout/axe.spec.ts`

## Kerjakan

### 1. Batas ukuran body — `src/lib/request-body.ts`
`readJsonBody(request: Request, maxBytes: number): Promise<unknown>`, untuk dua endpoint baru di kartu ini.

- **Header dulu.** `Content-Length` lebih dari `maxBytes` → `PayloadTooLargeError` sebelum body dibaca.
- **Lalu body.** Dibaca sebagai stream dengan hitungan byte. Begitu melewati `maxBytes`, pembacaan dihentikan dan `PayloadTooLargeError` dilempar. Ini juga menangani body *chunked* tanpa `Content-Length`.
- **Bukan JSON sah atau body kosong** → `BadRequestError("Body permintaan harus JSON valid")`, sama dengan route S1-02.
- **`PayloadTooLargeError`** ditambahkan ke `src/lib/errors.ts`: status 413, kode `PAYLOAD_TOO_LARGE`, pesan "Teks terlalu panjang." (sama dengan pesan `TOO_LARGE` validator).
- **Batasnya** `MAX_CONTENT_BODY_BYTES = 1_048_576` (1 MiB), diekspor dari berkas yang sama. Alasannya: batas validator (100.000 karakter, 5.000 node) masuk dalam 1 MiB untuk dokumen yang wajar.

### 2. Simpan teks materi
**Route `PATCH /api/cms/courses/{id}/lessons/{lessonId}`** (berkas baru `src/app/api/cms/courses/[id]/lessons/[lessonId]/route.ts`), dengan pola route S1-02. Urutan langkahnya:
1. `requireApiRole("EDITOR")`, **sebelum body dibaca**;
2. kedua ID wajib UUID, bila tidak → 404;
3. `readJsonBody(request, MAX_CONTENT_BODY_BYTES)`;
4. service;
5. galat domain (< 500, `ZodError`) tidak di-log.

**Kontrak** (`src/modules/lesson/schema.ts`):
- `updateLessonContentInput = z.strictObject({ content: contentDocSchema })`.
- Masih client-safe (Zod dan modul murni saja), jadi klien bisa memakai skema yang sama.

**Service** `updateLessonContent(actor, { courseId, lessonId }, input)`: `assertCanManageLessons` lebih dulu, baru parse.

**Query** `updateLessonContentIfDraft`, satu transaksi dengan urutan kunci yang sama seperti `createLessonWithQuiz`:
1. `SELECT … FOR UPDATE` baris kursus (`{ of: courses }`). Tidak ada → 404. Status ≠ `DRAFT` → 409 `NOT_DRAFT_MESSAGE` modul lesson.
2. `SELECT … FOR UPDATE` baris materi dengan `id = lessonId AND course_id = courseId`. Tidak ada → 404, termasuk materi milik kursus lain (bentuk anti-IDOR, sama dengan halaman).
3. **Tanpa perubahan** → kembalikan DTO saat ini, tanpa tulis dan tanpa audit.
   - Perbandingannya `isDeepStrictEqual` dari `node:util` antara isi tersimpan dan dokumen hasil validasi.
   - Jangan membandingkan string JSON: `jsonb` Postgres mengurutkan ulang key.
4. **Ada perubahan:**
   - update `lessons.content` dengan dokumen hasil validasi, bukan input mentah;
   - sentuh baris kursus (`set({ updatedBy })`, seperti `createLessonWithQuiz`), supaya "terakhir diubah" di daftar kursus ikut bergerak;
   - satu baris audit `lesson.update_content`.
   - `before`/`after` audit hanya ringkasan `{ isContentEmpty }`, tanpa dokumen TipTap (aturan tinjauan S1-02 2a).

**Respons 200:** `{ data: { id, updatedAt, isContentEmpty } }`. Dokumennya tidak dikirim balik.

### 3. Simpan deskripsi kursus
**Route `PUT /api/cms/courses/{id}/description`** (berkas baru `src/app/api/cms/courses/[id]/description/route.ts`), dengan urutan langkah yang sama seperti bagian 2.

- **Kontrak** (`src/modules/course/schema.ts`): `updateCourseDescriptionInput = z.strictObject({ description: contentDocSchema })`. Kontrak pengaturan S1-02 (`updateCourseInput`) **tidak diubah**.
- **Service** `updateCourseDescription(actor, courseId, input)`; **query** `updateCourseDescriptionIfDraft`:
  1. kunci baris kursus → 404 / 409 `NOT_DRAFT_MESSAGE` modul kursus;
  2. tanpa perubahan (`isDeepStrictEqual`; `null` tersimpan dianggap berbeda dari dokumen apa pun) → tanpa tulis dan audit;
  3. ada perubahan → update `description` + `updatedBy`, satu audit `course.update_description` dengan ringkasan `{ isDescriptionEmpty }`.
- **Respons 200:** `{ data: { id, updatedAt, isDescriptionEmpty } }`.

### 4. Formulir editor bersama — `src/components/cms/content-doc-form.tsx`
Satu komponen klien untuk kedua halaman. Bentuknya formulir satu isian di sekitar `RichTextEditor` (S1-03b), tanpa react-hook-form.

**Props:**
- `initialDoc: ContentDoc`
- `saveUrl: string`, `method: "PATCH" | "PUT"`, `bodyKey: "content" | "description"`
- `labelId: string`: id elemen label di halaman, untuk `aria-labelledby` editor
- `breadcrumb: { label: string; href: string | null }[]`: segmen kepala halaman; `href: null` untuk segmen terakhir
- `heading: string`, `intro?: string`

**Kepala halaman (21i):**
- Bar setinggi 60 px dengan padding samping 24 px dan garis bawah `border-soft`.
- Kiri: breadcrumb mono 11.5 px, tracking 0.1em, `text-subtle`, huruf kapital. Segmen ber-`href` adalah tautan.
- Lalu indikator simpan (tabel di bawah), mono 11 px.
- Kanan: tombol **"Simpan"** (varian utama).

**Isi halaman:**
- Padding 26 / 24 / 32 px (atas / samping / bawah).
- Judul `h1` dengan gaya judul 21i: 28 px / 1.18, bobot 900 (TOKENS: 800 → 900), tracking −0.022em.
- `intro` bila ada (`text-text-muted`).
- Label isian: 15 px tebal, ditambah tag mono "WAJIB" (21i). `labelId` dipasang di elemen yang hanya berisi teks label, bukan tag "WAJIB", supaya nama aksesibel editor tepat "Teks materi" atau "Deskripsi".
- Editor.
- Pesan galat isian di bawah editor, disambungkan lewat `aria-describedby`; editor diberi `aria-invalid` saat ada galat.

**Indikator simpan** (satu tempat, di kepala halaman; 20c):

| State | Teks | Warna |
|---|---|---|
| Belum ada perubahan sejak dimuat | *(kosong)* | |
| Ada perubahan | BELUM DISIMPAN *(usulan)* | `text-meta` |
| Request berjalan | ⟳ MENYIMPAN… | `text-meta` |
| Berhasil | ✓ TERSIMPAN 12:04 (jam:menit perangkat, titik dua seperti 20c) | `success` |
| Gagal | ⚠ GAGAL MENYIMPAN | `danger` |

Indikator berada di dalam `role="status"` supaya pembaca layar mengumumkan perubahannya.

**Alur simpan:**
- **Pemicu:** tombol "Simpan" atau **Ctrl+S / ⌘S** di mana pun di halaman. Pintasan itu memanggil `preventDefault`, jadi dialog "Simpan halaman" browser tidak muncul.
- **Cek klien dulu:** `validateContentDoc(doc)`. Tidak sah → pesan issue pertama tampil di bawah editor, dan `ref.focus()` ke editor. Tidak ada request.
- **Penjaga klik ganda:** ref `inFlight`, dengan pola S1-02.
- **Respons:**
  - **200** → indikator "Tersimpan", status "belum disimpan" hilang, fokus kembali ke tombol Simpan (pola `pendingSaveFocus` S1-02, karena `Button` `loading` memasang `disabled` native).
  - **400** → ambil `fields` yang path-nya diawali `bodyKey`; pesan pertama tampil di bawah editor, fokus ke editor.
  - **413** → "Teks terlalu panjang." di bawah editor, fokus ke editor.
  - **409** → banner galat berisi pesan server, lalu `router.refresh()`. Halaman berubah ke bentuk terkunci (bagian 7).
  - **Galat lain atau jaringan putus** → bar merah 20c di atas editor: "Gagal menyimpan — koneksi terputus", dengan tombol "Coba lagi" yang mengulang simpan. Teks di editor tetap utuh.
- **Status "belum disimpan"** menyala pada `onChange` pertama. `onChange` S1-03b hanya terpanggil oleh suntingan sungguhan, bukan oleh fokus.

**Penjaga perubahan belum disimpan** (hanya saat status "belum disimpan"):
- `beforeunload` dipasang hanya selama kondisi itu (tutup tab, muat ulang, ketik URL).
- **Tautan breadcrumb** di halaman ini membuka dialog A-06 sebelum pindah:
  - judul: "Tinggalkan tanpa menyimpan?";
  - isi: "Perubahan sejak simpan terakhir akan hilang.";
  - tombol: **"Tetap di sini"** (utama, terfokus) dan **"Tinggalkan"**.
- Navigasi sidebar CMS tidak dijaga (keterbatasan App Router; catat di PR).

### 5. Halaman editor materi — ganti placeholder `src/app/(cms)/cms/kursus/[id]/materi/[lessonId]/page.tsx`
- **Penjaga:** sama dengan placeholder (EDITOR+, UUID, 404 anti-IDOR).
- **Data:** satu panggilan service baru `getLessonEditor(actor, { courseId, lessonId })` → `{ course: { id, title, status }, lesson: { id, title, orderIndex, content } }`.
  - `content` divalidasi di serializer. Bila isi tersimpan tidak lolos validator (seharusnya tidak pernah), halaman tidak membuka editor: pesan "Isi materi ini tidak bisa dibuka editor." *(usulan)*, dan galatnya di-log dengan kode + path saja.
- **Tampilan:**
  - breadcrumb `KURSUS / {judul kursus} / MATERI {orderIndex}`: "KURSUS" → `/cms/kursus`, judul kursus → builder;
  - `h1` = judul materi, tidak bisa diubah di kartu ini;
  - label "Teks materi" + "WAJIB".
  - Placeholder editor tetap default S1-03b ("Mulai menulis…").
- **Simpan:** `PATCH` bagian 2, `bodyKey: "content"`.

### 6. Halaman deskripsi kursus — baru `src/app/(cms)/cms/kursus/[id]/deskripsi/page.tsx`
- **Penjaga:** EDITOR+, UUID, kursus tidak ada → 404.
- **Data:** `getCourseDescriptionEditor(actor, { courseId })` → `{ course: { id, title, status, description } }`. `description` `null` → `EMPTY_DOC` untuk editor. Isi tidak sah ditangani seperti bagian 5.
- **Tampilan** (usulan, desain belum menggambar halaman ini):
  - breadcrumb `KURSUS / {judul kursus} / DESKRIPSI`;
  - `h1` "Deskripsi lengkap", sama dengan label syarat terbit 4;
  - `intro` "Tampil di halaman kursus, di bawah ringkasan. Ceritakan untuk siapa kursus ini dan apa yang akan dipelajari.";
  - label "Deskripsi" + "WAJIB".
- **Simpan:** `PUT` bagian 3, `bodyKey: "description"`.

**Pintu masuk dari builder** (`course-settings-panel.tsx`, baris "Deskripsi"):

| Status kursus | Deskripsi | Tampilan |
|---|---|---|
| `DRAFT` | kosong | tautan "+ Tulis deskripsi lengkap" (21g, `text-primary-deep`) |
| `DRAFT` | terisi | "Sudah diisi · " + tautan "Ubah" *(usulan)* |
| selain `DRAFT` | | teks seperti sekarang ("Belum diisi"/"Sudah diisi") |

Tautan menuju `/cms/kursus/{id}/deskripsi`.

### 7. Kursus terkunci (bukan `DRAFT`)
Kedua halaman tidak menampilkan editor dan tombol Simpan. Yang tampil:
- banner info berisi copy terkunci S1-02 ("Kursus sudah bukan draf — pengaturan dan materi terkunci.");
- isinya lewat `RichContent`, atau "Belum diisi." bila kosong.

## Bukan lingkup tugas ini
- **Setelah demo:** simpan otomatis 20 detik dan state konflik versi 20c (CMS-03), ubah judul materi, bagian Video, blok "Quiz materi", panel "Syarat materi lengkap" (21i), tombol "Pratinjau" dan "Selesai", tata letak tablet dan ponsel editor (20e: editor tidak dibuka di ponsel), penjaga navigasi sidebar.
- **Kartu editor quiz (Min 8):** tautan "Sunting quiz" dari halaman editor materi (22h).
- **Diketahui, tidak diubah:**
  - Tanpa cek versi, simpan terakhir yang menang. Diterima untuk demo; catat di PR.
  - Outline builder memuat isi TipTap semua materi hanya untuk `isContentEmpty` (catatan STATUS 4 Nov malam).

Pekerjaan di luar lingkup → **berhenti dan tanyakan.**

## Berkas yang boleh dibuat/diubah
- `src/lib/request-body.ts` + tesnya (baru); `src/lib/errors.ts` (satu kelas `PayloadTooLargeError`)
- `src/modules/lesson/{schema,service,queries,serializer}.ts` + tes skema, serializer, dan integrasinya
- `src/modules/course/{schema,service,queries,serializer}.ts` + tes skema, serializer, dan integrasinya
- `src/app/api/cms/courses/[id]/lessons/[lessonId]/route.ts`, `src/app/api/cms/courses/[id]/description/route.ts` (baru)
- `src/app/(cms)/cms/kursus/[id]/materi/[lessonId]/page.tsx`, `src/app/(cms)/cms/kursus/[id]/deskripsi/page.tsx` (baru)
- `src/components/cms/content-doc-form.tsx` + `content-doc-form.test.tsx` (baru), `src/components/cms/course-settings-panel.tsx` + tes builder yang menyentuh baris itu
- `e2e/cms-materi-editor.spec.ts` (baru), `e2e/layout/axe.spec.ts` (dua halaman baru)

Tanpa migrasi, tanpa dependensi baru, dan tanpa perubahan `package.json`/`package-lock.json`.

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- daftar berkas;
- signature setiap ekspor baru (fungsi, DTO, props `ContentDocForm`);
- urutan langkah di kedua transaksi;
- cara `readJsonBody` menghitung byte dan berhenti;
- pemetaan state indikator dan respons ke tampilan;
- daftar tes per bagian "Selesai jika";
- untuk setiap mutasi: tes yang diharapkan merah, beserta tes yang diperkirakan tetap hijau karena tertutup lapis lain.

## Selesai jika
- [ ] **Tes `readJsonBody`** (node):
  - body tepat `maxBytes` → terbaca;
  - `maxBytes + 1` → `PayloadTooLargeError`, untuk dua bentuk: `Content-Length` jujur, dan stream tanpa `Content-Length`;
  - `Content-Length` palsu yang kecil dengan body besar → tetap 413;
  - JSON rusak dan body kosong → `BadRequestError`.
- [ ] **Tes skema:**
  - `updateLessonContentInput` dengan `iframe` di indeks 0 → path `["content", "content", 0, "type"]` dan `params.code` `FORBIDDEN_EMBED`;
  - key tambahan di objek luar → ditolak;
  - `updateCourseDescriptionInput` setara.
- [ ] **Tes integrasi** (DB `e2e:db`, pola `service.integration.test.ts`), untuk materi dan deskripsi masing-masing:
  - **Sah:**
    - tersimpan, dan isinya sama dengan dokumen hasil validasi;
    - `updated_at` kursus ikut bergerak (khusus materi);
    - satu baris audit, `before`/`after` berisi ringkasan saja, dan JSON audit tidak memuat teks dokumen.
  - **Tanpa perubahan:** dokumen sama dengan urutan key berbeda → tidak ada tulis (`updated_at` tetap) dan tidak ada audit.
  - **Penjagaan:**
    - kursus `IN_REVIEW` → 409;
    - materi milik kursus lain → 404;
    - ID tidak ada → 404;
    - peran di bawah EDITOR → 403 **sebelum** input diparse.
  - **V-08:** dokumen berisi `iframe` → `ZodError`, path `content.content.0.type`, dan DB tidak berubah.
- [ ] **Tes komponen** (`content-doc-form.test.tsx`, jsdom; `RichTextEditor` di-mock dengan stub yang memanggil `onChange` dan punya `focus()`):
  - **Indikator:** tiap state di tabel bagian 4 muncul pada saat yang benar.
  - **Simpan:** satu `fetch` dengan method, URL, dan body `{ [bodyKey]: doc }` yang benar.
  - **Klik ganda / submit ganda** → satu `fetch`.
  - **Ctrl+S** → simpan, dan `defaultPrevented`.
  - **Dokumen tidak sah di klien** → tanpa `fetch`, pesan tampil, `aria-invalid`, fokus editor.
  - **Respons 400** dengan `fields[0].path = "content.content.0.type"` → pesan server di bawah editor.
  - **413** → "Teks terlalu panjang."
  - **409** → banner, lalu `router.refresh` dipanggil.
  - **Jaringan gagal** → bar 20c; "Coba lagi" mengirim ulang.
  - **Fokus:** setelah 200, kembali ke tombol Simpan.
  - **`beforeunload`:** hanya terpasang saat belum disimpan.
  - **Breadcrumb saat belum disimpan:** membuka dialog. "Tetap di sini" → tidak pindah. "Tinggalkan" → pindah.
- [ ] **Tes builder:** baris "Deskripsi" menampilkan ketiga bentuk di tabel bagian 6.
- [ ] **E2E** (`cms-materi-editor.spec.ts`, EDITOR):
  - **Teks materi:**
    1. Builder → klik materi → editor terbuka dengan breadcrumb dan judul.
    2. Ketik di `getByRole("textbox", { name: "Teks materi" })`, lalu Simpan → "TERSIMPAN".
    3. Muat ulang → teks bertahan.
    4. Breadcrumb ke builder → penanda materi kosong hilang.
  - **Deskripsi:**
    1. "+ Tulis deskripsi lengkap" → ketik → Simpan.
    2. Kembali ke builder → "Sudah diisi · Ubah", dan syarat "Deskripsi lengkap" terpenuhi.
  - **Penjaga:** ketik tanpa simpan, klik breadcrumb → dialog → "Tetap di sini" → teks masih ada.
  - **API** (request konteks yang sudah login):
    - `iframe` → 400 dengan `fields` berkode `FORBIDDEN_EMBED`;
    - body 2 MB → 413;
    - MEMBER → 403, termasuk dengan body 2 MB (peran dicek sebelum body).
  - **Kursus bukan `DRAFT`** → kedua halaman tampil terkunci, tanpa tombol Simpan.
  - **Lebar 360** → kedua halaman tidak menggulir ke samping.
- [ ] **Axe:** kedua halaman ditambahkan ke `e2e/layout/axe.spec.ts`, dengan pola yang sudah ada untuk `/cms/kursus/{id}`.
- [ ] **Uji mutasi** (merah, lalu dikembalikan dengan `git restore`). Merah berarti asersi gagal dengan alasan yang diharapkan. Laporkan per mutasi nama tes yang merah beserta pesannya.
  1. Cek `DRAFT` di transaksi materi dihapus.
  2. Filter `course_id` pada kunci baris materi dihapus.
  3. `readJsonBody` tanpa pembatas stream (hanya cek header).
  4. `contentDocSchema` diganti `z.unknown()` di skema materi.
  5. Deteksi "tanpa perubahan" dihapus.
  6. Audit menyimpan dokumen utuh.
  7. Peran dicek setelah `readJsonBody`.
  8. Penjaga `inFlight` dihapus.
  9. `beforeunload` dipasang tanpa syarat.
  10. Dialog penjaga breadcrumb dilewati.

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`. `main` sudah memuat S1-03a dan S1-03b.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR. Harapan sama dengan akhir S1-03b (dikonfirmasi 6 Nov di `main` `d3eab7f`: 0 excused / 0 blocking / 23). Angka lain atau temuan blocking baru → berhenti dan tempel output lengkapnya.
- **Prettier:** berkas yang sudah ada tetap apa adanya, sehingga diff sebatas lingkup. Berkas baru boleh dirapikan.
- **Uji mutasi:** commit lokal dulu, lalu kembalikan setiap mutasi dengan `git restore`.
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas.
- **"Keputusan & asumsi" di PR** memuat semua copy usulan dan keputusan yang diambil tanpa bertanya.
- **Screenshot e2e** kedua halaman (w1280 dan w768, termasuk state "BELUM DISIMPAN", "TERSIMPAN", bar gagal, dan dialog penjaga) disimpan di artefak CI, dengan `animations: "disabled"` (pelajaran S1-01).
- **Setelah push:** cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e`
- `git diff --stat main -- package.json package-lock.json src/db` kosong

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Lokal (`npm run dev:db`, lalu `npm run dev`), sebagai akun EDITOR:
  1. Buat kursus, tambah satu materi, lalu buka editornya dari outline.
  2. Tulis beberapa paragraf memakai B, I, H2, list, tautan, dan tabel, lalu Ctrl+S.
  3. Muat ulang: semuanya bertahan.
  4. Kembali ke builder: materi tidak lagi ditandai kosong.
  5. Tulis deskripsi lewat "+ Tulis deskripsi lengkap", simpan, kembali: syarat "Deskripsi lengkap" terpenuhi.
- [ ] Ketik sesuatu tanpa menyimpan, lalu klik nama kursus di breadcrumb → dialog muncul. Coba juga tutup tab → peringatan browser muncul.
- [ ] Unggah screenshot halaman editor materi dan deskripsi (w1280) ke Claude chat untuk dibandingkan dengan 21i.

## Catatan jadwal
- Sesi dimulai setelah **S1-03b merge**.
- **Bila 20b dipisah dari S1-03b** (kartu S1-03c), kartu ini tidak terpengaruh: penolakan tempel ada di dalam komponen editor, dan V-08 tetap ditegakkan endpoint.

## Catatan keputusan
- **Simpan manual** (keputusan 3 Nov). Indikator 20c dipakai untuk state yang masih relevan, ditambah "BELUM DISIMPAN" karena tanpa simpan otomatis penulis perlu tahu ada perubahan yang belum aman. Ctrl+S ditambahkan karena penulis terbiasa menekannya, dan tanpa penanganan tombol itu membuka dialog simpan halaman browser.
- **Tanpa cek versi.** Membandingkan `updated_at` kursus membuat simpan deskripsi gagal palsu setiap kali materi disimpan di tab lain (simpan materi menyentuh baris kursus). Konflik versi yang benar butuh kolom versi per dokumen dan ikut CMS-03 setelah demo.
- **Deskripsi di halaman sendiri**, bukan dialog. Isinya dokumen panjang dengan toolbar, tabel, dan dialog tautan; halaman memakai komponen formulir yang sama dengan editor materi, dan tidak ada dialog bertumpuk.
- **Endpoint deskripsi terpisah** dari `PATCH /api/cms/courses/{id}`. Kontrak pengaturan S1-02 tetap `strictObject` lima field, dan dokumen panjang tidak ikut terkirim setiap kali pengaturan disimpan.
- **Batas body 1 MiB dibaca sebagai stream**, karena `request.json()` membaca seluruh body tanpa batas, dan `Content-Length` bisa tidak ada atau berbohong. Peran dicek sebelum body dibaca, supaya pemanggil tanpa hak tidak bisa memaksa server membaca 1 MiB.
- **Server menyimpan dokumen hasil validasi**, bukan input. Perbandingan "tanpa perubahan" memakai kesamaan struktur, karena `jsonb` tidak mempertahankan urutan key.
