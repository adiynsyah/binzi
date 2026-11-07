# S1-03b · Editor TipTap: toolbar inti, tautan, tabel, penolakan tempel 20b

| | |
|---|---|
| **Pemilik** | Agent — satu sesi, satu branch, satu PR |
| **Bergantung pada** | **C-04** sudah merge (lockfile baru) dan **S1-03a** sudah merge (`validateContentDoc`, `classifyHref`, `ContentDoc`, `CONTENT_DOC_SHOWCASE`, `RichContent`) |
| **Target** | Sabtu 7 Nov, sebelum sesi S1-04. Langkah keempat jalur demo 20 Nov |
| **Branch** | `s1/s1-03b-editor-tiptap` |

> **Dibuat 5 Nov 2026** di Claude chat. **Ditinjau ulang terhadap `main` `2e9a44f`** (S1-03a, PR #110) pada hari yang sama: semua nama ekspor S1-03a yang dirujuk kartu ini ada dengan nama yang sama. **Ditinjau 6 Nov terhadap `main` `d3eab7f`** (C-04, PR #111): simulasi dependensi bagian 1 diulang di atas lockfile `main` yang sebenarnya, dan angkanya sama (49 entri baru, 0 entri lama berubah, entri terbaru `linkifyjs` 4.4.0, gate 0 / 0 / 23). C-04 tidak menyentuh `src/`, jadi rujukan kode tetap berlaku.
>
> **Ditinjau ulang 7 Nov terhadap `main` `822d0ce`** (PR docs #112, tanpa perubahan `src/`). Simulasi bagian 1 diulang dan angkanya sama. Komponen editor diuji dengan React Testing Library di jsdom 29.1.1, dan ada dua koreksi:
> - jsdom tidak punya `Range.prototype.getClientRects`, sehingga tes komponen butuh polyfill (bagian "Selesai jika", lingkungan jsdom);
> - `aria-invalid` lewat `editor.setOptions` di efek hilang pada render berikutnya, jadi atribut kanvas kini dibangun di opsi `useEditor` (bagian 3, mutasi 11).
>
> **Disetujui pemilik 5 Nov:**
> - panel 20b inline seperti desain;
> - semua copy usulan di kartu ini (tiga varian 20b, dialog tautan, menu tabel, nama tombol toolbar);
> - semua `colwidth` tempelan dijadikan `null`;
> - bagian 7 tetap di kartu ini, dan baru dipisah bila pemilik meminta saat sesi.
>
> Copy tersebut tetap dicantumkan di "Keputusan & asumsi" PR sebagai copy yang sudah disetujui.
>
> **Fakta TipTap 3.32.0 di kartu ini diuji di Claude chat** dengan editor headless di jsdom 29.1.1 (versi repo). Bagian "Catatan keputusan" memuat hasilnya.

## Tujuan
Satu komponen editor teks kaya untuk CMS yang keluarannya selalu lolos validator S1-03a. S1-04 memakainya untuk teks materi dan deskripsi kursus. Bentuk dokumen yang dihasilkan editor sama dengan daftar putih S1-03a, dan percobaan memasang video atau sematan dijelaskan kepada penulis (CRS-05, desain 20b), bukan dibuang diam-diam.

## Baca dulu (hanya ini)
- `CLAUDE.md`
- PRD: `docs/prd/sections/06-2-kursus-materi.md` (CRS-03, CRS-04, CRS-05), `12-keamanan.md` (§12.3)
- Desain:
  - `docs/design/screens/21i.md` + `.png` + `.html`: bingkai editor dan toolbar teks materi.
  - `20a.md` + `.html`: ikon list dan tautan (SVG di markup), dan state tombol aktif.
  - `20b.md` + `.png` + `.html`: panel penolakan.
- `docs/design/handoff/TOKENS.md` bagian Warna, Tipografi, Radius
- Kode S1-03a: `src/lib/content-doc.ts`, `src/lib/content-doc-validator.ts` (ekspor saja), `src/lib/content-doc-fixtures.ts`, `src/components/shared/rich-content.tsx` (sumber tipografi kanvas)
- Kode UI: `src/components/ui/dialog.tsx`, `dropdown-menu.tsx`, `button-variants.ts`, `field.tsx`, `input.tsx`, `test-env.ts`, dan `src/components/cms/course-list.test.tsx` (pola tes komponen)
- `src/app/(dev)/dev/ui/page.tsx`

## Kerjakan

### 1. Dependensi
Jalankan tepat satu perintah ini, di atas `main` pasca-C-04:

```bash
npm install --save-exact --before=2026-10-24 \
  @tiptap/react@3.32.0 @tiptap/pm@3.32.0 @tiptap/starter-kit@3.32.0 \
  @tiptap/extension-table@3.32.0 @tiptap/extensions@3.32.0
```

**Harapan** (hasil simulasi Claude chat di atas lockfile pasca-C-04, 5 Nov):
- `package.json`: lima baris `dependencies` baru bernilai persis `"3.32.0"`.
- `package-lock.json`: 49 entri baru, 0 entri lama berubah selain entri root.
- Entri terbaru: `linkifyjs` 4.4.0, rilis 23 Okt 2026 01.40 UTC. Lolos soak 14 hari sejak 6 Nov.
- Gate audit: 0 excused / 0 blocking / 23 info-low-moderate, sama sebelum dan sesudah pemasangan.
- `npm ls @tiptap/core` menunjukkan satu versi, 3.32.0. `@tiptap/core` datang sebagai peer dependency `@tiptap/react` dan tidak ditulis di `package.json`.

**Bila hasilnya berbeda** (jumlah entri, entri lama berubah, entri yang rilis setelah 24 Okt, atau angka gate lain): berhenti dan tempel outputnya. Versi TipTap tetap 3.32.0. Versi 3.32.1 baru lolos soak 11 Nov.

**Aturan impor:**
- API TipTap (`Editor`, `Extension`, `useEditor`, `useEditorState`, `EditorContent`, tipe `JSONContent`) diimpor dari `@tiptap/react`, yang me-re-ekspor seluruh `@tiptap/core`.
- API ProseMirror diimpor dari `@tiptap/pm/*`.
- Tidak ada impor langsung dari `@tiptap/core`, `prosemirror-*`, atau `linkifyjs`.

### 2. Konfigurasi editor — `src/components/cms/editor-extensions.ts`
`createEditorExtensions(options?: { placeholder?: string })` adalah satu-satunya sumber konfigurasi. Komponen dan tes headless memakai fungsi yang sama.

- **`StarterKit.configure`:**
  - `heading: { levels: [2, 3, 4] }`; `code: false`, `codeBlock: false`, `strike: false`.
  - `link`:
    - `openOnClick: false`, `autolink: true`, `linkOnPaste: true`, `defaultProtocol: "https"`;
    - `isAllowedUri: (url) => classifyHref(url) !== null`;
    - `shouldAutoLink` dibiarkan default. Opsi itu menerima teks mentah (mis. `contoh.id`), bukan `href` hasil akhirnya, dan jalur tautan otomatis tidak memanggil `isAllowedUri`. Default 3.32.0 sudah diuji: `ftp://…`, domain tanpa skema, dan email tetap teks biasa saat diketik maupun ditempel; hanya `http(s)://…` yang menjadi tautan. Tes di "Selesai jika" mengunci perilaku ini.
  - Ekstensi lain bawaan StarterKit 3.32.0 tetap menyala: `underline`, `undoRedo`, `trailingNode`, `listKeymap`, `dropcursor`, `gapcursor`.
- **`TableKit.configure({ table: { resizable: false } })`.**
- **`Placeholder` dari `@tiptap/extensions`,** default "Mulai menulis…".
- **Normalisasi `colwidth` saat tempel:** satu ekstensi kecil dengan plugin `transformPasted` yang menyetel `colwidth` setiap `tableCell`/`tableHeader` di slice tempelan menjadi `null`.
  - Ini semua nilai, bukan hanya yang tidak sah, karena renderer mengabaikan lebar kolom; editor dan halaman peserta jadi sama.
  - Tempelan `<col width="auto">` menghasilkan `NaN` di `getJSON()` (diuji), dan validator menolaknya.

Hasilnya, skema editor berisi tepat 14 node (`doc`, `paragraph`, `text`, `heading`, `bulletList`, `orderedList`, `listItem`, `blockquote`, `horizontalRule`, `hardBreak`, `table`, `tableRow`, `tableHeader`, `tableCell`) dan 4 mark (`bold`, `italic`, `underline`, `link`) — sama dengan daftar putih S1-03a.

### 3. Komponen `RichTextEditor` — `src/components/cms/rich-text-editor.tsx`
`"use client"`. API dirancang dari kebutuhan S1-04 (teks materi dan deskripsi kursus, masing-masing formulir satu isian dengan simpan manual, tanpa react-hook-form):

```ts
export type RichTextEditorHandle = { focus: () => void };

export type RichTextEditorProps = {
  defaultValue: ContentDoc;              // dibaca sekali saat mount; reset = remount dengan key baru
  onChange: (doc: JSONContent) => void;  // lihat aturan "suntingan" di bawah
  "aria-labelledby": string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  placeholder?: string;
  className?: string;
  ref?: Ref<RichTextEditorHandle>;       // focus() untuk pola "fokus ke isian salah" (C-08)
};
```

- **SSR:**
  - `useEditor({ immediatelyRender: false, ... })` ditulis eksplisit. TipTap 3.32.0 mendeteksi Next.js dan memaksa `false` sambil mencetak peringatan di konsol dev.
  - Sebelum editor siap (render server dan render pertama), bingkai dan toolbar tetap dirender dengan semua tombol nonaktif, dan kanvas memakai tinggi minimum yang sama, sehingga tidak ada lompatan tata letak.
- **Status toolbar** dibaca lewat `useEditorState`. Di 3.32.0 `useEditor` tidak me-render ulang pada setiap transaksi, jadi `editor.isActive(...)` saat render saja akan basi.
- **Aturan suntingan:**
  - `onChange(editor.getJSON())` dipanggil dari event `update` **hanya bila transaksi akarnya `docChanged`**.
  - Alasannya (diuji): dokumen yang berakhir dengan tabel, list, atau heading mendapat paragraf penutup dari `trailingNode` begitu editor difokus, dan TipTap memancarkan `update` untuk itu. Tanpa aturan ini, S1-04 menandai materi "belum disimpan" hanya karena penulis mengeklik kanvas.
  - Suntingan berikutnya membawa paragraf penutup itu bersama perubahannya.
- **Atribut kanvas (`contenteditable`):**
  - `role="textbox"`, `aria-multiline="true"`, ditambah `aria-labelledby`, `aria-describedby`, dan `aria-invalid` dari props.
  - `editorProps.attributes` dibangun dari props **terkini di opsi `useEditor` pada setiap render**, bersama `handlePaste` (bagian 7). S1-04 menyalakan `aria-invalid` setelah validasi, dan nilainya harus bertahan.
  - Jangan memanggil `editor.setOptions` dari komponen. `useEditor` 3.32.0 membandingkan opsinya dengan `editor.options` di setiap render dan menerapkan ulang opsinya sendiri bila berbeda, sehingga atribut yang dipasang terpisah lewat `setOptions` di efek hilang pada render berikutnya. Diuji 7 Nov: `aria-invalid` `"true"` setelah prop berubah, lalu hilang setelah re-render karena prop lain.
  - Tes komponen S1-04 memakai stub `RichTextEditor`, jadi hanya tes di kartu ini yang menjaga perilaku tersebut.
- **`ref.focus()`** memanggil `editor.commands.focus()`.
- **Di dalam `<form>` S1-04:**
  - Setiap tombol toolbar dan panel `type="button"`.
  - Event submit dialog tautan berhenti di dialognya sendiri (`preventDefault` + `stopPropagation`). Event React merambat menembus portal Radix ke formulir induk.
- **Bingkai dan kanvas (21i):**
  - Bingkai: `border border-border`, radius token yang paling dekat dengan 13 px di 21i (`rounded-card`, 14 px), tanpa `overflow-hidden` supaya cincin fokus tidak terpotong.
  - Kanvas: padding 18 / 20 / 60 px (atas / samping / bawah), `max-w-(--width-measure)` untuk isi.
  - **Cincin fokus** ada di bingkai saat kanvas fokus. Kanvasnya sendiri tanpa outline, supaya cincin global 2 px / jeda 3 px tidak menabrak garis bingkai. Tombol toolbar tetap memakai cincin global.
- **Tipografi kanvas** (berkas `rich-text-editor.module.css`):
  - Nilai yang sama persis dengan `RichContent` S1-03a: badan, h2–h4, list, kutipan, hr, tabel, tautan. Dengan begitu yang ditulis terlihat seperti yang dibaca peserta.
  - Komentar di kepala berkas menunjuk ke `rich-content.tsx` sebagai sumber nilai.
  - Hanya token lewat `var(--…)`, tanpa hex.
  - Termasuk `th` tanpa `align` rata kiri, bukan rata tengah bawaan browser (keputusan pemilik di PR #110). Sel dengan `align` mengikuti nilainya.
  - Yang sengaja berbeda dari renderer: paragraf kosong tetap tampil (tempat mengetik).
  - Tambahan khusus editor:
    - placeholder pada `p.is-editor-empty:first-child::before` berwarna `text-subtle`;
    - sel terpilih (`.selectedCell`) berlatar `fill`;
    - `ol[type]` dipetakan ke `list-style-type` yang sesuai, seperti di renderer;
    - tabel lebar menggulir di dalam kanvas (`overflow-x: auto` pada kanvas).

CSP sudah mengizinkan `style-src 'unsafe-inline'`, jadi CSS bawaan TipTap dan atribut `style` dari ProseMirror tidak terblokir. Biarkan `injectCSS` default.

### 4. Toolbar
Keputusan pemilik 4 Nov malam no. 3: **B, I, H2, list poin, list bernomor, tautan, tabel.** Underline, H3–H4, kutipan, dan garis pemisah tetap jalan lewat pintasan dan tempelan, tanpa tombol.

| Urutan | Tampilan | Nama aksesibel | Perilaku | Status |
|---|---|---|---|---|
| 1 | "B" (tebal) | Tebal | `toggleBold` | `aria-pressed` |
| 2 | "I" (Lato miring) | Miring | `toggleItalic` | `aria-pressed` |
| — | pemisah | | | |
| 3 | "H2" | Judul bagian (H2) | `toggleHeading({ level: 2 })` | `aria-pressed` |
| — | pemisah | | | |
| 4 | ikon list 20a | Daftar berpoin | `toggleBulletList` | `aria-pressed` |
| 5 | ikon list bernomor 20a | Daftar bernomor | `toggleOrderedList` | `aria-pressed` |
| — | pemisah | | | |
| 6 | ikon tautan 20a | Tautan | membuka dialog bagian 5 | aktif secara visual bila kursor di tautan |
| 7 | "Tabel ▾" | Tabel | membuka menu bagian 6 | `aria-haspopup="menu"` |

- **Gaya (21i dan 20a):**
  - Bar: `bg-surface-2`, garis bawah `border-soft`, padding 7 × 12 px, jarak antartombol 2 px.
  - Tombol: 32 × 32 px (tombol berlabel teks: tinggi 32, padding samping 8 px), radius `sm`, teks `text-nav`, hover `bg-fill`.
  - Tombol aktif: `bg-text text-surface` (20a).
  - Pemisah: 1 × 18 px `bg-border`, margin samping 5 px.
  - Ikon: SVG dari `20a.html`, 17 px, `aria-hidden`.
  - Bobot mengikuti TOKENS: 800 → 900, 600 → 700.
- **Semantik:**
  - `role="toolbar"`, `aria-label="Format teks"`, `aria-controls` ke id kanvas.
  - **Roving tabindex**: satu tombol dalam urutan Tab; panah kiri/kanan berpindah dan berputar; Home/End ke ujung.
  - Setiap perintah dijalankan dengan `editor.chain().focus()…run()`, sehingga fokus kembali ke kanvas dengan seleksi utuh.
- Kelas Tailwind ditulis sebagai string literal utuh (pelajaran S1-03a: kelas yang dirangkai tidak dihasilkan CSS-nya).

### 5. Tautan — dialog
Memakai `Dialog` (A-06), bukan `prompt()`.

- **Membuka:**
  - Kursor di dalam tautan → dialog "Ubah tautan", isian terisi `href`, dan seleksi diperluas ke seluruh tautan (`extendMarkRange("link")`).
  - Selain itu → "Pasang tautan" dengan isian kosong.
- **Isian "Alamat tautan":**
  - `type="text"` dan `inputMode="url"`, bukan `type="url"`, yang menolak path `/kursus/…`.
  - Petunjuk: "Contoh: https://… untuk situs lain, atau /kursus/… untuk halaman BINZI."
- **Validasi:**
  - `classifyHref(nilai)`. `null` → pesan galat `INVALID_LINK` dari validator S1-03a, tampil di isian dengan `aria-invalid`, dan fokus tetap di isian.
  - Tabel pesan validator (`MESSAGES`) belum diekspor di `main` `2e9a44f`. Ekspor sebagai `CONTENT_DOC_MESSAGES` tanpa mengubah isinya; itu satu-satunya perubahan yang boleh di `content-doc-validator.ts`.
- **Menerapkan:**
  - Seleksi tidak kosong → `setLink({ href })` pada seleksi.
  - Seleksi kosong di luar tautan → sisipkan alamatnya sebagai teks bertautan.
  - "Hapus tautan" (hanya di mode ubah) → `unsetLink` pada rentang tautan.
- **Tombol:** "Pasang" (mode baru) / "Simpan" (mode ubah), "Hapus tautan", "Batal".
- **Fokus:** setelah dialog tertutup, fokus kembali ke kanvas, bukan ke tombol toolbar (`onCloseAutoFocus` → `preventDefault`, lalu `editor.commands.focus()`).

### 6. Tabel — menu
`DropdownMenu` (A-06) dari tombol "Tabel".

| Item | Perintah | Aktif bila |
|---|---|---|
| Sisipkan tabel 3 × 3 | `insertTable({ rows: 3, cols: 3, withHeaderRow: true })` | kursor **tidak** di dalam tabel |
| *(pemisah)* | | |
| Tambah baris di bawah | `addRowAfter` | `editor.can().addRowAfter()` |
| Tambah kolom di kanan | `addColumnAfter` | `editor.can().addColumnAfter()` |
| Hapus baris | `deleteRow` | `editor.can().deleteRow()` |
| Hapus kolom | `deleteColumn` | `editor.can().deleteColumn()` |
| *(pemisah)* | | |
| Hapus tabel | `deleteTable` | `editor.can().deleteTable()` |

- **Penjaga tabel bersarang:**
  - `editor.can().insertTable()` bernilai `true` di dalam sel, dan perintahnya membuat tabel bersarang (diuji), yang ditolak validator.
  - Penjaganya `editor.isActive("table")`, di satu helper `canInsertTable(editor)` yang dipakai menu dan tesnya.
  - Menempel tabel saat kursor di sel sudah aman: prosemirror-tables menggabungkan selnya ke tabel yang ada (diuji).
- **Item nonaktif:** memakai `disabled` Radix, sehingga dilewati keyboard.
- **Fokus:** setelah item dipilih, fokus ke kanvas (`onCloseAutoFocus` → `preventDefault`, lalu fokus editor).

### 7. Penolakan tempel — 20b
Sebaiknya dikerjakan **terakhir, sebagai commit sendiri** (lihat "Catatan jadwal").

**Deteksi** (fungsi murni di `src/components/cms/editor-paste.ts`): `detectBlockedPaste({ html, text })` mengembalikan salah satu dari:

| Hasil | Kapan |
|---|---|
| `{ kind: "embed-html" }` | `html` memuat tag `iframe`, `video`, `embed`, `object`, `script`, atau `audio` (tanpa membedakan huruf besar/kecil) |
| `{ kind: "embed-code" }` | tanpa `html` seperti itu, tetapi `text` (dipangkas) diawali salah satu tag tadi — kode sematan yang disalin sebagai teks, mis. dari "Bagikan → Sematkan" YouTube |
| `{ kind: "video-link", url }` | `text` (dipangkas) adalah satu URL `http(s)` tanpa spasi, dengan host video atau path berakhiran berkas video |
| `null` | selain itu |

Detail aturannya:
- Urutan pengecekan sesuai urutan baris tabel di atas.
- Host video ada di satu konstanta, cocok persis atau sebagai subdomain: `youtube.com`, `youtu.be`, `youtube-nocookie.com`, `vimeo.com`, `tiktok.com`, `dailymotion.com`, `dai.ly`.
- Path video yang dikenali: `.mp4`, `.webm`, `.mov`, `.m4v`, `.m3u8`, `.mkv`, `.avi`, `.ogv`.
- URL video di tengah kalimat **bukan** `video-link`; tempelannya berjalan biasa.

**Pencegat:**
- Letaknya di `editorProps.handlePaste` komponen. Props view dijalankan ProseMirror sebelum plugin Link dan prosemirror-tables, jadi URL video belum sempat menjadi tautan.
- Hasil bukan `null` → kembalikan `true` (dokumen tidak berubah), simpan `slice` yang diberikan ProseMirror, lalu tampilkan panel.
- Selain itu → kembalikan `false`.

**Panel** inline seperti 20b (bukan modal):
- Letaknya di antara toolbar dan kanvas: kotak `danger-tint` bergaris `danger-tint-line`, lingkaran "!" `danger`, judul, isi, dan tombol.
- Bungkusnya `role="group"` dengan `aria-labelledby` ke judul.
- Saat panel muncul, fokus pindah ke tombol utama. Esc di dalam panel sama dengan "Batal".
- Setelah tombol mana pun, panel hilang dan fokus kembali ke kanvas.
- Tombol "Buat materi kursus dari video ini" di 20b tidak dipakai (keputusan 4 Nov malam no. 5).

**Copy** (netral, karena komponen dipakai untuk teks materi dan deskripsi kursus; disetujui pemilik 5 Nov):

| Varian | Judul | Isi | Tombol |
|---|---|---|---|
| `video-link` | Video tidak bisa dipasang di dalam teks | Video dipasang terpisah di materi kursus, supaya halaman tetap ringan dan bisa dibaca dengan kuota kecil. Tautannya bisa disimpan sebagai teks biasa. | **Sisipkan sebagai tautan teks** · Batal |
| `embed-html` | Sebagian isi tempelan tidak bisa dipasang | Video, iframe, embed, dan script tidak bisa dipasang di dalam teks, supaya halaman tetap ringan dan aman. Sisa tulisannya bisa ditempel tanpa bagian itu. | **Tempel tanpa bagian itu** · Batal |
| `embed-code` | Kode sematan tidak bisa dipasang di dalam teks | Video, iframe, embed, dan script tidak bisa dipasang di dalam teks, supaya halaman tetap ringan dan aman. Video dipasang terpisah di materi kursus. | **Tutup** |

**Aksi utama:**
- **"Sisipkan sebagai tautan teks":** seleksi tidak kosong → `setLink({ href: url })` pada seleksi. Seleksi kosong → sisipkan `url` sebagai teks bertautan.
- **"Tempel tanpa bagian itu":** `view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView())` dengan `slice` yang disimpan. ProseMirror sudah membuang elemen terlarang saat mem-parse tempelan (diuji), dan `colwidth` sudah dinormalkan.

### 8. Contoh di `/dev/ui`
Bagian baru **"Editor teks"** lewat komponen klien `src/app/(dev)/dev/ui/editor-demo.tsx`:
- satu editor berisi `CONTENT_DOC_SHOWCASE`;
- di bawahnya status `validateContentDoc` atas keluaran terakhir ("Dokumen sah", atau daftar kode + path issue);
- di bawahnya lagi `RichContent` dari keluaran yang sama;
- satu editor kosong (`EMPTY_DOC`) untuk placeholder.

Ini alat verifikasi pemilik: tempel dari Google Docs atau Word, lalu lihat apakah hasilnya sah dan bagaimana tampil di halaman peserta.

## Bukan lingkup tugas ini
- **S1-04:** formulir, simpan, API, halaman editor materi dan deskripsi, status "belum disimpan", e2e editor. Kartu ini tidak punya route produksi; `/dev/ui` hanya ada di development.
- **Ditunda (keputusan 4 Nov malam):** menu "/" (21i, butuh `@tiptap/suggestion`), tombol Gambar dan Callout, penanda merah node terlarang di dokumen lama.
- **Tidak di demo:** tombol undo/redo (pintasan tetap jalan), tombol underline/H3/H4/kutipan/garis, menu gelembung, pintasan Mod-K, penghitung kata, simpan otomatis dan state 20c, tata letak tablet dan ponsel halaman editor.
- **Diketahui, tidak diubah:** tempelan `<h1>`/`<h5>` menjadi paragraf (level heading 2–4). Validator S1-03a menerima tabel yang bersarang tidak langsung (di dalam list atau kutipan di dalam sel); penjaga toolbar mencegah jalur itu dari editor.

Pekerjaan di luar lingkup → **berhenti dan tanyakan.** Termasuk bila tes bolak-balik menemukan keluaran editor yang ditolak validator: tempel JSON-nya dan berhenti. Tabel daftar putih S1-03a diperbarui per node lewat keputusan pemilik, bukan dengan melonggarkan validator di sesi ini.

## Berkas yang boleh dibuat/diubah
- `package.json`, `package-lock.json` — hanya lewat perintah di bagian 1
- `src/components/cms/editor-extensions.ts` + `editor-extensions.test.ts` (baru)
- `src/components/cms/editor-paste.ts` + `editor-paste.test.ts` (baru)
- `src/components/cms/rich-text-editor.tsx` + `rich-text-editor.test.tsx` + `rich-text-editor.module.css` (baru)
- `src/components/cms/editor-toolbar.tsx`, `editor-link-dialog.tsx`, `editor-blocked-paste.tsx` (baru, opsional bila komponen utama terlalu panjang; tesnya tetap di `rich-text-editor.test.tsx`)
- `src/app/(dev)/dev/ui/page.tsx` + `src/app/(dev)/dev/ui/editor-demo.tsx` (baru)
- `src/lib/content-doc-validator.ts` — hanya untuk mengekspor `MESSAGES` sebagai `CONTENT_DOC_MESSAGES` (bagian 5)

Tanpa migrasi, tanpa `src/db`, dan tanpa dependensi selain lima paket di bagian 1.

## Rencana agent (ditinjau di Claude chat sebelum disetujui)
Rencana memuat:
- daftar berkas yang akan dibuat atau diubah;
- signature setiap ekspor (`createEditorExtensions`, `canInsertTable`, `detectBlockedPaste`, `RichTextEditor` + props + handle);
- cara aturan suntingan dan atribut kanvas (bagian 3) serta penjaga tabel (bagian 6) diterapkan;
- kelas Tailwind dan selektor CSS module per bagian bingkai, toolbar, kanvas, dan panel;
- daftar tes per bagian "Selesai jika";
- untuk setiap mutasi: tes yang diharapkan merah, beserta tes yang diperkirakan tetap hijau karena tertutup lapis lain.

## Selesai jika
- [ ] **Tes headless** (`editor-extensions.test.ts`, jsdom, `new Editor({ extensions: createEditorExtensions() })`):
  - **Skema = daftar putih:** `Object.keys(editor.schema.nodes)` sama persis dengan 14 nama di bagian 2, dan `Object.keys(editor.schema.marks)` dengan 4 nama.
  - **Bolak-balik fitur:** setiap perintah berikut, dari dokumen yang sesuai, menghasilkan `getJSON()` yang lolos `validateContentDoc`:
    - B, I, underline;
    - H2, H3, H4;
    - list poin, list bernomor, list bersarang (`sinkListItem`);
    - `setLink` untuk `https://…`, `mailto:…`, `/kursus/x`; `unsetLink`;
    - `setHardBreak` di dalam teks tebal dan di dalam tautan;
    - kutipan, garis pemisah;
    - sisip tabel → tambah baris → tambah kolom → hapus baris → hapus kolom → hapus tabel;
    - undo dan redo.
  - **Bolak-balik muat:** `CONTENT_DOC_SHOWCASE`, `EMPTY_DOC`, dan bentuk seed demo dimuat → `getJSON()` lolos validator dan **idempoten** (dimuat ulang → `toStrictEqual` keluaran pertama).
    - Bentuk seed demo (doc → paragraph → text) ditulis inline di tes. Jangan mengimpor `src/db/seed-demo.ts`: `tipTapDoc` di sana tidak diekspor, dan berkas itu menjalankan `main()` (koneksi DB) saat diimpor.
    - Bukan sama dengan fixture: TipTap mengurutkan ulang mark (link lebih dulu) dan membuang `content: []` (diuji).
  - **Tempel** (`view.pasteHTML(html, new Event("paste"))`; jsdom 29 tidak punya konstruktor `ClipboardEvent`, jadi event dibuat sendiri). Semua hasil lolos validator:
    - HTML ala Google Docs: pembungkus `<b style="font-weight:normal">`, h1, h5, `<s>`, `<code>`, `<pre>`, `<mark>`, `<span style>`, `<img>`;
    - `<a href="#x">` dan `<a href="javascript:…">` → teks biasa tanpa tautan;
    - `<strong>a<br>b</strong>` → `hardBreak` bermark;
    - tabel dengan `<colgroup><col width="auto"><col width="120">` → semua `colwidth` `null`;
    - HTML berisi `iframe`/`video`/`script` → elemen itu hilang, teks di sekitarnya tetap.
  - **`setLink({ href: "javascript:alert(1)" })`** → `false`, dokumen tidak berubah.
  - **Tautan otomatis**, diketik per huruf lalu spasi dan juga ditempel sebagai teks: `https://contoh.id` → tautan sah. `ftp://contoh.id/berkas`, `contoh.id`, dan `ahli@contoh.id` → teks biasa.
  - **Tabel:** `canInsertTable` bernilai `false` dengan kursor di sel dan `true` di paragraf; menempel tabel saat kursor di sel → tetap satu node `table`.
- [ ] **Tes deteksi** (`editor-paste.test.ts`, node):
  - setiap tag terlarang di `html` (huruf campuran) → `embed-html`;
  - kode `<iframe …>` sebagai `text` → `embed-code`;
  - URL setiap host di konstanta, termasuk subdomain (`m.youtube.com`, `player.vimeo.com`) dan spasi di tepi → `video-link`;
  - `https://contoh.id/video.MP4?x=1` → `video-link`;
  - `https://contoh.id/artikel`, URL video di tengah kalimat, `notyoutube.com`, dan HTML Google Docs tanpa sematan → `null`.
- [ ] **Tes komponen** (`rich-text-editor.test.tsx`, jsdom, RTL):
  - **Lingkungan jsdom** (diuji 7 Nov dengan TipTap 3.32.0, jsdom 29.1.1):
    - jsdom tidak punya `Range.prototype.getClientRects` dan `getBoundingClientRect`. Setiap `chain().focus()…run()` pada editor yang terpasang di DOM memicu `scrollToSelection` ProseMirror, lalu unhandled `TypeError: target.getClientRects is not a function`. Vitest keluar dengan kode 1 walau semua tes lulus, sehingga `npm run check` merah.
    - Pasang polyfill di kepala `rich-text-editor.test.tsx`: `getClientRects` mengembalikan daftar kosong, `getBoundingClientRect` mengembalikan rect bernilai nol. Bukan di `test-env.ts` (setup bersama, di luar daftar berkas). Tes headless `editor-extensions.test.ts` tanpa elemen DOM tidak membutuhkannya (diuji).
    - Seleksi: fokus kanvas, `document.getSelection().setBaseAndExtent(…)` pada node teks di kanvas, lalu `document.dispatchEvent(new Event("selectionchange"))`.
    - Ketikan: `fireEvent.keyPress` tidak menyisipkan teks. Ubah `data` node teks di kanvas lalu pindahkan seleksi ke ujungnya; DOMObserver ProseMirror membacanya sebagai satu suntingan. `@testing-library/user-event` tidak ada di repo dan tidak ditambahkan.
    - Membuka `DropdownMenu`: `fireEvent.pointerDown(trigger, { button: 0 })`, seperti `src/components/ui/dropdown-menu.test.tsx`.
  - **Toolbar:**
    - nama `toolbar` "Format teks";
    - ketujuh nama tombol sesuai tabel bagian 4;
    - klik "Tebal" → `aria-pressed="true"` dan teks terpilih jadi `<strong>` di kanvas;
    - hanya satu tombol dengan `tabindex="0"`; panah kanan/kiri, Home, dan End memindahkan fokus.
  - **Aturan suntingan:**
    - dokumen berakhir dengan tabel, kanvas difokus → `onChange` tidak dipanggil;
    - lalu satu ketikan → `onChange` dipanggil sekali dan dokumennya lolos validator.
  - **Atribut kanvas:**
    - `role`, `aria-multiline`, `aria-labelledby` ada;
    - mengganti prop `aria-invalid` mengubah atributnya, **lalu re-render dengan prop lain berubah (mis. `className`) → `aria-invalid` tetap**;
    - `ref.focus()` memfokuskan kanvas.
  - **Di dalam `<form onSubmit={spy}>`:** klik setiap tombol toolbar dan kirim dialog tautan → `spy` tidak dipanggil.
  - **Tautan:**
    - `javascript:x` → pesan `INVALID_LINK` tampil dan isian `aria-invalid`;
    - `https://contoh.id` → tautan terpasang;
    - membuka di tautan yang ada → isian terisi, "Hapus tautan" melepasnya;
    - setelah tertutup, fokus di kanvas.
  - **Tabel:**
    - di paragraf: "Sisipkan tabel 3 × 3" aktif dan kelima perintah lain nonaktif;
    - di sel: kebalikannya;
    - setiap item mengubah dokumen sesuai perintahnya.
  - **20b** (event `paste` dengan `clipboardData` palsu lewat `fireEvent.paste`):
    - **URL YouTube:** panel `video-link` tampil, fokus di tombol utama, dokumen belum berubah. "Batal" → dokumen tetap. "Sisipkan sebagai tautan teks" → teks bertautan, lolos validator.
    - **HTML berisi iframe:** "Tempel tanpa bagian itu" → teks di sekitarnya masuk, tanpa iframe.
    - **Kode sematan sebagai teks:** hanya "Tutup".
    - Esc di panel = Batal. Setelah panel tertutup, fokus di kanvas.
  - **Render server:** `renderToString(<RichTextEditor …/>)` tidak melempar dan memuat toolbar yang tombolnya nonaktif.
- [ ] **Uji mutasi** (merah, lalu dikembalikan dengan `git restore`). Merah berarti asersi gagal dengan alasan yang diharapkan, bukan `TypeError` dari kode yang rusak. Laporkan per mutasi nama tes yang merah beserta pesan asersinya.
  1. `isAllowedUri` dilepas dari konfigurasi Link.
  2. Penjaga `canInsertTable` dihapus (selalu `true`).
  3. Normalisasi `colwidth` dihapus.
  4. `onChange` dipanggil di setiap event `update` (tanpa cek transaksi akar).
  5. Pencegat tempel selalu mengembalikan `false`.
  6. Status toolbar dibaca langsung saat render, tanpa `useEditorState`.
  7. `strike: false` dihapus dari konfigurasi StarterKit.
  8. Dialog tautan tidak memeriksa `classifyHref`.
  9. Roving tabindex dihapus (semua tombol `tabIndex={0}`).
  10. `stopPropagation` di submit dialog tautan dihapus.
  11. `aria-invalid` diteruskan lewat `editor.setOptions` di efek, bukan lewat opsi `useEditor`. Harapan: tes "re-render dengan prop lain → `aria-invalid` tetap" merah, sedangkan tes "mengganti prop mengubah atributnya" tetap hijau.

## Sebelum membuka PR
- **Prasyarat:** Docker menyala, `npm run dev:db` dan `npm run e2e:db`. `main` sudah memuat C-04 dan S1-03a; mulai dari `git switch main && git pull --ff-only && npm ci`.
- **Gate audit:** `node scripts/check-audit.mjs` di awal sesi, setelah pemasangan, dan sebelum PR. Harapan ketiganya 0 excused / 0 blocking / 23 info-low-moderate. Angka lain atau temuan blocking baru → berhenti dan tempel output lengkapnya.
- **Dependensi di PR:** tabel 49 entri baru (nama, versi, tanggal rilis dari `npm view <paket> time`), keluaran `git diff main -- package.json`, dan konfirmasi nol entri lama berubah.
- **Prettier:** berkas yang sudah ada tetap apa adanya, sehingga diff sebatas lingkup. Berkas baru boleh dirapikan.
- **Uji mutasi:** commit lokal dulu, lalu kembalikan setiap mutasi dengan `git restore`.
- **Staging per nama berkas.** Sebelum commit, `git status` hanya menunjukkan berkas dari daftar di atas.
- **Commit terpisah** untuk dependensi (bagian 1), editor + toolbar + tautan + tabel (bagian 2–6), panel 20b (bagian 7), dan `/dev/ui` (bagian 8).
- **"Keputusan & asumsi" di PR** memuat semua copy usulan dan keputusan yang diambil tanpa bertanya.
- **Setelah push:** cek CI (`gh pr checks`, job `ci` dan `e2e`) lalu laporkan hasilnya.

## Verifikasi otomatis (agent menjalankan, hasilnya dilampirkan di PR)
- `npm run check` · `npm run build` · `npm run e2e` (sekali di lokal sebagai regresi; CI menjalankannya lagi)
- `npm ls @tiptap/core @tiptap/pm` → satu versi masing-masing, 3.32.0
- `git diff --stat main -- src/db` kosong

## Verifikasi oleh kamu (sebelum merge)
- [ ] CI `ci` + `e2e` hijau. Tabel dependensi di PR: 49 entri, semuanya rilis ≤ 24 Okt.
- [ ] Lokal (`npm run dev:db`, lalu `npm run dev`), `/dev/ui` bagian "Editor teks" di lebar 1280. Ambil screenshot dan unggah ke Claude chat untuk dibandingkan dengan 21i, 20a, dan 20b:
  1. editor showcase;
  2. editor kosong dengan placeholder;
  3. dialog tautan dengan pesan galat;
  4. menu Tabel saat kursor di sel;
  5. panel 20b setelah menempel URL YouTube.
- [ ] Tempel sungguhan, lalu periksa status di bawah editor:
  1. Satu paragraf dari Google Docs berisi tebal, miring, tautan, list bersarang, dan tabel → "Dokumen sah".
  2. Hal yang sama dari Word (bila ada).
  3. Satu URL YouTube → panel 20b.
  4. Kode sematan YouTube ("Bagikan → Sematkan") → panel "Kode sematan…".
- [ ] Dengan keyboard saja:
  1. Tab ke toolbar.
  2. Panah sampai "Tabel", Enter membuka menu, Esc menutupnya.
  3. Tab ke kanvas.
  4. Pilih teks dengan Shift+panah, Ctrl+B, lalu buka dialog tautan dari toolbar dan pasang tautan.
  5. Setelah dialog tertutup, kursor kembali di kanvas.

## Catatan jadwal
- Sesi dimulai setelah **C-04 dan S1-03a merge**. C-04 harus merge sebelum sesi karena keduanya menyentuh `package-lock.json`.
- C-04 sudah merge 6 Nov (`d3eab7f`). Jangan memasang TipTap di atas lockfile yang lebih lama dari itu.
- **Bagian 7 (20b) bisa dipisah.** Bila pemilik meminta "lewati bagian 7", PR dibuka tanpa panel itu:
  - pencegat tempel tidak dipasang;
  - mutasi 5 dilewati;
  - tes 20b tidak ditulis.

  20b lalu menjadi kartu S1-03c, paling akhir Sel 17 (keputusan 4 Nov malam no. 5).

## Catatan keputusan
- **TipTap tepat 3.32.0, lima paket** (keputusan 4 Nov malam).
  - Simulasi 5 Nov di atas lockfile pasca-C-04 memberi angka yang sama dengan simulasi 4 Nov (49 baru, 0 berubah, gate tetap). Diulang 6 Nov di atas `main` `d3eab7f` (lockfile C-04 asli): sama.
  - Entri terbarunya berbeda dari catatan STATUS 4 Nov: `linkifyjs` 4.4.0 (23 Okt), bukan `fast-equals` 5.4.5 (14 Okt). Keduanya lolos soak untuk sesi Sabtu.
  - `@tiptap/core` tidak ditulis di `package.json` karena `@tiptap/react` me-re-ekspor seluruhnya.
- **Fakta yang diuji di Claude chat** (TipTap 3.32.0, jsdom 29.1.1, editor headless):
  - Skema dengan konfigurasi bagian 2 berisi tepat 14 node dan 4 mark daftar putih.
  - `trailingNode` menambah paragraf saat dokumen yang berakhir dengan tabel difokus, dan TipTap memancarkan `update` untuk itu (dasar aturan suntingan).
  - `can().insertTable()` di dalam sel bernilai `true` dan menghasilkan tabel bersarang. Menempel tabel di dalam sel tidak.
  - `setLink` dengan `isAllowedUri` menolak `javascript:`.
  - Tempelan HTML berisi `iframe`/`video`/`script` dibuang ProseMirror tanpa pesan. Tempelan URL YouTube menjadi tautan otomatis. Dua perilaku ini yang membuat 20b perlu pencegat sendiri.
  - `editorProps.handlePaste` menerima `clipboardData` dari event sintetis di jsdom.
  - Memuat dokumen mengurutkan ulang mark dan membuang `content: []`.
  - `<col width="auto">` → `colwidth: [NaN]`.
  - `useEditor` tidak me-render ulang per transaksi, dan memaksa `immediatelyRender: false` di Next.js sambil memperingatkan.
- **Fakta tambahan yang diuji 7 Nov** (komponen dengan `useEditor` + `EditorContent`, RTL, jsdom 29.1.1, di atas `822d0ce` + simulasi bagian 1):
  - Tanpa polyfill `Range.prototype.getClientRects`, toolbar yang memanggil `chain().focus()` memicu unhandled `TypeError` dan Vitest keluar dengan kode 1. Dengan polyfill, kode 0. Editor headless tanpa elemen tidak terdampak.
  - `useEditor` (opsi tanpa `deps`) menerapkan ulang opsinya lewat `setOptions` setiap kali opsi berbeda dari `editor.options`. Atribut dari `setOptions` di efek komponen hilang setelah re-render berikutnya; atribut di opsi `useEditor` bertahan.
  - `editor.setOptions({ editorProps })` mengganti seluruh `editor.options.editorProps`, bukan menggabungkan per kunci.
  - Seleksi DOM + `selectionchange` dipetakan ke seleksi ProseMirror. Mengubah teks node di kanvas memicu tepat satu `onChange`. `fireEvent.keyPress` tidak menyisipkan teks.
  - Fokus pada dokumen yang berakhir dengan tabel menambah paragraf penutup tanpa memanggil `onChange` (aturan suntingan bagian 3).
  - `renderToString` komponen dengan `useEditorState` tidak melempar.
- **Panel 20b inline, mengikuti desain**, bukan dialog modal. Copy netral karena komponen dipakai di dua konteks; tiga varian karena kode sematan yang disalin sebagai teks tidak punya "sisa tulisan" untuk ditempel.
- **Semua `colwidth` hasil tempel menjadi `null`**, tidak hanya yang tidak sah. Renderer mengabaikan lebar kolom, jadi editor dan halaman peserta tampil sama, dan tidak ada nilai yang bisa lolos ke validator dalam bentuk `NaN`.
- **Tipografi kanvas menyalin nilai `RichContent`** di CSS module, karena node ProseMirror tidak bisa diberi kelas per level heading. Sumber nilainya tetap `rich-content.tsx`; screenshot `/dev/ui` (editor dan pratinjau berdampingan) menjadi pemeriksa kesamaannya.
