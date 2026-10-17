// /cms/kursus placeholder (card A-15 step 11): title = the active menu
// item's label, body "Segera hadir." — the list itself is S1 (screen 21e).
import { CmsPlaceholderPage } from "@/components/cms/cms-pages";
import { getActiveCmsItem } from "@/components/cms/cms-nav";
import { requireRole } from "@/lib/rbac";

export default async function CmsKursusPage() {
  // Matrix: /cms/kursus (prefix) → EDITOR+ (src/lib/rbac.ts).
  const sessionUser = await requireRole("EDITOR");
  const title =
    getActiveCmsItem("/cms/kursus", null, sessionUser.role)?.label ?? "Kursus";

  return <CmsPlaceholderPage title={title} />;
}
