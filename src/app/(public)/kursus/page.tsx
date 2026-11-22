// /kursus — the public catalog (card S6-02 §2): every PUBLISHED course
// with at least one lesson, newest publication first. force-dynamic is the
// deliberate PRD §10.4 deviation recorded in the card: a publish must be
// visible immediately, and CI builds with a dummy DATABASE_URL. robots
// noindex stays until launch. NO loading.tsx in this folder or [slug]/
// (card keputusan 12) — src/lib/public-route-structure.test.ts guards it.
import type { Metadata } from "next";

import { CourseCatalog } from "@/components/public/course-catalog";
import { PageContainer } from "@/components/shared/page-container";
import { getPublicCatalog } from "@/modules/course/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kursus — BINZI",
  robots: { index: false },
};

export default async function KursusPage() {
  const courses = await getPublicCatalog();
  return (
    <PageContainer className="pt-8">
      <CourseCatalog courses={courses} />
    </PageContainer>
  );
}
