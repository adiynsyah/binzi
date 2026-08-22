"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button/Button";
import { Input } from "@/components/ui/Input/Input";

import { registerAction } from "../mutations/register";
import { initialRegisterState } from "../schemas/register.schema";
import styles from "./RegisterForm.module.scss";

/**
 * BINZI registration form (TASK 011, UI/UX §31).
 *
 * Exactly three fields — Email, Password, Confirm Password.
 * Validation runs server-side in the action (Zod); native
 * attributes here are only a progressive-enhancement first gate.
 */
export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(
    registerAction,
    initialRegisterState,
  );

  return (
    <form action={formAction} className={styles.form} noValidate>
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        disabled={isPending}
        error={
          state.status === "error" ? state.errors?.email : undefined
        }
      />
      <Input
        label="Kata Sandi"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        disabled={isPending}
        error={
          state.status === "error" ? state.errors?.password : undefined
        }
      />
      <Input
        label="Konfirmasi Kata Sandi"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        disabled={isPending}
        error={
          state.status === "error"
            ? state.errors?.confirmPassword
            : undefined
        }
      />

      <Button type="submit" disabled={isPending}>
        {isPending ? "Mendaftar…" : "Daftar"}
      </Button>

      {state.status === "error" && state.message ? (
        <p role="alert" className={`${styles.message} ${styles.messageError}`}>
          {state.message}
        </p>
      ) : null}

      {state.status === "success" ? (
        <p role="status" className={`${styles.message} ${styles.messageSuccess}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
