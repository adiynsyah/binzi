import type { Metadata } from "next";

import {
  AuthInlineLink,
  AuthShell,
  LoginMarketing,
} from "@/components/shared/auth/auth-panels";
import {
  getAuthUiConfig,
  redirectIfSignedIn,
} from "@/components/shared/auth/auth-config";
import { mapCallbackError } from "@/components/shared/auth/auth-errors";
import { POST_LOGIN_DEFAULT_PATH } from "@/components/shared/auth/constants";
import { LoginForm } from "@/components/shared/auth/login-form";
import { safeInternalRedirectPath } from "@/modules/auth/schema";

// /masuk (card A-13; screens 2a/2d/2t, states 2b). `?next=` only ever
// holds a path that survived safeInternalRedirectPath — invalid values are
// dropped, not corrected (the A-11/A-12 contract). `?error=` arrives from
// OAuth callbacks and is whitelisted inside mapCallbackError.

export const metadata: Metadata = { title: "Masuk · BINZI" };

type MasukPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function MasukPage({ searchParams }: MasukPageProps) {
  const { next, error } = await searchParams;
  const nextPath = safeInternalRedirectPath(next ?? null);
  const { googleEnabled, turnstileSiteKey } = await getAuthUiConfig();
  // Already signed in? Straight to the destination (product-owner decision).
  await redirectIfSignedIn(nextPath ?? POST_LOGIN_DEFAULT_PATH);

  return (
    <AuthShell
      eyebrow="MASUK"
      heading="Masuk"
      sub="Lanjutkan dari materi terakhir Anda."
      marketing={<LoginMarketing />}
      footer={
        <>
          Belum punya akun?{" "}
          <AuthInlineLink href="/daftar">Daftar gratis</AuthInlineLink>
        </>
      }
      note="Sesi bertahan 30 hari di perangkat ini."
      closable
    >
      <LoginForm
        nextPath={nextPath}
        googleEnabled={googleEnabled}
        turnstileSiteKey={turnstileSiteKey}
        initialError={error ? mapCallbackError(error) : null}
      />
    </AuthShell>
  );
}
