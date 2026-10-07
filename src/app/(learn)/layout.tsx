// Layered guard (card A-12): the whole (learn) area needs a signed-in
// ACTIVE user — but this layout is only the OUTERMOST layer. Every page,
// route handler, and server action under /belajar must still call
// requireUser/requireRole itself (src/lib/rbac.ts). Visual design: A-14.
import { requireRole } from "@/lib/rbac";

export default async function LearnLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Matrix: MEMBER+ for /belajar/** (PRD §7.2).
  await requireRole("MEMBER");
  return children;
}
