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

// Expired verification link (card A-13; screen 3c state "tautan verifikasi
// kedaluwarsa (24 jam)"). The dead link's token no longer identifies the
// address, so the resend action asks for it — rate limited 3/hour/email by
// the same A-10 bucket as every other verification send. Copy of the panel
// itself is final 3c copy; the confirmations below are minimal factual
// additions noted in the PR.

const EMAIL_ERROR_COPY = "Format email belum benar — contoh: nama@email.com";

const formSchema = z.object({ email: signInSchema.shape.email });
type ResendValues = z.infer<typeof formSchema>;

export function ResendVerificationForm() {
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

  const onSubmit = handleSubmit(async (values) => {
    const { error } = await authClient.sendVerificationEmail({
      email: values.email,
      callbackURL: VERIFICATION_CALLBACK_PATH,
    });
    if (error) {
      setNotice(mapEmailSendError(error));
      return;
    }
    setNotice(null);
    setSent(true);
  });

  return (
    <div className="rounded-card border border-border-soft bg-surface-2 p-6">
      <h2 className="text-lg font-black tracking-tight text-text">
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
          <Button
            type="submit"
            className="w-full"
            loading={isSubmitting}
            loadingLabel="Mengirim…"
          >
            Kirim tautan verifikasi baru
          </Button>
        </form>
      )}
    </div>
  );
}
