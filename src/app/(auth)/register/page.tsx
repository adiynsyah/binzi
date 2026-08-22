import type { Metadata } from "next";

import { Card } from "@/components/ui/Card/Card";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

import styles from "./page.module.scss";

/**
 * BINZI registration page (TASK 011, UI/UX §30–§31, Blueprint §4).
 *
 * Public route in the `(auth)` group: URL is `/register`. The form
 * collects exactly Email, Password, and Confirm Password; the
 * Supabase sign-up and application-user provisioning happen in the
 * `registerAction` server action.
 */
export const metadata: Metadata = {
  title: "Daftar",
  description:
    "Buat akun BINZI untuk mengikuti kursus gizi, artikel, dan kuis interaktif.",
};

export default function RegisterPage() {
  return (
    <main className={styles.main}>
      <Card className={styles.card}>
        <h1 className={styles.title}>Daftar</h1>
        <p className={styles.intro}>
          Buat akun untuk mengikuti kursus dan melacak progres
          belajar Anda.
        </p>
        <RegisterForm />
      </Card>
    </main>
  );
}
