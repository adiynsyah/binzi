"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button/Button";
import { Input } from "@/components/ui/Input/Input";

import { loginAction } from "../mutations/login";
import { initialLoginState } from "../schemas/login.schema";
import styles from "./LoginForm.module.scss";

/**
 * BINZI login form (TASK 012, UI/UX §30).
 *
 * Exactly two fields — Email and Password. Validation runs
 * server-side in the action (Zod); native attributes here are
 * only a progressive-enhancement first gate. Successful logins
 * redirect; only failures re-render this form.
 */
export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialLoginState,
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
        error={state.status === "error" ? state.errors?.email : undefined}
      />
      <Input
        label="Kata Sandi"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        disabled={isPending}
        error={state.status === "error" ? state.errors?.password : undefined}
      />

      <Button type="submit" disabled={isPending}>
        {isPending ? "Masuk…" : "Masuk"}
      </Button>

      {state.status === "error" && state.message ? (
        <p role="alert" className={`${styles.message} ${styles.messageError}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
