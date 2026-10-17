// /cms Ringkasan (card A-15 step 11; screens 19a/19b): role-based heading
// only — no subtitle and no stat cards (invented data is forbidden, and the
// dashboard itself is S1). Guarded by its own requireRole call on top of
// the layout's (layered guard, card A-12).
import { CmsOverviewHeading } from "@/components/cms/cms-pages";
import { getUserProfile } from "@/modules/user/service";
import { requireRole } from "@/lib/rbac";

export default async function CmsHomePage() {
  // Matrix: /cms (exact) → EDITOR+ (src/lib/rbac.ts).
  const sessionUser = await requireRole("EDITOR");
  const profile = await getUserProfile(sessionUser, {
    userId: sessionUser.id,
  });

  return (
    <CmsOverviewHeading
      user={{ name: profile.name, role: sessionUser.role }}
    />
  );
}
