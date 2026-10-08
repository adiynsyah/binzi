import type { Metadata } from "next";

import {
  AuthInlineLink,
  AuthShell,
  RegisterMarketing,
} from "@/components/shared/auth/auth-panels";
import {
  getGoogleEnabled,
  getTurnstileSiteKey,
  redirectIfSignedIn,
} from "@/components/shared/auth/auth-config";
import { mapCallbackError } from "@/components/shared/auth/auth-errors";
import { POST_LOGIN_DEFAULT_PATH } from "@/components/shared/auth/constants";
import { RegisterForm } from "@/components/shared/auth/register-form";

// /daftar (card A-13; screens 3a/3d/3t, edge states 3c). Enrollment context
// (course card, "langsung terdaftar" copy) is S2 work — the generic version
// ships now (card note h).

export const metadata: Metadata = { title: "Daftar gratis · BINZI" };

type DaftarPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function DaftarPage({ searchParams }: DaftarPageProps) {
  const { error } = await searchParams;
  // Both read at request time (redirectIfSignedIn below already makes this
  // page dynamic — headers() opts it out of static rendering).
  const googleEnabled = await getGoogleEnabled();
  const turnstileSiteKey = await getTurnstileSiteKey();
  await redirectIfSignedIn(POST_LOGIN_DEFAULT_PATH);

  return (
    <AuthShell
      eyebrow="DAFTAR"
      heading="Daftar gratis"
      sub="Butuh 30 detik. Verifikasi email menyusul lewat satu tautan."
      marketing={<RegisterMarketing />}
      footer={
        <>
          Sudah punya akun? <AuthInlineLink href="/masuk">Masuk</AuthInlineLink>
        </>
      }
      closable
    >
      <RegisterForm
        googleEnabled={googleEnabled}
        turnstileSiteKey={turnstileSiteKey}
        initialError={error ? mapCallbackError(error) : null}
      />
    </AuthShell>
  );
}
