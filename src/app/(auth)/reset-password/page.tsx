import type { Metadata } from "next";

import { AuthShell } from "@/components/shared/auth/auth-panels";
import { isResetLinkError } from "@/components/shared/auth/auth-errors";
import { ExpiredResetPanel } from "@/components/shared/auth/expired-link-panel";
import { ResetPasswordForm } from "@/components/shared/auth/reset-password-form";

// /reset-password (card A-13; screen 3b right, expired state 3c).
// Destination of the reset link's `redirectTo`: Better Auth's callback
// validated the token moments before redirecting, so `?token=` here means
// valid and `?error=INVALID_TOKEN` (or no token) means expired/used.
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

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token, error } = await searchParams;
  const validToken = typeof token === "string" && token.length > 0 ? token : null;
  const expired = validToken === null || isResetLinkError(error);

  return (
    <AuthShell heading="Buat password baru">
      {expired ? (
        <ExpiredResetPanel />
      ) : (
        <ResetPasswordForm token={validToken as string} />
      )}
    </AuthShell>
  );
}
