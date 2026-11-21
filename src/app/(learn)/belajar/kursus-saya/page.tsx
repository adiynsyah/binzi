// /belajar/kursus-saya — the Kursus Saya page (card S5-04 §2). Data wire
// only, mirroring the nilai page: guard → getMyCoursesPage → <MyCourses>.
// The service is a pure GET, so there is no error branch here.
//
// The static segment `kursus-saya` wins over [slug]; a course slug
// "kursus-saya" is already rejected by the CMS schema. NO loading.tsx
// next to this page (card §2) — src/lib/learn-route-structure.test.ts
// guards that.
import { PageContainer } from "@/components/shared/page-container";
import { MyCourses } from "@/components/learn/my-courses";
import { requireRole } from "@/lib/rbac";
import { getMyCoursesPage } from "@/modules/progress/service";

export default async function KursusSayaPage() {
  const actor = await requireRole("MEMBER");
  const data = await getMyCoursesPage(actor);
  return (
    <PageContainer className="pt-8">
      <MyCourses data={data} />
    </PageContainer>
  );
}
