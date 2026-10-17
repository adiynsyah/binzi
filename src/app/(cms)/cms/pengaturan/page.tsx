// /cms/pengaturan placeholder (card A-15 step 11): title = the active menu
// item's label ("Sistem"), body "Segera hadir." — system settings itself is
// S1 (27a).
import { CmsPlaceholderPage } from "@/components/cms/cms-pages";
import { getActiveCmsItem } from "@/components/cms/cms-nav";
import { requireRole } from "@/lib/rbac";

export default async function CmsPengaturanPage() {
  // Matrix: /cms/pengaturan (exact) → SUPER_ADMIN only (src/lib/rbac.ts).
  const sessionUser = await requireRole("SUPER_ADMIN");
  const title =
    getActiveCmsItem("/cms/pengaturan", null, sessionUser.role)?.label ??
    "Sistem";

  return <CmsPlaceholderPage title={title} />;
}
