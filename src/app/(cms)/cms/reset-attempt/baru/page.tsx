// /cms/reset-attempt/baru (card S3-03 §6, screen 26c; decision 8): reset
// without a report. `?email=` drives the exact-email lookup on the server
// (no GET API for users/attempts). ADMIN+ here and inside the service. No
// loading.tsx (decision 14).
import { ZodError } from "zod";

import { ResetAttemptManual } from "@/components/cms/reset-attempt-manual";
import { requireRole } from "@/lib/rbac";
import {
  findUserForManualReset,
  type ManualResetLookupDTO,
} from "@/modules/recovery/service";

export default async function CmsResetAttemptNewPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  // Matrix: /cms/reset-attempt (prefix) → ADMIN+ (src/lib/rbac.ts).
  const sessionUser = await requireRole("ADMIN");
  const { email } = await searchParams;
  const value = typeof email === "string" ? email.trim() : "";

  let lookup: ManualResetLookupDTO | null = null;
  if (value !== "") {
    try {
      lookup = await findUserForManualReset(sessionUser, { email: value });
    } catch (error) {
      // An over-long value is just "not found", not a 500.
      if (!(error instanceof ZodError)) throw error;
      lookup = { found: false, email: value };
    }
  }
  return <ResetAttemptManual lookup={lookup} />;
}
