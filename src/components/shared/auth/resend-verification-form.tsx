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
import { VERIFICATION_CALLBACK_PATH } from "./constants";
import { TurnstileWidget } from "./turnstile-widget";

// Expired verification link (card A-13; screen 3c state "tautan verifikasi
// kedaluwarsa (24 jam)"). The dead link's token no longer identifies the
// address, so the resend action asks for it — rate limited 3/hour/email by
// the same A-10 bucket as every other verification send, and protected by
// Turnstile like every email-triggering endpoint (AUTH-10,
// TURNSTILE_PROTECTED_ENDPOINTS: token in x-captcha-response, widget
// remounted after every submit). Copy of the panel itself is final 3c
// copy; the confirmations below are minimal factual additions noted in
// the PR.

const EMAIL_ERROR_COPY = "Format email belum benar — contoh: nama@email.com";

const formSchema = z.object({ email: signInSchema.shape.email });
type ResendValues = z.infer<typeof formSchema>;

export function ResendVerificationForm({
  turnstileSiteKey,
}: {
  turnstileSiteKey: string | null;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResendValues>({
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

  const onSubmit = handleSubmit(async (values) => {
    // Fresh attempt: drop the old banner so a new failure remounts
    // role="alert" (re-announced) instead of mutating the old one.
    setNotice(null);
    const { error } = await authClient.sendVerificationEmail(
      {
        email: values.email,
        callbackURL: VERIFICATION_CALLBACK_PATH,
      },
      {
        headers: { "x-captcha-response": captchaToken ?? "" },
      },
    );
    if (needsCaptcha) {
      setCaptchaToken(null);
      setCaptchaKey((key) => key + 1);
    }
    if (error) {
      setNotice(mapEmailSendError(error));
      return;
    }
    setNotice(null);
    setSent(true);
  });

  return (
    <div className="rounded-card border border-border-soft bg-surface-2 p-6">
      <h2 className="text-[24px] leading-[1.24] font-black tracking-[-0.02em] text-text">
        Akun Anda belum aktif.
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        Kirim tautan verifikasi baru — yang lama otomatis dibatalkan.
      </p>

      {sent ? (
        <p role="status" className="mt-4 text-sm font-bold text-success-tint-text">
          Tautan verifikasi baru sudah dikirim ke email tersebut — periksa kotak
          masuk Anda (berlaku 24 jam).
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
          {notice ? <Banner tone="error" title={notice.message} /> : null}
          <Field
            label="Email"
            error={errors.email ? EMAIL_ERROR_COPY : undefined}
          >
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
            Kirim tautan verifikasi baru
          </Button>
        </form>
      )}
    </div>
  );
}
