"use client";

import { useState } from "react";
import { ChipFilter } from "../../../../components/ui/chip-filter";

/*
 * Interactive demos for /dev/ui. Handler props cannot cross the
 * server/client boundary, so stateful chip demos live in this client
 * module and the (server) page composes them.
 */

const FILTERS = ["Semua", "Sedang berjalan", "Selesai", "Belum dimulai"] as const;

export function ChipToggleDemo() {
  const [active, setActive] = useState<string | null>("Sedang berjalan");
  return (
    <div className="flex flex-wrap items-center gap-3">
      {FILTERS.map((label) => (
        <ChipFilter
          key={label}
          label={label}
          count={label === "Semua" ? 3 : 1}
          active={active === label}
          onClick={() => setActive(active === label ? null : label)}
        />
      ))}
    </div>
  );
}

export function RemovableChipDemo() {
  const [filters, setFilters] = useState(["Gizi ibu hamil", "MP-ASI"]);
  if (filters.length === 0) {
    return <p className="text-sm text-text-meta">Semua filter sudah dihapus.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      {filters.map((label) => (
        <ChipFilter
          key={label}
          label={label}
          onRemove={() => setFilters(filters.filter((f) => f !== label))}
        />
      ))}
    </div>
  );
}
