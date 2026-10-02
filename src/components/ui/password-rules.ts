/*
 * Password rules (card A-05) — the single rule list reused by the
 * PasswordField pills and, later, by server-side validation (A-09).
 *
 * Labels are the final copy from screen 3a — do not paraphrase.
 * NOTE (A-05): this file lives in src/components/ui for now; when A-09
 * lands it moves to the shared contract location and the rules must be
 * matched against the password policy in the PRD.
 */

export type PasswordRule = {
  id: string;
  /** Final UI copy (screen 3a). */
  label: string;
  /** Pure predicate; must behave identically on server and client. */
  test: (value: string) => boolean;
};

export const passwordRules: readonly PasswordRule[] = [
  { id: "length", label: "8 karakter", test: (value) => value.length >= 8 },
  { id: "letter", label: "ada huruf", test: (value) => /[a-z]/i.test(value) },
  { id: "digit", label: "ada angka", test: (value) => /\d/.test(value) },
];

/** Rules satisfied by `value`, in declaration order. */
export function satisfiedPasswordRules(value: string): PasswordRule[] {
  return passwordRules.filter((rule) => rule.test(value));
}
