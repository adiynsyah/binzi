// Transactional mail transports (card A-10, NTF-01).
//
// Two transports selected by MAIL_TRANSPORT (src/config/env.server.ts):
// - "log": prints subject + action link to the server log — the whole
//   verification/reset flow is testable without Resend (card "Selesai jika").
// - "resend": POSTs to the Resend REST API with a plain fetch — no SDK
//   dependency by decision (card A-10, PR "Keputusan & asumsi").
//
// Guarantees shared by both transports:
// - `send` NEVER throws. A send failure is logged as one structured line
//   and swallowed: the auth endpoints must keep their generic responses
//   (no account-status leak, §14.2) and `afterEmailVerification` runs
//   outside Better Auth's error-swallowing background wrapper.
// - Logs never contain the full recipient address (masked via maskEmail)
//   and never contain the API key.
//
// No top-level server-only imports so this module stays importable in
// unit tests; the environment is read lazily inside getMailTransport().
export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  /**
   * Primary action URL, printed by the log transport ("subject + link").
   * Informational only — the URL itself is already inside `html`.
   */
  link?: string;
};

export type MailTransport = {
  readonly kind: "log" | "resend";
  /** Delivers one message; resolves also on failure (see header). */
  send(message: MailMessage): Promise<void>;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 10_000;
// Development default for the log transport only; with MAIL_TRANSPORT=resend
// the env schema already requires MAIL_FROM.
const DEV_LOG_FROM = "BINZI <dev@binzi.invalid>";

/**
 * Masks an address for logs: "rina.kurnia@example.com" → "r***@example.com".
 * Malformed input degrades to "***" — the raw value is never echoed.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0 || at === email.length - 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

/** Compact, value-free-ish error description for log lines. */
export function describeError(error: unknown): string {
  const text =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.slice(0, 300);
}

function logTransport(from: string): MailTransport {
  return {
    kind: "log",
    send: async (message) => {
      const link = message.link ? ` · tautan: ${message.link}` : "";
      console.log(
        `[mail:log] dari ${from} untuk ${maskEmail(message.to)} · subjek: ${message.subject}${link}`,
      );
    },
  };
}

function resendTransport(config: {
  apiKey: string;
  from: string;
}): MailTransport {
  return {
    kind: "resend",
    send: async (message) => {
      try {
        const response = await fetch(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from: config.from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
          }),
          // A hung delivery must not pin the request/serverless invocation.
          signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(
            `Resend menolak dengan HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
          );
        }
      } catch (error) {
        // Ordinary failure (HTTP error, network error, timeout): log and
        // move on — see the header for why this must not throw.
        console.error(
          `[mail:resend] gagal mengirim "${message.subject}" ke ${maskEmail(message.to)}: ${describeError(error)}`,
        );
      }
    },
  };
}

let cachedTransport: MailTransport | undefined;

/**
 * Builds (and memoizes) the transport for this process. Reads the server
 * env lazily via dynamic import — same pattern as `src/lib/auth.ts` — so
 * importing this module never requires a configured environment.
 */
export async function getMailTransport(): Promise<MailTransport> {
  if (cachedTransport) return cachedTransport;
  const { serverEnv } = await import("../config/env.server");
  const from = serverEnv.MAIL_FROM ?? DEV_LOG_FROM;
  cachedTransport =
    serverEnv.MAIL_TRANSPORT === "resend" && serverEnv.RESEND_API_KEY
      ? resendTransport({ apiKey: serverEnv.RESEND_API_KEY, from })
      : logTransport(from);
  return cachedTransport;
}
