/*
 * Course status → BadgeStatus pill (21e/21g).
 *
 * Plain module on purpose (no "use client"): the builder page is a server
 * component and needs the MAP as a real value. A "use client" module's
 * exports become client references on the server — indexing one yields
 * undefined, so BadgeStatus would render an empty pill. Client components
 * (course-list) import from here too.
 */
import type { BadgeStatusType } from "@/components/ui/badge-status";
import type { CmsCourseListItemDTO } from "@/modules/course/service";

export const STATUS_BADGE: Record<
  CmsCourseListItemDTO["status"],
  BadgeStatusType
> = {
  DRAFT: "draf",
  IN_REVIEW: "menunggu-persetujuan",
  PUBLISHED: "terbit",
  ARCHIVED: "arsip",
};
