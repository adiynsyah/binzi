// List pagination constants shared by all modules (A-08).
// Single source of truth for the 9-items-per-page design decision.
// src/components/ui/pagination.tsx still carries its own copy — switching it
// to import from here is tracked as leftover work in the A-08 PR.
export const PAGE_SIZE = 9;

/** Zero-based offset for a 1-based page number. */
export function offsetForPage(page: number): number {
  return (page - 1) * PAGE_SIZE;
}
