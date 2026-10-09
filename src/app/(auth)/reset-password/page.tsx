import type { Metadata } from "next";

import {
  AuthInlineLink,
  AuthShell,
  ResetFlowMarketing,
} from "@/components/shared/auth/auth-panels";
import { isResetLinkError } from "@/components/shared/auth/auth-errors";
import { ExpiredResetPanel } from "@/components/shared/auth/expired-link-panel";
import { ResetPasswordForm } from "@/components/shared/auth/reset-password-form";

// /reset-password (card A-13; screen 3b right, expired state 3c).
// Destination of the reset link's `redirectTo`: Better Auth's callback
// validated the token moments before redirecting, so `?token=` here means
// valid and `?error=INVALID_TOKEN` (or no token) means expired/used.
// Desktop layout follows /lupa-password (3b's "melanjutkan pola halaman
// Masuk (2a)" note): the shared ink marketing panel.
// referrer no-referrer: the token is a one-time secret carried in the URL —
// it must never leak to external referrers from this page (product-owner
// decision, card A-13).

export const metadata: Metadata = {
  title: "Buat password baru · BINZI",
  referrer: "no-referrer",
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string; error?: string }>;
};

// "Kembali ke Masuk" (A-13 fix): mobile card footer below the form; on
// ≥1024 the link lives at the bottom of the marketing panel.
const backToLogin = (
  <>
    Kembali ke <AuthInlineLink href="/masuk">Masuk</AuthInlineLink>
  </>
);

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token, error } = await searchParams;
  const validToken = typeof token === "string" && token.length > 0 ? token : null;
  const expired = validToken === null || isResetLinkError(error);

  return (
    <AuthShell
      tone="ink"
      // Heading only while a form is actually offered. In the expired
      // state the shell renders no h1 — the 3c panel's card title is the
      // page's main heading (A-13 visual finding: never stack "Buat
      // password baru" above an expired-link card).
      heading={expired ? undefined : "Buat password baru"}
      marketing={<ResetFlowMarketing />}
      footer={backToLogin}
    >
      {expired ? (
        <ExpiredResetPanel />
      ) : (
        <ResetPasswordForm token={validToken as string} />
      )}
    </AuthShell>
  );
}
