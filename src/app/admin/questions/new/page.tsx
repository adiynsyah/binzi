import type { Metadata } from "next";
import Link from "next/link";

import { QuestionForm } from "@/features/questions/components/QuestionForm/QuestionForm";
import { createQuestionAction } from "@/features/questions/mutations/createQuestion";

import styles from "./page.module.scss";

/**
 * CMS Question Create (TASK 031, CMS Spec §22).
 *
 * Server Component wrapper for the shared Question form. Route-level
 * ADMIN protection is owned by src/proxy.ts (TASK 014 — /admin/:path*
 * covers /admin/questions/new); the mutation additionally authorizes
 * server-side. No data access happens here — ids, sort_order, and
 * timestamps are all assigned by the server on save.
 *
 * Four empty option rows render on create (CMS §22 mock); admins add
 * or remove rows up to the Blueprint §26 bounds in the form.
 */
export const metadata: Metadata = {
  title: "Soal Baru",
};

const INITIAL_EMPTY_OPTIONS = [
  { optionText: "", isCorrect: false },
  { optionText: "", isCorrect: false },
  { optionText: "", isCorrect: false },
  { optionText: "", isCorrect: false },
];

export default function AdminQuestionNewPage() {
  return (
    <section aria-labelledby="admin-question-new-heading">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title} id="admin-question-new-heading">
            Soal Baru
          </h1>
          <p className={styles.intro}>
            Buat soal pilihan ganda baru untuk Bank Soal.
          </p>
        </div>
        <Link className={styles.backLink} href="/admin/questions">
          ← Kembali ke Bank Soal
        </Link>
      </div>
      <QuestionForm
        action={createQuestionAction}
        initialOptions={INITIAL_EMPTY_OPTIONS}
        submitLabel="Simpan Soal"
      />
    </section>
  );
}
