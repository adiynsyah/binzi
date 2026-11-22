// /profil — Profil & pengaturan (card S5-05 §5). Data wire only,
// mirroring /belajar/nilai: guard → services → <ProfileSettings>.
// "Anggota sejak" is formatted SERVER-side so no Date ever crosses into a
// client component. NO loading.tsx next to this page (same stance as
// nilai/): the (dashboard) skeleton is not this page's shape and the page
// is one GET pair — src/lib/learn-route-structure.test.ts guards it.
import { ProfileSettings } from "@/components/learn/profile/profile-settings";
import { PageContainer } from "@/components/shared/page-container";
import { formatWibDate } from "@/lib/datetime";
import { requireRole } from "@/lib/rbac";
import { getAccountSecurity, getUserProfile } from "@/modules/user/service";

export default async function ProfilPage() {
  const actor = await requireRole("MEMBER");
  const [profile, security] = await Promise.all([
    getUserProfile(actor, { userId: actor.id }),
    getAccountSecurity(actor),
  ]);
  return (
    <PageContainer className="pt-8">
      <ProfileSettings
        profile={{
          name: profile.name,
          email: profile.email,
          emailVerified: profile.emailVerified,
          memberSince: formatWibDate(new Date(profile.createdAt)),
        }}
        security={security}
      />
    </PageContainer>
  );
}
