// w1440 (card A-19b §1): the 1440 checkpoint is only required for Beranda
// and Masuk (definition of done in CLAUDE.md) — the other pages stay at
// w360–w1280. Runs only in the w1440 project (testMatch in the config).
import { expect, test } from "../fixtures";
import {
  expectNoHorizontalScroll,
  maybeScreenshot,
  widthSpecOf,
} from "./helpers";

const projectName = "w1440";
widthSpecOf(projectName); // throws on unknown project names

test.describe(`tanpa scroll horizontal @${projectName}`, () => {
  for (const path of ["/", "/masuk"]) {
    test(`tamu ${path}`, async ({ page }, testInfo) => {
      expect(testInfo.project.name).toBe(projectName);
      await page.goto(path);
      await expectNoHorizontalScroll(page, `tamu ${path} @${projectName}`);
      await maybeScreenshot(page, `tamu${path}`, projectName);
    });
  }
});
