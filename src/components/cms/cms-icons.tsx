import {
  CircleCheck,
  Clock,
  Diamond,
  FileText,
  Image,
  LayoutGrid,
  Pencil,
  RotateCw,
  ScrollText,
  SlidersHorizontal,
  SquareCheck,
  SquarePlay,
  User,
  type LucideIcon,
} from "lucide-react";

import type { CmsIconId } from "./cms-nav";

/*
 * The menu config (cms-nav.ts) stores icons as string ids so the whole
 * config stays serializable across the server → client props boundary;
 * this map — client side only — is where the ids become Lucide line icons
 * (18px, stroke 1.8, matching the public side's icon weight).
 */
export const CMS_ICONS: Record<CmsIconId, LucideIcon> = {
  "layout-grid": LayoutGrid,
  "file-text": FileText,
  "square-play": SquarePlay,
  "square-check": SquareCheck,
  image: Image,
  clock: Clock,
  pencil: Pencil,
  "circle-check": CircleCheck,
  diamond: Diamond,
  user: User,
  "rotate-cw": RotateCw,
  "scroll-text": ScrollText,
  "sliders-horizontal": SlidersHorizontal,
};
