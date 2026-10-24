// Shared helpers for the A-19b layout specs. Everything here builds on the
// A-19 harness fixtures (the CSP collector keeps watching every page load)
// and the single per-width expectation table in e2e/layout/widths.ts.
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Locator, Page } from "@playwright/test";

import { expect } from "../fixtures";
import { widthSpecOf } from "./widths";

/** Card §2 guest pages (no token on /reset-password → expired state). */
export const GUEST_PAGES: readonly string[] = [
  "/",
  "/masuk",
  "/daftar",
  "/lupa-password",
  "/reset-password",
  "/daftar/verifikasi",
];

/** 40-char no-space name (A-14b lesson: 217px overflow at 360). */
export const LONG_NAME = "k".repeat(40);

/** The Turnstile widget container (cross-origin Cloudflare iframe). */
export const TURNSTILE_CONTAINER =
  '[aria-label="Verifikasi anti-robot Cloudflare Turnstile"]';

// ------------------------------------------------------------ measurements

/**
 * Waits until layout-affecting work is done before any pixel measurement:
 * web fonts change text metrics (and thus scrollWidth).
 */
export async function waitStableForMeasure(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
}

/**
 * §14.1: document.documentElement.scrollWidth <= clientWidth. `soft` keeps
 * later pages in a multi-step test reporting their own result instead of
 * aborting at the first failure.
 */
export async function expectNoHorizontalScroll(
  page: Page,
  label: string,
  soft = false,
): Promise<void> {
  await waitStableForMeasure(page);
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  const message = `${label}: scrollWidth ${scrollWidth} <= clientWidth ${clientWidth}`;
  if (soft) {
    expect.soft(scrollWidth, message).toBeLessThanOrEqual(clientWidth);
  } else {
    expect(scrollWidth, message).toBeLessThanOrEqual(clientWidth);
  }
}

/** §14.1: width AND height of the box must be >= 44px. */
export async function expectTouchTarget(
  locator: Locator,
  label: string,
): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, `${label}: rendered`).toBeTruthy();
  expect(box!.width, `${label}: width >= 44`).toBeGreaterThanOrEqual(44);
  expect(box!.height, `${label}: height >= 44`).toBeGreaterThanOrEqual(44);
}

/** Measure-only companion to expectTouchTarget (reported in the PR). */
export async function measureTarget(
  locator: Locator,
  label: string,
): Promise<string> {
  const box = await locator.boundingBox();
  const size = box
    ? `${Math.round(box.width)}×${Math.round(box.height)}`
    : "not rendered";
  console.log(`[touch] ${label}: ${size}`);
  return size;
}

/** |Δleft| and |Δtop| between two rects (px). */
export function rectDelta(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { dx: number; dy: number } {
  return { dx: Math.abs(a.x - b.x), dy: Math.abs(a.y - b.y) };
}

// -------------------------------------------------------------- screenshots

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "");
}

/**
 * Card §7: when E2E_SCREENSHOT_DIR is set, save a full-page screenshot for
 * the owner's visual review in Claude chat. Never committed; not a baseline.
 */
export async function maybeScreenshot(
  page: Page,
  name: string,
  projectName: string,
): Promise<void> {
  const dir = process.env.E2E_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await waitStableForMeasure(page);
  await page.screenshot({
    path: join(dir, `${sanitize(name)}-${projectName}.png`),
    fullPage: true,
  });
}

// ------------------------------------------------------------------ keyboard

type FocusCheck = {
  pass: boolean;
  reason: string;
  descriptor: string;
};

/**
 * Focus indicator of the CURRENT activeElement (owner decision): an outline
 * (style != none AND width >= 2px), OR a style that visibly changes between
 * the focused and unfocused state. box-shadow alone is NOT trusted (an
 * always-on shadow would false-pass). Stops inside the Turnstile region are
 * excluded (cross-origin widget: the iframe host AND the wrapper divs
 * Cloudflare injects, which can be focusable without an indicator) and
 * reported as such.
 */
export async function focusIndicatorOf(page: Page): Promise<FocusCheck> {
  return page.evaluate((turnstile: string) => {
    const el = document.activeElement;
    const describe = (element: Element): string => {
      const label =
        element.getAttribute("aria-label") ??
        (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 48);
      return `${element.tagName.toLowerCase()}${label ? ` "${label}"` : ""}`;
    };
    if (!(el instanceof HTMLElement)) {
      return {
        pass: false,
        reason: "no active element",
        descriptor: String(el),
      };
    }
    if (el.tagName === "IFRAME" || el.closest(turnstile) !== null) {
      return {
        pass: true,
        reason: "excluded (Turnstile cross-origin region)",
        descriptor: describe(el),
      };
    }
    const snapshot = () => ({
      outlineStyle: getComputedStyle(el).outlineStyle,
      outlineWidth: getComputedStyle(el).outlineWidth,
      boxShadow: getComputedStyle(el).boxShadow,
    });
    const focused = snapshot();
    const outlineWidth = parseFloat(focused.outlineWidth);
    if (
      focused.outlineStyle !== "none" &&
      !Number.isNaN(outlineWidth) &&
      outlineWidth >= 2
    ) {
      return { pass: true, reason: "outline", descriptor: describe(el) };
    }
    // Fallback: the style must differ from the unfocused state. blur/refocus
    // happen synchronously; values were captured before the blur.
    el.blur();
    const unfocused = snapshot();
    el.focus();
    const changed =
      focused.outlineStyle !== unfocused.outlineStyle ||
      focused.outlineWidth !== unfocused.outlineWidth ||
      focused.boxShadow !== unfocused.boxShadow;
    return {
      pass: changed,
      reason: changed ? "focus changes style" : "no visible focus indicator",
      descriptor: describe(el),
    };
  }, TURNSTILE_CONTAINER);
}

// -------------------------------------------------------------------- menus

/** MEMBER "/" first renders the guest header — wait for the swap (A-14b). */
export async function waitForMemberHeader(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Menu akun" })).toBeVisible();
}

/** Opens the guest mobile menu (< 640) and waits for its cover row. */
export async function openGuestMenu(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Buka menu" }).click();
  await expect(page.getByRole("button", { name: "Tutup menu" })).toBeVisible();
}

/** Opens the member account drawer (< 640). */
export async function openAccountDrawer(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Menu akun" }).click();
  await expect(
    page.getByRole("button", { name: "Tutup menu akun" }),
  ).toBeVisible();
}

/** Opens the member account dropdown (>= 640). */
export async function openAccountDropdown(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Menu akun" }).click();
  await expect(page.getByRole("menuitem", { name: "Keluar" })).toBeVisible();
}

/** Opens the CMS phone drawer (< 640). */
export async function openCmsDrawer(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Buka menu CMS" }).click();
  await expect(
    page.getByRole("button", { name: "Tutup menu CMS" }),
  ).toBeVisible();
}

/**
 * The VISIBLE CMS account-menu trigger (>= 640: the rail avatar button at
 * 640–1023, the sidebar user block at >= 1024). Both stay in the DOM
 * (CSS-hidden per breakpoint) and their accessible names differ (the rail
 * button carries aria-label="Menu akun", the sidebar one is named by its
 * text) — the stable shared handle is the Radix-set aria-haspopup="menu"
 * on the trigger inside the CMS <aside>, filtered to the rendered one.
 */
export function visibleCmsAccountTrigger(page: Page): Locator {
  return page.locator('aside button[aria-haspopup="menu"] >> visible=true');
}

/** Opens the CMS account menu (>= 640) and waits for its first item. */
export async function openCmsAccountMenu(page: Page): Promise<void> {
  await visibleCmsAccountTrigger(page).click();
  await expect(
    page.getByRole("menuitem", { name: "Lihat situs" }),
  ).toBeVisible();
}

/** The visible "Menu CMS" nav (role locators skip display:none navs). */
export function visibleCmsNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Menu CMS" });
}

/** widthSpecOf wrapper so specs never import widths.ts directly twice. */
export { widthSpecOf };
