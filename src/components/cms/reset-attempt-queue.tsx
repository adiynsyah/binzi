// /cms/reset-attempt queue (card S3-03 §6, screen 26a). Server component:
// header, the `?status=` tabs (client island), and one list of reports.
// Each report is ONE link (the whole row) to /cms/reset-attempt/{nomor};
// its accessible name is the row text, so it carries the reporter and the
// number. ≥ 1024 the rows line up under a visual column header (hidden
// from assistive tech — each row's own text stays self-describing); below
// 1024 they stack as cards. No counts in the sidebar (decision 10), no
// "Baru diputuskan" block (decision 11).
import Link from "next/link";

import { CMS_HEADING_CLASS } from "@/components/cms/cms-pages";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button-variants";
import type { ReportQueueDTO } from "@/modules/recovery/service";

import { DeadlineText, ReportStatusPill } from "./reset-attempt-status";
import { ResetAttemptTabs, type QueueTab } from "./reset-attempt-tabs";

const GRID = "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_110px_110px]";
const MONO_META =
  "font-mono text-[11px] uppercase tracking-[0.06em] text-text-meta";

export function ResetAttemptQueue({
  data,
  active,
}: {
  data: ReportQueueDTO;
  active: QueueTab;
}) {
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {/* ≥ 640 the CMS topbar already shows this breadcrumb. */}
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-text-meta sm:hidden">
            Pengaturan / Reset attempt
          </p>
          <h1 className={CMS_HEADING_CLASS}>Reset attempt</h1>
          <p className="mt-2 max-w-[38rem] text-[15px] leading-relaxed text-text-muted">
            Quiz hanya satu kesempatan, jadi ini satu-satunya jalan pemulihan bila
            gangguan teknis merusak nilai seseorang. Janji ke user: diputuskan dalam
            1×24 jam kerja.
          </p>
        </div>
        <div className="shrink-0">
          <Link
            href="/cms/reset-attempt/baru"
            className={buttonVariants({ variant: "secondary" })}
          >
            Reset tanpa laporan…
          </Link>
        </div>
      </div>

      <ResetAttemptTabs active={active} counts={data.counts}>
        {data.items.length === 0 ? (
          <p className="mt-2 rounded-card border border-border bg-surface-2 p-5 text-[15px] text-text-muted">
            Tidak ada laporan di tab ini.
          </p>
        ) : (
          <div className="mt-2 rounded-card border border-border bg-surface">
            <div
              aria-hidden="true"
              className={`hidden gap-4 border-b border-border px-5 py-3 lg:grid ${GRID} font-mono text-xs font-medium uppercase tracking-[0.08em] text-text-subtle`}
            >
              <span>Pelapor</span>
              <span>Quiz &amp; attempt</span>
              <span>Kendala</span>
              <span>Status</span>
              <span>Tenggat</span>
            </div>
            <ul>
              {data.items.map((item) => (
                <li
                  key={item.number}
                  className="border-b border-border-soft last:border-b-0"
                >
                  <Link
                    href={`/cms/reset-attempt/${item.number}`}
                    className={`grid gap-3 px-5 py-4 transition-colors hover:bg-surface-2 lg:items-center lg:gap-4 ${GRID}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={item.reporterName} size="sm" aria-hidden className="shrink-0" />
                      <div className="min-w-0">
                        <p className="wrap-anywhere font-bold text-text">{item.reporterName}</p>
                        <p className={MONO_META}>
                          R-{item.number} · {item.createdAt}
                        </p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="wrap-anywhere font-bold text-text">{item.quizLabel}</p>
                      <p className={MONO_META}>
                        Nilai {item.scorePercent} · Soal {item.answered}/{item.total}
                      </p>
                    </div>
                    <p className="text-sm text-text-body">{item.categoryLabel}</p>
                    <div className="flex flex-wrap items-center gap-3 lg:contents">
                      <div>
                        <ReportStatusPill status={item.status} />
                      </div>
                      <div>
                        <DeadlineText
                          deadline={item.deadline}
                          prefix={
                            item.deadline ? (
                              // ≥ 1024 the column header says it.
                              <span className="lg:sr-only">Tenggat </span>
                            ) : undefined
                          }
                        />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </ResetAttemptTabs>
    </div>
  );
}
