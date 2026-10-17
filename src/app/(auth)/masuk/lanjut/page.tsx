// /masuk/lanjut — role-based post-login landing (PRD Q44, chore after
// A-15). POST_LOGIN_DEFAULT_PATH points here, so the destination is
// decided SERVER-side from the DB session: MEMBER → /belajar, staff
// (EDITOR+) → /cms (landingPathForRole, src/lib/rbac.ts). Not signed in
// or non-ACTIVE → plain /masuk: this route is outside the proxy matcher,
// so no x-binzi-pathname header exists and requireUser's loginRedirectPath
// cannot attach `next`. This page must NEVER call redirectIfSignedIn —
// it IS the post-login hop, and the /masuk hop already ends here;
// bouncing signed-in users back would loop.
import { redirect } from "next/navigation";

import { landingPathForRole, requireUser } from "@/lib/rbac";

// No metadata and no UI: every branch redirects, nothing ever renders.
// headers() inside requireUser makes the page dynamic (the /masuk
// pattern) — the role can never be frozen into a build.
export default async function MasukLanjutPage() {
  const user = await requireUser();
  redirect(landingPathForRole(user.role));
}
