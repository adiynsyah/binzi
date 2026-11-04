// axe-core WCAG 2.1 A/AA (card A-19b §6) — runs in w360 and w1280 (config
// testIgnore). The nine card pages (6 guest + /belajar + /cms + the 403)
// are scanned per width, plus the open menu/drawer states at w360, with
// ALL rules active (no disableRules; the only `exclude` is the Turnstile
// container — cross-origin Cloudflare iframe). Everything serious/critical
// fails the suite: the color-contrast findings A-19b had to excuse (small
// `text-primary`/white-on-primary ≈ 3.8:1 and `text-text-subtle` micro
// text ≈ 3.6–3.8:1, both under the 4.5:1 AA bar) were fixed by the C-07
// token change, so KNOWN_CONTRAST_FINDINGS below is empty. The exception
// mechanism stays for the future: every entry is asserted to still fire,
// and any NEW serious/critical violation (contrast included, on any
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
 * Exception list for KNOWN serious color-contrast findings, keyed
 * `"${axeLabel} @${projectName}"` — empty since C-07 closed every A-19b
 * finding. To add an entry, capture its axe target verbatim from
 * analyze(); the stale-entry assertion below then keeps the list honest:
 * an entry whose finding no longer fires fails the suite until it is
 * pruned.
 */
const KNOWN_CONTRAST_FINDINGS: Readonly<
  Record<string, readonly KnownFinding[]>
> = {};

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

    // Card S1-01: the course list WITH a row (table + badge states) and the
    // empty builder. A tokenized title/slug keeps width projects sharing
    // the e2e database from colliding.
    const token = `a${Date.now().toString(36)}${testInfo.project.name}`;
    const response = await page.context().request.post("/api/cms/courses", {
      data: {
        title: `${token} kursus uji axe`,
        slug: `${token}-kursus-uji-axe`,
        level: "BEGINNER",
        summary: "Ringkasan netral untuk tes e2e.",
      },
    });
    expect(response.status(), await response.text()).toBe(201);
    const courseId = ((await response.json()) as { data: { id: string } }).data.id;

    await page.goto("/cms/kursus");
    // Scope to the title cell paragraph: the course title now also sits in
    // an sr-only span inside the row's "Buka" link (unique accessible
    // names), which a bare getByText would match twice.
    await expect(
      page.getByRole("paragraph").filter({ hasText: `${token} kursus uji axe` }),
    ).toBeVisible();
    await expectAxeClean(page, "EDITOR /cms/kursus berisi", testInfo);

    await page.goto(`/cms/kursus/${courseId}`);
    await expect(
      page.locator('section[aria-labelledby="builder-materi-heading"]')
        .getByText("Belum ada materi")
    ).toBeVisible();
    await expectAxeClean(page, "EDITOR /cms/kursus/{id} builder", testInfo);
  });

  test("tamu: menu ponsel terbuka (w360 saja)", async ({ page }, testInfo) => {
    const spec = widthSpecOf(testInfo.project.name);
    test.skip(!spec.header.bukaMenu, "state terbuka hanya di w360");
    await page.goto("/");
    await openGuestMenu(page);
    await expectAxeClean(page, "menu ponsel terbuka", testInfo);
  });
});
