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
