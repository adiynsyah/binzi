// /belajar/nilai — the Nilai Saya page (card S5-03 §3). Data wire only,
// mirroring the dashboard page: guard → getGradesPage → <MyGrades>. The
// service is a pure GET (no transaction, no write), so there is no error
// branch here — a weights failure is a 500, the honest answer.
//
// The static segment `nilai` wins over [slug]; a course slug "nilai" is
// already rejected (course/schema.ts). NO loading.tsx next to this page
// (card §3): it sits OUTSIDE the (dashboard) group, whose skeleton is the
// dashboard's shape, and a fallback here has nothing to add — the page is
// one read. src/lib/learn-route-structure.test.ts guards it.
import { PageContainer } from "@/components/shared/page-container";
import { MyGrades } from "@/components/learn/my-grades";
import { requireRole } from "@/lib/rbac";
import { getGradesPage } from "@/modules/attempt/service";

export default async function NilaiSayaPage() {
  const actor = await requireRole("MEMBER");
  const data = await getGradesPage(actor);
  return (
    <PageContainer className="pt-8">
      <MyGrades data={data} />
    </PageContainer>
  );
}
