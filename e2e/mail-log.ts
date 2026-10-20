// Reader for the E2E server's mail log (card A-19 §3).
//
// MAIL_TRANSPORT=log makes the server print one `[mail:log]` line per
// message (src/lib/mail.ts). Tests snapshot the file's line count BEFORE an
// action, then poll for the ONE matching line that appears AFTER that
// offset — more than one match fails the test (session decision #7).
//
// What actually identifies a line: the OFFSET (lines written after the
// snapshot), the link's PATH (verification `/api/auth/verify-email` vs
// reset `/api/auth/reset-password/`), and the EXACTLY-ONE rule — NOT the
// masked recipient: every test address starts with "e", so maskEmail
// renders them all as e***@example.com and distinguishes nothing. For
// verification links the token is a JWT, so `verifyJwtEmail` can decode
// its payload and pin the line to one EXACT address; reset tokens are
// opaque, so those tests rely on offset+path+exactly-one alone.
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
 * Exact address from a verification link's JWT payload, or null when the
 * link has no decodable `token` (reset links use opaque tokens).
 */
function jwtEmail(link: string): string | null {
  try {
    const token = new URL(link).searchParams.get("token") ?? "";
    const payload = token.split(".")[1] ?? "";
    const json = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { email?: unknown };
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}

/**
 * Polls the server log until EXACTLY ONE mail line addressed to `email`
 * (masked comparison) with a link containing `linkPathIncludes` appears
 * after `sinceLine`. Returns the action link; throws on zero matches at the
 * deadline or on more than one match. With `verifyJwtEmail`, the matched
 * line's JWT token payload must ALSO contain the exact address — a real
 * identity check instead of the (non-distinguishing) masked comparison.
 */
export async function waitForMailLink(options: {
  sinceLine: number;
  email: string;
  linkPathIncludes: string;
  verifyJwtEmail?: boolean;
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
      if (link) {
        if (options.verifyJwtEmail && jwtEmail(link) !== options.email) {
          throw new Error(
            `The [mail:log] line for ${expectedMasked} carries a token ` +
              `whose JWT payload does not hold the exact address ` +
              `(${options.linkPathIncludes}).`,
          );
        }
        return link;
      }
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
