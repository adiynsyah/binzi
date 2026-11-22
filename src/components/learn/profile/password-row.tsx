"use client";

// PasswordRow (card S5-05 §5.4, screens 9c/9e) — the Keamanan password
// row. "Ubah password" discloses the form (aria-expanded/aria-controls);
// on success the form collapses, focus returns to the button (4 Nov
// lesson), the row shows "Password baru disimpan." (3b copy), and
// router.refresh() re-renders the server rows so "Sesi aktif" reflects
// the post-revoke count — every other device was just signed out.
//
// For accounts WITHOUT a password the row degrades to a caption + link to
// /lupa-password (card decision 10): there is no current password to
// verify against, so the change form must not appear at all.
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
  authClient,
} from "@/components/shared/auth/auth-client";
import {
  mapChangePasswordError,
  type AuthNotice,
} from "@/components/shared/auth/auth-errors";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordField } from "@/components/ui/password-field";
import { passwordSchema } from "@/modules/auth/schema";

const CURRENT_REQUIRED_COPY = "Password saat ini wajib diisi.";
const MATCH_ERROR_COPY = "Ulangan belum sama dengan password baru.";
const NOTE_COPY =
  "Setelah password diganti, sesi di perangkat lain otomatis keluar.";

const formSchema = z
  .object({
    currentPassword: z.string().min(1, CURRENT_REQUIRED_COPY),
    newPassword: passwordSchema,
    confirm: z.string(),
  })
  .refine((values) => values.newPassword === values.confirm, {
    path: ["confirm"],
    message: MATCH_ERROR_COPY,
  });

type ChangePasswordValues = z.infer<typeof formSchema>;

export type PasswordRowProps = {
  hasPassword: boolean;
};

export function PasswordRow({ hasPassword }: PasswordRowProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [serverCurrentError, setServerCurrentError] = useState<string | null>(
    null,
  );
  const [saved, setSaved] = useState(false);

  const formId = useId();
  const headingId = "profil-password-heading";
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setFocus,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  // Focus returns AFTER the re-render: to the button once the form has
  // collapsed on success, to the "Password saat ini" input when the server
  // rejected it (INVALID_PASSWORD) — the field error alone gives a screen
  // reader no cue where to go. setFocus (not a hand-wired ref): register()
  // installs its own ref, so a separate ref prop would be clobbered.
  useEffect(() => {
    if (saved) buttonRef.current?.focus();
  }, [saved]);
  useEffect(() => {
    if (serverCurrentError !== null) setFocus("currentPassword");
  }, [serverCurrentError, setFocus]);

  const onSubmit = handleSubmit(async (values) => {
    setNotice(null);
    setServerCurrentError(null);
    const { error } = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      revokeOtherSessions: true,
    });
    if (error) {
      const mapped = mapChangePasswordError(error);
      if (mapped.kind === "invalid_current_password") {
        setServerCurrentError(mapped.message);
      } else {
        setNotice(mapped);
      }
      return;
    }
    setOpen(false);
    setSaved(true);
    // shouldUnregister is false by default, so RHF KEEPS the submitted
    // values after the form unmounts — a reopen would show the old (now
    // dead) password. reset() on success AND on a manual close (PR review).
    reset();
    router.refresh();
  });

  if (!hasPassword) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-card border border-border-soft bg-surface-2 p-4">
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="text-[15px] font-bold text-text">
            Password
          </h3>
          <p className="mt-1 text-[13px] text-text-muted">
            Akun ini belum punya password.
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <Link
            href="/lupa-password"
            className={buttonVariants({ variant: "secondary" })}
          >
            Buat password lewat email
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border-soft bg-surface-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="text-[15px] font-bold text-text">
            Password
          </h3>
        </div>
        <div className="w-full sm:w-auto">
          <Button
            ref={buttonRef}
            variant="secondary"
            aria-expanded={open}
            aria-controls={formId}
            onClick={() => {
              setSaved(false);
              setNotice(null);
              if (open) {
                // Closing mid-edit also drops the typed values (same
                // shouldUnregister caveat as the success path above).
                reset();
                setServerCurrentError(null);
              }
              setOpen(!open);
            }}
          >
            Ubah password
          </Button>
        </div>
      </div>

      {open ? (
        <form
          id={formId}
          onSubmit={onSubmit}
          noValidate
          className="mt-4 max-w-md space-y-4"
        >
          {notice ? <Banner tone="error" title={notice.message} /> : null}

          <Field
            label="Password saat ini"
            error={
              errors.currentPassword?.message ?? serverCurrentError ?? undefined
            }
          >
            <Input
              type="password"
              autoComplete="current-password"
              disabled={isSubmitting}
              {...register("currentPassword")}
            />
          </Field>

          {/* Controlled PasswordField → Controller (reset-password-form
              pattern); the pills mirror the live letter/digit/length rules. */}
          <Controller
            control={control}
            name="newPassword"
            render={({ field }) => (
              <PasswordField
                label="Password baru"
                name={field.name}
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                disabled={isSubmitting}
                loading={isSubmitting}
                error={
                  errors.newPassword
                    ? "Minimal 8 karakter dan mengandung huruf serta angka."
                    : undefined
                }
              />
            )}
          />

          <Field
            label="Ulangi password baru"
            error={
              errors.confirm ? (errors.confirm.message ?? MATCH_ERROR_COPY) : undefined
            }
          >
            <Input
              type="password"
              autoComplete="new-password"
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
            Simpan password
          </Button>

          <p className="text-[13px] text-text-muted">{NOTE_COPY}</p>
        </form>
      ) : null}

      {saved ? (
        <div className="mt-4">
          <Banner tone="success" title="Password baru disimpan." />
        </div>
      ) : null}
    </div>
  );
}
