"use client";

// Queue tabs for /cms/reset-attempt (card S3-03 §6, 26a) — the course-list
// pattern (ui/tabs, counts in mono) with `?status=` as the URL contract:
// a tab change navigates, and the server renders the active tab's rows
// (passed in as children). Manual activation, so arrow keys move focus
// without firing a navigation per key. Every trigger owns a TabsContent
// (aria-controls must resolve); only the active one holds the rows.
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type QueueTab = "menunggu" | "disetujui" | "ditolak" | "semua";

export const QUEUE_TABS: readonly {
  value: QueueTab;
  label: string;
  countKey: "PENDING" | "APPROVED" | "REJECTED" | "ALL";
}[] = [
  { value: "menunggu", label: "Menunggu", countKey: "PENDING" },
  { value: "disetujui", label: "Disetujui", countKey: "APPROVED" },
  { value: "ditolak", label: "Ditolak", countKey: "REJECTED" },
  { value: "semua", label: "Semua", countKey: "ALL" },
];

export function queueTabHref(tab: QueueTab): string {
  return tab === "menunggu" ? "/cms/reset-attempt" : `/cms/reset-attempt?status=${tab}`;
}

export type ResetAttemptTabsProps = {
  active: QueueTab;
  counts: Record<"PENDING" | "APPROVED" | "REJECTED" | "ALL", number>;
  children: ReactNode;
};

export function ResetAttemptTabs({ active, counts, children }: ResetAttemptTabsProps) {
  const router = useRouter();
  return (
    <Tabs
      value={active}
      activationMode="manual"
      onValueChange={(value) => router.push(queueTabHref(value as QueueTab))}
      className="mt-6"
    >
      <TabsList className="overflow-x-auto">
        {QUEUE_TABS.map(({ value, label, countKey }) => (
          <TabsTrigger key={value} value={value} className="shrink-0 px-2 sm:px-4">
            <span>{label}</span>
            <span className="font-mono text-xs text-text-subtle">{counts[countKey]}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {QUEUE_TABS.map(({ value }) => (
        <TabsContent key={value} value={value}>
          {value === active ? children : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}
