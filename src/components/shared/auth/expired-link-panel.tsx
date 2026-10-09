import Link from "next/link";

import { buttonVariants } from "../../ui/button-variants";
import { cn } from "../../../lib/utils";

// 3c "tautan kedaluwarsa atau sudah dipakai" state for the reset link: the
// dark callout is the highest-contrast element on the page and its recovery
// action points back to the request form. Reached when /reset-password is
// opened with `?error=INVALID_TOKEN` (or without a token), or when the
// submit consumes an already-used/expired token (the form then redirects
// here with the error param).
//
// In this state the panel title IS the page's main heading: the (auth)
// page renders AuthShell without its own h1, so this h1 is the only one —
// never stack "Buat password baru" above an expired-link card.
//
// Sizing per 3c + TOKENS: title "Judul kartu" 19/1.3/900; supporting text
// carries ink-surface-text (titles stay white); the button takes the
// secondary band with 3c's exact metrics — height 46, side padding 18,
// radius 8 (via local --radius-control), 15px/700. TOKENS' 8–10 control
// band still holds everywhere else at the default 10.
export function ExpiredResetPanel() {
  return (
    <div role="status" className="rounded-card bg-text p-6 text-surface">
      <h1 className="text-[19px] leading-[1.3] font-black tracking-[-0.015em]">
        Tautan ini sudah tidak berlaku
      </h1>
      <p className="mt-2 text-sm text-ink-surface-text">
        Tautan reset berlaku 1 jam dan hanya bisa dipakai sekali. Minta tautan
        baru — password lama Anda masih aktif sampai diganti.
      </p>
      <Link
        href="/lupa-password"
        className={cn(
          buttonVariants({ variant: "secondary", size: "md" }),
          // 3c's radius (8) via a LOCAL --radius-control override — same
          // pattern as the ink panel's [--focus-ring:…] swap. A literal
          // rounded-[8px] would NOT work: tailwind-merge doesn't know
          // rounded-control is a radius utility, so both classes survive
          // cn() and the stylesheet order lets rounded-control (10) win.
          "mt-5 w-full min-h-[46px] px-[18px] text-[15px] [--radius-control:8px] sm:w-auto",
        )}
      >
        Minta tautan baru
      </Link>
    </div>
  );
}
