// /cms/media placeholder (card A-15 step 11): title = the active menu item's
// label, body "Segera hadir." — the media library itself is S1 (screen 24a).
import { CmsPlaceholderPage } from "@/components/cms/cms-pages";
import { getActiveCmsItem } from "@/components/cms/cms-nav";
import { requireRole } from "@/lib/rbac";

export default async function CmsMediaPage() {
  // Matrix: /cms/media (exact) → EDITOR+ (src/lib/rbac.ts).
  const sessionUser = await requireRole("EDITOR");
  const title = getActiveCmsItem("/cms/media", null, sessionUser.role)?.label ?? "Media";

  return <CmsPlaceholderPage title={title} />;
}
