// Beranda versi demo (card S6-01 §8) — chromium project only (1280×800,
// motion ACTIVE, per the config's testIgnore). The pause/reduced-motion
// behaviour lives here because the width projects run reducedMotion:
// "reduce" and e2e/layout/** only — this file is the one place where the
// illustration is expected to actually animate.
import AxeBuilder from "@axe-core/playwright";

import { expect, test, withE2eDb } from "./fixtures";
import {
  TURNSTILE_CONTAINER,
  expectNoHorizontalScroll,
  maybeScreenshot,
} from "./layout/helpers";

/** KSL-03/04: the exact redirect target for the seeded number + template. */
const EXPECTED_WA_URL =
  "https://wa.me/6280000000000?text=Halo%2C%20saya%20___%20dan%20ingin%20bertanya%20seputar%20gizi.%20Saya%20menemukan%20halaman%20ini%20dari%20BINZI.";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

/** Play states of every animation whose target lives inside the artwork. */
function illustrationAnimationStates(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const art = document.querySelector("[data-hero-illustration]");
    if (!art) return [];
    return document
      .getAnimations()
      .filter((animation) => {
        const effect = animation.effect;
        const target = effect instanceof KeyframeEffect ? effect.target : null;
        return target instanceof Element && art.contains(target);
      })
      .map((animation) => animation.playState);
  });
}

/** The quiz-score progress circle — the only stroke-dasharray:264 circle. */
const RING_SELECTOR = '[data-hero-illustration] circle[stroke-dasharray="264"]';

test.describe("beranda", () => {
  // §8 no. 1
  test("halaman: 200, h1, CTA, ilustrasi aria-hidden", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Belajar gizi dari penjelasan yang benar",
      }),
    ).toBeVisible();

    expect(
      await page
        .getByRole("link", { name: "Mulai Belajar Gratis" })
        .first()
        .getAttribute("href"),
    ).toBe("/daftar");
    expect(
      await page
        .getByRole("link", { name: "Baca Artikel" })
        .first()
        .getAttribute("href"),
    ).toBe("/artikel");

    await expect(page.locator("[data-hero-illustration]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  // §8 no. 2
  test("jeda: klik Jeda animasi → semua terhenti; klik lagi → bergerak", async ({
    page,
  }) => {
    await page.goto("/");

    const before = await illustrationAnimationStates(page);
    expect(
      before.filter((state) => state === "running").length,
      "ada animasi running sebelum jeda",
    ).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Jeda animasi" }).click();
    await expect(
      page.getByRole("button", { name: "Putar animasi" }),
    ).toBeVisible();
    const paused = await illustrationAnimationStates(page);
    // fill-mode "both" one-shot animations report "finished", never
    // "running" — the pause must leave NOTHING running and at least one
    // infinite animation actually paused.
    expect(
      paused.filter((state) => state === "running"),
      "tidak ada yang running saat dijeda",
    ).toEqual([]);
    expect(
      paused.filter((state) => state === "paused").length,
      "animasi tak hingga benar-benar paused",
    ).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Putar animasi" }).click();
    await expect(
      page.getByRole("button", { name: "Jeda animasi" }),
    ).toBeVisible();
    const resumed = await illustrationAnimationStates(page);
    expect(
      resumed.filter((state) => state === "running").length,
      "ada yang running lagi setelah diputar",
    ).toBeGreaterThan(0);
  });

  // §8 no. 3
  test("kurangi gerakan: tombol jeda hilang, semua diam, cincin 74px", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: "Jeda animasi" }),
    ).toBeHidden();

    const states = await illustrationAnimationStates(page);
    expect(
      states.filter((state) => state === "running"),
      "tidak ada animasi running saat gerakan dikurangi",
    ).toEqual([]);

    // Frame diam yang bermakna: cincin nilai berhenti di 72% (dashoffset 74).
    const dashoffset = await page.locator(RING_SELECTOR).evaluate((node) => {
      const circle = node instanceof SVGElement ? node : null;
      return circle ? getComputedStyle(circle).strokeDashoffset : null;
    });
    expect(dashoffset).toBe("74px");
  });

  // §8 no. 4 — serial: the invalid-value test restores the setting in its
  // finally, and the third GET proves the restoration.
  test.describe.serial("route /api/konsultasi/whatsapp", () => {
    test("302 ke wa.me dengan no-store", async ({ request }) => {
      const response = await request.get("/api/konsultasi/whatsapp", {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(302);
      expect(response.headers().location).toBe(EXPECTED_WA_URL);
      expect(response.headers()["cache-control"]).toContain("no-store");
    });

    test("setting \"0812\" → 503 fail-closed, lalu nilai asli dikembalikan", async ({
      request,
    }) => {
      // Read the ORIGINAL value first (tambahan 11): what gets restored is
      // exactly what was there, not an assumed seed literal.
      const rows = await withE2eDb(
        (sql) =>
          sql`select value from system_settings where key = 'consultation.whatsapp_number'`,
      );
      const original = rows[0]?.value as unknown;

      try {
        // to_jsonb('0812'::text): leading zeros are not a valid JSON number
        // cast — the value must land as a JSON STRING (same discipline the
        // service reads with).
        await withE2eDb(
          (sql) =>
            sql`update system_settings
                set value = to_jsonb('0812'::text)
                where key = 'consultation.whatsapp_number'`,
        );

        const response = await request.get("/api/konsultasi/whatsapp", {
          maxRedirects: 0,
        });
        expect(response.status()).toBe(503);
        expect(response.headers()["cache-control"]).toContain("no-store");
        const body = (await response.json()) as {
          error: { code: string; message: string };
        };
        expect(body.error.code).toBe("CONSULTATION_UNAVAILABLE");
      } finally {
        await withE2eDb((sql) =>
          original === undefined
            ? sql`delete from system_settings where key = 'consultation.whatsapp_number'`
            : sql`update system_settings
                  set value = ${JSON.stringify(original)}::jsonb
                  where key = 'consultation.whatsapp_number'`,
        );
      }

      // Restoration asserted twice: the row is byte-identical to the
      // original AND the route answers 302 again.
      const restored = await withE2eDb(
        (sql) =>
          sql`select value from system_settings where key = 'consultation.whatsapp_number'`,
      );
      expect(restored[0]?.value).toEqual(original);
      const after = await request.get("/api/konsultasi/whatsapp", {
        maxRedirects: 0,
      });
      expect(after.status()).toBe(302);
    });
  });

  // §8 no. 5 — KSL-14: the anchor may never land under the sticky header.
  for (const width of [1280, 360]) {
    test(`#${width}: #tanya-ahli-gizi terlihat, tidak tertutup header`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/#tanya-ahli-gizi");

      const heading = page.getByRole("heading", {
        name: "Tanya Ahli Gizi Kami",
      });
      await expect(heading).toBeVisible();
      await expect(heading).toBeInViewport();

      const headingBox = await heading.boundingBox();
      const headerBox = await page.locator("header").boundingBox();
      expect(headingBox, "h2 punya kotak").toBeTruthy();
      expect(headerBox, "header punya kotak").toBeTruthy();
      expect(
        headingBox!.y,
        "sisi atas h2 ≥ sisi bawah header sticky",
      ).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 0.5);
    });
  }

  // §8 no. 6 + tambahan 6: wrapper height equals the SCALED artwork (±1px)
  // at 360/640/768/1024/1280; at 1024 also no horizontal scroll, the h1
  // clear of the illustration column, and the beranda-w1024 screenshot.
  for (const width of [360, 640, 768, 1024, 1280]) {
    test(`#${width}: tinggi pembungkus = tinggi ilustrasi terskala (±1px)`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");

      const frameBox = await page.locator("[data-hero-frame]").boundingBox();
      const artBox = await page
        .locator("[data-hero-illustration]")
        .boundingBox();
      expect(frameBox, "pembungkus ada").toBeTruthy();
      expect(artBox, "ilustrasi ada").toBeTruthy();
      expect(
        Math.abs(frameBox!.height - artBox!.height),
        `tinggi pembungkus ${frameBox!.height} ≈ ilustrasi ${artBox!.height}`,
      ).toBeLessThanOrEqual(1);

      if (width === 1024) {
        await expectNoHorizontalScroll(page, "beranda @1024");
        const headingBox = await page
          .getByRole("heading", { level: 1 })
          .boundingBox();
        expect(
          headingBox!.x + headingBox!.width,
          "teks h1 berakhir sebelum kolom ilustrasi",
        ).toBeLessThanOrEqual(frameBox!.x + 0.5);
        await maybeScreenshot(page, "beranda-w1024", testInfo.project.name);
      }
    });
  }

  // §8 no. 7
  test("halaman segera hadir: 200, h1, noindex, nav current di /kursus", async ({
    page,
  }) => {
    const pages: readonly [string, string][] = [
      ["/kursus", "Kursus"],
      ["/artikel", "Artikel"],
      ["/tentang", "Tentang Kami"],
      ["/cari", "Cari"],
    ];
    for (const [path, title] of pages) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(
        page.getByRole("heading", { level: 1, name: title }),
      ).toBeVisible();
      await expect(
        page.locator('meta[name="robots"]'),
        `${path}: meta robots noindex`,
      ).toHaveAttribute("content", /noindex/);
    }

    await page.goto("/kursus");
    await expect(
      page.locator("header").getByRole("link", { name: "Kursus", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });

  // Tambahan 10: axe with the layout suite's tags on BOTH pause states —
  // the artwork text and the toggle button must stay clean whether the
  // scene is running or frozen. Same bar as axe.spec.ts: serious/critical
  // violations fail; anything else is attached for the PR listing.
  test("axe: bersih dengan animasi berjalan maupun dijeda", async (
    { page },
    testInfo,
  ) => {
    const expectClean = async (label: string) => {
      const results = await new AxeBuilder({ page })
        .withTags([...AXE_TAGS])
        .exclude(TURNSTILE_CONTAINER)
        .analyze();
      const serious = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );
      if (results.violations.length > 0) {
        await testInfo.attach(`axe-${label}`, {
          body: JSON.stringify(results.violations, null, 2),
          contentType: "application/json",
        });
      }
      expect(serious, `${label}: serious/critical`).toEqual([]);
    };

    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Jeda animasi" }),
    ).toBeVisible();
    await expectClean("beranda-berjalan");

    await page.getByRole("button", { name: "Jeda animasi" }).click();
    await expect(
      page.getByRole("button", { name: "Putar animasi" }),
    ).toBeVisible();
    await expectClean("beranda-dijeda");
  });
});
