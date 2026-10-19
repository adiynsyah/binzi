// Reader for the E2E server's mail log (card A-19 §3).
//
// MAIL_TRANSPORT=log makes the server print one `[mail:log]` line per
// message (src/lib/mail.ts). Tests snapshot the file's line count BEFORE an
// action, then poll for the ONE matching line that appears AFTER that
// offset — more than one match fails the test (session decision #7).
//
// Lines are matched by the masked recipient (maskEmail from src/lib/mail.ts
// — same masking the server applies) plus the link's path, which
// distinguishes verification (`/api/auth/verify-email`) from password-reset
// (`/api/auth/reset-password/`) links without depending on subject copy.
// Polling with a deadline — never a fixed waitForTimeout.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { maskEmail } from "../src/lib/mail";

// Playwright loads spec files (and their imports) as CJS in this repo —
// `import.meta` is therefore unavailable here. Workers run from the project
// root, so resolve against process.cwd().
const SERVER_LOG = resolve(process.cwd(), "test-results/server.log");

// [mail:log] dari BINZI <…> untuk r***@example.com · subjek: … · tautan: https://…
const MAIL_LINE =
  /^\[mail:log\] dari (.+?) untuk (\S+) · subjek: (.*?)(?: · tautan: (\S+))?$/;

export type MailLogLine = {
  from: string;
  maskedTo: string;
  subject: string;
  link?: string;
};

/**
 * Number of COMPLETE lines in the server log (newline-terminated) — the
 * offset for the next wait. Not `split("\n").length`: that counts the empty
 * string after the trailing newline too, so a line appended right after the
 * snapshot would land exactly at `slice(sinceLine)`'s exclusive start and be
 * missed (every mail wait failed on exactly this off-by-one).
 */
export async function mailLogOffset(): Promise<number> {
  let text: string;
  try {
    text = await readFile(SERVER_LOG, "utf8");
  } catch {
    // File not created yet (no `next start` output at all).
    return 0;
  }
  return text.split("\n").length - 1;
}

function parseLines(text: string, sinceLine: number): MailLogLine[] {
  return text
    .split("\n")
    .slice(sinceLine)
    .map((line) => MAIL_LINE.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({
      from: m[1] ?? "",
      maskedTo: m[2] ?? "",
      subject: m[3] ?? "",
      link: m[4],
    }));
}

/**
 * Polls the server log until EXACTLY ONE mail line addressed to `email`
 * (masked comparison) with a link containing `linkPathIncludes` appears
 * after `sinceLine`. Returns the action link; throws on zero matches at the
 * deadline or on more than one match.
 */
export async function waitForMailLink(options: {
  sinceLine: number;
  email: string;
  linkPathIncludes: string;
  timeoutMs?: number;
}): Promise<string> {
  const expectedMasked = maskEmail(options.email);
  const deadline = Date.now() + (options.timeoutMs ?? 30_000);

  let lastSeen = 0;
  for (;;) {
    let text: string;
    try {
      text = await readFile(SERVER_LOG, "utf8");
    } catch {
      text = "";
    }
    const matches = parseLines(text, options.sinceLine).filter(
      (line) =>
        line.maskedTo === expectedMasked &&
        line.link !== undefined &&
        line.link.includes(options.linkPathIncludes),
    );
    lastSeen = matches.length;
    if (matches.length === 1) {
      const link = matches[0]?.link;
      if (link) return link;
    }
    if (matches.length > 1) {
      throw new Error(
        `Expected exactly one [mail:log] line for ${expectedMasked} ` +
          `(${options.linkPathIncludes}) after line ${options.sinceLine}, found ${matches.length}.`,
      );
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting for the [mail:log] line for ${expectedMasked} ` +
          `(${options.linkPathIncludes}); saw ${lastSeen} matching lines after ` +
          `line ${options.sinceLine}.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
