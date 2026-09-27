#!/usr/bin/env node
/**
 * Hex literal guard (card A-04).
 *
 * Fails when a hex color literal (#abc, #abcd, #aabbcc, #aabbccdd) appears
 * anywhere under src/ outside the two allowed places:
 *   - src/styles/tokens.css      — the single source of color truth
 *   - src/components/public/hero-illustration/ — exported hero artwork
 *
 * Colors must be referenced by token name instead. The regex also matches
 * hex-looking words in comments and strings (e.g. an id anchor "#fade") —
 * deliberate: anything hex-shaped outside the token file is a smell.
 */
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcDir = join(root, "src");
const exemptFile = join(root, "src", "styles", "tokens.css");
const exemptDir = join(root, "src", "components", "public", "hero-illustration");

const scannedExtensions = new Set([
  ".css",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".svg",
  ".html",
  ".json",
]);

// 3, 4, 6, or 8 hex digits, not followed by another hex digit (so a longer
// word like "#abcdef012" only matches once, as its longest valid prefix).
const hexLiteral =
  /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-fA-F])/g;

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const offenders = [];

for (const file of walk(srcDir)) {
  if (file === exemptFile || file.startsWith(exemptDir + sep)) continue;
  if (!scannedExtensions.has(extname(file))) continue;

  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    for (const match of line.matchAll(hexLiteral)) {
      offenders.push({
        location: `${relative(root, file)}:${index + 1}:${match.index + 1}`,
        literal: match[0],
      });
    }
  });
}

if (offenders.length > 0) {
  console.error(
    `lint:hex — ${offenders.length} hex color literal(s) outside allowed files:`,
  );
  for (const offender of offenders) {
    console.error(`  ${offender.location}  ${offender.literal}`);
  }
  console.error(
    "\nUse design tokens from src/styles/tokens.css instead " +
      "(docs/design/handoff/TOKENS.md).",
  );
  process.exit(1);
}

console.log("lint:hex — no hex color literals outside tokens.css");
