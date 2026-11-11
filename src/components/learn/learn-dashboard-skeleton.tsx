"use client";

// LearnDashboardSkeleton (card S5-01 §2, pattern 28d) — the loading.tsx
// body for /belajar. Renders NOTHING for the first SKELETON_DELAY_MS (fast
// navigations skip the flicker), then mimics the 28a layout shape so
// nothing jumps when the dashboard lands: heading line, paragraph line,
// featured card, and — ≥ 1024 — the two right-column rows.
//
// NEUTRAL card (border + surface), not the featured card's primary-tint:
// 28d's rule is a placeholder for the SHAPE, and flashing red at every
// member navigation would read as an error state.
import { PageContainer } from "@/components/shared/page-container";
import {
  Skeleton,
  SkeletonList,
  SkeletonRow,
  useSkeletonDelay,
} from "@/components/ui/skeleton";

export function LearnDashboardSkeleton() {
  const visible = useSkeletonDelay(true);
  if (!visible) return null;

  return (
    <PageContainer className="pt-8">
      {/* Same shape as the dashboard it stands in for: the heading and
          intro paragraph span BOTH columns, the two-column grid (with its
          right-column rows) starts mt-8 below them. */}
      <Skeleton className="h-8 w-64 rounded-control" />
      <Skeleton className="mt-4 h-4 w-2/3" />
      <SkeletonList className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {/* Featured card twin: image block (120px stacked < 640, 190px
              side-by-side from 640) + text lines + a button block. */}
          <div className="grid overflow-hidden rounded-card border border-border bg-surface sm:grid-cols-[236px_minmax(0,1fr)]">
            <Skeleton className="h-[120px] w-full rounded-none sm:h-[190px]" />
            <div className="p-4 sm:p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-2/3" />
              <Skeleton className="mt-2 h-4 w-1/2" />
              <Skeleton className="mt-5 h-12 w-32 rounded-control" />
            </div>
          </div>
        </div>
        <div className="hidden flex-col gap-7 lg:flex">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </SkeletonList>
    </PageContainer>
  );
}
