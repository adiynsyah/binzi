import type { Metadata } from "next";

import { AuthShell } from "@/components/shared/auth/auth-panels";
import { getGoogleEnabled } from "@/components/shared/auth/auth-config";
import { ForgotPasswordForm } from "@/components/shared/auth/forgot-password-form";

// /lupa-password (card A-13; screen 3b left, AUTH-04). The request is not
// Turnstile-protected (AUTH-10 covers sign-in/sign-up) and the response is
// identical for registered and unknown addresses (§14.2, A-10).

export const metadata: Metadata = { title: "Lupa password · BINZI" };

// googleEnabled is environment state, not page content: force request-time
// rendering so the value is read per request instead of being frozen into
// prerendered HTML by a build whose env differs (the PR #39 preview lesson).
export const dynamic = "force-dynamic";

export default async function LupaPasswordPage() {
  // No Turnstile on this page — the sitekey path must not be evaluated here.
  const googleEnabled = await getGoogleEnabled();

  return (
    <AuthShell
      heading="Lupa password"
      sub="Masukkan email akun Anda. Kami kirim satu tautan reset yang berlaku 1 jam dan hanya bisa dipakai sekali."
    >
      <ForgotPasswordForm googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
