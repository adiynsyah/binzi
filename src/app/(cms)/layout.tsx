// Layered guard (card A-12): the whole (cms) area needs EDITOR+ — but this
// layout is only the OUTERMOST layer. Every page, route handler, and
// server action under /cms must still call requireRole itself with the
// role its own matrix row demands (src/lib/rbac.ts). Visual design: A-15.
import { requireRole } from "@/lib/rbac";

export default async function CmsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Matrix: /cms area minimum is EDITOR (PRD §7.2/§3.2); stricter rows
  // (ADMIN+/SUPER_ADMIN) are enforced by their own pages.
  await requireRole("EDITOR");
  return children;
}
