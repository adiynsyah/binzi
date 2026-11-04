// Unit tests for the course input contract (card S1-01). Pure Zod — no db,
// no server imports — mirroring the user module's schema tests.
import { describe, expect, it } from "vitest";

import {
  createCourseInput,
  listCoursesInput,
  slugifyCourseSlug,
  FORBIDDEN_COURSE_SLUGS,
} from "./schema";

const validInput = {
  title: "Gizi Seimbang untuk Ibu Hamil",
  slug: "gizi-seimbang-untuk-ibu-hamil",
  level: "BEGINNER",
  summary: "Satu atau dua kalimat untuk kartu katalog.",
};

describe("createCourseInput", () => {
  it("accepts a valid payload", () => {
    expect(createCourseInput.parse(validInput)).toEqual(validInput);
  });

  it("trims title, slug, and summary", () => {
    const parsed = createCourseInput.parse({
      ...validInput,
      title: `  ${validInput.title}  `,
      slug: `  ${validInput.slug}  `,
      summary: `  ${validInput.summary}  `,
    });
    expect(parsed).toEqual(validInput);
  });

  it("rejects an empty title with the required message", () => {
    const result = createCourseInput.safeParse({ ...validInput, title: "  " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["title"]);
      expect(result.error.issues[0]?.message).toBe("Judul kursus wajib diisi.");
    }
  });

  it("rejects a title over 80 characters", () => {
    const result = createCourseInput.safeParse({
      ...validInput,
      title: "k".repeat(81),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a slug that is not kebab-case", () => {
    for (const slug of ["Gizi-Baik", "gizi baik", "gizi_baik", "-gizi", "gizi-"]) {
      const result = createCourseInput.safeParse({ ...validInput, slug });
      expect(result.success, slug).toBe(false);
    }
  });

  it("rejects an empty slug — the punctuation-only-title case", () => {
    const result = createCourseInput.safeParse({
      ...validInput,
      title: "!!! ???",
      slug: slugifyCourseSlug("!!! ???"),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "slug");
      expect(issue?.message).toContain("Slug wajib diisi");
    }
  });

  it("rejects forbidden static-route slugs on path slug", () => {
    for (const slug of FORBIDDEN_COURSE_SLUGS) {
      const result = createCourseInput.safeParse({ ...validInput, slug });
      expect(result.success, slug).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === "slug");
        expect(issue?.message).toContain(slug);
        expect(issue?.message).toContain("dipakai halaman lain");
      }
    }
  });

  it("rejects a non-enum level and unknown keys", () => {
    expect(
      createCourseInput.safeParse({ ...validInput, level: "AHli" }).success,
    ).toBe(false);
    expect(
      createCourseInput.safeParse({ ...validInput, extra: 1 }).success,
    ).toBe(false);
  });

  it("rejects an empty summary with the 21f copy", () => {
    const result = createCourseInput.safeParse({ ...validInput, summary: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Ringkasan wajib diisi — tanpa ini kartu katalog kosong.",
      );
    }
  });
});

describe("listCoursesInput", () => {
  it("accepts an empty object and trims the query", () => {
    expect(listCoursesInput.parse({})).toEqual({});
    expect(listCoursesInput.parse({ q: "  gizi  " })).toEqual({ q: "gizi" });
  });

  it("treats a blank query as no filter", () => {
    expect(listCoursesInput.parse({ q: "   " })).toEqual({});
    expect(listCoursesInput.parse({ q: "" })).toEqual({});
  });

  it("accepts every content status", () => {
    expect(listCoursesInput.parse({ status: "ARCHIVED" })).toEqual({
      status: "ARCHIVED",
    });
  });

  it("rejects an unknown status, an over-long query, and extra keys", () => {
    expect(listCoursesInput.safeParse({ status: "OLD" }).success).toBe(false);
    expect(listCoursesInput.safeParse({ q: "g".repeat(81) }).success).toBe(false);
    expect(listCoursesInput.safeParse({ page: 2 }).success).toBe(false);
  });
});

describe("slugifyCourseSlug", () => {
  it("lowercases and dashes non-alphanumerics", () => {
    expect(slugifyCourseSlug("Gizi Seimbang untuk Ibu Hamil!")).toBe(
      "gizi-seimbang-untuk-ibu-hamil",
    );
  });

  it("strips diacritics via NFD normalization", () => {
    expect(slugifyCourseSlug("Résumé Gizi Kalsium")).toBe("resume-gizi-kalsium");
  });

  it("collapses dash runs and trims edges", () => {
    expect(slugifyCourseSlug("--a---b--")).toBe("a-b");
  });

  it("keeps digits", () => {
    expect(slugifyCourseSlug("Gizi 101: Dasar")).toBe("gizi-101-dasar");
  });

  it("returns an empty slug for a punctuation-only title", () => {
    expect(slugifyCourseSlug("!!! ??? ...")).toBe("");
  });

  it("cuts to 80 and drops the trailing dash the cut produced", () => {
    const slug = slugifyCourseSlug(`abc ${"x".repeat(100)}`);
    expect(slug).toHaveLength(80);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug.startsWith("abc-")).toBe(true);
  });
});
