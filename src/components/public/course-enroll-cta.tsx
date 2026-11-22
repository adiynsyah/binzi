"use client";

// CourseEnrollCta (card S6-02 §4) — the enroll card of /kursus/{slug}. The
// ONE client piece of the detail page (the page stays session-free on the
// server for future ISR, PRD §10.4): it reads the session the same way
// SessionHeader does and picks the CTA client-side.
//
// Guest OR session-still-loading → the guest pair (the first paint always
// carries "Daftar & mulai belajar"; a resolved member session swaps in the
// start button). "Masuk" returns to THIS page via ?next=. Every control is
// ≥ 44 px through the button size bands.
//
// The member branch renders StartCourseButton inside a BLOCK wrapper: it
// outputs Button + an always-mounted <p role="alert"> as siblings, which
// must never become separate flex items (STATUS 22 Nov lesson 5).

import Link from "next/link";
import { Check } from "lucide-react";

import { authClient } from "@/components/shared/auth/auth-client";
import { CoverBlock } from "@/components/learn/learn-dashboard";
import { StartCourseButton } from "@/components/learn/start-course-button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export type CourseEnrollCtaProps = {
  courseId: string;
  slug: string;
  /** The detail h1 — the start button names the course through it. */
  titleId: string;
};

/** 7b perk bullets; the check icons are decorative (aria-hidden). */
const PERKS = [
  "Progress tersimpan, bisa dilanjut dari HP",
  "Quiz dengan pembahasan lengkap",
  "Nilai tercatat di halaman Nilai Saya",
] as const;

export function CourseEnrollCta({
  courseId,
  slug,
  titleId,
}: CourseEnrollCtaProps) {
  // No isPending branch needed: while the session loads, user is undefined
  // and the guest pair below renders (the first paint is session-free).
  const { data } = authClient.useSession();
  const user = data?.user;

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      {/* Cover without a play button (keputusan 5): nothing plays here.
          Below 1024 the card is the 7t bar — no cover (PR 153 review
          item 5). */}
      <CoverBlock className="hidden min-h-[170px] lg:block" />
      <div className="p-5">
        <p className="text-[19px] font-black text-text">Gratis</p>
        <p className="mt-1 text-sm text-text-muted">
          Tanpa biaya, tanpa kartu kredit.
        </p>

        {user ? (
          <div className="mt-4">
            <StartCourseButton
              courseId={courseId}
              variant="primary"
              className="w-full"
              aria-describedby={titleId}
            >
              Mulai belajar
            </StartCourseButton>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/daftar"
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "w-full",
              )}
            >
              Daftar & mulai belajar
            </Link>
            <Link
              href={`/masuk?next=${encodeURIComponent(`/kursus/${slug}`)}`}
              className={cn(
                buttonVariants({ variant: "secondary", size: "md" }),
                "w-full",
              )}
            >
              Sudah punya akun? Masuk
            </Link>
          </div>
        )}

        <ul className="mt-5 flex flex-col gap-2.5">
          {PERKS.map((perk) => (
            <li
              key={perk}
              className="flex items-start gap-2.5 text-sm text-text-muted"
            >
              <Check
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-success"
              />
              <span>{perk}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
