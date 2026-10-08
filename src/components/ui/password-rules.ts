/*
 * Password rules (card A-05) — the single rule list reused by the
 * PasswordField pills and, later, by server-side validation (A-09).
 *
 * Labels are the final copy from screen 3a — do not paraphrase.
 * A-13: the length threshold now imports PASSWORD_MIN_LENGTH from the
 * shared contract (src/modules/auth/schema.ts, single source since A-09)
 * so the pills and the server schema can never drift. The letter/digit
 * predicates below mirror passwordSchema's regexes; the schema file is
 * outside this card's scope, so they stay local until a follow-up moves
 * the per-rule predicates into the contract too.
 */
// Relative import: this module is reached from Vitest tests (via
// PasswordField), and vitest.config.ts has no "@/" alias resolution.
import { PASSWORD_MIN_LENGTH } from "../../modules/auth/schema";

export type PasswordRule = {
  id: string;
  /** Final UI copy (screen 3a). */
  label: string;
  /** Pure predicate; must behave identically on server and client. */
  test: (value: string) => boolean;
};

export const passwordRules: readonly PasswordRule[] = [
  {
    id: "length",
    label: `${PASSWORD_MIN_LENGTH} karakter`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH,
  },
  { id: "letter", label: "ada huruf", test: (value) => /[a-z]/i.test(value) },
  { id: "digit", label: "ada angka", test: (value) => /\d/.test(value) },
];

/** Rules satisfied by `value`, in declaration order. */
export function satisfiedPasswordRules(value: string): PasswordRule[] {
  return passwordRules.filter((rule) => rule.test(value));
}
