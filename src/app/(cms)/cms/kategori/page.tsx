// /cms/kategori placeholder (card A-15 step 11): title = the active menu
// item's label, body "Segera hadir." — kategori & tag itself is S1 (23a).
import { CmsPlaceholderPage } from "@/components/cms/cms-pages";
import { getActiveCmsItem } from "@/components/cms/cms-nav";
import { requireRole } from "@/lib/rbac";

export default async function CmsKategoriPage() {
  // Matrix: /cms/kategori (exact) → ADMIN+ (src/lib/rbac.ts).
  const sessionUser = await requireRole("ADMIN");
  const title =
    getActiveCmsItem("/cms/kategori", null, sessionUser.role)?.label ??
    "Kategori";

  return <CmsPlaceholderPage title={title} />;
}
