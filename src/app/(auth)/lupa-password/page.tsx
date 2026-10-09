import type { Metadata } from "next";

import {
  AuthInlineLink,
  AuthShell,
  ResetFlowMarketing,
} from "@/components/shared/auth/auth-panels";
import {
  getGoogleEnabled,
  getTurnstileSiteKey,
} from "@/components/shared/auth/auth-config";
import { ForgotPasswordForm } from "@/components/shared/auth/forgot-password-form";

// /lupa-password (card A-13; screen 3b left, AUTH-04). The response is
// identical for registered and unknown addresses (§14.2, A-10) and the
// request is Turnstile-protected like every email-triggering endpoint
// (AUTH-10, TURNSTILE_PROTECTED_ENDPOINTS). Screen 3b is a mobile design;
// its note "melanjutkan pola halaman Masuk (2a)" decides the desktop
// layout — the ink marketing panel (ResetFlowMarketing).

export const metadata: Metadata = { title: "Lupa password · BINZI" };

// googleEnabled/turnstileSiteKey are environment state, not page content:
// force request-time rendering so the values are read per request instead
// of being frozen into prerendered HTML by a build whose env differs (the
// PR #39 preview lesson).
export const dynamic = "force-dynamic";

// "Kembali ke Masuk" (A-13 fix): mobile card footer below the form; on
// ≥1024 the link lives at the bottom of the marketing panel.
const backToLogin = (
  <>
    Kembali ke <AuthInlineLink href="/masuk">Masuk</AuthInlineLink>
  </>
);

export default async function LupaPasswordPage() {
  const [googleEnabled, turnstileSiteKey] = await Promise.all([
    getGoogleEnabled(),
    getTurnstileSiteKey(),
  ]);

  return (
    <AuthShell
      tone="ink"
      heading="Lupa password"
      sub="Masukkan email akun Anda. Kami kirim satu tautan reset yang berlaku 1 jam dan hanya bisa dipakai sekali."
      marketing={<ResetFlowMarketing />}
      footer={backToLogin}
    >
      <ForgotPasswordForm
        googleEnabled={googleEnabled}
        turnstileSiteKey={turnstileSiteKey}
      />
    </AuthShell>
  );
}
