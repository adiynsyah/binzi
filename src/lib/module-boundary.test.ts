// Proves the ESLint module-boundary rule actually fails offending imports
// (card A-08 "Selesai jika" #1) without committing any violating file: we
// run the real eslint.config.mjs against virtual snippets through the
// Linter API. If the rule is removed or its regexes stop matching, these
// tests fail.
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import eslintConfig from "../../eslint.config.mjs";

const linter = new Linter({ configType: "flat" });
const BOUNDARY_RULE = "no-restricted-imports";

function violatedRulesFor(code: string, filename: string): string[] {
  const messages = linter.verify(
    code,
    eslintConfig as unknown as Linter.FlatConfig[],
    filename,
  );
  return messages
    .map((message) => message.ruleId)
    .filter((ruleId): ruleId is string => ruleId !== null);
}

describe("ESLint module boundary (modules/*/queries is private)", () => {
  it("fails an alias import of queries from app code", () => {
    const rules = violatedRulesFor(
      'import { findUserById } from "@/modules/user/queries";\n',
      "src/app/dashboard/page.tsx",
    );
    expect(rules).toContain(BOUNDARY_RULE);
  });

  it("fails a relative cross-module import of queries", () => {
    const rules = violatedRulesFor(
      'import { findUserById } from "../user/queries";\n',
      "src/modules/course/service.ts",
    );
    expect(rules).toContain(BOUNDARY_RULE);
  });

  it("fails a module importing its own queries via the alias", () => {
    const rules = violatedRulesFor(
      'import { findUserById } from "@/modules/user/queries";\n',
      "src/modules/user/service.ts",
    );
    expect(rules).toContain(BOUNDARY_RULE);
  });

  it("fails a deep relative import escaping a module", () => {
    const rules = violatedRulesFor(
      'import { findUserById } from "../../modules/user/queries";\n',
      "src/components/shared/avatar.tsx",
    );
    expect(rules).toContain(BOUNDARY_RULE);
  });

  it("allows './queries' inside the module itself", () => {
    const rules = violatedRulesFor(
      'import { findUserById } from "./queries";\n',
      "src/modules/user/service.ts",
    );
    expect(rules).not.toContain(BOUNDARY_RULE);
  });

  it("allows importing a module's service from outside", () => {
    const rules = violatedRulesFor(
      'import { getUserProfile } from "@/modules/user/service";\n',
      "src/app/dashboard/page.tsx",
    );
    expect(rules).not.toContain(BOUNDARY_RULE);
  });
});
