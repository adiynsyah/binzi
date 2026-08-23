import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import buttonStyles from "@/components/ui/Button/Button.module.scss";
import { Card } from "@/components/ui/Card/Card";
import { QuestionForm } from "@/features/questions/components/QuestionForm/QuestionForm";
import { updateQuestionAction } from "@/features/questions/mutations/updateQuestion";
import { getQuestionForEditor } from "@/features/questions/queries/getQuestionForEditor";

import styles from "./page.module.scss";

/**
 * CMS Question Edit (TASK 031, CMS Spec §22/§24, BR §14/§15;
 * TASK 032, CMS Spec §23).
 *
 * Server Component: loads the question with its options server-side
 * (no data access in the client), renders 404 for unknown ids, and
 * binds the update action to the question id so the id is never client
 * input. Route-level ADMIN protection is owned by src/proxy.ts
 * (TASK 014); the mutation additionally authorizes server-side.
 *
 * CMS §24 reuse warning: Questions are reusable bank entities
 * (CMS §23), so an edit may affect several quizzes. When the question
 * is used in at least one quiz, the page first shows the
 * Cancel/Continue warning; "Continue" merely adds ?edit=1 to the URL
 * (server-driven state — works without JavaScript), and only then is
 * the form rendered. Questions carry NO publication status (Drizzle
 * Spec §11) — there is nothing to publish or unpublish here, and the
 * exactly-one-correct rule is validated by the action on save.
 *
 * TASK 032 renders the CMS §23 membership view — the list of quizzes
 * using this question (title, LESSON/FINAL type, owning lesson/course)
 * — in BOTH branches, so the admin always sees the reuse blast radius
 * (§24 warning included) before and while editing. Plain text only:
 * admin quiz surfaces do not exist until the TASK 033+ builders.
 */
export const metadata: Metadata = {
  title: "Sunting Soal",
};

const QUIZ_TYPE_LABELS: Record<"LESSON" | "FINAL", string> = {
  LESSON: "Kuis Pelajaran",
  FINAL: "Kuis Akhir",
};

export default async function AdminQuestionEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ questionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { questionId } = await params;
  const resolvedSearchParams = await searchParams;
  const editConfirmed = resolvedSearchParams.edit === "1";

  const question = await getQuestionForEditor(questionId);
  if (!question) {
    notFound();
  }

  const usedInCount = question.usedIn.length;
  const needsWarning = usedInCount > 0 && !editConfirmed;

  return (
    <section aria-labelledby="admin-question-edit-heading">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title} id="admin-question-edit-heading">
            Sunting Soal
          </h1>
          <p className={styles.intro}>
            {usedInCount > 0
              ? `Digunakan di ${usedInCount} kuis.`
              : "Belum digunakan di kuis mana pun."}
          </p>
        </div>
        <Link
          className={styles.backLink}
          href="/admin/questions"
        >
          ← Kembali ke Bank Soal
        </Link>
      </div>

      {usedInCount > 0 ? (
        <section
          className={styles.usage}
          aria-labelledby="admin-question-usage-heading"
        >
          <h2 className={styles.usageTitle} id="admin-question-usage-heading">
            Digunakan di Kuis
          </h2>
          <ul className={styles.usageList}>
            {question.usedIn.map((usage) => (
              <li key={usage.quizId} className={styles.usageItem}>
                <span className={styles.usageQuiz}>{usage.quizTitle}</span>
                <span className={styles.usageMeta}>
                  {QUIZ_TYPE_LABELS[usage.quizType]} · {usage.ownerTitle}
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.usageNote}>
            Soal dapat digunakan ulang di banyak kuis. Perubahan pada
            soal ini berlaku di semua kuis di atas.
          </p>
        </section>
      ) : null}

      {needsWarning ? (
        <Card className={styles.warningPanel}>
          <h2 className={styles.warningTitle}>
            Soal ini digunakan di {usedInCount} kuis.
          </h2>
          <p className={styles.warningText}>
            Perubahan pada teks soal, opsi, urutan, atau jawaban benar
            akan berlaku di semua kuis yang menggunakan soal ini.
            Opsi yang sudah dijawab peserta tidak dapat dihapus.
          </p>
          <div className={styles.warningActions}>
            <Link
              href="/admin/questions"
              className={`${buttonStyles.button} ${buttonStyles.secondary}`}
            >
              Batal
            </Link>
            <Link
              href={`/admin/questions/${question.id}?edit=1`}
              className={`${buttonStyles.button} ${buttonStyles.primary}`}
            >
              Lanjutkan Menyunting
            </Link>
          </div>
        </Card>
      ) : (
        <QuestionForm
          action={updateQuestionAction.bind(null, question.id)}
          initialQuestionText={question.questionText}
          initialExplanation={question.explanation ?? ""}
          initialOptions={question.options}
          submitLabel="Simpan Perubahan"
        />
      )}
    </section>
  );
}
