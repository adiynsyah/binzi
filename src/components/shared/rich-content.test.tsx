// @vitest-environment jsdom
import "../ui/test-env";

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RichContent } from "./rich-content";
import { EMPTY_DOC } from "@/lib/content-doc";
import { CONTENT_DOC_SHOWCASE } from "@/lib/content-doc-fixtures";

// Card S1-03a §5: the renderer must produce elements (never HTML strings),
// re-validate on every render, group same-href link runs into one <a>,
// and fall back to a single paragraph for anything invalid. The showcase
// fixture doubles as the "every whitelisted node renders" test.

afterEach(() => {
  vi.restoreAllMocks();
});

const text = (value: string, marks: readonly unknown[] = []) =>
  marks.length > 0
    ? { type: "text", text: value, marks }
    : { type: "text", text: value };

/** All-null extra attrs — the renderer must decide external-ness itself. */
const link = (href: string) => ({
  type: "link",
  attrs: { href, target: null, rel: null, class: null, title: null },
});

const para = (content: readonly unknown[]) => ({
  type: "paragraph",
  content,
});

const docOf = (blocks: readonly unknown[]) => ({ type: "doc", content: blocks });

const cell = (
  kind: "tableHeader" | "tableCell",
  content: readonly unknown[],
  overrides: Record<string, unknown> = {},
) => ({
  type: kind,
  attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null, ...overrides },
  content,
});

const cellText = (value: string, overrides?: Record<string, unknown>) =>
  cell("tableCell", [para([text(value)])], overrides);

const headText = (value: string) => cell("tableHeader", [para([text(value)])]);

describe("RichContent — showcase", () => {
  it("renders every heading level (2–4), blockquote, and rule — never h1 — without console.error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<RichContent doc={CONTENT_DOC_SHOWCASE} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Judul tingkat dua [CONTOH]" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 3, name: "Judul tingkat tiga [CONTOH]" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 4, name: "Judul tingkat empat [CONTOH]" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();

    expect(screen.getByText(/Kutipan contoh/).closest("blockquote")).toBeTruthy();
    expect(container.querySelector("hr")).toBeTruthy();

    // No filter: React key warnings used to hide behind a "RichContent"
    // filter here (PR 110 item 2). Anything logged fails this test.
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("renders lists: bullets, nested ordered start=3, a third mixed level with a line break, and type a", () => {
    const { container } = render(<RichContent doc={CONTENT_DOC_SHOWCASE} />);

    const nestedOl = screen
      .getByText("Langkah ketiga mulai dari start: 3 [CONTOH]")
      .closest("ol");
    expect(nestedOl).toBeTruthy();
    expect(nestedOl?.getAttribute("start")).toBe("3");
    expect(nestedOl?.className).toContain("list-decimal");
    // The ordered list lives inside the first bullet's list item.
    expect(nestedOl?.closest("li")?.textContent).toContain("Butir pertama");

    const thirdLevel = screen
      .getByText(/Tingkat ketiga campuran daftar, baris pertama/)
      .closest("li");
    expect(thirdLevel?.querySelector("br")).toBeTruthy();
    expect(thirdLevel?.textContent).toContain("baris kedua.");

    const olA = screen.getByText("Pilihan a [CONTOH]").closest("ol");
    expect(olA?.className).toContain("list-[lower-alpha]");
    expect(olA?.hasAttribute("start")).toBe(false);

    expect(container.querySelector("ul")).toBeTruthy();
  });

  it("renders marks bold, italic, underline", () => {
    render(<RichContent doc={CONTENT_DOC_SHOWCASE} />);

    expect(screen.getByText("tebal").tagName).toBe("STRONG");
    expect(screen.getByText("miring").tagName).toBe("EM");
    expect(screen.getByText("garis bawah").tagName).toBe("U");
  });

  it("renders exactly five anchors; three external with one sr-only hint each, two without target", () => {
    const { container } = render(<RichContent doc={CONTENT_DOC_SHOWCASE} />);

    const anchors = container.querySelectorAll("a");
    expect(anchors).toHaveLength(5);

    const withTarget = [...anchors].filter(
      (a) => a.getAttribute("target") === "_blank",
    );
    expect(withTarget).toHaveLength(3);
    for (const a of withTarget) {
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    }

    const srOnly = container.querySelectorAll("span.sr-only");
    expect(srOnly).toHaveLength(3);
    for (const span of srOnly) {
      expect(span.textContent).toBe(" (membuka tab baru)");
      expect(span.closest("a")).toBeTruthy();
    }

    const withoutTarget = [...anchors].filter((a) => !a.hasAttribute("target"));
    expect(withoutTarget).toHaveLength(2);
    const hrefs = withoutTarget.map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/kursus/contoh");
    expect(hrefs).toContain("mailto:halo@example.com");
  });

  it("renders tables: scoped headers, colspan, alignment, and numbered scroll regions", () => {
    const { container } = render(<RichContent doc={CONTENT_DOC_SHOWCASE} />);

    const tables = container.querySelectorAll("table");
    expect(tables).toHaveLength(2);

    const first = tables[0];
    expect(first).toBeTruthy();
    const headCells = first?.querySelectorAll('thead th[scope="col"]');
    expect(headCells).toHaveLength(3);

    const bodyHeader = screen
      .getByText("Baris satu [CONTOH]")
      .closest("th");
    expect(bodyHeader?.getAttribute("scope")).toBe("row");
    // align null means left for th and td alike (PR 110 item 4).
    expect(headCells?.[0]?.className).toContain("text-left");
    expect(bodyHeader?.className).toContain("text-left");

    const spanCell = screen
      .getByText("Sel gabungan dua kolom [CONTOH]")
      .closest("td");
    expect(spanCell?.getAttribute("colspan")).toBe("2");

    const centered = screen.getByText("Sel rata tengah [CONTOH]").closest("td");
    expect(centered?.className).toContain("text-center");

    // colwidth never leaks into presentational attributes.
    const allCells = container.querySelectorAll("th, td");
    expect(allCells.length).toBeGreaterThan(0);
    for (const cellEl of allCells) {
      expect(cellEl.hasAttribute("style")).toBe(false);
      expect(cellEl.hasAttribute("width")).toBe(false);
    }

    const regions = container.querySelectorAll('[role="region"]');
    expect(regions).toHaveLength(2);
    expect(regions[0]?.getAttribute("aria-label")).toBe("Tabel 1");
    expect(regions[0]?.getAttribute("tabindex")).toBe("0");
    expect(regions[1]?.getAttribute("aria-label")).toBe("Tabel 2");
  });
});

describe("RichContent — links", () => {
  it("external link gets target, rel, and one sr-only hint", () => {
    const { container } = render(
      <RichContent doc={docOf([para([text("halo", [link("https://example.com/x")])])])} />,
    );

    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("https://example.com/x");
    expect(anchor?.getAttribute("target")).toBe("_blank");
    expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(anchor?.querySelector("span.sr-only")?.textContent).toBe(
      " (membuka tab baru)",
    );
  });

  it("uppercase HTTPS scheme is still external", () => {
    const { container } = render(
      <RichContent
        doc={docOf([para([text("halo", [link("HTTPS://EXAMPLE.COM/BESAR")])])])}
      />,
    );

    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("target")).toBe("_blank");
    expect(anchor?.querySelector("span.sr-only")).toBeTruthy();
  });

  it("internal and mailto links get no target; doc-supplied target/rel are ignored", () => {
    const docSupplied = {
      type: "link",
      attrs: { href: "/kursus/contoh", target: "_blank", rel: "nofollow", class: null, title: null },
    };
    const { container } = render(
      <RichContent
        doc={docOf([
          para([text("dalam", [docSupplied])]),
          para([text("surel", [link("mailto:halo@example.com")])]),
        ])}
      />,
    );

    const anchors = container.querySelectorAll("a");
    expect(anchors).toHaveLength(2);
    for (const a of anchors) {
      expect(a.hasAttribute("target")).toBe(false);
      expect(a.hasAttribute("rel")).toBe(false);
      expect(a.querySelector("span.sr-only")).toBeNull();
    }
  });

  it("three text nodes with the same link render as ONE anchor with strong inside", () => {
    const shared = link("https://example.com/tautan-terbagi");
    const { container } = render(
      <RichContent
        doc={docOf([
          para([
            text("satu ", [shared]),
            text("dua", [shared, { type: "bold" }]),
            text(" tiga", [shared]),
          ]),
        ])}
      />,
    );

    const anchors = container.querySelectorAll("a");
    expect(anchors).toHaveLength(1);
    const anchor = anchors[0];
    expect(anchor?.textContent).toBe("satu dua tiga (membuka tab baru)");
    expect(anchor?.querySelector("strong")?.textContent).toBe("dua");
    expect(anchor?.querySelectorAll("span.sr-only")).toHaveLength(1);
  });

  it("a hardBreak inside a link run stays inside the anchor", () => {
    const shared = link("https://example.com/tautan-terbagi");
    const { container } = render(
      <RichContent
        doc={docOf([
          para([
            text("satu", [shared]),
            { type: "hardBreak", marks: [shared] },
            text("dua.", [shared]),
          ]),
        ])}
      />,
    );

    const anchors = container.querySelectorAll("a");
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.querySelector("br")).toBeTruthy();
    expect(anchors[0]?.querySelectorAll("span.sr-only")).toHaveLength(1);
  });
});

describe("RichContent — tables", () => {
  it("a first row that mixes header and data cells produces no thead; body th gets scope row", () => {
    const { container } = render(
      <RichContent
        doc={docOf([
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [headText("Kepala [CONTOH]"), cellText("Isi [CONTOH]")],
              },
              {
                type: "tableRow",
                content: [cellText("Baris dua [CONTOH]"), cellText("Data [CONTOH]")],
              },
            ],
          },
        ])}
      />,
    );

    expect(container.querySelector("thead")).toBeNull();
    const bodyRows = container.querySelectorAll("tbody tr");
    expect(bodyRows).toHaveLength(2);
    expect(
      screen.getByText("Kepala [CONTOH]").closest("th")?.getAttribute("scope"),
    ).toBe("row");
  });

  // PR 110 item 3: a table inside a blockquote inside a cell is valid
  // (cell blocks exclude table directly, not indirectly) and must still
  // get a numbered label in document order.
  it("tabel di dalam blockquote di dalam sel → Tabel 1 dan Tabel 2 sesuai urutan dokumen", () => {
    const { container } = render(
      <RichContent
        doc={docOf([
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  cell("tableCell", [
                    para([text("Sel luar [CONTOH]")]),
                    {
                      type: "blockquote",
                      content: [
                        {
                          type: "table",
                          content: [
                            {
                              type: "tableRow",
                              content: [cellText("Sel dalam [CONTOH]")],
                            },
                          ],
                        },
                      ],
                    },
                  ]),
                ],
              },
            ],
          },
        ])}
      />,
    );

    const regions = container.querySelectorAll('[role="region"]');
    expect(regions).toHaveLength(2);
    expect(regions[0]?.getAttribute("aria-label")).toBe("Tabel 1");
    expect(regions[1]?.getAttribute("aria-label")).toBe("Tabel 2");
    // The inner table really lives inside the outer table's cell.
    expect(regions[1]?.closest("td")).toBeTruthy();
  });
});

describe("RichContent — escaping & fallback", () => {
  it("renders hostile text literally; no script/img/iframe elements exist", () => {
    const { container } = render(
      <RichContent
        doc={docOf([
          para([text("<script>alert(1)</script>")]),
          para([text('<img src=x onerror=alert(1)>')]),
        ])}
      />,
    );

    expect(screen.getByText("<script>alert(1)</script>")).toBeTruthy();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(container.querySelector("script, img, iframe")).toBeNull();
  });

  it("type bernama properti warisan Object.prototype → fallback, tanpa melempar", () => {
    // PR 110 item 1: the validator used to throw on these, taking the
    // whole render down with it.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const input = JSON.parse(
      '{"type":"doc","content":[{"type":"toString","content":[]}]}',
    );
    expect(() => render(<RichContent doc={input} />)).not.toThrow();
    expect(screen.getByText("Konten ini belum bisa ditampilkan.")).toBeTruthy();
    errorSpy.mockRestore();
  });

  it("invalid document (iframe) → fallback paragraph and ONE console.error with codes and paths only", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <RichContent
        doc={docOf([
          para([text("aman")]),
          { type: "iframe", attrs: { src: "https://jahat.example.com/x" } },
        ])}
      />,
    );

    expect(screen.getByText("Konten ini belum bisa ditampilkan.")).toBeTruthy();
    // The fallback replaces the whole document — nothing else renders.
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelector("a, table, ul, blockquote")).toBeNull();

    const richErrors = errorSpy.mock.calls.filter((call) =>
      String(call[0]).includes("RichContent"),
    );
    expect(richErrors).toHaveLength(1);
    const args = richErrors[0] as unknown[];
    expect(args[1]).toStrictEqual([
      { code: "FORBIDDEN_EMBED", path: ["content", 1, "type"] },
    ]);
    // The document's text never reaches the log.
    expect(JSON.stringify(args)).not.toContain("jahat.example.com");
  });

  it("null renders nothing at all", () => {
    const { container } = render(<RichContent doc={null} />);
    expect(container.firstElementChild).toBeNull();
  });

  it("EMPTY_DOC renders the root with no paragraph and no fallback", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<RichContent doc={EMPTY_DOC} />);

    expect(container.querySelector("div")).toBeTruthy();
    expect(container.querySelector("p")).toBeNull();
    expect(screen.queryByText("Konten ini belum bisa ditampilkan.")).toBeNull();
    expect(
      errorSpy.mock.calls.filter((call) => String(call[0]).includes("RichContent")),
    ).toHaveLength(0);
  });
});
