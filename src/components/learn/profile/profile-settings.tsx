// ProfileSettings (card S5-05 §5, screens 9c/9e) — server component: the
// page shell, the identity row, and the Keamanan section's static rows.
// Interactivity lives in the three client components below; ONLY displayed
// fields cross the boundary (name/email/emailVerified/memberSince as
// strings + the AccountSecurityDTO summary), never a full DTO.
import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import type { AccountSecurityDTO } from "@/modules/user/service";

import { PasswordRow } from "./password-row";
import { ProfileNameForm } from "./profile-name-form";
import { RevokeAllSessionsButton } from "./revoke-all-sessions-button";

// Same eyebrow treatment as the other (learn) pages (my-grades.tsx).
const EYEBROW_CLASS =
  "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-subtle";

export type ProfileSettingsProps = {
  profile: {
    name: string;
    email: string;
    emailVerified: boolean;
    /** Pre-formatted server-side (formatWibDate) — no Date crosses. */
    memberSince: string;
  };
  security: AccountSecurityDTO;
};

const DATA_HEADING_ID = "profil-data-heading";
const KEAMANAN_HEADING_ID = "profil-keamanan-heading";

/** One Keamanan row (9c/9e): light-gray inner card, title + caption left,
 *  action right; stacks below 640. The action container renders only when
 *  it has content — an empty flex child would still claim gap space. */
function SecurityRow({
  title,
  headingId,
  caption,
  action,
}: {
  title: string;
  headingId: string;
  caption: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-card border border-border-soft bg-surface-2 p-4">
      <div className="min-w-0 flex-1">
        <h3 id={headingId} className="text-[15px] font-bold text-text">
          {title}
        </h3>
        {/* wrap-anywhere: the Google caption carries the full email —
            a long one has no other break point at 360 (card §5.4). */}
        <p className="mt-1 text-[13px] text-text-muted wrap-anywhere">
          {caption}
        </p>
      </div>
      {action ? <div className="w-full sm:w-auto">{action}</div> : null}
    </div>
  );
}

export function ProfileSettings({ profile, security }: ProfileSettingsProps) {
  return (
    <div className="max-w-[59rem]">
      <p className={EYEBROW_CLASS}>Belajar / Profil</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-text sm:text-3xl">
        Profil &amp; pengaturan
      </h1>

      <div className="mt-6 space-y-5">
        <section
          aria-labelledby={DATA_HEADING_ID}
          className="rounded-card border border-border bg-surface p-4 sm:p-6"
        >
          <h2
            id={DATA_HEADING_ID}
            className="text-lg font-black tracking-tight text-text"
          >
            Data akun
          </h2>

          {/* Identity row (9c): decorative avatar beside the name — the name
              text is the accessible label, so the avatar stays aria-hidden. */}
          <div className="mt-4 flex items-center gap-4">
            <Avatar
              name={profile.name}
              size="lg"
              aria-hidden="true"
              className="shrink-0 bg-text text-surface"
            />
            <div className="min-w-0">
              <p className="text-[21px] font-bold text-text wrap-anywhere">
                {profile.name}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Anggota sejak {profile.memberSince}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <ProfileNameForm
              name={profile.name}
              email={profile.email}
              emailVerified={profile.emailVerified}
            />
          </div>
        </section>

        <section
          aria-labelledby={KEAMANAN_HEADING_ID}
          className="rounded-card border border-border bg-surface p-4 sm:p-6"
        >
          <h2
            id={KEAMANAN_HEADING_ID}
            className="text-lg font-black tracking-tight text-text"
          >
            Keamanan
          </h2>
          <div className="mt-4 space-y-4">
            <PasswordRow hasPassword={security.hasPassword} />
            {security.googleLinked ? (
              <SecurityRow
                headingId="profil-google-heading"
                title="Akun Google tertaut"
                caption={`${profile.email} · bisa dipakai untuk masuk satu klik`}
              />
            ) : null}
            <SecurityRow
              headingId="profil-sesi-heading"
              title="Sesi aktif"
              caption={`${security.activeSessionCount} perangkat`}
              action={<RevokeAllSessionsButton />}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
