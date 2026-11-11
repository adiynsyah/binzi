// Instant navigations skip this file entirely; real navigations (member
// clicks "Belajar") show LearnDashboardSkeleton. It sits in the
// `(dashboard)` ROUTE GROUP on purpose (card S5-01 §3): directly under
// belajar/ the fallback would also wrap FUTURE child routes — /belajar/…
// lesson pages calling notFound()/redirect() would first paint this
// skeleton, then answer 200 for a page that does not exist. The group keeps
// the fallback scoped to the dashboard page only.
import { LearnDashboardSkeleton } from "@/components/learn/learn-dashboard-skeleton";

export default function BelajarDashboardLoading() {
  return <LearnDashboardSkeleton />;
}
