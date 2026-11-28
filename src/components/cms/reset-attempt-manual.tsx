// /cms/reset-attempt/baru body (card S3-03 §6, screen 26c; decision 8): a
// page, not the 26c three-step dialog. A plain GET form looks the user up
// by EXACT email (`?email=`); found → the user card with "Ganti" (drops
// `?email`) and the client reset form; not found → one line of copy.
import Link from "next/link";

import { CMS_HEADING_CLASS } from "@/components/cms/cms-pages";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ManualResetLookupDTO } from "@/modules/recovery/service";

import { ResetAttemptManualForm } from "./reset-attempt-manual-form";

export function ResetAttemptManual({
  lookup,
}: {
  lookup: ManualResetLookupDTO | null;
}) {
  return (
    <div className="max-w-[40rem]">
      <Link
        href="/cms/reset-attempt"
        className="inline-flex min-h-(--height-touch-min) items-center font-mono text-xs font-medium uppercase tracking-[0.08em] text-text hover:underline"
      >
        ← Reset attempt
      </Link>
      <h1 className={`mt-2 ${CMS_HEADING_CLASS}`}>Reset attempt</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-text-muted">
        Untuk keluhan yang datang lewat jalur lain. Satu attempt hanya bisa direset
        satu kali.
      </p>

      {lookup !== null && lookup.found ? (
        <>
          <div className="mt-6 flex items-center gap-3 rounded-card border border-border bg-surface-2 p-4">
            <Avatar name={lookup.user.name} aria-hidden className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="wrap-anywhere font-bold text-text">{lookup.user.name}</p>
              <p className="wrap-anywhere text-sm text-text-muted">{lookup.user.email}</p>
            </div>
            <Link
              href="/cms/reset-attempt/baru"
              className="inline-flex min-h-(--height-touch-min) shrink-0 items-center px-2 text-sm font-bold text-text underline underline-offset-2"
            >
              Ganti
            </Link>
          </div>
          {lookup.quizzes.length === 0 ? (
            <p className="mt-6 text-[15px] text-text-muted">
              Pengguna ini belum punya attempt quiz.
            </p>
          ) : (
            <ResetAttemptManualForm quizzes={lookup.quizzes} />
          )}
        </>
      ) : (
        <form method="get" action="/cms/reset-attempt/baru" className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Email pengguna" className="sm:flex-1">
              <Input
                type="email"
                name="email"
                autoComplete="off"
                required
                defaultValue={lookup?.email ?? ""}
              />
            </Field>
            <Button type="submit" variant="dark">
              Cari
            </Button>
          </div>
          {lookup !== null ? (
            <p role="status" className="mt-3 text-sm text-text-muted">
              Tidak ada pengguna dengan email ini.
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}
