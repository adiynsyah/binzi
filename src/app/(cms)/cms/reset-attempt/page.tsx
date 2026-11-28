// /cms/reset-attempt (card S3-03 §6, screen 26a): the report queue.
// `?status=` is the URL contract (menunggu | disetujui | ditolak | semua;
// anything else → menunggu). Role is checked here AND inside the service
// (ADMIN+, before the input is parsed).
import { ResetAttemptQueue } from "@/components/cms/reset-attempt-queue";
import type { QueueTab } from "@/components/cms/reset-attempt-tabs";
import { requireRole } from "@/lib/rbac";
import { listAttemptReports } from "@/modules/recovery/service";

const STATUS_BY_TAB: Record<QueueTab, "PENDING" | "APPROVED" | "REJECTED" | "ALL"> = {
  menunggu: "PENDING",
  disetujui: "APPROVED",
  ditolak: "REJECTED",
  semua: "ALL",
};

function tabOf(value: string | string[] | undefined): QueueTab {
  return typeof value === "string" && Object.hasOwn(STATUS_BY_TAB, value)
    ? (value as QueueTab)
    : "menunggu";
}

export default async function CmsResetAttemptPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  // Matrix: /cms/reset-attempt (prefix) → ADMIN+ (src/lib/rbac.ts).
  const sessionUser = await requireRole("ADMIN");
  const active = tabOf((await searchParams).status);
  const data = await listAttemptReports(sessionUser, {
    status: STATUS_BY_TAB[active],
  });
  return <ResetAttemptQueue data={data} active={active} />;
}
