// /cms placeholder (card A-12): guard + temporary copy — the dashboard
// itself (screens 19a/19b) is built in A-15.
import { requireRole } from "@/lib/rbac";

export default async function CmsHomePage() {
  // Matrix: /cms (exact) → EDITOR+ (src/lib/rbac.ts).
  await requireRole("EDITOR");
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-black">CMS BINZI</h1>
      <p className="mt-2 text-text-muted">
        Ringkasan CMS — tata letak menyusul.
      </p>
    </main>
  );
}
