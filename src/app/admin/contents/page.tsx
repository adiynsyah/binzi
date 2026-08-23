import type { Metadata } from "next";
import Link from "next/link";

import buttonStyles from "@/components/ui/Button/Button.module.scss";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { Card } from "@/components/ui/Card/Card";
import { Input } from "@/components/ui/Input/Input";
import { listContents } from "@/features/contents/queries/listContents";
import { parseContentListSearchParams } from "@/features/contents/schemas/content-list.schema";
import { contentType, publicationStatus } from "@/db/schema/enums";

import styles from "./page.module.scss";

/**
 * CMS Content List (TASK 016, CMS Spec §13).
 *
 * Server Component: all data access stays server-side behind the
 * TASK 014 proxy authorization. Search/filter state lives in the
 * URL (q / status / type / page) so views are shareable and the
 * filter form works as a plain GET form without JavaScript.
 *
 * Columns per CMS §13: Title, Type, Status, Updated At, Used In,
 * Actions. The Actions column carries only the Edit link to
 * /admin/contents/[id]/edit (TASK 019) — the other CMS §16 actions
 * (Preview/Publish) stay deferred until their own tasks.
 */

type ContentType = (typeof contentType.enumValues)[number];
type ContentStatus = (typeof publicationStatus.enumValues)[number];

const TYPE_LABELS: Record<ContentType, string> = {
  ARTICLE: "Artikel",
  VIDEO: "Video",
  INFOGRAPHIC: "Infografis",
  TEXT: "Teks",
  TIP: "Tips",
};

const STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: "Draf",
  PUBLISHED: "Terbit",
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

function buildPageHref(
  query: { q?: string; status?: string; type?: string },
  page: number,
): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.type) params.set("type", query.type);
  if (page > 1) params.set("page", String(page));
  const queryString = params.toString();
  return queryString ? `/admin/contents?${queryString}` : "/admin/contents";
}

export const metadata: Metadata = {
  title: "Konten",
};

export default async function AdminContentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseContentListSearchParams(await searchParams);

  let result: Awaited<ReturnType<typeof listContents>> | null = null;
  try {
    result = await listContents(query);
  } catch (error) {
    // Detailed errors belong in server logs (CMS Spec §45);
    // users get an application-level error state.
    console.error("[admin/contents] list query failed:", error);
  }

  const isFiltered = Boolean(query.q || query.status || query.type);

  return (
    <section aria-labelledby="admin-contents-heading">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title} id="admin-contents-heading">
            Konten
          </h1>
          <p className={styles.intro}>
            Kelola artikel, video, infografis, teks, dan tips.
          </p>
        </div>
        <Link
          href="/admin/contents/new"
          className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.createCta}`}
        >
          Tambah Konten
        </Link>
      </div>

      {result ? (
        <>
          <form
            className={styles.filters}
            method="get"
            action="/admin/contents"
          >
            <div className={styles.searchField}>
              <Input
                type="search"
                name="q"
                label="Cari judul"
                placeholder="Cari judul konten…"
                defaultValue={query.q ?? ""}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="content-status">
                Status
              </label>
              <select
                id="content-status"
                name="status"
                className={styles.select}
                defaultValue={query.status ?? ""}
              >
                <option value="">Semua Status</option>
                {publicationStatus.enumValues.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="content-type">
                Tipe
              </label>
              <select
                id="content-type"
                name="type"
                className={styles.select}
                defaultValue={query.type ?? ""}
              >
                <option value="">Semua Tipe</option>
                {contentType.enumValues.map((value) => (
                  <option key={value} value={value}>
                    {TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary">
              Terapkan
            </Button>
          </form>

          <p className={styles.resultCount}>
            {isFiltered
              ? `${result.total} konten ditemukan`
              : `${result.total} konten`}
          </p>

          {result.rows.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Judul</th>
                    <th scope="col">Tipe</th>
                    <th scope="col">Status</th>
                    <th scope="col">Diperbarui</th>
                    <th scope="col">Digunakan Di</th>
                    <th scope="col">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row" className={styles.titleCell}>
                        {row.title}
                      </th>
                      <td>
                        <Badge tone="neutral">
                          {TYPE_LABELS[row.type as ContentType]}
                        </Badge>
                      </td>
                      <td>
                        <Badge
                          tone={
                            row.status === "PUBLISHED" ? "success" : "warning"
                          }
                        >
                          {STATUS_LABELS[row.status as ContentStatus]}
                        </Badge>
                      </td>
                      <td className={styles.dateCell}>
                        {dateFormatter.format(row.updatedAt)}
                      </td>
                      <td className={styles.usedInCell}>
                        {row.usedInCount > 0
                          ? `${row.usedInCount} pelajaran`
                          : "—"}
                      </td>
                      <td className={styles.actionsCell}>
                        <Link
                          className={styles.editLink}
                          href={`/admin/contents/${row.id}/edit`}
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
                Tidak ada konten yang cocok.
              </h2>
              <p className={styles.panelText}>
                Coba ubah kata kunci atau filter pencarian.
              </p>
              <Link className={styles.panelLink} href="/admin/contents">
                Hapus filter
              </Link>
            </Card>
          ) : (
            <Card className={styles.panel}>
              <h2 className={styles.panelTitle}>Belum ada konten.</h2>
              <p className={styles.panelText}>
                Buat konten pertama Anda untuk mulai mengisi kursus.
              </p>
            </Card>
          )}

          {result.pageCount > 1 ? (
            <nav
              className={styles.pagination}
              aria-label="Navigasi halaman konten"
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
          <h2 className={styles.panelTitle}>Gagal memuat daftar konten.</h2>
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
