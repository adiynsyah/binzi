/*
 * Slug helpers shared by the course and lesson modules (card S1-02).
 *
 * Moved out of modules/course/schema.ts when the lesson module needed the
 * SAME title→slug rule (card: "fungsi slugify yang sama dengan kursus");
 * pure on purpose so both client-safe schemas and server queries import it.
 */

/** Longest slug either domain accepts (courses.slug / lessons.slug). */
export const SLUG_MAX = 80;

/**
 * Title → slug base: NFD-normalize and drop diacritics, everything outside
 * a–z0–9 becomes "-", runs collapse, edges are trimmed, the result is cut to
 * `maxLength` and a trailing "-" produced by that cut is trimmed again. A
 * title made only of punctuation yields "".
 */
export function slugify(title: string, maxLength = SLUG_MAX): string {
  return title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/**
 * Appends "-2", "-3", … until `isTaken` answers false (reserved words count
 * as taken — pass them through the predicate). The suffixed result stays
 * within SLUG_MAX: the base is cut to SLUG_MAX − suffix length and its
 * trailing "-" trimmed BEFORE the suffix is appended, so "…-2" can never
 * end up 81 characters (card §4 step 3, review addition 7).
 */
export function uniquifySlug(
  base: string,
  isTaken: (slug: string) => boolean,
): string {
  if (!isTaken(fitSlug(base, ""))) return fitSlug(base, "");
  for (let n = 2; ; n += 1) {
    const candidate = fitSlug(base, `-${n}`);
    if (!isTaken(candidate)) return candidate;
  }
}

/** base + suffix, cut to SLUG_MAX with any trailing "-" removed first. */
function fitSlug(base: string, suffix: string): string {
  const core = base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, "");
  return `${core}${suffix}`;
}
