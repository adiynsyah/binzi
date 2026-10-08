"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Banner } from "../../ui/banner";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { PasswordField } from "../../ui/password-field";
import { signUpSchema } from "../../../modules/auth/schema";

import { authClient } from "./auth-client";
import { mapSignUpError, type AuthNotice } from "./auth-errors";
import { VERIFICATION_CALLBACK_PATH } from "./constants";
import { GoogleButton } from "./google-button";
import { TurnstileWidget } from "./turnstile-widget";

// Registration form (card A-13; screens 3a desktop / 3d mobile / 3t tablet,
// validation states 3c). The validation RULES are the shared server schema
// (signUpSchema + passwordSchema — single source since A-09); consent is a
// client-side gate only, so it lives in a form-local schema extension
// instead of the server contract. Anti-enumeration (§14.2): a duplicate
// email answers 200 with NO email sent, so the success panel copy below is
// deliberately identical for fresh and already-registered addresses.

/** 2b/3c per-field display copy (the schema decides WHEN it shows). */
const EMAIL_ERROR_COPY = "Format email belum benar — contoh: nama@email.com";
const PASSWORD_ERROR_COPY = "Minimal 8 karakter dan mengandung huruf serta angka";
const CONSENT_ERROR_COPY = "Centang persetujuan untuk melanjutkan";

const formSchema = z.object({
  ...signUpSchema.shape,
  consent: z.boolean().refine((value) => value, { message: CONSENT_ERROR_COPY }),
});

type RegisterFormValues = z.infer<typeof formSchema>;

export type RegisterFormProps = {
  googleEnabled: boolean;
  turnstileSiteKey: string | null;
  /** Whitelisted `?error=` notice from an OAuth callback. */
  initialError?: AuthNotice | null;
};

export function RegisterForm({
  googleEnabled,
  turnstileSiteKey,
  initialError = null,
}: RegisterFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: { name: "", email: "", password: "", consent: false },
  });

  const [notice, setNotice] = useState<AuthNotice | null>(initialError);
  const [registered, setRegistered] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  const needsCaptcha = turnstileSiteKey !== null;

  const onSubmit = handleSubmit(async (values) => {
    const { error } = await authClient.signUp.email(
      {
        name: values.name,
        email: values.email,
        password: values.password,
        // Where the verification link lands after /api/auth/verify-email.
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

    // A 200 here means "check your email" for BOTH a fresh sign-up and a
    // duplicate address — the panel copy must not distinguish them.
    if (!error) {
      setRegistered(true);
      return;
    }
    setNotice(mapSignUpError(error));
  });

  if (registered) {
    return (
      <div
        role="status"
        className="rounded-card border border-border-soft bg-surface-2 p-6"
      >
        <h2 className="text-[24px] leading-[1.24] font-black tracking-[-0.02em] text-text">
          Cek email Anda.
        </h2>
        <p className="mt-3 text-sm text-text-muted">
          Jika alamat ini belum terdaftar, kami mengirim tautan verifikasi yang
          berlaku 24 jam.
        </p>
        <p className="mt-3 text-sm text-text-muted">
          Sudah punya akun?{" "}
          <Link
            href="/masuk"
            className="font-bold text-primary transition-colors duration-200 ease-out hover:text-primary-deep"
          >
            Masuk
          </Link>{" "}
          atau{" "}
          <Link
            href="/lupa-password"
            className="font-bold text-primary transition-colors duration-200 ease-out hover:text-primary-deep"
          >
            reset password
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {googleEnabled ? (
        <>
          <GoogleButton label="Daftar dengan Google" callbackURL="/" errorCallbackURL="/daftar" />
          <p className="text-sm text-text-muted">
            Tanpa verifikasi email — email Google sudah terverifikasi. Jika
            email itu sudah punya akun BINZI, akunnya ditautkan.
          </p>
          <div aria-hidden="true" className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-border-soft" />
            <span className="text-xs text-text-meta">atau pakai email</span>
            <span className="h-px flex-1 bg-border-soft" />
          </div>
        </>
      ) : null}

      {notice ? <Banner tone="error" title={notice.message} /> : null}

      <Field label="Nama lengkap" error={errors.name ? "Nama wajib diisi" : undefined}>
        <Input
          type="text"
          autoComplete="name"
          placeholder="Nama lengkap"
          disabled={isSubmitting}
          {...register("name")}
        />
      </Field>

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

      {/* PasswordField is a controlled component (value + onChange); RHF's
          plain register() needs its ref to land in _fields, which a custom
          component never forwards — Controller is the intended wiring. */}
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <PasswordField
            label="Password"
            name={field.name}
            value={field.value}
            onChange={(event) => field.onChange(event.target.value)}
            disabled={isSubmitting}
            loading={isSubmitting}
            error={errors.password ? PASSWORD_ERROR_COPY : undefined}
          />
        )}
      />

      {needsCaptcha ? (
        <TurnstileWidget
          key={captchaKey}
          siteKey={turnstileSiteKey as string}
          onVerify={setCaptchaToken}
          onExpire={() => setCaptchaToken(null)}
        />
      ) : null}

      <div>
        <div className="flex items-start gap-2">
          <Controller
            control={control}
            name="consent"
            render={({ field }) => (
              <Checkbox
                id="register-consent"
                checked={field.value ?? false}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                disabled={isSubmitting}
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={errors.consent ? "register-consent-error" : undefined}
              />
            )}
          />
          <label
            htmlFor="register-consent"
            className="mt-3 text-sm leading-relaxed text-text-muted"
          >
            Saya menyetujui{" "}
            {/* Placeholder marks until the legal pages exist (A-14+, PR note):
                styled like links but not focusable, so nobody clicks a dead
                control. */}
            <span className="font-bold text-primary underline underline-offset-2">
              Syarat &amp; Ketentuan
            </span>{" "}
            dan{" "}
            <span className="font-bold text-primary underline underline-offset-2">
              Kebijakan Privasi
            </span>
            , termasuk penyimpanan progres belajar saya.
          </label>
        </div>
        {errors.consent ? (
          <p id="register-consent-error" className="mt-1 text-sm text-danger">
            {CONSENT_ERROR_COPY}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        className="w-full"
        loading={isSubmitting}
        loadingLabel="Mendaftarkan…"
        disabled={needsCaptcha && !captchaToken}
      >
        Buat Akun Gratis
      </Button>
    </form>
  );
}
