// Date/time formatting shared by email + CMS (card S1-08 §6).
//
// Deliberately WITHOUT "use client": the approval queue renders timestamps
// server-side only, so Intl always runs on Node with one ICU set — no
// Node-vs-browser hydration mismatch is possible (owner review addition).
// Pure function, no config imports: safe anywhere.

/** Formats a timestamp in WIB as "3 Okt 2026 14.05 WIB" (design 15a). */
export function formatWib(date: Date): string {
  const formatted = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date);
  return `${formatted.replace(/,\s*/, " ")} WIB`;
}
