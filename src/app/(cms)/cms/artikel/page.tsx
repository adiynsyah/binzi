// /cms/artikel placeholder (card A-15 step 11): title = the active menu
// item's label, body "Segera hadir." — the list itself is S1 (screen 19c).
import { CmsPlaceholderPage } from "@/components/cms/cms-pages";
import { getActiveCmsItem } from "@/components/cms/cms-nav";
import { requireRole } from "@/lib/rbac";

export default async function CmsArtikelPage() {
  // Matrix: /cms/artikel (exact) → EDITOR+ (src/lib/rbac.ts).
  const sessionUser = await requireRole("EDITOR");
  const title =
    getActiveCmsItem("/cms/artikel", null, sessionUser.role)?.label ??
    "Artikel";

  return <CmsPlaceholderPage title={title} />;
}
