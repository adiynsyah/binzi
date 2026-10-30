// Proves the ESLint module-boundary rules actually fail offending imports
// (card A-08 "Selesai jika" #1, card C-06) without committing any violating
// file: we run the real eslint.config.mjs against virtual snippets through
// the Linter API. If a rule is removed or its regexes stop matching, these
// tests fail.
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import eslintConfig from "../../eslint.config.mjs";

const linter = new Linter({ configType: "flat" });
const BOUNDARY_RULE = "no-restricted-imports";
const DYNAMIC_IMPORT_RULE = "no-restricted-syntax";

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

describe("ESLint DB boundary (db instance is module/composition-root only)", () => {
  it("fails a value import of @/db from app code", () => {
    const rules = violatedRulesFor(
      'import { db } from "@/db";\n',
      "src/app/x/page.tsx",
    );
    expect(rules).toContain(BOUNDARY_RULE);
  });

  it("fails a value import of ../db from lib code", () => {
    const rules = violatedRulesFor(
      'import { db } from "../db";\n',
      "src/lib/x.ts",
    );
    expect(rules).toContain(BOUNDARY_RULE);
  });

  it("fails a value import of @/db/client from components", () => {
    const rules = violatedRulesFor(
      'import { db } from "@/db/client";\n',
      "src/components/x.tsx",
    );
    expect(rules).toContain(BOUNDARY_RULE);
  });

  it("fails a dynamic import of @/db from app code", () => {
    const rules = violatedRulesFor(
      'import("@/db");\n',
      "src/app/x/page.tsx",
    );
    expect(rules).toContain(DYNAMIC_IMPORT_RULE);
  });

  it("fails a dynamic import of ../db from lib code", () => {
    const rules = violatedRulesFor(
      'import("../db");\n',
      "src/lib/x.ts",
    );
    expect(rules).toContain(DYNAMIC_IMPORT_RULE);
  });

  it("still bans queries from app code (pattern repeated in the DB block)", () => {
    const rules = violatedRulesFor(
      'import { findUserById } from "@/modules/user/queries";\n',
      "src/app/x/page.tsx",
    );
    expect(rules).toContain(BOUNDARY_RULE);
  });

  it("still bans queries in the allowlisted auth adapter (global block)", () => {
    const rules = violatedRulesFor(
      'import { findUserById } from "@/modules/user/queries";\n',
      "src/lib/auth.ts",
    );
    expect(rules).toContain(BOUNDARY_RULE);
  });

  it("allows import type from @/db/client anywhere", () => {
    const rules = violatedRulesFor(
      'import type { Db } from "@/db/client";\n',
      "src/lib/x.ts",
    );
    expect(rules).not.toContain(BOUNDARY_RULE);
    expect(rules).not.toContain(DYNAMIC_IMPORT_RULE);
  });

  it("allows a value import of @/db/schema", () => {
    const rules = violatedRulesFor(
      'import { users } from "@/db/schema";\n',
      "src/lib/x.ts",
    );
    expect(rules).not.toContain(BOUNDARY_RULE);
    expect(rules).not.toContain(DYNAMIC_IMPORT_RULE);
  });

  it("allows a dynamic import outside the db targets", () => {
    const rules = violatedRulesFor(
      'import("@/config/env.server");\n',
      "src/lib/x.ts",
    );
    expect(rules).not.toContain(BOUNDARY_RULE);
    expect(rules).not.toContain(DYNAMIC_IMPORT_RULE);
  });

  it("allows the auth adapter's dynamic db import", () => {
    const rules = violatedRulesFor(
      'import("@/db");\n',
      "src/lib/auth.ts",
    );
    expect(rules).not.toContain(BOUNDARY_RULE);
    expect(rules).not.toContain(DYNAMIC_IMPORT_RULE);
  });

  it("allows a value import of @/db in the allowlisted files", () => {
    for (const filename of [
      "src/app/api/health/route.ts",
      "src/modules/course/queries.ts",
    ]) {
      const rules = violatedRulesFor('import { db } from "@/db";\n', filename);
      expect(rules).not.toContain(BOUNDARY_RULE);
      expect(rules).not.toContain(DYNAMIC_IMPORT_RULE);
    }
  });

  it("allows './index' inside src/db itself", () => {
    const rules = violatedRulesFor(
      'import { db } from "./index";\n',
      "src/db/x.ts",
    );
    expect(rules).not.toContain(BOUNDARY_RULE);
    expect(rules).not.toContain(DYNAMIC_IMPORT_RULE);
  });

  it("allows ../src/db/client outside src/ (scripts are not covered)", () => {
    const rules = violatedRulesFor(
      'import { db } from "../src/db/client";\n',
      "scripts/x.ts",
    );
    expect(rules).not.toContain(BOUNDARY_RULE);
    expect(rules).not.toContain(DYNAMIC_IMPORT_RULE);
  });
});
