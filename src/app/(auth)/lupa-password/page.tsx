import type { Metadata } from "next";

import { AuthShell } from "@/components/shared/auth/auth-panels";
import { getAuthUiConfig } from "@/components/shared/auth/auth-config";
import { ForgotPasswordForm } from "@/components/shared/auth/forgot-password-form";

// /lupa-password (card A-13; screen 3b left, AUTH-04). The request is not
// Turnstile-protected (AUTH-10 covers sign-in/sign-up) and the response is
// identical for registered and unknown addresses (§14.2, A-10).

export const metadata: Metadata = { title: "Lupa password · BINZI" };

export default async function LupaPasswordPage() {
  const { googleEnabled } = await getAuthUiConfig();

  return (
    <AuthShell
      heading="Lupa password"
      sub="Masukkan email akun Anda. Kami kirim satu tautan reset yang berlaku 1 jam dan hanya bisa dipakai sekali."
    >
      <ForgotPasswordForm googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
