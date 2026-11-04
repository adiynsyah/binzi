# S1-03a · Dokumen konten: validator server, renderer, batas isi

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | S1-02 (PR #108, `main` `e7612b5`): `src/lib/content-doc.ts` dengan `EMPTY_DOC` dan `isDocEmpty` |
| **Target** | Merge Jumat 6 Nov (sebelum atau sesudah C-04). Langkah ketiga jalur demo 20 Nov |
| **Branch** | `s1/s1-03a-dokumen-konten` |

> **Dibuat 4 Nov 2026** di Claude chat, lalu ditinjau ulang terhadap `main` `e7612b5` (S1-02 sudah di-merge) pada malam yang sama. Bila `main` bergerak lagi sebelum sesi, tinjau ulang dulu.
>
> **S1-03 dipecah dua** (keputusan pemilik 4 Nov). S1-03a (kartu ini) tanpa dependensi baru, jadi tidak bentrok dengan lockfile C-04 (Jum 6). S1-03b memasang TipTap 3.32.0 dan membangun editor setelah C-04 merge. Daftar node, atribut, dan batas di kartu ini adalah kontrak yang wajib dipenuhi keluaran editor S1-03b.
>
> **Tabel masuk lingkup demo** (keputusan pemilik 4 Nov): validator dan renderer tabel di kartu ini, tombol dan perintah tabel di editor S1-03b.

## Tujuan
Satu sumber aturan untuk dokumen konten kaya (teks materi, deskripsi kursus, nanti artikel): validator server yang menegakkan CRS-05 dan V-08 tanpa bisa di-bypass, dan renderer yang hanya mengeluarkan elemen dari daftar putih. S1-04 memakai validator saat menyimpan; halaman materi peserta (Kam 12) memakai renderer.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD: `docs/prd/sections/06-2-kursus-materi.md` (CRS-03, CRS-04, CRS-05), `12-keamanan.md` (§12.3 dan baris V-08), `11-model-data.md` (baris "Konten kaya disimpan sebagai JSONB")
- Desain: `docs/design/screens/20a.md + .png` (badan teks dan kutipan di kanvas tulis), `20b.md + .png` (alasan penolakan; UI-nya milik kartu lain), `21i.md` (toolbar editor materi)
- `docs/design/handoff/TOKENS.md` bagian Warna (`text-body`) dan Tipografi
- Kode: `src/lib/content-doc.ts` + tesnya (S1-02), `src/db/seed-demo.ts` baris 54–69 (bentuk dokumen seed), `src/styles/tokens.css`, `src/app/(dev)/dev/ui/page.tsx`, `eslint.config.mjs`, `src/components/cms/course-list.test.tsx` (pola tes komponen)

## Kerjakan

### 1. Model dokumen (daftar putih)
Bentuknya persis keluaran `editor.getJSON()` TipTap 3.32.0 dengan StarterKit (heading level 2–4; `code`, `codeBlock`, `strike` dimatikan) dan `TableKit` (`resizable: false`). Bentuk ini sudah dicek di Claude chat lewat `getSchema()` dan `toJSON()`.

**Node:**

| Node | Isi (`content`) | `attrs` |
|---|---|---|
| `doc` | ≥ 1 node blok | tidak ada |
| `paragraph` | node inline; boleh tidak ada atau `[]` | tidak ada |
| `heading` | node inline; boleh tidak ada atau `[]` | wajib: `{ level: 2 \| 3 \| 4 }` |
| `bulletList` | ≥ 1 `listItem` | tidak ada |
| `orderedList` | ≥ 1 `listItem` | wajib: `{ start: bilangan bulat 1–9999, type: null \| "1" \| "a" \| "A" \| "i" \| "I" }` |
| `listItem` | `paragraph`, lalu nol atau lebih node blok | tidak ada |
| `blockquote` | ≥ 1 node blok | tidak ada |
| `horizontalRule` | tidak ada | tidak ada |
| `table` | ≥ 1 `tableRow` | tidak ada |
| `tableRow` | ≥ 1 sel (`tableHeader` atau `tableCell`) | tidak ada |
| `tableHeader`, `tableCell` | ≥ 1 node blok selain `table` | wajib: `{ colspan, rowspan, colwidth, align }` (lihat "Atribut sel") |
| `hardBreak` | tidak ada | tidak ada |
| `text` | — (punya `text`: string ≥ 1 karakter, dan `marks` opsional) | — |

Node blok: `paragraph`, `heading`, `bulletList`, `orderedList`, `blockquote`, `horizontalRule`, `table`. Node inline: `text`, `hardBreak`. `tableRow` hanya di dalam `table`, dan sel hanya di dalam `tableRow`.

**Atribut sel** (`tableHeader` dan `tableCell`):
- `colspan`: bilangan bulat 1–20;
- `rowspan`: bilangan bulat 1–50;
- `colwidth`: `null`, atau array 1 sampai `colspan` bilangan bulat 1–10.000 (diisi TipTap dari `<colgroup>` saat menempel tabel);
- `align`: `null`, `"left"`, `"center"`, atau `"right"` (nilai yang dinormalisasi TipTap 3.32.0).

Validator tidak memeriksa apakah jumlah kolom per baris rata; editor (prosemirror-tables) yang menjaganya, dan renderer tetap aman bila tidak rata.

**Mark:** `bold`, `italic`, `underline` (tanpa `attrs`), dan `link` dengan `attrs` wajib `{ href, target, rel, class, title }`:
- `href`: aturan bagian 3;
- `target`: `"_blank"` atau `null`;
- `rel`: string ≤ 100 karakter atau `null`;
- `class`: `null`;
- `title`: string ≤ 200 karakter atau `null`.

Satu jenis mark paling banyak sekali per node teks; urutannya bebas.

**Ketat:** setiap key yang tidak tercantum di daftar putih — di node, di `attrs`, atau di mark — membuat dokumen tidak sah, termasuk `__proto__` dan `constructor` hasil `JSON.parse`. Menambah node nanti (callout, gambar) cukup dengan menambah baris di sini, dan dokumen yang sudah tersimpan tetap sah.

**Tipe:** `ContentDoc` dan tipe node-nya tinggal di `src/lib/content-doc.ts`. Array di tipe node memakai `readonly`, supaya `EMPTY_DOC` dari S1-02 (yang ditulis `as const`) bisa `satisfies ContentDoc` tanpa diubah bentuknya; `isDocEmpty` tetap menerima `unknown`.

### 2. Validator
- **Berkas baru `src/lib/content-doc-validator.ts`**, murni: tanpa `server-only`, tanpa DB. Dipakai server sekarang, dan editor di S1-03b.
- **`validateContentDoc(input: unknown)`** mengembalikan `{ ok: true; doc: ContentDoc }` atau `{ ok: false; issues: ContentDocIssue[] }`.
  - `doc` dibangun ulang dari daftar putih: objek baru, bukan input yang sama (pola serializer).
  - `ContentDocIssue` = `{ path: (string | number)[]; code; message }`. `path` menunjuk lokasi JSON persis, mis. `["content", 2, "content", 0, "marks", 1, "attrs", "href"]`, supaya editor nanti bisa menandai node yang salah (20b).
  - Paling banyak 20 issue; pengumpulan berhenti setelahnya.
- **Implementasi:** walker eksplisit di atas tabel daftar putih bagian 1. Setiap issue membawa kode dan path, dan batas kedalaman dicek sebelum turun satu tingkat.
- **Kode issue** (pesan = copy usulan; S1-04 memakainya sebagai pesan galat isian):

  | Kode | Kapan | Pesan |
  |---|---|---|
  | `FORBIDDEN_EMBED` | node `video`, `iframe`, `embed`, `object`, `script`, `audio`, `youtube` | "Video, iframe, embed, dan script tidak bisa dipasang di dalam teks." |
  | `UNKNOWN_NODE` | jenis node lain yang tidak ada di daftar putih — termasuk `image` dan `callout` sampai kartunya | "Format teks ini tidak didukung editor." |
  | `UNKNOWN_MARK` | jenis mark yang tidak ada di daftar | sama dengan di atas |
  | `INVALID_ATTRS` | `attrs` hilang, berlebih, atau nilainya di luar daftar putih | sama dengan di atas |
  | `INVALID_STRUCTURE` | isi tidak sesuai kolom "Isi" (termasuk tabel di dalam sel), root bukan objek `doc`, key tak dikenal di node, mark ganda | sama dengan di atas |
  | `INVALID_LINK` | `href` melanggar bagian 3 | "Tautan harus diawali https://, http://, mailto:, atau / untuk halaman BINZI." |
  | `TOO_LARGE` | lebih dari batas node atau teks | "Teks terlalu panjang." |
  | `TOO_DEEP` | lebih dari batas kedalaman | "Susunan teks terlalu bertingkat." |

- **Batas** (konstanta bernama, diekspor):
  - kedalaman maksimal 16 (`doc` = 0);
  - maksimal 5.000 node;
  - total panjang teks maksimal 100.000 karakter.

  Batas dicek sambil berjalan, dan validator berhenti begitu batas terlampaui. Dokumen bersarang 10.000 tingkat menghasilkan `TOO_DEEP`, tidak pernah `RangeError`.
- **Adapter Zod `contentDocSchema`** di berkas yang sama:
  - Bentuknya `z.unknown().transform(...)`: sukses → mengembalikan `doc` hasil validasi; gagal → satu issue `custom` per `ContentDocIssue` (path relatif, `message`, `params: { code }`).
  - Dipakai skema input S1-04, mis. `z.strictObject({ content: contentDocSchema })`. Path issue-nya otomatis berawalan nama field: node terlarang di indeks 0 menjadi `["content", "content", 0, "type"]` (dicek di zod 4.6.6).

### 3. Tautan
`href` sah bila memenuhi salah satu:
- URL absolut berprotokol `https:` atau `http:` dengan host tidak kosong;
- URL `mailto:`;
- path internal yang diawali tepat satu `/` (bukan `//`, bukan `/\`).

Selain itu → `INVALID_LINK`, termasuk:
- `javascript:` dalam variasi huruf apa pun, `data:`, `vbscript:`;
- spasi atau karakter kontrol di mana pun dalam `href` (mis. `" javascript:…"`, `"java\tscript:…"`); nilainya tidak dipangkas;
- path relatif tanpa `/`, string kosong, dan lebih dari 2.048 karakter.

S1-03b menyetel `protocols`/`isAllowedUri` ekstensi Link agar sama dengan aturan ini.

### 4. `isDocEmpty` dan `EMPTY_DOC`
- Aturan "kosong = tidak ada node `text` berisi selain spasi" tetap, di `src/lib/content-doc.ts`. Dokumen yang hanya berisi `hardBreak` atau `horizontalRule` → kosong.
- `EMPTY_DOC` lolos validator.
- Untuk setiap dokumen sah di tes validator, `isDocEmpty` sejalan dengan "ada teks selain spasi".
- Tabel (catatan STATUS 4 Nov): teks di sel mana pun membuat dokumen tidak kosong; tabel yang semua selnya kosong → kosong. Pencarian rekursif S1-02 sudah membaca isi sel, jadi bagian ini cukup dibuktikan dengan tes. Perluasan untuk gambar ikut S1-07.
- Komentar kepala `content-doc.ts` ("S1-03 widens emptiness to images/tables…") diperbarui: tabel sudah tercakup, gambar ikut S1-07.

### 5. Renderer `RichContent`
- **Berkas baru `src/components/shared/rich-content.tsx`**, tanpa `"use client"` dan tanpa impor server. Dengan begitu ia bisa dipakai server component (halaman materi, artikel ISR) maupun komponen klien (pratinjau editor).
- **Props:** `doc: unknown`, `className?: string`.
  - `doc` null atau undefined → tidak merender apa pun.
  - Selain itu, renderer selalu memvalidasi ulang dengan `validateContentDoc` (§12.3 "sanitasi ulang saat render") dan merender **hanya** `doc` hasil validasi.
  - Tidak sah → satu paragraf "Konten ini belum bisa ditampilkan." (copy usulan) dan satu `console.error` berisi kode dan path issue saja, tanpa isi dokumen.
- **Keluarannya elemen React.** Teks masuk sebagai child React, sehingga di-escape React.
- **Pemetaan:**

  | Node/mark | Elemen | Catatan |
  |---|---|---|
  | `paragraph` | `<p>` | paragraf tanpa isi tidak dirender (`EMPTY_DOC` → kosong) |
  | `heading` | `<h2>`, `<h3>`, `<h4>` | sesuai `level` |
  | `bulletList`, `orderedList` | `<ul>`, `<ol>` | atribut `start` bila ≠ 1; `type` bila tidak null |
  | `listItem` | `<li>` | |
  | `blockquote` | `<blockquote>` | |
  | `horizontalRule` | `<hr>` | |
  | `hardBreak` | `<br>` | |
  | `table` | wadah gulir + `<table>` | aturan di bawah |
  | `tableRow` | `<tr>` | |
  | `tableHeader` | `<th>` | `scope="col"` di `<thead>`, `scope="row"` di `<tbody>` |
  | `tableCell` | `<td>` | |
  | `bold`, `italic`, `underline` | `<strong>`, `<em>`, `<u>` | |
  | `link` | `<a href>` | aturan di bawah |

- **Tautan:**
  - `target`, `rel`, `class`, dan `title` dari dokumen diabaikan; renderer yang menentukan.
  - `https:`/`http:` → `target="_blank"`, `rel="noopener noreferrer"`, dan span `sr-only` " (membuka tab baru)" (copy usulan).
  - Path internal dan `mailto:` → tanpa `target`.
  - Root renderer `relative`, supaya span `sr-only` tidak lolos dari wadah `overflow-*` milik halaman pemakai (pelajaran S1-01).
- **Tabel:**
  - Wadah: `<div role="region" aria-label="Tabel n" tabIndex={0}>`, dengan n = urutan tabel di dokumen (copy usulan), `relative overflow-x-auto`, dan cincin fokus standar. Tabel lebar bisa digeser dengan keyboard, dan wadah gulir yang bisa difokus memenuhi aturan axe `scrollable-region-focusable`.
  - Baris pertama yang **seluruhnya** `tableHeader` masuk `<thead>`; baris lain di `<tbody>`. Tanpa baris seperti itu, semua baris di `<tbody>`.
  - `colspan`/`rowspan` > 1 → `colSpan`/`rowSpan`. `align` → kelas `text-left`/`text-center`/`text-right`. `colwidth` diabaikan; lebar kolom mengikuti layar.
- **Tipografi** (TOKENS "Badan artikel/materi" dan 20a), kelas Tailwind per elemen, hanya token, tanpa hex:
  - root: warna `text-body`, 17 px / 1.75, `max-w-(--width-measure)`; paragraf `text-pretty`;
  - jarak antarblok 16 px; elemen pertama tanpa margin atas;
  - `h2` 24 px / 1.28, bobot 900, tracking −0.02em, margin atas 32 px;
  - `h3` 19 px / 1.3, bobot 900, tracking −0.015em, margin atas 24 px;
  - `h4` 17 px / 1.4, bobot 700, margin atas 20 px;
  - heading berwarna `text` dan `text-balance`;
  - list: `list-disc`/`list-decimal`, indentasi 24 px, jarak antar-`li` 8 px;
  - `blockquote`: garis kiri 2 px token `text`, padding kiri 20 px, 18 px / 1.7, warna `text` (20a);
  - `hr`: garis token `border`, margin vertikal 32 px;
  - tabel (usulan, desain belum menggambar tabel konten): `w-full border-collapse`, 16 px / 1.5; sel bergaris token `border`, padding 8 × 12 px, `align-top`, lebar minimal 120 px, `wrap-anywhere`; jarak antarblok di dalam sel 8 px; `th` berlatar `surface-2`, bobot 700, warna `text`;
  - tautan: `text-primary-deep` bergaris bawah, hover `primary-deeper`, cincin fokus standar (aturan C-07: teks tidak pernah memakai `primary`);
  - `strong` bobot 700 (Lato tidak punya 600).

### 6. Pengaman lint
Tambahkan `react/no-danger: "error"` untuk `src/**` di `eslint.config.mjs`, sebagai blok tersendiri. Sekarang ada nol pemakaian `dangerouslySetInnerHTML`, dan aturan ini menjaga agar dokumen konten selalu dirender lewat `RichContent` di kartu-kartu berikutnya. Aturan ini tersedia di konfigurasi `eslint-config-next` 16.4.1 (dicek di Claude chat).

### 7. Contoh di `/dev/ui`
- **Fixture `src/lib/content-doc-fixtures.ts` (baru):** `CONTENT_DOC_SHOWCASE` memuat setiap node dan mark minimal sekali:
  - H2, H3, H4;
  - list bersarang tiga tingkat, campuran `ul` dan `ol`, satu `ol` dengan `start: 3`;
  - tautan eksternal, internal, dan `mailto:`;
  - `blockquote`, `horizontalRule`, `hardBreak`;
  - satu paragraf 80 karakter tanpa spasi;
  - satu tabel 3 kolom: baris judul, tiga baris isi, satu sel `colspan: 2`, satu sel `align: "center"`, satu sel berisi list, satu sel berisi teks 80 karakter tanpa spasi, dan satu `tableHeader` di kolom pertama baris isi;
  - satu tabel kedua yang lebih lebar dari 360 px (6 kolom), untuk memeriksa geser horizontal.

  Isinya teks pengisi bertanda "[CONTOH]", tanpa isi gizi (PRD §13.4). Fixture yang sama dipakai tes validator dan tes renderer.
- **Bagian baru "Konten kaya" di `/dev/ui`:** fixture showcase, ditambah satu contoh dokumen tidak sah (berisi `iframe`) yang menampilkan fallback. Impor baru memakai `@/`.

## Bukan lingkup tugas ini
- **S1-03b:** editor TipTap, dependensinya, toolbar (termasuk tombol dan perintah tabel), dan UI penolakan 20b.
- **S1-04:** menyimpan konten (API materi dan deskripsi), termasuk batas ukuran body request.
- **Halaman materi peserta (Kam 12).**
- **Setelah demo:** node callout dan gambar (gambar bersama S1-07).
- **Kartu lain:** teks soal dan pembahasan quiz (editor quiz memutuskan apakah memakai validator ini); ekstraksi teks polos, waktu baca, `search_vector` (artikel).

Pekerjaan di luar lingkup → **berhenti dan tanyakan**.

## Berkas yang boleh dibuat/diubah
- `src/lib/content-doc.ts` (tipe, `satisfies`, komentar kepala; aturan `isDocEmpty` tetap) + `src/lib/content-doc.test.ts`
- `src/lib/content-doc-validator.ts` + tesnya (baru)
- `src/lib/content-doc-fixtures.ts` (baru)
- `src/components/shared/rich-content.tsx` + tesnya (baru)
- `src/app/(dev)/dev/ui/page.tsx`, ditambah satu berkas demo baru di folder yang sama bila perlu
- `eslint.config.mjs` (satu blok `react/no-danger`)

Tanpa migrasi, dan tanpa perubahan `package.json`, `package-lock.json`, atau `src/db`.

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- daftar berkas yang akan dibuat atau diubah;
- bentuk tabel daftar putih sebagai struktur data;
- signature setiap ekspor dan tipe `ContentDoc`;
- urutan cek di walker (kapan kedalaman, jumlah node, dan panjang teks dicek);
- pemetaan renderer beserta kelas Tailwind per elemen;
- daftar tes per bagian "Selesai jika";
- untuk setiap mutasi, tes yang diharapkan merah.

## Selesai jika
- [ ] **Tes validator** (`content-doc-validator.test.ts`):
  - **Sah:**
    - `EMPTY_DOC`, bentuk seed demo (`doc` → `paragraph` → `text`), `CONTENT_DOC_SHOWCASE`, dan paragraf dengan `content: []`;
    - keluaran sama secara deep-equal dengan input, tetapi bukan objek yang sama.
  - **V-08:** masing-masing `video`, `iframe`, `embed`, `object`, `script`, `audio`, `youtube` — di tingkat atas, di dalam `listItem`, dan di dalam `blockquote` → `FORBIDDEN_EMBED` dengan path persis.
  - **Tidak dikenal:**
    - node `image`, `callout`, `codeBlock` → `UNKNOWN_NODE`;
    - mark `strike`, `code`, `highlight`, `textStyle` → `UNKNOWN_MARK`.
  - **Atribut:**
    - heading level 1, 5, dan `"2"` (string);
    - heading tanpa `attrs`; key tambahan di `attrs` heading; `attrs` pada paragraph;
    - `orderedList` dengan `start` 0 dan 1.5, `type` `"disc"`;
    - link dengan `class` berupa string, link tanpa `href`;
    - `__proto__` dan `constructor` (dari `JSON.parse`) sebagai key di node dan di `attrs` → ditolak, dan `Object.prototype` tidak berubah.
  - **Struktur:**
    - `doc` dengan `content: []`;
    - root bukan `doc`; root berupa `null`, array, atau string;
    - `text` kosong, `text` tanpa field `text`, `text` yang punya `content`;
    - mark sejenis dua kali;
    - `listItem` yang diawali `bulletList`, `bulletList` kosong;
    - `hardBreak` di tingkat blok, `paragraph` di dalam `paragraph`;
    - `table` kosong, `tableRow` kosong, sel tanpa isi, `table` di dalam sel, `tableRow` di tingkat atas, sel di luar `tableRow`.
  - **Atribut sel:** `colspan` 0, 21, dan `"2"`; `rowspan` 51; `align` `"justify"`; `colwidth` `[NaN]`, `[0]`, dan array lebih panjang dari `colspan`; sel tanpa `align` → `INVALID_ATTRS`. Sel dengan `colwidth: [120]` → sah.
  - **Tautan:**
    - diterima: `https://…`, `http://…`, `mailto:…`, `/kursus/x`;
    - ditolak: `javascript:` (huruf campuran, spasi di depan, tab di tengah), `data:`, `vbscript:`, `//evil.example`, `/\evil.example`, `https://` tanpa host, `kursus/x`, string kosong, 2.049 karakter.
  - **Batas:**
    - kedalaman 17 → `TOO_DEEP`;
    - 10.000 tingkat → `TOO_DEEP` tanpa melempar;
    - 5.001 node → `TOO_LARGE`;
    - total teks 100.001 karakter → `TOO_LARGE`;
    - 30 node terlarang → tepat 20 issue.
  - **Adapter Zod:** `z.strictObject({ content: contentDocSchema })` → path `["content", "content", 0, "type"]` dan `params.code`; saat sukses, keluarannya `doc` hasil validasi.
- [ ] **Tes `isDocEmpty`** (tambahan): dokumen berisi `hardBreak` saja, `horizontalRule` saja, atau tabel yang semua selnya kosong → `true`; tabel dengan teks di satu sel → `false`; konsisten dengan "ada teks selain spasi" untuk setiap fixture sah.
- [ ] **Tes renderer** (`rich-content.test.tsx`, jsdom):
  - **Showcase:** setiap elemen di tabel pemetaan muncul (`h2`, `h3`, `h4`, `ul`, `ol[start="3"]`, `li` bersarang, `blockquote`, `hr`, `br`, `strong`, `em`, `u`, tiga `a`), dan tidak ada `h1`.
  - **Tautan:**
    - eksternal → `target="_blank"`, `rel="noopener noreferrer"`, dan teks sr-only;
    - internal dan `mailto:` → tanpa `target`;
    - `rel`/`target` dari dokumen diabaikan (dokumen dengan `rel: "x"`, `target: null` tetap menghasilkan atribut renderer).
  - **Tabel:**
    - baris judul showcase di `<thead>` dengan `th[scope="col"]`; `tableHeader` di kolom pertama baris isi → `th[scope="row"]`;
    - tabel yang baris pertamanya campuran → tanpa `<thead>`;
    - `colSpan="2"` dan kelas `text-center` muncul; tidak ada atribut `width` atau `style` dari `colwidth`;
    - dua tabel → dua wadah `role="region"` dengan `tabindex="0"` dan nama "Tabel 1", "Tabel 2".
  - **Escape:** teks `<script>alert(1)</script>` dan `<img src=x onerror=alert(1)>` tampil sebagai teks, dan `container.querySelector("script, img, iframe")` bernilai null.
  - **Tidak sah:** dokumen berisi `iframe` → tanpa `iframe`, fallback tampil, `console.error` dipanggil sekali, dan argumennya tidak memuat teks dokumen.
  - **Kosong:** `null` → container kosong; `EMPTY_DOC` → tanpa `<p>` dan tanpa fallback.
- [ ] **Uji mutasi** (merah, lalu dikembalikan dengan `git restore`):
  1. Validator menerima jenis node yang tidak ada di daftar putih.
  2. Cek protokol `href` dimatikan.
  3. Cek kedalaman dihapus.
  4. Key tambahan diterima (cek ketat dimatikan).
  5. Renderer merender `doc` mentah tanpa validasi ulang.
  6. `rel` tautan eksternal dihapus dari renderer.
  7. `dangerouslySetInnerHTML` ditambahkan ke renderer → `eslint .` merah.
  8. Adapter Zod tanpa `path` issue.
  9. `table` diizinkan di dalam sel.
  10. Wadah tabel tanpa `tabIndex`.

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi dan sebelum PR.
  - Harapan sebelum C-04 masuk: 5 excused / 0 blocking / 31 info-low-moderate.
  - Setelah branch menggabung `main` pasca-C-04: 0 excused / 0 blocking / 32 info-low-moderate.
  - Angka lain atau temuan blocking baru → berhenti dan tempel output lengkapnya.
- **Prettier:** berkas yang sudah ada tetap apa adanya, sehingga diff sebatas lingkup. Berkas baru boleh dirapikan.
- **Uji mutasi:** commit lokal dulu, lalu kembalikan setiap mutasi dengan `git restore`.
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas.
- **"Keputusan & asumsi" di PR** memuat semua copy usulan dan keputusan yang diambil tanpa bertanya.
- **Setelah push:** cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e` (sekali di lokal sebagai regresi; CI menjalankannya lagi)
- `git diff --stat main -- package.json package-lock.json src/db` kosong

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau.
- [ ] Lokal (`npm run dev:db`, lalu `npm run dev`): buka `/dev/ui` bagian "Konten kaya" di lebar 360 dan 1280 (DevTools). Ambil screenshot keduanya dan unggah ke Claude chat untuk dibandingkan dengan 20a dan TOKENS.
- [ ] Di lebar 360: halaman tidak menggulir ke samping; tabel 6 kolom menggulir di dalam wadahnya. Dengan keyboard saja: Tab sampai wadah tabel (cincin fokus terlihat), lalu panah kanan menggeser tabel.
- V-08 lewat API (payload `iframe` langsung ke endpoint) diverifikasi di S1-04, saat endpoint simpan ada.

## Catatan jadwal
C-04 dimulai Jumat 6 Nov ≥ 07.00 WIB. Bila sesi ini belum selesai saat itu:
1. Commit dan push semua pekerjaan, lalu akhiri sesi.
2. Pemilik menjalankan C-04 dari `main`.
3. Setelah C-04 merge, lanjutkan di branch ini dengan `git merge origin/main && npm ci` (bukan rebase), lalu ulangi `npm run check` dan gate.

Kartu ini tidak menyentuh berkas paket, jadi penggabungan itu bebas konflik.

## Catatan keputusan
- **S1-03 dipecah menurut kebutuhan dependensi** (keputusan pemilik 4 Nov). Validator dan renderer hanya fungsi murni di atas JSON, jadi bisa dikerjakan sebelum TipTap terpasang. Kecocokan dengan editor dibuktikan di S1-03b lewat tes bolak-balik: keluaran `getJSON()` setiap fitur toolbar wajib lolos validator kartu ini. Bila S1-03b menemukan beda, tabel bagian 1 yang diperbarui di S1-03b, per node, bukan validator yang dilonggarkan.
- **Renderer ditulis sendiri.** `@tiptap/html` versi server butuh `happy-dom` sebagai peer dependency, padahal daftar putih di sini hanya empat belas jenis node dan empat mark. Elemen React memberi escape otomatis dan tidak pernah membuat string HTML.
- **Daftar putih dimulai sempit.** Callout dan gambar ditunda. Menambah node kemudian tidak mengubah dokumen yang sudah tersimpan, sedangkan mencabut node bisa membuat dokumen lama tidak sah.
- **Tabel dibagi dua kartu.** Validator dan renderer tabel di sini karena murni dan bisa dikerjakan Kamis; Sabtu (S1-03b lalu S1-04) sudah padat. Kontrak untuk S1-03b: `TableKit.configure({ table: { resizable: false } })`; perintah sisip tabel tidak tersedia saat kursor di dalam sel; dan `colwidth` hasil tempel yang tidak sah (mis. `NaN` dari `<col width="auto">`) dinormalisasi ke `null` sebelum disimpan.
- **Atribut ketat mengikuti keluaran TipTap 3.32.0**, bukan "apa pun yang mirip". Kunci yang tidak dikenal tidak pernah sampai ke database maupun renderer.
- **`rel` dan `target` tautan ditentukan renderer**, sehingga dokumen tidak bisa membuka tab baru tanpa `noopener`.
