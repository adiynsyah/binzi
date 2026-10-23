// axe-core WCAG 2.1 A/AA (card A-19b §6) — runs in w360 and w1280 (config
// testIgnore). The nine card pages (6 guest + /belajar + /cms + the 403)
// are scanned per width, plus the open menu/drawer states at w360. Only
// serious/critical fail the tests; moderate/minor are attached to the
// Playwright report (JSON) and logged for the PR listing. The ONE
// exclusion is the Turnstile container (cross-origin Cloudflare iframe) —
// no other rule may be excluded. A serious/critical finding that comes
// from src/** stops the card (owner rule): report, do not silence.
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
 * Asserts no serious/critical violations; everything else is attached and
 * logged. Nothing is silenced here.
 */
async function expectAxeClean(
  page: Page,
  label: string,
  testInfo: TestInfo,
): Promise<void> {
  const violations = await runAxe(page);
  const blocking = violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );

  expect
    .soft(
      blocking.map((v) => `${v.impact} ${v.id}`),
      `${label}: serious/critical violations`,
    )
    .toEqual([]);

  if (violations.length > 0) {
    console.log(`[axe] ${label}: ${digest(violations)}`);
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
