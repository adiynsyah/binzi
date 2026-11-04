// /cms/kursus (card S1-01, screen 21e): the course list. The page is a thin
// server shell — role gate + one service call; tabs/search/filtering live in
// the client CourseList (the tab badges need the full list anyway, so the
// whole list ships once and no pagination endpoint exists in the MVP).
import { CourseList } from "@/components/cms/course-list";
import { requireRole } from "@/lib/rbac";
import { listCourses } from "@/modules/course/service";

export default async function CmsKursusPage() {
  // Matrix: /cms/kursus (prefix) → EDITOR+ (src/lib/rbac.ts).
  const sessionUser = await requireRole("EDITOR");
  const { items, counts } = await listCourses(sessionUser, {});

  return <CourseList courses={items} counts={counts} />;
}
