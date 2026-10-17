// /cms/konten placeholder (card A-15 step 11). The `status` query is a URL
// contract only (Q42): it picks the MENU state ("Perlu revisi" for EDITOR,
// "Persetujuan" for ADMIN+) and never touches authorization — the RBAC
// check runs on the pathname alone. The title comes from the same
// getActiveCmsItem the topbar breadcrumb uses, so the two cannot disagree.
import { CmsPlaceholderPage } from "@/components/cms/cms-pages";
import { getActiveCmsItem } from "@/components/cms/cms-nav";
import { requireRole } from "@/lib/rbac";

type CmsKontenPageProps = {
  searchParams: Promise<{ status?: string | string[] }>;
};

export default async function CmsKontenPage({
  searchParams,
}: CmsKontenPageProps) {
  // Matrix: /cms/konten (exact) → EDITOR+ (src/lib/rbac.ts).
  const sessionUser = await requireRole("EDITOR");
  const { status } = await searchParams;
  const statusValue = typeof status === "string" ? status : null;

  const title =
    getActiveCmsItem("/cms/konten", statusValue, sessionUser.role)?.label ??
    "Konten";

  return <CmsPlaceholderPage title={title} />;
}
