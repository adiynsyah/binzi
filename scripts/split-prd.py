"""Split the full PRD into docs/prd/sections/*.md — the excerpts AI agents load.

Never edit docs/prd/sections/ by hand: change the full PRD, bump its version,
then regenerate. Verified to reproduce the v1.3 split byte for byte.

Usage (from the repo root):
  python3 scripts/split-prd.py docs/prd/PRD-v1.4.md docs/prd/sections 1.4 PRD-v1.4.md

A new top-level section (## N.) or a new ### 6.x / ### 13.x subsection needs
a filename in FILES below — the script fails loudly until it has one.
"""
import re, sys, os

FILES = {
 "header": "00-header-revisi.md", "0": "00-ringkasan-keputusan-kunci.md",
 "1": "01-penjelasan-apa-itu-mobile-first.md", "2": "02-decision-log.md",
 "3": "03-persona-role.md", "4": "04-ruang-lingkup.md",
 "5": "05-fitur-konsultasi-ruang-lingkup-final.md",
 "6.1": "06-1-autentikasi-akun.md", "6.2": "06-2-kursus-materi.md",
 "6.3": "06-3-quiz-sistem-penilaian.md",
 "6.4": "06-4-progress-nilai-saya-menggantikan-sertifi.md",
 "6.5": "06-5-artikel-kategori.md", "6.6": "06-6-halaman-tentang-kami.md",
 "6.7": "06-7-cms.md", "6.8": "06-8-pencarian-notifikasi.md",
 "7": "07-navigasi-information-architecture.md",
 "8": "08-requirement-non-fungsional.md", "9": "09-rekomendasi-teknologi.md",
 "10": "10-arsitektur-system-design.md", "11": "11-model-data.md",
 "12": "12-keamanan.md", "13.1": "13-1-fase-pengembangan-mvp-12-minggu.md",
 "13.2": "13-2-jalur-kritis-produksi-konten.md", "13.3": "13-3-tim.md",
 "13.4": "13-4-model-eksekusi-dengan-ai.md",
 "13.5": "13-5-panduan-desain-ui-ux-dengan-ai.md",
 "14": "14-acceptance-criteria.md", "15": "15-risiko-mitigasi.md",
 "16": "16-pertanyaan-terbuka.md", "17": "17-lampiran.md",
}
SPLIT_SUB = {"6", "13"}  # level-2 sections split per "### N.x"

def split(text):
    lines = text.split("\n")
    h2 = [(i, re.match(r"## (\d+)\.", l).group(1)) for i, l in enumerate(lines)
          if re.match(r"## \d+\. ", l)]
    out = {"header": "\n".join(lines[:h2[0][0]])}
    for k, (start, num) in enumerate(h2):
        end = h2[k + 1][0] if k + 1 < len(h2) else len(lines)
        block = lines[start:end]
        if num not in SPLIT_SUB:
            out[num] = "\n".join(block); continue
        subs = [(i, re.match(rf"### ({num}\.\d+) ", l).group(1)) for i, l in enumerate(block)
                if re.match(rf"### {num}\.\d+ ", l)]
        pre = "\n".join(block[:subs[0][0]])
        for j, (s, sid) in enumerate(subs):
            e = subs[j + 1][0] if j + 1 < len(subs) else len(block)
            out[sid] = pre + "\n" + "\n".join(block[s:e])
    return out

def main(prd, out_dir, version, fname):
    text = open(prd, encoding="utf-8").read()
    head = (f"> Potongan dari **PRD BINZI v{version}** (`../{fname}`). Rujukan silang "
            "\"§x\" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan "
            "ini dan PRD utuh berbeda, PRD utuh yang berlaku.\n\n")
    parts = split(text)
    assert set(parts) == set(FILES), sorted(set(parts) ^ set(FILES))
    os.makedirs(out_dir, exist_ok=True)
    for key, body in parts.items():
        body = body.strip("\n")
        # Section separators belong to the full PRD, not to the excerpts —
        # the header excerpt is the exception (it keeps its closing rule).
        if key != "header":
            while body.endswith("\n---") or body == "---":
                body = body[: -len("---")].rstrip("\n")
        open(os.path.join(out_dir, FILES[key]), "w", encoding="utf-8").write(
            head + body + "\n")

if __name__ == "__main__":
    main(*sys.argv[1:5])
