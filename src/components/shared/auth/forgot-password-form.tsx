"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Banner } from "../../ui/banner";
import { Button } from "../../ui/button";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { signInSchema } from "../../../modules/auth/schema";

import { authClient } from "./auth-client";
import { mapEmailSendError, type AuthNotice } from "./auth-errors";
import { PASSWORD_RESET_REDIRECT_PATH } from "./constants";
import { startGoogleSignIn } from "./google-button";
import { TurnstileWidget } from "./turnstile-widget";

// Forgot-password form (card A-13; screen 3b left). The endpoint answers
// the SAME generic shape for registered and unknown addresses (§14.2,
// A-10), so the success panel is shown unconditionally — copy approved by
// the product owner (not present in the screen .md, noted in the PR).
// Turnstile protects this endpoint like sign-in/sign-up (AUTH-10,
// TURNSTILE_PROTECTED_ENDPOINTS): the single-use token travels in the
// x-captcha-response header and the widget remounts after every submit.

const EMAIL_ERROR_COPY = "Format email belum benar — contoh: nama@email.com";

const formSchema = z.object({ email: signInSchema.shape.email });
type ForgotPasswordValues = z.infer<typeof formSchema>;

export function ForgotPasswordForm({
  googleEnabled,
  turnstileSiteKey,
}: {
  googleEnabled: boolean;
  turnstileSiteKey: string | null;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: { email: "" },
  });
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Single-use tokens: remount the widget after every submit so the next
  // attempt gets a fresh challenge (the shared TurnstileWidget contract).
  const [captchaKey, setCaptchaKey] = useState(0);

  const needsCaptcha = turnstileSiteKey !== null;

  const resetCaptcha = () => {
    if (!needsCaptcha) return;
    setCaptchaToken(null);
    setCaptchaKey((key) => key + 1);
  };

  const onSubmit = handleSubmit(async (values) => {
    // Fresh attempt: drop the old banner so a new failure remounts
    // role="alert" (re-announced) instead of mutating the old one.
    setNotice(null);
    const { error } = await authClient.requestPasswordReset(
      {
        email: values.email,
        redirectTo: PASSWORD_RESET_REDIRECT_PATH,
      },
      {
        headers: { "x-captcha-response": captchaToken ?? "" },
      },
    );
    resetCaptcha();
    if (error) {
      setNotice(mapEmailSendError(error));
      return;
    }
    setNotice(null);
    setSent(true);
  });

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-card border border-border-soft bg-surface-2 p-6"
      >
        <h2 className="text-[24px] leading-[1.24] font-black tracking-[-0.02em] text-text">
          Periksa email Anda.
        </h2>
        <p className="mt-3 text-sm text-text-muted">
          Jika email tersebut terdaftar, tautan reset sudah kami kirim. Tautan
          berlaku 1 jam dan hanya bisa dipakai sekali.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 text-sm font-bold text-primary underline underline-offset-2 transition-colors duration-200 ease-out hover:text-primary-deep"
        >
          Kirim ulang ke alamat lain
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {notice ? <Banner tone="error" title={notice.message} /> : null}

      <Field label="Email" error={errors.email ? EMAIL_ERROR_COPY : undefined}>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="nama@email.com"
          disabled={isSubmitting}
          {...register("email")}
        />
      </Field>

      {needsCaptcha ? (
        <TurnstileWidget
          key={captchaKey}
          siteKey={turnstileSiteKey as string}
          onVerify={setCaptchaToken}
          onExpire={() => setCaptchaToken(null)}
        />
      ) : null}

      <Button
        type="submit"
        className="w-full"
        loading={isSubmitting}
        loadingLabel="Mengirim…"
        disabled={needsCaptcha && !captchaToken}
      >
        Kirim tautan reset
      </Button>

      {googleEnabled ? (
        <p className="text-sm text-text-muted">
          Masuk dengan Google sebelumnya? Akun itu tidak punya password —
          lanjutkan dengan{" "}
          <GoogleInlineStart label="Google" />
        </p>
      ) : null}
    </form>
  );
}

/** The "Google" red link from screen 3b — starts the Google flow inline. */
function GoogleInlineStart({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => startGoogleSignIn("/", "/masuk")}
      className="font-bold text-primary underline underline-offset-2 transition-colors duration-200 ease-out hover:text-primary-deep"
    >
      {label}
    </button>
  );
}
