// /cms/reset-attempt placeholder (card A-15 step 11): title = the active
// menu item's label, body "Segera hadir." — the tool itself is S1 (26a).
import { CmsPlaceholderPage } from "@/components/cms/cms-pages";
import { getActiveCmsItem } from "@/components/cms/cms-nav";
import { requireRole } from "@/lib/rbac";

export default async function CmsResetAttemptPage() {
  // Matrix: /cms/reset-attempt (exact) → ADMIN+ (src/lib/rbac.ts).
  const sessionUser = await requireRole("ADMIN");
  const title =
    getActiveCmsItem("/cms/reset-attempt", null, sessionUser.role)?.label ??
    "Reset attempt";

  return <CmsPlaceholderPage title={title} />;
}
