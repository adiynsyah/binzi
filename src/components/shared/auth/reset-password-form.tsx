"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Banner } from "../../ui/banner";
import { Button } from "../../ui/button";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { PasswordField } from "../../ui/password-field";
import { passwordSchema } from "../../../modules/auth/schema";

import { authClient } from "./auth-client";
import { isInvalidTokenError, unknownNotice, type AuthNotice } from "./auth-errors";
import { ExpiredResetPanel } from "./expired-link-panel";

// Reset-password form (card A-13; screen 3b right). The token arrives via
// `?token=` from Better Auth's redirect callback, which validated it moments
// earlier — the static "Tautan valid" pill reflects that (product-owner
// decision: no countdown; the remaining validity is not exposed to the
// client and any number we invented could be wrong). Submitting a token that
// expired in between switches to the 3c expired panel.

const PASSWORD_ERROR_COPY = "Minimal 8 karakter dan mengandung huruf serta angka";
const MATCH_ERROR_COPY = "Kedua password belum sama";

const formSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: MATCH_ERROR_COPY,
  });

type ResetPasswordValues = z.infer<typeof formSchema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [expired, setExpired] = useState(false);
  const [saved, setSaved] = useState(false);

  const onSubmit = handleSubmit(async (values) => {
    const { error } = await authClient.resetPassword({
      token,
      newPassword: values.password,
    });
    if (error) {
      if (isInvalidTokenError(error)) {
        setExpired(true); // consumed or lapsed between open and submit
        return;
      }
      setNotice(unknownNotice());
      return;
    }
    setSaved(true);
  });

  if (expired) return <ExpiredResetPanel />;

  if (saved) {
    // AUTH-06: every other session was revoked by the reset, so the next
    // step is always a fresh sign-in.
    return (
      <div
        role="status"
        className="rounded-card border border-success bg-success-tint p-6 text-success-tint-text"
      >
        <h2 className="text-xl font-black tracking-tight">
          Password baru disimpan.
        </h2>
        <p className="mt-3 text-sm">
          Anda keluar dari semua perangkat lain. Silakan masuk kembali dengan
          password baru Anda.
        </p>
        <Link
          href="/masuk"
          className="mt-4 inline-block text-sm font-bold underline underline-offset-2"
        >
          Masuk
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <p className="inline-flex items-center gap-2 rounded-pill border border-success bg-success-tint px-3 py-1 text-sm font-bold text-success-tint-text">
        <span aria-hidden="true" className="size-2 rounded-pill bg-success" />
        Tautan valid
      </p>

      {notice ? <Banner tone="error" title={notice.message} /> : null}

      {/* Controlled PasswordField → Controller (see register-form.tsx). */}
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <PasswordField
            label="Password baru"
            name={field.name}
            value={field.value}
            onChange={(event) => field.onChange(event.target.value)}
            disabled={isSubmitting}
            loading={isSubmitting}
            error={errors.password ? PASSWORD_ERROR_COPY : undefined}
          />
        )}
      />

      <Field
        label="Ulangi password baru"
        error={errors.confirm ? (errors.confirm.message ?? MATCH_ERROR_COPY) : undefined}
      >
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="Ketik ulang"
          disabled={isSubmitting}
          {...register("confirm")}
        />
      </Field>

      <Button
        type="submit"
        className="w-full"
        loading={isSubmitting}
        loadingLabel="Menyimpan…"
      >
        Simpan password baru
      </Button>

      <p className="text-sm text-text-meta">
        Menyimpan password baru akan mengeluarkan akun Anda dari semua perangkat
        lain (AUTH-06).
      </p>
    </form>
  );
}
