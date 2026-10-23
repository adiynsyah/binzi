// Width-project sanity (card A-19b §1, owner decision): the `page` fixture
// creates its own context, and Playwright fills every newContext option not
// passed explicitly from the project's `use` block — this test pins that
// guarantee per project so a config/fixture drift turns red instead of
// silently measuring at the wrong width.
import { expect, test } from "../fixtures";

import { widthSpecOf } from "./helpers";

test("project viewport matches e2e/layout/widths.ts", async (
  { page },
  testInfo,
) => {
  const spec = widthSpecOf(testInfo.project.name); // throws on unknown names
  expect(page.viewportSize(), testInfo.project.name).toEqual(spec.viewport);
});
