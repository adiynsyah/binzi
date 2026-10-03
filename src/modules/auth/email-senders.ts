// Better Auth email callbacks → BINZI templates (card A-10, NTF-01).
//
// Pure wiring with no server imports: the transport is injected as a
// `send` function so integration tests capture messages in memory
// (no network, no Resend). Every callback funnels through `deliver`,
// which catches ALL failures (template render, invalid URL, transport)
// and logs one structured line — never throwing back into Better Auth:
// - sendVerificationEmail / sendResetPassword run inside Better Auth's
//   error-swallowing background wrapper, but
// - afterEmailVerification does NOT — an exception there would break the
//   verification request itself.
// Either way the auth endpoints keep responses that do not depend on
// mail delivery succeeding (§14.2).
import { resetPasswordEmail } from "../../emails/reset-password";
import { verificationEmail } from "../../emails/verification";
import { welcomeEmail } from "../../emails/welcome";
import { describeError, maskEmail, type MailMessage } from "../../lib/mail";

export type SendMailFn = (message: MailMessage) => Promise<void>;

/** The three callbacks `createAuthInstance` wires into Better Auth. */
export type MailCallbacks = {
  sendVerificationEmail: (
    data: {
      user: { name?: string | null; email: string };
      url: string;
      token: string;
    },
    request?: Request,
  ) => Promise<void>;
  sendResetPassword: (
    data: {
      user: { name?: string | null; email: string };
      url: string;
      token: string;
    },
    request?: Request,
  ) => Promise<void>;
  afterEmailVerification: (
    user: { name?: string | null; email: string },
    request?: Request,
  ) => Promise<void>;
};

export type MailSenderOptions = {
  /** Absolute app origin, used for the welcome-email CTA. */
  appUrl: string;
};

/**
 * Coarse User-Agent categories for the reset email's request metadata
 * ("Permintaan dibuat dari Chrome di Windows · … WIB."). Deliberately
 * category-level: the raw UA string never enters an email, and no geo
 * source exists, so no city is claimed.
 */
export function parseUserAgent(userAgent: string | null | undefined): {
  browser: string;
  os: string;
} | null {
  const ua = userAgent ?? "";
  if (!ua) return null;

  let browser: string | null = null;
  if (/\bEdg\//.test(ua)) browser = "Edge";
  else if (/\b(OPR|Opera)\//.test(ua)) browser = "Opera";
  else if (/\bSamsungBrowser\//.test(ua)) browser = "Samsung Internet";
  else if (/\bChrome\//.test(ua)) browser = "Chrome";
  else if (/\bFirefox\//.test(ua)) browser = "Firefox";
  else if (/\bSafari\//.test(ua) && /\bVersion\//.test(ua)) browser = "Safari";

  let os: string | null = null;
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Macintosh|Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux|X11/.test(ua)) os = "Linux";

  if (!browser || !os) return null;
  return { browser, os };
}

export function createMailCallbacks(
  send: SendMailFn,
  options: MailSenderOptions,
): MailCallbacks {
  const deliver = async (
    label: string,
    to: string,
    build: () => MailMessage,
  ): Promise<void> => {
    try {
      await send(build());
    } catch (error) {
      console.error(
        `[mail] gagal menyiapkan/mengirim "${label}" untuk ${maskEmail(to)}: ${describeError(error)}`,
      );
    }
  };

  return {
    sendVerificationEmail: ({ user, url }) =>
      deliver("email verifikasi", user.email, () => {
        const rendered = verificationEmail({
          recipientEmail: user.email,
          userName: user.name ?? "",
          url,
        });
        return {
          to: user.email,
          subject: rendered.subject,
          html: rendered.html,
          link: url,
        };
      }),

    sendResetPassword: ({ user, url }, request) =>
      deliver("email reset password", user.email, () => {
        const rendered = resetPasswordEmail({
          recipientEmail: user.email,
          url,
          device: parseUserAgent(request?.headers.get("user-agent")),
          requestedAt: new Date(),
        });
        return {
          to: user.email,
          subject: rendered.subject,
          html: rendered.html,
          link: url,
        };
      }),

    afterEmailVerification: (user) =>
      deliver("email selamat datang", user.email, () => {
        const rendered = welcomeEmail({
          recipientEmail: user.email,
          userName: user.name ?? "",
          appUrl: options.appUrl,
        });
        return {
          to: user.email,
          subject: rendered.subject,
          html: rendered.html,
        };
      }),
  };
}
