/*
 * CMS page bodies (card A-15 step 11) — deliberately server-safe plain
 * components (no "use client", no hooks) so the thin page.tsx files stay
 * Vitest-importable. The layout owns <main id="konten-utama"> and the
 * content paddings; pages only render what is inside.
 */
import { firstNameOf } from "../shared/member-user";
import type { CmsUser } from "./cms-nav";

/* CMS heading scale (19a): Lato 900, 28 / 1.16, letter-spacing -0.022em. */
const HEADING_CLASS =
  "text-[28px] font-black leading-[1.16] tracking-[-0.022em] text-text";

/**
 * /cms heading per role: "Halo, {nama depan}" for the ahli gizi (19a) —
 * just "Halo" when the name has no first word — and "Ringkasan" for
 * ADMIN/SUPER_ADMIN (19b). No subtitle and no stat cards: inventing data
 * is forbidden (CLAUDE.md) and the dashboard itself is S1.
 */
export function CmsOverviewHeading({ user }: { user: CmsUser }) {
  const first = firstNameOf(user.name);
  const title =
    user.role === "EDITOR" ? (first ? `Halo, ${first}` : "Halo") : "Ringkasan";

  return <h1 className={HEADING_CLASS}>{title}</h1>;
}

/**
 * Placeholder body for every other menu destination: the active item's
 * label as the heading plus one "Segera hadir." paragraph. The title comes
 * from the same getActiveCmsItem the breadcrumb uses, so the two can never
 * disagree.
 */
export function CmsPlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className={HEADING_CLASS}>{title}</h1>
      <p className="mt-3 text-[15px] text-text-muted">Segera hadir.</p>
    </div>
  );
}
