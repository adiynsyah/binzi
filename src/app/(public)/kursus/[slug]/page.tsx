// /kursus/{slug} — the public course detail (card S6-02 §2). The read is
// wrapped in React cache() so generateMetadata and the page share ONE
// query per request. A NotFoundError becomes notFound() in BOTH callers —
// the anti-IDOR 404: unknown slug, unpublished course, and course without
// lessons are indistinguishable. force-dynamic + robots noindex follow the
// catalog page; NO loading.tsx in this folder (card keputusan 12).
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CourseDetail } from "@/components/public/course-detail";
import { PageContainer } from "@/components/shared/page-container";
import { NotFoundError } from "@/lib/errors";
import {
  getPublicCourse,
  type PublicCourseDetailDTO,
} from "@/modules/course/service";

export const dynamic = "force-dynamic";

/** null = the 404 branch; anything else bubbles up. */
const loadCourse = cache(
  async (slug: string): Promise<PublicCourseDetailDTO | null> => {
    try {
      return await getPublicCourse(slug);
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  },
);

type CourseDetailRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: CourseDetailRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await loadCourse(slug);
  if (!course) notFound();
  return {
    title: `${course.meta.title} — BINZI`,
    description: course.meta.description ?? undefined,
    robots: { index: false },
  };
}

export default async function CourseDetailRoutePage({
  params,
}: CourseDetailRouteProps) {
  const { slug } = await params;
  const course = await loadCourse(slug);
  if (!course) notFound();
  return (
    <PageContainer className="pt-8">
      <CourseDetail course={course} />
    </PageContainer>
  );
}
