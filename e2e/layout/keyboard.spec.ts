// Keyboard (card A-19b §5) — runs in w360 and w1280 (config testIgnore).
// The login flow runs WITHOUT a mouse along an EXPECTED stop list per
// width (owner decision): ONE Tab per stop + toBeFocused, so a stop that
// appears, disappears, or reorders fails by name. The Turnstile region is
// crossed with Tab until focus leaves it — at most 3 stops inside the
// region + 1 Tab to exit (≤ 4 presses); its inner stops are cross-origin
// and excluded from the indicator check (noted in the PR). Every other
// stop must show a visible focus indicator (helpers.focusIndicatorOf).
// /masuk has NO skip link (owner decision — the (auth) shell is
// chrome-less); the skip link is tested separately on / and /belajar,
// where it exists.
import { createRoleAccount, expect, signInViaApi, test } from "../fixtures";
import type { Locator, Page } from "@playwright/test";
import {
  TURNSTILE_CONTAINER,
  focusIndicatorOf,
  waitForMemberHeader,
} from "./helpers";

/** One expected Tab stop; `afterTurnstile` changes the approach (below). */
type Stop = {
  label: string;
  locator: Locator;
  /** Type into the field once focused. */
  type?: "email" | "password";
  /** Reached by Tabbing OUT of the Turnstile region, not by one Tab. */
  afterTurnstile?: boolean;
};

/**
 * Tabs to `stop`, asserts it holds focus and shows an indicator. For
 * `afterTurnstile` stops the Tab presses continue while focus stays inside
 * the Turnstile container — the widget contributes at most 3 stops (the
 * observed wrapper div, the iframe, a trailing wrapper), so up to 4
 * presses are allowed: 3 landing inside + the one that exits; the
 * toBeFocused below then proves the exit stopped exactly where expected.
 */
async function tabToStop(
  page: Page,
  stop: Stop,
  typed: { email: string; password: string },
): Promise<void> {
  if (stop.afterTurnstile) {
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press("Tab");
      const outside = await page.evaluate((container) => {
        const active = document.activeElement;
        return !(active instanceof Element) || active.closest(container) === null;
      }, TURNSTILE_CONTAINER);
      if (outside) break;
    }
  } else {
    await page.keyboard.press("Tab");
  }
  await expect(stop.locator, stop.label).toBeFocused();
  const indicator = await focusIndicatorOf(page);
  expect
    .soft(indicator.pass, `indikator fokus di ${stop.label}: ${indicator.reason}`)
    .toBe(true);
  if (stop.type) await page.keyboard.type(typed[stop.type]);
}

test.describe("keyboard", () => {
  test("masuk tanpa mouse: perhentian Tab sesuai lebar → Enter → /belajar", async ({
    page,
    request,
  }, testInfo) => {
    const account = await createRoleAccount(request, "MEMBER");
    await page.goto("/masuk");

    const submit = page.getByRole("button", { name: "Masuk", exact: true });

    // Expected stop order per width (owner decision). Only the first stop
    // differs: w360 starts at the ✕ back link, w1280 at the header's
    // "Daftar gratis"; from the Google button on the form is identical.
    const firstStop: Stop =
      testInfo.project.name === "w360"
        ? {
            label: "✕ Tutup",
            locator: page.getByRole("link", { name: "Tutup" }),
          }
        : {
            label: "Daftar gratis",
            locator: page.getByRole("link", { name: "Daftar gratis" }),
          };
    const finalStop: Stop = {
      label: "tombol Masuk (setelah keluar dari wilayah Turnstile)",
      locator: submit,
      afterTurnstile: true,
    };
    const stops: readonly Stop[] = [
      firstStop,
      {
        label: "Masuk dengan Google",
        locator: page.getByRole("button", { name: "Masuk dengan Google" }),
      },
      {
        label: "Email",
        locator: page.getByLabel("Email"),
        type: "email",
      },
      {
        label: "Lupa password?",
        locator: page.getByRole("link", { name: "Lupa password?" }),
      },
      {
        label: "Kata sandi",
        locator: page.locator("#login-password"),
        type: "password",
      },
      {
        label: "Tampilkan kata sandi",
        locator: page.getByRole("button", { name: "Tampilkan kata sandi" }),
      },
      finalStop,
    ];

    console.log(
      `[keyboard @${testInfo.project.name}] perhentian: ${stops
        .map((stop) => stop.label)
        .join(" → ")}`,
    );
    for (const stop of stops.slice(0, -1)) {
      await tabToStop(page, stop, {
        email: account.email,
        password: account.password,
      });
    }

    // The Turnstile token must arm the submit BEFORE the final Tab: a
    // disabled button is skipped by Tab (focus would sail past "Masuk" to
    // the card's "Daftar gratis" link — observed in the debug run).
    await expect(submit).toBeEnabled();
    await tabToStop(page, finalStop, {
      email: account.email,
      password: account.password,
    });

    // Enter submits from the keyboard.
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/belajar$/);
  });
});

test.describe("skip link 'Lewati ke konten utama'", () => {
  test("tamu di /: Tab → terlihat → Enter → fokus melewati header", async ({
    page,
  }) => {
    await page.goto("/");

    const skip = page.getByRole("link", {
      name: "Lewati ke konten utama",
    });
    // toBeVisible() alone would pass while the link sits translated
    // -200% OFFSCREEN — toBeInViewport proves the resting state is out of
    // view and focus:translate-y-0 actually slides it in (skip-link.tsx).
    await expect(skip, "skip link di luar viewport sebelum fokus").not.toBeInViewport();
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    await expect(skip, "skip link masuk viewport saat fokus").toBeInViewport();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#konten-utama$/);
    await page.keyboard.press("Tab");
    // Beranda is the A-14a placeholder (real content arrives in S6):
    // main#konten-utama currently holds ZERO focusable elements, so Tab
    // after the skip link correctly continues to the first focusable
    // AFTER main (a footer link). The invariant that holds today — and
    // the one that matters — is that focus has passed the header. When
    // S6 adds focusable content inside main, tighten this to the owner's
    // strict wording ("first element INSIDE #konten-utama").
    const landed = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof Element)) return false;
      const inHeader = active.closest("header") !== null;
      const main = document.querySelector("main#konten-utama");
      const inside = active.closest("#konten-utama") !== null;
      const after =
        main !== null &&
        (main.compareDocumentPosition(active) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0;
      return !inHeader && (inside || after);
    });
    expect(landed, "fokus berikutnya di dalam/setelah #konten-utama").toBe(true);
    const indicator = await focusIndicatorOf(page);
    expect.soft(indicator.pass, `indikator fokus: ${indicator.reason}`).toBe(true);
  });

  test("MEMBER di /belajar: Tab → terlihat → Enter → fokus melewati header", async ({
    page,
    request,
  }) => {
    const account = await createRoleAccount(request, "MEMBER");
    await signInViaApi(page.context(), account);
    await page.goto("/belajar");
    await waitForMemberHeader(page);

    const skip = page.getByRole("link", {
      name: "Lewati ke konten utama",
    });
    await expect(skip, "skip link di luar viewport sebelum fokus").not.toBeInViewport();
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    await expect(skip, "skip link masuk viewport saat fokus").toBeInViewport();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#konten-utama$/);
    await page.keyboard.press("Tab");
    // /belajar is still the A-14b stub (an h1, no focusables inside
    // <main> until S5). At w360 the bottom nav (< 768) supplies the next
    // focusable AFTER main. At w1280 NOTHING focusable follows main (the
    // nav is md:hidden and the (learn) shell has no footer), so the Tab
    // right after the skip link focuses nothing (activeElement = body)
    // and the NEXT Tab wraps to the skip link again. The invariant that
    // holds today — and the one that matters — is that focus did NOT
    // land in the header. Tighten to the strict wording ("first element
    // INSIDE #konten-utama") when S5 adds focusable content.
    const landed = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof Element)) return false;
      const inHeader = active.closest("header") !== null;
      const main = document.querySelector("main#konten-utama");
      const inside = active.closest("#konten-utama") !== null;
      const after =
        main !== null &&
        (main.compareDocumentPosition(active) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0;
      const isSkip =
        active instanceof HTMLAnchorElement &&
        active.getAttribute("href") === "#konten-utama";
      const isBody = active === document.body;
      return !inHeader && (inside || after || isSkip || isBody);
    });
    expect(landed, "fokus berikutnya di dalam/setelah #konten-utama").toBe(true);
    // At w1280 the Tab above focuses NOTHING (activeElement = body — see
    // the comment above); an indicator is only checkable on a real stop.
    const isBody = await page.evaluate(
      () => document.activeElement === document.body,
    );
    if (!isBody) {
      const indicator = await focusIndicatorOf(page);
      expect.soft(indicator.pass, `indikator fokus: ${indicator.reason}`).toBe(
        true,
      );
    }
  });
});
