import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

import { AuthShell } from "@/components/shared/auth/auth-panels";
import { getTurnstileSiteKey } from "@/components/shared/auth/auth-config";
import { POST_LOGIN_DEFAULT_PATH } from "@/components/shared/auth/constants";
import { ResendVerificationForm } from "@/components/shared/auth/resend-verification-form";
import { isVerificationLinkError } from "@/components/shared/auth/auth-errors";

// /daftar/verifikasi (card A-13): destination of the verification link's
// `callbackURL` (note c). The link itself is GET /api/auth/verify-email —
// success lands here clean, failure lands with `?error=` from a fixed set
// (TOKEN_EXPIRED / INVALID_TOKEN / USER_NOT_FOUND / INVALID_USER), which
// this page collapses into ONE "link no longer valid" state (3c) with a
// resend action (Turnstile-protected like every email-triggering endpoint,
// AUTH-10). `autoSignInAfterVerification` (A-09/A-10) means a success
// visit is already signed in — so this page never redirects signed-in
// users. Generic copy per card note h (no course/material names).

export const metadata: Metadata = { title: "Verifikasi email · BINZI" };

// turnstileSiteKey is environment state, not page content: force
// request-time rendering so the value is read per request instead of being
// frozen into prerendered HTML by a build whose env differs (the PR #39
// preview lesson, same as /lupa-password).
export const dynamic = "force-dynamic";

type VerifikasiPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function VerifikasiPage({
  searchParams,
}: VerifikasiPageProps) {
  const { error } = await searchParams;
  const expired = isVerificationLinkError(error);
  // The sitekey path is touched only when the widget actually renders
  // (auth-config rule: pages without the widget never evaluate it).
  const turnstileSiteKey = expired ? await getTurnstileSiteKey() : null;

  return (
    <AuthShell heading="Verifikasi email">
      {expired ? (
        <ResendVerificationForm turnstileSiteKey={turnstileSiteKey} />
      ) : (
        // 3c "email terverifikasi" state, generic wording (note h).
        <div
          role="status"
          className="rounded-card border border-success bg-success-tint p-6 text-success-tint-text"
        >
          <span
            aria-hidden="true"
            className="mx-auto grid size-12 place-items-center rounded-pill bg-success text-surface"
          >
            <Check aria-hidden="true" className="size-6" strokeWidth={3} />
          </span>
          <h2 className="mt-4 text-center text-[24px] leading-[1.24] font-black tracking-[-0.02em]">
            Akun aktif
          </h2>
          <p className="mt-3 text-center text-sm">
            Anda masuk otomatis dan siap melanjutkan belajar.
          </p>
          <Link
            href={POST_LOGIN_DEFAULT_PATH}
            className="mt-5 block text-center text-sm font-bold underline underline-offset-2"
          >
            Mulai belajar
          </Link>
          <p className="mt-5 flex items-center justify-center gap-2 border-t border-success pt-4 text-center text-sm">
            <Check aria-hidden="true" className="size-4" strokeWidth={3} />
            Sesi bertahan 30 hari di perangkat ini.
          </p>
        </div>
      )}
    </AuthShell>
  );
}
