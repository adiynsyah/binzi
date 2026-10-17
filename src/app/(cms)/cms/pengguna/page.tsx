// /cms/pengguna placeholder (card A-15 step 11): title = the active menu
// item's label, body "Segera hadir." — user management itself is S1 (25a).
import { CmsPlaceholderPage } from "@/components/cms/cms-pages";
import { getActiveCmsItem } from "@/components/cms/cms-nav";
import { requireRole } from "@/lib/rbac";

export default async function CmsPenggunaPage() {
  // Matrix: /cms/pengguna (exact) → ADMIN+ (src/lib/rbac.ts).
  const sessionUser = await requireRole("ADMIN");
  const title =
    getActiveCmsItem("/cms/pengguna", null, sessionUser.role)?.label ??
    "Pengguna & peran";

  return <CmsPlaceholderPage title={title} />;
}
