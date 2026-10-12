// Temporary /belajar (card A-14b): ONE heading, nothing else — the
// dashboard content arrives in S5. Greeting copy from 28a ("Selamat
// datang, Dimas"); the first name is the first word of the display name
// after trim, and a blank name drops the name part entirely.
//
// Layered guard: the layout already checked MEMBER+, but every page calls
// its own guard (src/lib/rbac.ts) — hiding a button is never authorization.
import { firstNameOf } from "@/components/shared/member-user";
import { getUserProfile } from "@/modules/user/service";
import { requireRole } from "@/lib/rbac";

export default async function BelajarPage() {
  const sessionUser = await requireRole("MEMBER");
  const profile = await getUserProfile(sessionUser, {
    userId: sessionUser.id,
  });

  const firstName = firstNameOf(profile.name);

  return (
    <div className="px-4 pt-8 sm:px-7 lg:px-10">
      {/* break-words: a 40-character single-word name must not widen the
          viewport (card: no horizontal scroll at 360 and 640). */}
      <h1 className="break-words text-balance text-[25px] font-black leading-[1.14] tracking-[-0.022em] text-text sm:text-[32px] sm:leading-[1.16] sm:tracking-[-0.024em]">
        {firstName ? `Selamat datang, ${firstName}` : "Selamat datang"}
      </h1>
    </div>
  );
}
