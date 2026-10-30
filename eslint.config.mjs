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
  // DB instance boundary (card C-06): the Drizzle instance in src/db may be
  // imported as a value only inside src/modules/**, src/db/**, the Better
  // Auth adapter (src/lib/auth.ts, via dynamic import), and the two A-18
  // composition roots (health + keep-alive routes) — this block's `ignores`
  // is that allowlist. Scoped to src/** only: scripts/** and e2e/** are
  // CLI/harness entry points that create their own connection via createDb.
  // Two rules are needed because no-restricted-imports (core and
  // typescript-eslint alike) does not check dynamic import(): the
  // no-restricted-syntax selector below catches `import("@/db")` and the
  // relative forms. `import type` stays allowed anywhere (allowTypeImports),
  // and @/db/schema / @/db/ping are not restricted. Known gap: import() with
  // a template literal or a variable path matches neither rule.
  // Proof: src/lib/module-boundary.test.ts.
  // A scoped block replaces (not merges) the global config for the same
  // rule, so the modules/queries pattern above is repeated here.
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: [
      "src/modules/**",
      "src/db/**",
      "src/lib/auth.ts",
      "src/app/api/health/route.ts",
      "src/app/api/cron/keep-alive/route.ts",
    ],
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
              regex: "^(@/|(\\.\\./)+|\\./)db(/index|/client)?$",
              allowTypeImports: true,
              message:
                "The DB instance is reserved for modules and composition roots — go through modules/<name>/service (PRD §10.2). Types come from @/db/client via import type; @/db/schema and @/db/ping are unrestricted.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportExpression[source.value=/^(@\\/|(\\.\\.\\/)+|\\.\\/)db(\\/index|\\/client)?$/]",
          message:
            "Dynamically importing the DB instance is reserved for modules and composition roots — go through modules/<name>/service (PRD §10.2).",
        },
      ],
    },
  },
  // E2E harness (card A-19): Playwright fixture factories take a `use`
  // callback that eslint-plugin-react-hooks misreads as a React hook call
  // ("React Hook 'use' is called in function 'page'…"). Only that ONE rule
  // is disabled, only under e2e/**.
  {
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    // Playwright artifacts (traces, bundled report JS) — git-ignored, and
    // ESLint's flat config does not read .gitignore.
    "test-results/**",
    "playwright-report/**",
    "playwright/.cache/**",
    "vitest-results/**",
    "next-env.d.ts",
    "package-lock.json",
    // Design handoff demo JS — vendored files, not project source
    "docs/**",
    // Claude Code parallel-session worktrees (.claude/worktrees/*) are full
    // checkouts. Flat-config ESLint lints dot directories, and both ignore
    // patterns and `files` blocks are anchored to this repo root (e.g.
    // "docs/**" above, the e2e/** hook exemption), so they do not cover the
    // copies inside a worktree. The only tracked file under .claude/ is
    // settings.json.
    ".claude/**",
  ]),
]);

export default eslintConfig;
