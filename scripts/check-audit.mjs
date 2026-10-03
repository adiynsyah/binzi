#!/usr/bin/env node
/**
 * Security audit gate with explicit, expiring exceptions.
 *
 * Runs `npm audit --json` and fails (exit 1) when any high/critical
 * finding is not covered by an active exception in
 * .github/audit-exceptions.json — a JSON array of entries shaped:
 *
 *   { "id": "GHSA-xxxx-xxxx-xxxx", "package": "braces",
 *     "reason": "…", "expires": "YYYY-MM-DD" }
 *
 * Rules:
 *   - Same bar as the `npm audit --audit-level=high` step it replaces:
 *     only high/critical findings can fail the gate.
 *   - A direct advisory is excused only by an exception with the same
 *     GHSA id.
 *   - A transitive finding is excused only when EVERY `via` chain ends in
 *     excepted advisories (e.g. eslint-config-next ->
 *     @next/eslint-plugin-next -> fast-glob -> micromatch -> braces ->
 *     GHSA-vfj7-8cjw-p6xm). Any other high advisory on the chain still
 *     fails the gate.
 *   - Exceptions past their `expires` date (compared as local calendar
 *     dates) are not active and additionally fail the gate outright.
 *   - If npm reports a non-breaking fix for an excepted advisory, the
 *     gate fails: the exception must be removed and the upgrade applied.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const exceptionsPath = join(root, ".github", "audit-exceptions.json");
const blockingSeverities = new Set(["high", "critical"]);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function isRealIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function loadExceptions(today) {
  const errors = [];
  const active = new Map();

  let raw;
  try {
    raw = readFileSync(exceptionsPath, "utf8");
  } catch {
    console.error(`audit:check — cannot read ${exceptionsPath}`);
    process.exit(1);
  }

  let entries;
  try {
    entries = JSON.parse(raw);
  } catch (error) {
    console.error(
      `audit:check — invalid JSON in audit-exceptions.json: ${error.message}`,
    );
    process.exit(1);
  }
  if (!Array.isArray(entries)) {
    console.error(
      "audit:check — audit-exceptions.json must be a JSON array of entries",
    );
    process.exit(1);
  }

  for (const entry of entries) {
    const id =
      entry && typeof entry.id === "string" ? entry.id : "(missing id)";
    const shapeOk =
      entry !== null &&
      typeof entry === "object" &&
      typeof entry.id === "string" &&
      /^GHSA-[A-Za-z0-9-]+$/.test(entry.id) &&
      typeof entry.package === "string" &&
      entry.package.length > 0 &&
      typeof entry.reason === "string" &&
      entry.reason.length > 0;

    if (!shapeOk) {
      errors.push(
        `${id}: entry must have non-empty string id (GHSA-…), package, and reason`,
      );
      continue;
    }
    if (!isRealIsoDate(entry.expires)) {
      errors.push(`${entry.id}: "expires" must be a real date as YYYY-MM-DD`);
      continue;
    }
    if (active.has(entry.id)) {
      errors.push(`${entry.id}: duplicate exception entry`);
      continue;
    }
    if (entry.expires < today) {
      errors.push(
        `${entry.id} (${entry.package}): exception expired on ${entry.expires} — remove or renew it`,
      );
      continue;
    }
    active.set(entry.id, { ...entry });
  }

  return { errors, active };
}

function runAudit() {
  const result = spawnSync(npmCommand, ["audit", "--json"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.error) {
    console.error(
      `audit:check — cannot run npm audit: ${result.error.message}`,
    );
    process.exit(1);
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    console.error("audit:check — npm audit did not return valid JSON");
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(1);
  }
  if (
    report === null ||
    typeof report !== "object" ||
    !("vulnerabilities" in report)
  ) {
    console.error("audit:check — unexpected npm audit report shape");
    if (report?.error?.summary) console.error(report.error.summary);
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(1);
  }
  return report;
}

function advisoryId(advisory) {
  return String(advisory?.url ?? "")
    .split("/")
    .filter(Boolean)
    .pop();
}

// Filled by main() before evaluate() runs.
const vulnerabilities = {};
const evaluationCache = new Map();

// A finding is excused when every `via` cause is excused. String causes
// point at another vulnerable package; object causes are direct advisories
// that need an active exception. Unknown packages, cycles, and malformed
// causes fail closed (treated as not excused).
function evaluate(name, ancestors = new Set()) {
  if (evaluationCache.has(name)) return evaluationCache.get(name);

  const vuln = vulnerabilities[name];
  if (
    !vuln ||
    !Array.isArray(vuln.via) ||
    vuln.via.length === 0 ||
    ancestors.has(name)
  ) {
    return { excused: false, exceptionIds: new Set(), chain: null };
  }

  let excused = true;
  let chain = null;
  const exceptionIds = new Set();

  for (const cause of vuln.via) {
    if (typeof cause === "string") {
      const sub = evaluate(cause, new Set([...ancestors, name]));
      if (!sub.excused) {
        excused = false;
        break;
      }
      for (const id of sub.exceptionIds) exceptionIds.add(id);
      if (chain === null) chain = [cause, ...sub.chain];
    } else if (
      cause !== null &&
      typeof cause === "object" &&
      typeof cause.url === "string"
    ) {
      const id = advisoryId(cause);
      if (!activeExceptions.has(id)) {
        excused = false;
        break;
      }
      exceptionIds.add(id);
      if (chain === null) chain = [id];
    } else {
      excused = false;
      break;
    }
  }

  const outcome = { excused, exceptionIds, chain };
  evaluationCache.set(name, outcome);
  return outcome;
}

const today = localToday();
const { errors: gateErrors, active: activeExceptions } = loadExceptions(today);
const report = runAudit();
Object.assign(vulnerabilities, report.vulnerabilities);

const excused = [];
const blocking = [];
for (const [name, vuln] of Object.entries(vulnerabilities)) {
  if (!blockingSeverities.has(vuln.severity)) continue;
  const outcome = evaluate(name);
  if (outcome.excused) {
    excused.push({
      name,
      severity: vuln.severity,
      exceptionIds: [...outcome.exceptionIds],
      chain: outcome.chain,
    });
  } else {
    blocking.push({ name, severity: vuln.severity, via: vuln.via });
  }
}

// If npm can already fix an excepted advisory without a breaking change,
// the exception is stale — fail so it gets removed and the fix applied.
for (const [name, vuln] of Object.entries(vulnerabilities)) {
  if (!blockingSeverities.has(vuln.severity)) continue;
  const carried = vuln.via.find(
    (cause) =>
      cause !== null &&
      typeof cause === "object" &&
      typeof cause.url === "string" &&
      activeExceptions.has(advisoryId(cause)),
  );
  if (!carried) continue;

  const fix = vuln.fixAvailable;
  const nonBreaking =
    fix === true ||
    (fix !== null && typeof fix === "object" && fix.isSemVerMajor === false);
  if (nonBreaking) {
    const how =
      fix === true ? "npm audit fix" : `update ${fix.name} to ${fix.version}`;
    gateErrors.push(
      `${advisoryId(carried)} (${name}): perbaikan tersedia, hapus pengecualian dan upgrade — npm reports a non-breaking fix (${how})`,
    );
  }
}

console.log(
  `audit:check — high/critical findings: ${excused.length} excused, ${blocking.length} blocking`,
);

if (excused.length > 0) {
  console.log("Excused by active exceptions:");
  for (const finding of excused) {
    const expires = finding.exceptionIds
      .map((id) => `${id} expires ${activeExceptions.get(id).expires}`)
      .join(", ");
    const prefix = finding.chain.length === 1 ? "advisory " : "via ";
    console.log(
      `  - ${finding.name} [${finding.severity}] — ${prefix}${finding.chain.join(" -> ")} (${expires})`,
    );
  }
}

if (blocking.length > 0) {
  console.log("Blocking findings:");
  for (const finding of blocking) {
    const causes = finding.via.map((cause) => {
      if (typeof cause === "string") {
        return evaluate(cause).excused
          ? `depends on ${cause} (excused)`
          : `depends on ${cause} (not excused)`;
      }
      const id = advisoryId(cause) ?? "(unknown)";
      return activeExceptions.has(id)
        ? `advisory ${id} (excused)`
        : `advisory ${id} has no active exception`;
    });
    console.log(
      `  - ${finding.name} [${finding.severity}] — ${causes.join("; ")}`,
    );
  }
}

const usedIds = new Set();
for (const finding of excused) {
  for (const id of finding.exceptionIds) usedIds.add(id);
}
const unused = [...activeExceptions.values()].filter(
  (entry) => !usedIds.has(entry.id),
);
if (unused.length > 0) {
  console.log(
    "Note: exceptions not referenced by any excused finding (consider removing):",
  );
  for (const entry of unused) {
    console.log(`  - ${entry.id} (${entry.package})`);
  }
}

const lowerCounts = report.metadata?.vulnerabilities;
if (lowerCounts) {
  const lower =
    (lowerCounts.info ?? 0) +
    (lowerCounts.low ?? 0) +
    (lowerCounts.moderate ?? 0);
  if (lower > 0) {
    console.log(
      `(${lower} info/low/moderate finding(s) are below the high threshold and do not fail this gate)`,
    );
  }
}

if (gateErrors.length > 0) {
  console.error("audit:check — FAILED — problems with exception entries:");
  for (const message of gateErrors) console.error(`  - ${message}`);
  process.exit(1);
}
if (blocking.length > 0) {
  console.error(
    `audit:check — FAILED — ${blocking.length} blocking high/critical finding(s).`,
  );
  console.error(
    "  Fix by upgrading, or add a documented entry (id/package/reason/expires) to .github/audit-exceptions.json.",
  );
  process.exit(1);
}
console.log("audit:check — OK");
