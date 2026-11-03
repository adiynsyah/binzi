// /cms/kursus/[id] (card S1-01, screen 21g): the EMPTY builder, read-only.
// Creating the course (21f) lands here; everything editable — materi, video,
// sampul, deskripsi, checklist, tombol kirim — belongs to S1-02+ and is
// deliberately NOT rendered as a dead button.
//
// A non-UUID or unknown id is a 404 (never a 500): the shape check happens
// before the service, and its NotFoundError maps to notFound() too.
import { notFound } from "next/navigation";

import { STATUS_BADGE } from "@/components/cms/course-list";
import { CMS_HEADING_CLASS } from "@/components/cms/cms-pages";
import { BadgeStatus } from "@/components/ui/badge-status";
import { NotFoundError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { COURSE_LEVEL_LABELS } from "@/modules/course/schema";
import { getCourseDetail, type CmsCourseDetailDTO } from "@/modules/course/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CmsCourseBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Matrix: /cms/kursus (prefix) → EDITOR+ (src/lib/rbac.ts).
  const sessionUser = await requireRole("EDITOR");
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  let course: CmsCourseDetailDTO;
  try {
    course = await getCourseDetail(sessionUser, { courseId: id });
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <div>
      {/* min-w-0 on the heading and both grid children: an 80-char no-space
          title/slug has a min-content wider than 360px, and break-words does
          not reduce min-content — without this the PAGE would scroll sideways
          (A-19b). */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={`${CMS_HEADING_CLASS} min-w-0`}>{course.title}</h1>
        <BadgeStatus status={STATUS_BADGE[course.status]} />
      </div>
      {course.summary ? (
        <p className="mt-2 max-w-(--width-measure) text-[15px] text-text-muted">
          {course.summary}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 flex flex-col gap-6">
          <section className="rounded-card border border-border bg-surface p-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-black text-text">Materi</h2>
              <span className="font-mono text-xs uppercase tracking-wide text-text-subtle">
                0 materi
              </span>
            </div>
            <p className="mt-4 font-bold text-text">Belum ada materi</p>
            <p className="mt-2 max-w-(--width-measure) text-text-muted">
              Tiap materi berisi satu video 3–5 menit (opsional), teks isi
              (wajib), dan satu quiz. Materi pertama otomatis jadi preview
              gratis.
            </p>
          </section>

          <section className="rounded-card border border-border bg-surface p-6">
            <h2 className="text-lg font-black text-text">Final Quiz</h2>
            <p className="mt-2 max-w-(--width-measure) text-text-muted">
              Sudah disiapkan kosong — minimum 10 soal, target 20 · bobot 40%
              Nilai Akhir
            </p>
          </section>
        </div>

        <aside className="min-w-0 rounded-card border border-border bg-surface p-6">
          <h2 className="font-mono text-xs uppercase tracking-wide text-text-subtle">
            Pengaturan kursus
          </h2>
          <dl className="mt-4 flex flex-col gap-4">
            <div>
              <dt className="text-sm font-bold text-text">Slug</dt>
              <dd className="mt-1 break-words font-mono text-sm text-text-muted">
                {course.slug}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-text">Level</dt>
              <dd className="mt-1 text-sm text-text-muted">
                {COURSE_LEVEL_LABELS[course.level]}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-text">Durasi</dt>
              <dd className="mt-1 text-sm text-text-muted">
                Dihitung otomatis dari video
              </dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-text">Penggarap</dt>
              <dd className="mt-1 text-sm text-text-muted">{course.ownerName}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
