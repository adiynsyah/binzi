import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  // Next.js base + core-web-vitals, then TypeScript rules
  ...nextCoreWebVitals,
  ...nextTypescript,
  // Disable ESLint stylistic rules that conflict with Prettier
  prettierConfig,
  // Module boundary (PRD §10.2 / card A-08): modules talk through each
  // other's service.ts only — queries.ts is module-private. Two blocks,
  // because a scoped block replaces (not merges) the global one:
  // 1) Everywhere: bans alias/absolute imports of any module's queries
  //    (also catches a module importing itself via the alias — inside a
  //    module, use a relative "./queries").
  // 2) Inside src/modules: additionally bans relative imports reaching a
  //    sibling module's queries ("../user/queries").
  // Proof: src/lib/module-boundary.test.ts fails if the rule stops working.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "modules/[^/]+/queries",
              message:
                "Module internals are private — import from modules/<name>/service instead (PRD §10.2). Inside the module itself, use a relative './queries'.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "modules/[^/]+/queries",
              message:
                "Module internals are private — import from modules/<name>/service instead (PRD §10.2). Inside the module itself, use a relative './queries'.",
            },
            {
              regex: "^\\.\\./[^/]+/queries$",
              message:
                "Cross-module imports must go through the other module's service.ts, never its queries.ts (PRD §10.2).",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "package-lock.json",
    // Design handoff demo JS — vendored files, not project source
    "docs/**",
  ]),
]);

export default eslintConfig;
