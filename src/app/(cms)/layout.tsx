// Layered guard (card A-12): the whole (cms) area needs EDITOR+ — but this
// layout is only the OUTERMOST layer. Every page, route handler, and server
// action under /cms must still call requireRole itself with the role its own
// matrix row demands (src/lib/rbac.ts). Visual design: A-15.
//
// Shell (card A-15 step 4): tautan lewati · sidebar/rel (≥ 640) atau bar
// ponsel (< 640) · kolom kanan berisi topbar (≥ 640) dan <main
// id="konten-utama">. No public header/footer. The sidebar and rail are
// sticky for the viewport height and scroll their own content.
//
// Server/client split: rbac-based menu filtering runs HERE, in
// getVisibleCmsMenu (cms-menu.server.ts — server-only by construction).
// The shell components receive only serializable props: the role-filtered
// groups and { name, role } for the user block (never the session/profile
// object). Active-row state is derived client-side from the pure
// getActiveCmsItem, so src/lib/rbac.ts never enters the client graph.
import { CmsMobileBar } from "@/components/cms/cms-mobile-bar";
import { getVisibleCmsMenu } from "@/components/cms/cms-menu.server";
import { CmsRail } from "@/components/cms/cms-rail";
import { CmsSidebar } from "@/components/cms/cms-sidebar";
import { CmsTopbar } from "@/components/cms/cms-topbar";
import { SkipLink } from "@/components/shared/skip-link";
import { getUserProfile } from "@/modules/user/service";
import { requireRole } from "@/lib/rbac";

export default async function CmsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Matrix: /cms area minimum is EDITOR (PRD §7.2/§3.2); stricter rows
  // (ADMIN+/SUPER_ADMIN) are enforced by their own pages.
  const sessionUser = await requireRole("EDITOR");
  const profile = await getUserProfile(sessionUser, {
    userId: sessionUser.id,
  });

  const groups = getVisibleCmsMenu(sessionUser);
  const user = { name: profile.name, role: sessionUser.role };

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <SkipLink />
      <CmsMobileBar groups={groups} user={user} />
      <div className="flex min-w-0 flex-1">
        <CmsSidebar groups={groups} user={user} />
        <CmsRail groups={groups} user={user} />
        <div className="flex min-w-0 flex-1 flex-col">
          <CmsTopbar role={user.role} />
          <main id="konten-utama" className="flex-1">
            {/* CMS content column (step 10): own padding scale 16/22/28
                (sides) and 16/22/26 (top), capped at 1200 and LEFT-aligned
                beside the sidebar — deliberately NOT PageContainer (the
                public 16/28/40 centered scale does not apply here). */}
            <div className="w-full max-w-content px-4 pt-4 sm:px-[22px] sm:pt-[22px] lg:px-7 lg:pt-[26px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
