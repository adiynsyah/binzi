"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

/*
 * Pagination (card A-06, screen 5h): lists page 9 items at a time —
 * PAGE_SIZE is exported so future server queries share one constant.
 * Accessibility: a labelled <nav> landmark, aria-current="page" on the
 * active page, named previous/next buttons (disabled at the edges), and
 * every target at least 44×44 (TOKENS.md touch minimum). Page numbers
 * use IBM Plex Mono (numbers role, TOKENS.md → "Tipografi").
 */

/** Lists paginate 9 items per page (card A-06 / screen 5h). */
export const PAGE_SIZE = 9;

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Accessible name for the <nav> landmark, e.g. "Navigasi artikel". */
  label: string;
  className?: string;
};

/**
 * Page list with ellipses: `1 … 4 5 6 … 20`. The first and last page are
 * always reachable; a one-page window moves around the current page.
 */
export function pageWindow(
  current: number,
  total: number,
): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];
  if (current > 3) pages.push("ellipsis");
  for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page++) {
    pages.push(page);
  }
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

const pageButtonClass =
  "grid min-h-11 min-w-11 place-items-center rounded-control border font-mono text-sm transition-colors duration-200 ease-out disabled:cursor-not-allowed disabled:pointer-events-none disabled:border-transparent disabled:bg-surface-disabled disabled:text-text-subtle";

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  label,
  className,
}: PaginationProps) {
  return (
    <nav aria-label={label} className={cn("flex flex-wrap items-center gap-2", className)}>
      <button
        type="button"
        aria-label="Halaman sebelumnya"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className={cn(pageButtonClass, "bg-surface text-text hover:bg-fill")}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </button>

      {pageWindow(currentPage, totalPages).map((page, index) =>
        page === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            aria-hidden="true"
            className="grid min-h-11 min-w-11 place-items-center font-mono text-sm text-text-subtle"
          >
            …
          </span>
        ) : (
          <button
            key={page}
            type="button"
            aria-current={page === currentPage ? "page" : undefined}
            onClick={() => onPageChange(page)}
            className={cn(
              pageButtonClass,
              page === currentPage
                ? // Active page: solid dark pill, white text (contrast rule).
                  "border-transparent bg-text text-surface"
                : "border-border-strong bg-surface text-text hover:bg-fill",
            )}
          >
            {page}
          </button>
        ),
      )}

      <button
        type="button"
        aria-label="Halaman berikutnya"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className={cn(pageButtonClass, "bg-surface text-text hover:bg-fill")}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </nav>
  );
}
