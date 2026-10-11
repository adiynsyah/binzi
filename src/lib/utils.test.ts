// Guards the BINZI token registration in utils.ts. The parity section reads
// src/styles/tokens.css (the single source of truth) and proves every theme
// token actually merges — a token added there without being registered in
// utils.ts fails here. Test strings avoid hex literals on purpose: lint:hex
// bans them everywhere under src/, including tests.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { cn } from "./utils";

const tokensCss = readFileSync(
  fileURLToPath(new URL("../styles/tokens.css", import.meta.url)),
  "utf8",
);

/** All names defined as `--<prefix>-<name>:` in tokens.css. */
function themeValues(prefix: string): string[] {
  const pattern = new RegExp(`^\\s*--${prefix}-([a-z0-9-]+):`, "gm");
  return [...tokensCss.matchAll(pattern)].flatMap((match) => match[1] ?? []);
}

// Default scale names keep working without registration; only the mapped
// values changed in tokens.css.
const RADIUS_DEFAULT_SCALE = new Set(["sm", "md", "lg", "xl", "2xl"]);

describe("cn — BINZI token class merging", () => {
  it("later arbitrary radius beats the radius token (PR #40 regression)", () => {
    expect(cn("rounded-control", "rounded-[8px]")).toBe("rounded-[8px]");
  });

  it("later radius token beats the earlier arbitrary radius", () => {
    expect(cn("rounded-[8px]", "rounded-control")).toBe("rounded-control");
  });

  it("radius token beats radius token", () => {
    expect(cn("rounded-card", "rounded-pill")).toBe("rounded-pill");
  });

  it("corner radius token merges with the corner scale", () => {
    expect(cn("rounded-t-sheet", "rounded-t-lg")).toBe("rounded-t-lg");
  });

  it("color token beats color token", () => {
    expect(cn("text-muted", "text-primary")).toBe("text-primary");
  });

  it("later arbitrary color beats the color token", () => {
    expect(cn("bg-primary", "bg-[rgb(1,2,3)]")).toBe("bg-[rgb(1,2,3)]");
  });

  it("border color tokens merge with each other", () => {
    expect(cn("border-border", "border-strong")).toBe("border-strong");
  });

  it("later arbitrary width beats the container token", () => {
    expect(cn("max-w-content", "max-w-[720px]")).toBe("max-w-[720px]");
  });

  it("shadow tokens merge with the shadow scale", () => {
    expect(cn("shadow-menu", "shadow-lg")).toBe("shadow-lg");
  });

  // Negative cases: classes in different conflict groups must both survive.
  it("keeps text color and arbitrary font-size (project typography pattern)", () => {
    expect(cn("text-muted", "text-[16px]")).toBe("text-muted text-[16px]");
  });

  it("keeps border color and border width", () => {
    expect(cn("border-border", "border-2")).toBe("border-border border-2");
  });

  it("keeps ring width and ring color", () => {
    expect(cn("ring-2", "ring-primary")).toBe("ring-2 ring-primary");
  });

  it("keeps clsx argument semantics (falsy/array/object)", () => {
    expect(
      cn("flex", false && "hidden", undefined, ["px-2"], {
        "py-1": true,
        grow: false,
      }),
    ).toBe("flex px-2 py-1");
  });
});

describe("cn — tokens.css parity", () => {
  it("registers every --radius-* role outside the default scale", () => {
    const radii = themeValues("radius").filter(
      (name) => !RADIUS_DEFAULT_SCALE.has(name),
    );
    expect(radii.length).toBeGreaterThan(0);
    for (const name of radii) {
      expect(cn(`rounded-${name}`, "rounded-lg"), `rounded-${name}`).toBe(
        "rounded-lg",
      );
    }
  });

  it("registers every --color-* token (BINZI roles + shadcn aliases)", () => {
    const colors = themeValues("color");
    expect(colors.length).toBeGreaterThan(0);
    for (const name of colors) {
      expect(cn(`bg-${name}`, "bg-black"), `bg-${name}`).toBe("bg-black");
      expect(cn(`text-${name}`, "text-white"), `text-${name}`).toBe(
        "text-white",
      );
    }
  });

  it("registers every --container-* width", () => {
    const containers = themeValues("container");
    expect(containers.length).toBeGreaterThan(0);
    for (const name of containers) {
      expect(cn(`max-w-${name}`, "max-w-lg"), `max-w-${name}`).toBe("max-w-lg");
    }
  });

  it("registers every --shadow-* preset", () => {
    const shadows = themeValues("shadow");
    expect(shadows.length).toBeGreaterThan(0);
    for (const name of shadows) {
      expect(cn(`shadow-${name}`, "shadow-lg"), `shadow-${name}`).toBe(
        "shadow-lg",
      );
    }
  });
});
