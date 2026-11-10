// /cms/konten (card S1-08 §6): the approval queue — ADMIN+ ("Persetujuan")
// see every IN_REVIEW course; an EDITOR ("Menunggu persetujuan") sees only
// courses that account sent (PRD §7 note ¹). The `status` query stays a URL
// contract only (Q42): authorization runs on the pathname, and the SAME
// getActiveCmsItem that names the page decides its content (owner review 6)
// — ?status=perlu-revisi exists for EDITOR alone, so ADMIN+ keep the queue
// under the "Persetujuan" title whatever the query says.
import { ApprovalQueue } from "@/components/cms/approval-queue";
import { getActiveCmsItem } from "@/components/cms/cms-nav";
import { CMS_HEADING_CLASS } from "@/components/cms/cms-pages";
import { requireRole } from "@/lib/rbac";
import { listCourseApprovalQueue } from "@/modules/course/service";

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

  const activeItem = getActiveCmsItem(
    "/cms/konten",
    statusValue,
    sessionUser.role,
  );
  const title = activeItem?.label ?? "Konten";

  if (activeItem?.id === "perlu-revisi") {
    return (
      <div>
        <h1 className={CMS_HEADING_CLASS}>{title}</h1>
        <ApprovalQueue variant="perlu-revisi" />
      </div>
    );
  }

  // Role check happens inside the service (EDITOR+, before the query).
  const items = await listCourseApprovalQueue(sessionUser);

  return (
    <div>
      <h1 className={CMS_HEADING_CLASS}>{title}</h1>
      <ApprovalQueue items={items} />
    </div>
  );
}
