// Keyboard (card A-19b §5) — runs in w360 and w1280 (config testIgnore).
// The login flow runs WITHOUT a mouse: Tab walks to Email, then to the
// password (passing "Lupa password?" between them), waits for the Turnstile
// token, then Enter on the submit button lands on /belajar. Every Tab stop
// must show a visible focus indicator (helpers.focusIndicatorOf; stops
// inside the Turnstile region are excluded — cross-origin widget, noted in
// the PR). /masuk has NO skip link (owner decision — the (auth) shell is
// chrome-less); the skip link is tested separately on / and /belajar,
// where it exists.
import { createRoleAccount, expect, signInViaApi, test } from "../fixtures";
import {
  focusIndicatorOf,
  walkTabUntil,
  waitForMemberHeader,
} from "./helpers";

test.describe("keyboard", () => {
  test("masuk tanpa mouse: Tab → email → password → Enter → /belajar", async ({
    page,
    request,
  }, testInfo) => {
    const account = await createRoleAccount(request, "MEMBER");
    await page.goto("/masuk");

    const email = page.getByLabel("Email");
    const password = page.locator("#login-password");
    const submit = page.getByRole("button", { name: "Masuk", exact: true });

    const stopsToEmail = await walkTabUntil(page, email, "Email");
    await page.keyboard.type(account.email);

    const stopsToPassword = await walkTabUntil(
      page,
      password,
      "Password (melewati 'Lupa password?')",
    );
    await page.keyboard.type(account.password);

    // Turnstile token arms the button; Enter submits from the keyboard.
    await expect(submit).toBeEnabled();
    const stopsToSubmit = await walkTabUntil(page, submit, "tombol Masuk");

    // The stop order (documented in the PR) — stdout lands in the report.
    console.log(
      `[keyboard @${testInfo.project.name}] stops:\n` +
        [...stopsToEmail, ...stopsToPassword, ...stopsToSubmit]
          .map((stop, index) => `  ${index + 1}. ${stop}`)
          .join("\n"),
    );

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/belajar$/);
  });
});

test.describe("skip link 'Lewati ke konten utama'", () => {
  test("tamu di /: Tab → terlihat → Enter → fokus di #konten-utama", async ({
    page,
  }) => {
    await page.goto("/");

    const skip = page.getByRole("link", {
      name: "Lewati ke konten utama",
    });
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    // The link slides into view when focused — that visibility IS its
    // indicator (plus the global focus-visible outline).
    await expect(skip).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#konten-utama$/);
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => {
      const active = document.activeElement;
      return (
        active instanceof Element && active.closest("#konten-utama") !== null
      );
    });
    expect(inside, "fokus berikutnya di dalam #konten-utama").toBe(true);
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
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#konten-utama$/);
    await page.keyboard.press("Tab");
    // /belajar is still the A-14b stub (an h1, no focusables inside
    // <main> until S5), so "first element INSIDE #konten-utama" degrades
    // to "first element AT OR AFTER #konten-utama" — the invariant that
    // matters is that focus has passed the header. Noted in the PR.
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
});
