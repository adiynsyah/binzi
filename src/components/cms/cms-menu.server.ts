// Role-filtered CMS menu (card A-15 step 1) — server-side by CONSTRUCTION:
// the runtime import of rbac (→ next/headers, db/schema) keeps this file out
// of the client graph, so it deliberately carries neither "use client" nor
// an `import "server-only"` (that would shut Vitest out). The (cms) layout
// calls getVisibleCmsMenu and hands the result to the shell components as
// plain serializable props; the per-role menu tests call the SAME function,
// never a copy of the logic.
import { pathAllows, type SessionUser } from "../../lib/rbac";

import { CMS_MENU, type CmsMenuGroup } from "./cms-nav";

/**
 * Groups with the items this user may see — an item must pass BOTH gates
 * from the card: `pathAllows(user, item.path)` against the RBAC matrix AND
 * the role being in the item's ✓ column. Groups left empty are dropped
 * entirely (never rendered), so the menu can never show an item the matrix
 * denies.
 */
export function getVisibleCmsMenu(user: SessionUser): CmsMenuGroup[] {
  return CMS_MENU.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => item.roles.includes(user.role) && pathAllows(user, item.path),
    ),
  })).filter((group) => group.items.length > 0);
}
