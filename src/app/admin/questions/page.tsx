import type { Metadata } from "next";
import Link from "next/link";

import buttonStyles from "@/components/ui/Button/Button.module.scss";
import { Button } from "@/components/ui/Button/Button";
import { Card } from "@/components/ui/Card/Card";
import { Input } from "@/components/ui/Input/Input";
import { listQuestions } from "@/features/questions/queries/listQuestions";
import { parseQuestionListSearchParams } from "@/features/questions/schemas/question-list.schema";

import styles from "./page.module.scss";

/**
 * CMS Question Bank list (TASK 030, CMS Spec §22).
 *
 * Server Component: all data access stays server-side behind the
 * TASK 014 proxy authorization (guest → /login, non-admin → 403
 * before this component runs). Search state lives in the URL
 * (q / page) so views are shareable and the filter form works as a
 * plain GET form without JavaScript. Read-only: TASK 030 renders
 * the bank and links out; it defines no mutation.
 *
 * Columns per CMS §22: Question, Number of options, Used in,
 * Updated At, Actions. Questions are reusable (CMS §23) and carry
 * NO publication status or type (Drizzle Spec §11, approved
 * decision) — hence no status/type filters or badges, unlike the
 * TASK 016 content list.
 *
 * The Actions column carries only the Edit link to
 * /admin/questions/[id] (TASK 031); "Create Question" is the header
 * CTA to /admin/questions/new (TASK 031) — the TASK 016→017
 * precedent of shipping list links ahead of their target task.
 * Question text renders as plain text (never HTML).
 */

function buildPageHref(query: { q?: string }, page: number): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (page > 1) params.set("page", String(page));
  const queryString = params.toString();
  return queryString ? `/admin/questions?${queryString}` : "/admin/questions";
}

export const metadata: Metadata = {
  title: "Bank Soal",
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseQuestionListSearchParams(await searchParams);

  let result: Awaited<ReturnType<typeof listQuestions>> | null = null;
  try {
    result = await listQuestions(query);
  } catch (error) {
    // Detailed errors belong in server logs (CMS Spec §45);
    // users get an application-level error state.
    console.error("[admin/questions] list query failed:", error);
  }

  const isFiltered = Boolean(query.q);

  return (
    <section aria-labelledby="admin-questions-heading">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title} id="admin-questions-heading">
            Bank Soal
          </h1>
          <p className={styles.intro}>
            Kelola soal pilihan ganda yang dapat digunakan ulang di
            berbagai kuis.
          </p>
        </div>
        <Link
          href="/admin/questions/new"
          className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.createCta}`}
        >
          Buat Soal
        </Link>
      </div>

      {result ? (
        <>
          <form
            className={styles.filters}
            method="get"
            action="/admin/questions"
          >
            <div className={styles.searchField}>
              <Input
                type="search"
                name="q"
                label="Cari soal"
                placeholder="Cari teks soal…"
                defaultValue={query.q ?? ""}
              />
            </div>
            <Button type="submit" variant="secondary">
              Terapkan
            </Button>
          </form>

          <p className={styles.resultCount}>
            {isFiltered
              ? `${result.total} soal ditemukan`
              : `${result.total} soal`}
          </p>

          {result.rows.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Soal</th>
                    <th scope="col">Jumlah Opsi</th>
                    <th scope="col">Digunakan Di</th>
                    <th scope="col">Diperbarui</th>
                    <th scope="col">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row" className={styles.questionCell}>
                        {row.questionText}
                      </th>
                      <td className={styles.optionsCell}>
                        {row.optionCount}
                      </td>
                      <td className={styles.usedInCell}>
                        {row.usedInCount > 0
                          ? `${row.usedInCount} kuis`
                          : "—"}
                      </td>
                      <td className={styles.dateCell}>
                        {dateFormatter.format(row.updatedAt)}
                      </td>
                      <td className={styles.actionsCell}>
                        <Link
                          className={styles.editLink}
                          href={`/admin/questions/${row.id}`}
                        >
                          Sunting
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : isFiltered ? (
            <Card className={styles.panel}>
              <h2 className={styles.panelTitle}>
                Tidak ada soal yang cocok.
              </h2>
              <p className={styles.panelText}>
                Coba ubah kata kunci pencarian.
              </p>
              <Link className={styles.panelLink} href="/admin/questions">
                Hapus filter
              </Link>
            </Card>
          ) : (
            <Card className={styles.panel}>
              <h2 className={styles.panelTitle}>Belum ada soal.</h2>
              <p className={styles.panelText}>
                Buat soal pertama Anda untuk mulai membangun kuis.
              </p>
            </Card>
          )}

          {result.pageCount > 1 ? (
            <nav
              className={styles.pagination}
              aria-label="Navigasi halaman soal"
            >
              {result.page > 1 ? (
                <Link
                  className={styles.pageLink}
                  href={buildPageHref(query, result.page - 1)}
                >
                  Sebelumnya
                </Link>
              ) : (
                <span className={styles.pageDisabled}>Sebelumnya</span>
              )}
              <p className={styles.pageStatus}>
                Halaman {result.page} dari {result.pageCount}
              </p>
              {result.page < result.pageCount ? (
                <Link
                  className={styles.pageLink}
                  href={buildPageHref(query, result.page + 1)}
                >
                  Berikutnya
                </Link>
              ) : (
                <span className={styles.pageDisabled}>Berikutnya</span>
              )}
            </nav>
          ) : null}
        </>
      ) : (
        <Card className={styles.panel}>
          <h2 className={styles.panelTitle}>Gagal memuat daftar soal.</h2>
          <p className={styles.panelText}>
            Terjadi kesalahan saat mengambil data. Silakan coba lagi.
          </p>
          <Link
            className={styles.panelLink}
            href={buildPageHref(query, query.page ?? 1)}
          >
            Coba lagi
          </Link>
        </Card>
      )}
    </section>
  );
}
