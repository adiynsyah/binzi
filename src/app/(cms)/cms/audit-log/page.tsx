// /cms/audit-log placeholder (card A-15 step 11): title = the active menu
// item's label, body "Segera hadir." — the audit log itself is S1 (27c).
import { CmsPlaceholderPage } from "@/components/cms/cms-pages";
import { getActiveCmsItem } from "@/components/cms/cms-nav";
import { requireRole } from "@/lib/rbac";

export default async function CmsAuditLogPage() {
  // Matrix: /cms/audit-log (exact) → SUPER_ADMIN only (Q43, src/lib/rbac.ts).
  const sessionUser = await requireRole("SUPER_ADMIN");
  const title =
    getActiveCmsItem("/cms/audit-log", null, sessionUser.role)?.label ??
    "Audit log";

  return <CmsPlaceholderPage title={title} />;
}
