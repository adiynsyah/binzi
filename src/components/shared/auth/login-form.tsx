"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Check, Clock, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Banner } from "../../ui/banner";
import { Button } from "../../ui/button";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { cn } from "../../../lib/utils";
import { signInSchema } from "../../../modules/auth/schema";

import { authClient } from "./auth-client";
import {
  mapEmailSendError,
  mapLoginError,
  type AuthNotice,
} from "./auth-errors";
import { POST_LOGIN_DEFAULT_PATH, VERIFICATION_CALLBACK_PATH } from "./constants";
import { GoogleButton } from "./google-button";
import { TurnstileWidget } from "./turnstile-widget";

// Login form (card A-13; screens 2a desktop / 2d mobile / 2t tablet, states
// 2b). Validation RULES come from the shared server schema (signInSchema);
// the per-field DISPLAY copy is screen 2b's final copy. Turnstile runs only
// when the server provides a sitekey; the token travels in the
// x-captcha-response header (src/lib/turnstile.ts).

/** 2b per-field display copy (the schema only decides WHEN it shows). */
const EMAIL_ERROR_COPY = "Format email belum benar — contoh: nama@email.com";
const PASSWORD_ERROR_COPY = "Minimal 8 karakter dan mengandung huruf serta angka";

export type LoginFormProps = {
  /** Validated `?next=` path, or null when missing/unsafe. */
  nextPath: string | null;
  googleEnabled: boolean;
  turnstileSiteKey: string | null;
  /** Whitelisted `?error=` notice from an OAuth callback (mapCallbackError). */
  initialError?: AuthNotice | null;
};

export function LoginForm({
  nextPath,
  googleEnabled,
  turnstileSiteKey,
  initialError = null,
}: LoginFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: standardSchemaResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const [notice, setNotice] = useState<AuthNotice | null>(initialError);
  const [succeeded, setSucceeded] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Turnstile tokens are single-use: bumping the key after every submit
  // remounts the widget so the next attempt gets a fresh challenge.
  const [captchaKey, setCaptchaKey] = useState(0);
  const [resendState, setResendState] = useState<
    "idle" | "sending" | "sent" | "blocked"
  >("idle");

  const needsCaptcha = turnstileSiteKey !== null;

  const resetCaptcha = () => {
    if (!needsCaptcha) return;
    setCaptchaToken(null);
    setCaptchaKey((key) => key + 1);
  };

  const resendVerification = async () => {
    // Read at click time (no watch subscription): the value only matters
    // the moment the user asks for a resend.
    const email = safeEmail(getValues("email"));
    if (!email) {
      setError("email", { message: " " }); // flags the field; copy stays 2b's
      setFocus("email");
      return;
    }
    setResendState("sending");
    // AUTH-10: the resend endpoint is captcha-protected too. The token that
    // admitted the sign-in attempt was CONSUMED by it (and resetCaptcha()
    // already dropped it), so this can only fire once the remounted widget
    // produced a fresh one — the button stays disabled until then.
    const { error } = await authClient.sendVerificationEmail(
      {
        email,
        callbackURL: VERIFICATION_CALLBACK_PATH,
      },
      {
        headers: { "x-captcha-response": captchaToken ?? "" },
      },
    );
    resetCaptcha();
    if (error) {
      setNotice(mapEmailSendError(error));
      setResendState("blocked");
      return;
    }
    setResendState("sent");
  };

  const onSubmit = handleSubmit(async (values) => {
    const { error } = await authClient.signIn.email(
      { email: values.email, password: values.password },
      {
        headers: { "x-captcha-response": captchaToken ?? "" },
      },
    );
    resetCaptcha();

    if (!error) {
      setSucceeded(true);
      // 2b: the success state is visible, then the user returns to the
      // page they came from (§14.2) — never a hard-coded homepage.
      const target = nextPath ?? POST_LOGIN_DEFAULT_PATH;
      window.setTimeout(() => {
        router.replace(target);
        router.refresh();
      }, 700);
      return;
    }
    setNotice(mapLoginError(error));
  });

  if (succeeded) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-control border border-success bg-success-tint p-4 text-success-tint-text"
      >
        <span
          aria-hidden="true"
          className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-pill bg-success text-surface"
        >
          <Check aria-hidden="true" className="size-4" strokeWidth={3} />
        </span>
        <div>
          <p className="text-sm font-bold">Berhasil masuk</p>
          <p className="mt-1 text-sm">Mengarahkan kembali ke halaman asal.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {googleEnabled ? (
        <>
          <GoogleButton
            label="Masuk dengan Google"
            callbackURL={nextPath ?? POST_LOGIN_DEFAULT_PATH}
            errorCallbackURL={
              nextPath === null
                ? "/masuk"
                : `/masuk?next=${encodeURIComponent(nextPath)}`
            }
          />
          <div
            aria-hidden="true"
            className="flex items-center gap-3 py-1"
          >
            <span className="h-px flex-1 bg-border-soft" />
            <span className="text-xs text-text-meta">atau pakai email</span>
            <span className="h-px flex-1 bg-border-soft" />
          </div>
        </>
      ) : null}

      {notice && notice.kind === "login_locked" ? (
        // 2b locked state: dark toast with a clock badge (the icon pattern
        // of the wrong-credentials banner — the wait, not a count) and a
        // reset escape hatch (AUTH-08: 5 attempts / 15 minutes).
        <div
          role="alert"
          className="flex items-start gap-3 rounded-card bg-text p-4 text-surface"
        >
          <span
            aria-hidden="true"
            className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-pill bg-surface text-text"
          >
            <Clock className="size-4" strokeWidth={2.5} />
          </span>
          <p className="text-sm">
            Terlalu banyak percobaan. Coba lagi dalam 15 menit, atau{" "}
            <Link
              href="/lupa-password"
              className="font-bold underline underline-offset-2"
            >
              reset password
            </Link>
            .
          </p>
        </div>
      ) : notice ? (
        <Banner
          tone="error"
          title={
            notice.kind === "email_not_verified"
              ? "Email Anda belum diverifikasi."
              : notice.message
          }
          description={
            notice.kind === "email_not_verified" ? (
              resendState === "sent" ? (
                "Tautan verifikasi baru sudah dikirim ke email Anda — berlaku 24 jam."
              ) : (
                <>
                  {resendState === "sending" ? (
                    "Mengirim tautan…"
                  ) : (
                    <button
                      type="button"
                      onClick={() => void resendVerification()}
                      disabled={needsCaptcha && !captchaToken}
                      className="font-bold underline underline-offset-2 disabled:cursor-not-allowed disabled:text-text-subtle disabled:no-underline"
                    >
                      Kirim ulang tautan
                    </button>
                  )}{" "}
                  — berlaku 24 jam.
                </>
              )
            ) : undefined
          }
        />
      ) : null}

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

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="login-password" className="block text-sm font-bold text-text">
            Password
          </label>
          <Link
            href="/lupa-password"
            className="text-sm font-bold text-primary transition-colors duration-200 ease-out hover:text-primary-deep"
          >
            Lupa password?
          </Link>
        </div>
        <div className="relative mt-2">
          <Input
            id="login-password"
            type={passwordVisible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Minimal 8 karakter"
            className="pr-14"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "login-password-error" : "login-password-hint"}
            disabled={isSubmitting}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            aria-pressed={passwordVisible}
            aria-label={
              passwordVisible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
            }
            disabled={isSubmitting}
            className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-control text-text-meta transition-colors duration-200 ease-out hover:bg-fill hover:text-text disabled:cursor-not-allowed disabled:text-text-subtle"
          >
            {passwordVisible ? (
              <EyeOff aria-hidden="true" className="size-5" />
            ) : (
              <Eye aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
        {errors.password ? (
          <p id="login-password-error" className="mt-2 text-sm text-danger">
            {PASSWORD_ERROR_COPY}
          </p>
        ) : (
          <p id="login-password-hint" className="mt-2 text-sm text-text-meta">
            Minimal 8 karakter
          </p>
        )}
      </div>

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
        loadingLabel="Memeriksa…"
        disabled={needsCaptcha && !captchaToken}
      >
        Masuk
      </Button>

      <p className={cn("text-center text-sm text-text-meta")}>
        Dengan masuk, Anda menyetujui Syarat &amp; Ketentuan serta Kebijakan
        Privasi.
      </p>
    </form>
  );
}

/** The resend action needs a syntactically valid email before it can call. */
function safeEmail(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  const parsed = signInSchema.shape.email.safeParse(trimmed);
  return parsed.success ? parsed.data : null;
}
