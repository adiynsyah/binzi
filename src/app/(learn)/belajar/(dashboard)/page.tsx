// /belajar — the member learning dashboard (card S5-01 §3). All states and
// markup live in LearnDashboard (server component); this page is the data
// wire: guard → profile (header greeting) + dashboard lists in parallel.
//
// Layered guard: the (learn) layout already checked MEMBER+, but every page
// calls its own guard (src/lib/rbac.ts) — hiding a button is never
// authorization.
//
// The page sits in a `(dashboard)` ROUTE GROUP so loading.tsx (next to it)
// can wrap ONLY this page. Directly under belajar/ the fallback would also
// swallow child routes' notFound()/redirect() — see (dashboard)/loading.tsx.
import { firstNameOf } from "@/components/shared/member-user";
import { PageContainer } from "@/components/shared/page-container";
import { LearnDashboard } from "@/components/learn/learn-dashboard";
import { getLearnerDashboard } from "@/modules/progress/service";
import { getUserProfile } from "@/modules/user/service";
import { requireRole } from "@/lib/rbac";

export default async function BelajarDashboardPage() {
  const sessionUser = await requireRole("MEMBER");
  const [profile, dashboard] = await Promise.all([
    getUserProfile(sessionUser, { userId: sessionUser.id }),
    getLearnerDashboard(sessionUser),
  ]);

  return (
    <PageContainer className="pt-8">
      <LearnDashboard
        firstName={firstNameOf(profile.name)}
        dashboard={dashboard}
      />
    </PageContainer>
  );
}
