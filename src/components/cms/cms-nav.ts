// CMS navigation config (card A-15 step 1) — the single source of menu
// groups, items, icons, and role visibility. PURE on purpose: no React, no
// next/headers, no db imports (UserRole arrives via `import type`, which is
// erased at build time), so the client shell components (sidebar, rail,
// drawer, topbar) and Vitest can import it freely while src/lib/rbac.ts
// itself stays out of the client graph. Role FILTERING against the RBAC
// matrix lives separately in cms-menu.server.ts (getVisibleCmsMenu) — the
// one place allowed to import rbac at runtime.
//
// `href` may carry a ?status= contract (e.g. /cms/konten?status=menunggu);
// `path` is the pathname only. Authorization and active-state matching ALWAYS
// compare `path` — a query string never reaches minRoleForPath/pathAllows,
// because the /cms/konten matrix row is exact and a query would silently
// fall through to the fail-closed catch-all.
import type { UserRole } from "../../lib/rbac";

/** String ids keep the config serializable; cms-icons.tsx maps id → Lucide. */
export type CmsIconId =
  | "layout-grid"
  | "file-text"
  | "square-play"
  | "square-check"
  | "image"
  | "clock"
  | "pencil"
  | "circle-check"
  | "diamond"
  | "user"
  | "rotate-cw"
  | "scroll-text"
  | "sliders-horizontal";

export type CmsMenuItem = {
  readonly id: string;
  readonly label: string;
  /** Link target; may carry the ?status= URL contract. */
  readonly href: string;
  /** Pathname only — what RBAC and active matching compare against. */
  readonly path: string;
  readonly icon: CmsIconId;
  /** Roles that see the item (the ✓ columns of the card table, verbatim). */
  readonly roles: readonly UserRole[];
};

export type CmsMenuGroup = {
  readonly id: string;
  /** Mono group label; null = the ungrouped Ringkasan row. */
  readonly label: string | null;
  readonly items: readonly CmsMenuItem[];
};

/** What the CMS shell components may know about the signed-in staff user. */
export type CmsUser = {
  name: string;
  role: UserRole;
};

// The ✓ columns of the card table. PENGIRIMAN is EDITOR exactly (not
// EDITOR+) — admins publish directly, so they get PENERBITAN instead.
const EDITOR_AND_UP: readonly UserRole[] = ["EDITOR", "ADMIN", "SUPER_ADMIN"];
const EDITOR_ONLY: readonly UserRole[] = ["EDITOR"];
const ADMIN_AND_UP: readonly UserRole[] = ["ADMIN", "SUPER_ADMIN"];
const SUPER_ADMIN_ONLY: readonly UserRole[] = ["SUPER_ADMIN"];

/**
 * THE CMS menu (card A-15 step 1 table, order and labels verbatim). No
 * counts on items (data arrives in S1); Materi and Terjadwal are not in the
 * MVP (Q42 / CMS-15) and Audit log is Super admin only (Q43).
 */
export const CMS_MENU: readonly CmsMenuGroup[] = [
  {
    id: "root",
    label: null,
    items: [
      {
        id: "ringkasan",
        label: "Ringkasan",
        href: "/cms",
        path: "/cms",
        icon: "layout-grid",
        roles: EDITOR_AND_UP,
      },
    ],
  },
  {
    id: "konten",
    label: "KONTEN",
    items: [
      {
        id: "artikel",
        label: "Artikel",
        href: "/cms/artikel",
        path: "/cms/artikel",
        icon: "file-text",
        roles: EDITOR_AND_UP,
      },
      {
        id: "kursus",
        label: "Kursus",
        href: "/cms/kursus",
        path: "/cms/kursus",
        icon: "square-play",
        roles: EDITOR_AND_UP,
      },
      {
        id: "quiz",
        label: "Quiz",
        href: "/cms/quiz",
        path: "/cms/quiz",
        icon: "square-check",
        roles: EDITOR_AND_UP,
      },
      {
        id: "media",
        label: "Media",
        href: "/cms/media",
        path: "/cms/media",
        icon: "image",
        roles: EDITOR_AND_UP,
      },
    ],
  },
  {
    id: "pengiriman",
    label: "PENGIRIMAN",
    items: [
      {
        id: "menunggu-persetujuan",
        label: "Menunggu persetujuan",
        href: "/cms/konten?status=menunggu",
        path: "/cms/konten",
        icon: "clock",
        roles: EDITOR_ONLY,
      },
      {
        id: "perlu-revisi",
        label: "Perlu revisi",
        href: "/cms/konten?status=perlu-revisi",
        path: "/cms/konten",
        icon: "pencil",
        roles: EDITOR_ONLY,
      },
    ],
  },
  {
    id: "penerbitan",
    label: "PENERBITAN",
    items: [
      {
        id: "persetujuan",
        label: "Persetujuan",
        href: "/cms/konten?status=menunggu",
        path: "/cms/konten",
        icon: "circle-check",
        roles: ADMIN_AND_UP,
      },
    ],
  },
  {
    id: "pengaturan",
    label: "PENGATURAN",
    items: [
      {
        id: "kategori",
        label: "Kategori",
        href: "/cms/kategori",
        path: "/cms/kategori",
        icon: "diamond",
        roles: ADMIN_AND_UP,
      },
      {
        id: "pengguna",
        label: "Pengguna & peran",
        href: "/cms/pengguna",
        path: "/cms/pengguna",
        icon: "user",
        roles: ADMIN_AND_UP,
      },
      {
        id: "reset-attempt",
        label: "Reset attempt",
        href: "/cms/reset-attempt",
        path: "/cms/reset-attempt",
        icon: "rotate-cw",
        roles: ADMIN_AND_UP,
      },
      {
        id: "audit-log",
        label: "Audit log",
        href: "/cms/audit-log",
        path: "/cms/audit-log",
        icon: "scroll-text",
        roles: SUPER_ADMIN_ONLY,
      },
      {
        id: "sistem",
        label: "Sistem",
        href: "/cms/pengaturan",
        path: "/cms/pengaturan",
        icon: "sliders-horizontal",
        roles: SUPER_ADMIN_ONLY,
      },
    ],
  },
];

/** Segment-boundary prefix match — the same rule minRoleForPath uses. */
function segmentMatches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function itemById(id: string): CmsMenuItem | null {
  for (const group of CMS_MENU) {
    const item = group.items.find((candidate) => candidate.id === id);
    if (item) return item;
  }
  return null;
}

/**
 * The menu item the shell treats as active (card A-15 step 3): `/cms` exact
 * → Ringkasan; segment-prefix per item otherwise. `/cms/konten` resolves by
 * `status` + role: perlu-revisi → Perlu revisi (EDITOR only — for ADMIN+ the
 * value is unknown and falls through to Persetujuan); menunggu / no status /
 * any unknown value → Menunggu persetujuan (EDITOR) or Persetujuan (ADMIN+).
 * The result is always an item the role may actually see, or null.
 */
export function getActiveCmsItem(
  pathname: string,
  status: string | null,
  role: UserRole,
): CmsMenuItem | null {
  let candidate: CmsMenuItem | null = null;
  if (pathname === "/cms") {
    candidate = itemById("ringkasan");
  } else if (segmentMatches(pathname, "/cms/konten")) {
    candidate =
      role === "EDITOR" && status === "perlu-revisi"
        ? itemById("perlu-revisi")
        : role === "EDITOR"
          ? itemById("menunggu-persetujuan")
          : itemById("persetujuan");
  } else {
    for (const group of CMS_MENU) {
      const item = group.items.find(
        (candidate) =>
          candidate.path !== "/cms" &&
          candidate.path !== "/cms/konten" &&
          segmentMatches(pathname, candidate.path),
      );
      if (item) {
        candidate = item;
        break;
      }
    }
  }
  return candidate && candidate.roles.includes(role) ? candidate : null;
}

/** The group an item belongs to (breadcrumb "KONTEN / ARTIKEL"), or null. */
export function cmsGroupOf(item: CmsMenuItem): CmsMenuGroup | null {
  return (
    CMS_MENU.find((group) =>
      group.items.some((candidate) => candidate.id === item.id),
    ) ?? null
  );
}

/**
 * Role label in the UI (PRD §3.2 v1.4): EDITOR is displayed as "Ahli gizi",
 * ADMIN as "Admin", SUPER_ADMIN as "Super admin". MEMBER carries no label —
 * callers hide the label element when this returns null.
 */
export function roleLabel(role: UserRole): string | null {
  switch (role) {
    case "EDITOR":
      return "Ahli gizi";
    case "ADMIN":
      return "Admin";
    case "SUPER_ADMIN":
      return "Super admin";
    default:
      return null;
  }
}
