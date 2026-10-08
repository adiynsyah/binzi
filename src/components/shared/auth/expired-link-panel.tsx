import Link from "next/link";

import { buttonVariants } from "../../ui/button";
import { cn } from "../../../lib/utils";

// 3c "tautan kedaluwarsa atau sudah dipakai" state for the reset link: the
// dark callout is the highest-contrast element on the page and its recovery
// action points back to the request form. Reached when /reset-password is
// opened with `?error=INVALID_TOKEN` (or without a token), or when the
// submit consumes an already-used/expired token.
export function ExpiredResetPanel() {
  return (
    <div role="status" className="rounded-card bg-text p-6 text-surface">
      <h2 className="text-[24px] leading-[1.24] font-black tracking-[-0.02em]">Tautan ini sudah tidak berlaku</h2>
      <p className="mt-3 text-sm">
        Tautan reset berlaku 1 jam dan hanya bisa dipakai sekali. Minta tautan
        baru — password lama Anda masih aktif sampai diganti.
      </p>
      <Link
        href="/lupa-password"
        className={cn(
          buttonVariants({ variant: "secondary" }),
          "mt-5 w-full sm:w-auto",
        )}
      >
        Minta tautan baru
      </Link>
    </div>
  );
}
