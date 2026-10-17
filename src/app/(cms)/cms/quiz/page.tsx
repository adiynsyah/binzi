// /cms/quiz placeholder (card A-15 step 11): title = the active menu item's
// label, body "Segera hadir." — the list itself is S1 (screen 22f). The
// /cms/quiz matrix row is new in this very card (step 2).
import { CmsPlaceholderPage } from "@/components/cms/cms-pages";
import { getActiveCmsItem } from "@/components/cms/cms-nav";
import { requireRole } from "@/lib/rbac";

export default async function CmsQuizPage() {
  // Matrix: /cms/quiz (prefix) → EDITOR+ (src/lib/rbac.ts).
  const sessionUser = await requireRole("EDITOR");
  const title = getActiveCmsItem("/cms/quiz", null, sessionUser.role)?.label ?? "Quiz";

  return <CmsPlaceholderPage title={title} />;
}
