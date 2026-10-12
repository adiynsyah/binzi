// Layered guard (card A-12): the whole (learn) area needs a signed-in
// ACTIVE user — but this layout is only the OUTERMOST layer. Every page,
// route handler, and server action under /belajar must still call
// requireUser/requireRole itself (src/lib/rbac.ts). Visual design: A-14b.
//
// Shell (card A-14b): skip link → member header → <main id="konten-utama">
// → bottom nav (< 768). No footer. The height/surface skeleton follows the
// (public) A-14a layout (min-h-dvh, <main> flex-1 on `surface`).
//
// The user data comes from the server (no guest→member flash): the guard
// identifies the user, then one self-read through the user module's public
// door (getUserProfile) supplies the name/email the header may see. The
// header receives ONLY { name, email } — never the session object.
import { LearnBottomNav } from "@/components/shared/learn-bottom-nav";
import { MemberHeader } from "@/components/shared/member-header";
import { SkipLink } from "@/components/shared/skip-link";
import { getUserProfile } from "@/modules/user/service";
import { requireRole } from "@/lib/rbac";

export default async function LearnLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Matrix: MEMBER+ for /belajar/** (PRD §7.2).
  const sessionUser = await requireRole("MEMBER");
  const profile = await getUserProfile(sessionUser, {
    userId: sessionUser.id,
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <MemberHeader user={{ name: profile.name, email: profile.email }} />
      {/* Bottom padding reserves space for the fixed bottom nav (< 768)
          so the last content is never covered; ≥ 768 the bar is gone. */}
      <main
        id="konten-utama"
        className="flex-1 bg-surface pb-[calc(62px+env(safe-area-inset-bottom))] md:pb-0"
      >
        {children}
      </main>
      <LearnBottomNav />
    </div>
  );
}
