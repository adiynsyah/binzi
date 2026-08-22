import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/Button/Button";
import { Card } from "@/components/ui/Card/Card";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { logoutAction } from "@/features/auth/mutations/logout";
import { createClient } from "@/lib/supabase/server";

import styles from "./page.module.scss";

/**
 * BINZI login page (TASK 012, UI/UX §30, Blueprint §4).
 *
 * Public route in the `(auth)` group: URL is `/login`. Anonymous
 * visitors get the Email + Password form; authenticated visitors
 * see their session state with a logout control. The global
 * header/nav (with its own auth entries) arrives with TASK 036.
 *
 * "Forgot password?" from the UI/UX wireframe is intentionally
 * omitted: no V1 task or route provides password reset.
 */
export const metadata: Metadata = {
  title: "Masuk",
  description:
    "Masuk ke akun BINZI Anda untuk melanjutkan kursus dan melacak progres belajar.",
};

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <main className={styles.main}>
      <Card className={styles.card}>
        {data.user ? (
          <section aria-labelledby="signed-in-heading">
            <h1 className={styles.title} id="signed-in-heading">
              Anda Sudah Masuk
            </h1>
            <p className={styles.intro}>
              Anda masuk sebagai{" "}
              <span className={styles.email}>{data.user.email}</span>.
            </p>
            <form action={logoutAction} className={styles.logoutForm}>
              <Button type="submit" variant="secondary">
                Keluar
              </Button>
            </form>
          </section>
        ) : (
          <section aria-labelledby="login-heading">
            <h1 className={styles.title} id="login-heading">
              Masuk
            </h1>
            <p className={styles.intro}>
              Masuk untuk melanjutkan belajar dan melacak progres
              Anda.
            </p>
            <LoginForm />
            <p className={styles.registerLink}>
              Belum punya akun?{" "}
              <Link href="/register" className={styles.link}>
                Daftar
              </Link>
            </p>
          </section>
        )}
      </Card>
    </main>
  );
}
