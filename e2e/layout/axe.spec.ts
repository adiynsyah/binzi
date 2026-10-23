// axe-core WCAG 2.1 A/AA (card A-19b §6) — runs in w360 and w1280 (config
// testIgnore). The nine card pages (6 guest + /belajar + /cms + the 403)
// are scanned per width, plus the open menu/drawer states at w360, with
// ALL rules active (no disableRules; the only `exclude` is the Turnstile
// container — cross-origin Cloudflare iframe). Everything serious/critical
// fails EXCEPT the color-contrast nodes listed in KNOWN_CONTRAST_FINDINGS
// below: a pre-existing src token problem (small `text-primary`/white-on-
// primary ≈ 3.8:1 and `text-text-subtle` micro text ≈ 3.6–3.8:1, both
// under the 4.5:1 AA bar) that is out of A-19b scope and queued as a
// separate token-fix chore (owner decision, full table in the PR). The
// list is SELF-PRUNING: every entry is also asserted to still fire, so
// once the chore lands the tests force the list to be emptied — and any
// NEW serious/critical violation (contrast included, on any other
// element) fails immediately.
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { TestInfo } from "@playwright/test";

import { createRoleAccount, expect, signInViaApi, test } from "../fixtures";
import {
  GUEST_PAGES,
  TURNSTILE_CONTAINER,
  openAccountDrawer,
  openCmsDrawer,
  openGuestMenu,
  widthSpecOf,
} from "./helpers";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

/** One known finding: the axe target selector (verbatim from analyze()). */
type KnownFinding = readonly [target: string, note: string];

/**
 * Baseline of the KNOWN serious color-contrast findings, keyed
 * `"${axeLabel} @${projectName}"`. Targets are axe's own selectors for the
 * DOM as rendered today — captured from two identical runs (stable). When
 * the token-fix chore lands, the stale-entry assertion below forces this
 * table to be pruned entry by entry.
 */
const KNOWN_CONTRAST_FINDINGS: Readonly<
  Record<string, readonly KnownFinding[]>
> = {
  // ---- guest auth pages ----------------------------------------------
  // "Daftar gratis" (login-form) — text-primary #f04030 on white 3.83:1.
  "tamu /masuk @w1280": [
    [String.raw`.mt-2\.5 > .text-primary.hover\:text-primary-deep[href$="daftar"]`, "Daftar gratis (text-primary)"],
    [String.raw`a[href$="lupa-password"]`, "Lupa password? (text-primary)"],
  ],
  "tamu /masuk @w360": [
    [String.raw`.mt-6.text-center.text-text-muted > .text-primary.hover\:text-primary-deep[href$="daftar"]`, "Daftar gratis (text-primary)"],
    [String.raw`a[href$="lupa-password"]`, "Lupa password? (text-primary)"],
  ],
  // "Masuk di sini." + S&K/Privasi (register-form) — text-primary 3.83:1.
  "tamu /daftar @w1280": [
    [String.raw`.mt-10 > .hover\:text-primary-deep[href$="masuk"]`, "Masuk di sini. (text-primary)"],
    [String.raw`.underline.underline-offset-2.text-primary:nth-child(1)`, "Syarat & Ketentuan (text-primary)"],
    [String.raw`.underline.underline-offset-2.text-primary:nth-child(2)`, "Kebijakan Privasi (text-primary)"],
  ],
  "tamu /daftar @w360": [
    [String.raw`.text-center > .hover\:text-primary-deep[href$="masuk"]`, "Masuk di sini. (text-primary)"],
    [String.raw`.underline.underline-offset-2.text-primary:nth-child(1)`, "Syarat & Ketentuan (text-primary)"],
    [String.raw`.underline.underline-offset-2.text-primary:nth-child(2)`, "Kebijakan Privasi (text-primary)"],
  ],
  // "Google" toggle (forgot-password-form) — text-primary 3.83:1; the
  // w360 panel also shows the "Masuk" back link.
  "tamu /lupa-password @w1280": [
    [String.raw`button[type="button"]`, "tombol Google (text-primary)"],
  ],
  "tamu /lupa-password @w360": [
    [String.raw`.text-center > a`, "Masuk (kembali, text-primary)"],
    [String.raw`button[type="button"]`, "tombol Google (text-primary)"],
  ],
  // w360 only: the compact panel carries a "Masuk" link.
  "tamu /reset-password @w360": [
    [String.raw`.text-primary`, "Masuk (kembali, text-primary)"],
  ],
  // ---- home & 403 -----------------------------------------------------
  // Header "Daftar Gratis" pill — white on bg-primary #f04030 3.83:1.
  "tamu / @w1280": [
    [String.raw`.bg-primary`, "pil Daftar Gratis header (primary-foreground di bg-primary)"],
  ],
  // "Kembali ke Beranda" (forbidden.tsx) — white on bg-primary 3.83:1.
  "403 @w1280": [
    [String.raw`a`, "Kembali ke Beranda (primary-foreground di bg-primary)"],
  ],
  "403 @w360": [
    [String.raw`a`, "Kembali ke Beranda (primary-foreground di bg-primary)"],
  ],
  // ---- CMS --------------------------------------------------------------
  // Status chips (badge-status) & "Ringkasan" label — text-text-subtle
  // #8a8378 on white/tint 3.59–3.75:1 at 10.5–11.5px mono.
  "EDITOR /cms @w1280": [
    [String.raw`.pl-4 > .rounded-\[5px\].px-\[7px\].py-\[3px\]`, "chip status (text-text-subtle)"],
    [String.raw`p`, "label Ringkasan (text-text-subtle)"],
  ],
  "EDITOR /cms @w360": [
    [String.raw`.gap-2 > .rounded-\[5px\].px-\[7px\].py-\[3px\]`, "chip status (text-text-subtle)"],
  ],
  "drawer CMS terbuka @w360": [
    [String.raw`.gap-2 > .rounded-\[5px\].px-\[7px\].py-\[3px\]`, "chip status (text-text-subtle)"],
    [String.raw`.h-\[68px\].gap-3.border-b > .rounded-\[5px\].px-\[7px\].py-\[3px\]`, "chip status bar atas (text-text-subtle)"],
  ],
  // ---- open menus (w360) -----------------------------------------------
  // Guest mobile menu: "Daftar Gratis" button + "Konsultasi di beranda ↓"
  // hint; account drawer: the same hint row style.
  "menu ponsel terbuka @w360": [
    [String.raw`.bg-primary.hover\:bg-primary-deep.min-h-\(--height-button-secondary\)`, "tombol Daftar Gratis (primary-foreground di bg-primary)"],
    [String.raw`.mt-0\.5`, "hint 'di beranda ↓' (text-text-subtle)"],
  ],
  "drawer akun terbuka @w360": [
    [String.raw`.mt-0\.5`, "hint 'di beranda ↓' (text-text-subtle)"],
  ],
};

/** Violation digest for logs/attachments (id, impact, targets count). */
function digest(
  violations: Awaited<ReturnType<typeof runAxe>>,
): string {
  return violations
    .map((v) => `${v.impact} ${v.id} (${v.nodes.length} node)`)
    .join(", ");
}

async function runAxe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags([...AXE_TAGS])
    .exclude(TURNSTILE_CONTAINER)
    .analyze();
  return results.violations;
}

/**
 * Asserts: (a) every known color-contrast finding still fires (stale
 * entries fail — prune the table when the token chore lands), and (b) no
 * serious/critical violation exists OUTSIDE the known list (new findings,
 * including contrast on other elements, stay red). Moderate/minor are
 * attached to the report and logged for the PR listing.
 */
async function expectAxeClean(
  page: Page,
  label: string,
  testInfo: TestInfo,
): Promise<void> {
  const violations = await runAxe(page);
  const key = `${label} @${testInfo.project.name}`;
  const known = KNOWN_CONTRAST_FINDINGS[key] ?? [];
  const knownTargets = new Set(known.map(([target]) => target));

  const contrastNodes =
    violations.find((v) => v.id === "color-contrast")?.nodes ?? [];
  const seenTargets = new Set(contrastNodes.map((n) => n.target.join(" > ")));

  // (a) self-pruning guard.
  const stale = known.filter(([target]) => !seenTargets.has(target));
  expect
    .soft(
      stale.map(([target, note]) => `${target} (${note})`),
      `${key}: entri KNOWN_CONTRAST_FINDINGS yang tidak muncul lagi — pangkas daftar (token sudah diperbaiki?)`,
    )
    .toEqual([]);

  // (b) everything serious/critical outside the list must be empty.
  const rest = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .flatMap((v) =>
      v.nodes
        .filter(
          (n) =>
            !(
              v.id === "color-contrast" &&
              knownTargets.has(n.target.join(" > "))
            ),
        )
        .map((n) => `${v.impact} ${v.id}: ${n.target.join(" > ")}`),
    );
  expect
    .soft(rest, `${label}: serious/critical di luar daftar known`)
    .toEqual([]);

  if (violations.length > 0) {
    console.log(`[axe] ${key}: ${digest(violations)}`);
    await testInfo.attach(`axe-${label}`, {
      body: JSON.stringify(violations, null, 2),
      contentType: "application/json",
    });
  }
}

test.describe("axe WCAG 2.1 A/AA", () => {
  test("halaman tamu (6)", async ({ page }, testInfo) => {
    for (const path of GUEST_PAGES) {
      await test.step(path, async () => {
        await page.goto(path);
        await expectAxeClean(page, `tamu ${path}`, testInfo);
      });
    }
  });

  test("MEMBER: /belajar, 403, dan (w360) drawer akun terbuka", async (
    { page, request },
    testInfo,
  ) => {
    const spec = widthSpecOf(testInfo.project.name);
    const account = await createRoleAccount(request, "MEMBER");
    await signInViaApi(page.context(), account);

    await test.step("/belajar", async () => {
      await page.goto("/belajar");
      await expectAxeClean(page, "MEMBER /belajar", testInfo);
    });

    if (spec.account === "drawer") {
      await test.step("/belajar drawer akun terbuka", async () => {
        await openAccountDrawer(page);
        await expectAxeClean(page, "drawer akun terbuka", testInfo);
      });
    }

    await test.step("403 (/cms sebagai MEMBER)", async () => {
      await page.goto("/cms");
      await expect(
        page.getByRole("heading", { name: "Akses ditolak" }),
      ).toBeVisible();
      await expectAxeClean(page, "403", testInfo);
    });
  });

  test("EDITOR: /cms dan (w360) drawer CMS terbuka", async (
    { page, request },
    testInfo,
  ) => {
    const spec = widthSpecOf(testInfo.project.name);
    const account = await createRoleAccount(request, "EDITOR");
    await signInViaApi(page.context(), account);
    await page.goto("/cms");

    await expectAxeClean(page, "EDITOR /cms", testInfo);

    if (spec.cms === "bar") {
      await openCmsDrawer(page);
      await expectAxeClean(page, "drawer CMS terbuka", testInfo);
    }
  });

  test("tamu: menu ponsel terbuka (w360 saja)", async ({ page }, testInfo) => {
    const spec = widthSpecOf(testInfo.project.name);
    test.skip(!spec.header.bukaMenu, "state terbuka hanya di w360");
    await page.goto("/");
    await openGuestMenu(page);
    await expectAxeClean(page, "menu ponsel terbuka", testInfo);
  });
});
