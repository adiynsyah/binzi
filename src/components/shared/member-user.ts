/*
 * Member display data helpers (card A-14b). The member header receives
 * ONLY { name, email } — never the session/user object (CLAUDE.md: DTO
 * per audience). The Avatar derives its single initial on its own, so the
 * ONE rule that lives here is which string is handed to it: the display
 * name, or the email when the name is blank (product-owner decision —
 * there is no second initial rule to drift).
 */

/** What the member header (and its menus) may know about the user. */
export type MemberUser = {
  name: string;
  email: string;
};

/**
 * The name shown wherever the user is represented: the display name, or
 * the email when the name is blank/whitespace. Feeds the Avatar (initial),
 * the account pill and the menu heads.
 */
export function displayNameOf(user: MemberUser): string {
  return user.name.trim() ? user.name : user.email;
}

/**
 * First word of the name after trim (28a greeting, "Selamat datang, …").
 * Empty string when the name has no word — callers then drop the name
 * from the greeting entirely.
 */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}
