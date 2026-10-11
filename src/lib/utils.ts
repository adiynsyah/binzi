import { createCn } from "cn/config";

/*
 * BINZI token-aware class merging (docs/STATUS.md chore "extendTailwindMerge").
 *
 * The default tables only know Tailwind's built-in scales, so custom theme
 * tokens from src/styles/tokens.css survive cn() next to a later override —
 * and the stylesheet order silently picks the winner (PR #40: rounded-[8px]
 * lost to rounded-control). Registering the tokens puts them in the same
 * conflict groups as the built-in scales, restoring "last class wins" for
 * utilities like rounded-control / bg-surface-3 / max-w-content / shadow-menu.
 *
 * utils.test.ts reads tokens.css and asserts every token merges, so adding
 * a token there without listing it here fails the test.
 */

/** --radius-* roles; sm/md/lg/xl/2xl keep their default scale names. */
const RADII = ["pill", "card", "dialog", "control", "sheet"];

/** --shadow-* presets (menus/dropdowns and dialogs; cards use borders). */
const SHADOWS = ["menu", "dialog"];

/** --container-* widths (max-w-content). */
const CONTAINERS = ["content"];

/** All --color-* utilities (BINZI roles + shadcn aliases), per tokens.css. */
const COLORS = [
  "surface",
  "surface-2",
  "surface-3",
  "surface-disabled",
  "text",
  "text-muted",
  "text-body",
  "text-meta",
  "text-subtle",
  "text-nav",
  "border",
  "border-strong",
  "border-soft",
  "border-dashed",
  "primary",
  "primary-deep",
  "primary-tint",
  "success",
  "success-tint",
  "success-tint-text",
  "danger",
  "danger-tint",
  "danger-tint-text",
  "danger-tint-line",
  "warning",
  "warning-tint",
  "warning-tint-text",
  "warning-tint-line",
  "pending-tint",
  "pending-tint-text",
  "cycle-tint",
  "cycle-tint-text",
  "ink-surface",
  "ink-surface-text",
  "fill",
  "fill-soft",
  "scrim",
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "input",
  "ring",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
];

/** Corner-specific radius groups (rounded-t-sheet for the mobile sheet etc.). */
const CORNERS = [
  "s",
  "e",
  "t",
  "r",
  "b",
  "l",
  "ss",
  "se",
  "ee",
  "es",
  "tl",
  "tr",
  "br",
  "bl",
];

/** Conflict groups a BINZI color can appear in → group key maps to its prefix. */
const COLOR_GROUPS = {
  "bg-color": "bg",
  "text-color": "text",
  "border-color": "border",
  "ring-color": "ring",
  fill: "fill",
  stroke: "stroke",
} as const;

const classGroups = {
  rounded: [{ rounded: RADII }],
  shadow: [{ shadow: SHADOWS }],
  "max-w": [{ "max-w": CONTAINERS }],
  "min-w": [{ "min-w": CONTAINERS }],
  w: [{ w: CONTAINERS }],
  ...Object.fromEntries(
    CORNERS.map((corner) => [
      `rounded-${corner}`,
      [{ [`rounded-${corner}`]: RADII }],
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(COLOR_GROUPS).map(([group, prefix]) => [
      group,
      [{ [prefix]: COLORS }],
    ]),
  ),
};

export const cn = createCn({ extend: { classGroups } });
