// /cms/kursus/[id] (cards S1-01 → S1-02, screens 21a/21g): the course
// builder. This file is the thin server guard only — EDITOR+, UUID shape
// check before the service, NotFoundError → notFound() — and the whole
// page body (heading row + Simpan, outline, settings panel, syarat
// terbit) renders from ONE getCourseBuilder call inside the client
// component (review item 1).
import { notFound } from "next/navigation";

import { CourseBuilder } from "@/components/cms/course-builder";
import { NotFoundError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { getCourseBuilder } from "@/modules/course/service";

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

  let builder: Awaited<ReturnType<typeof getCourseBuilder>>;
  try {
    builder = await getCourseBuilder(sessionUser, { courseId: id });
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  return <CourseBuilder builder={builder} />;
}
