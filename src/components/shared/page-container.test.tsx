// @vitest-environment jsdom
import "../ui/test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageContainer } from "./page-container";

describe("PageContainer", () => {
  it("keeps the 16/28/40 page padding outside the capped column", () => {
    const { container } = render(<PageContainer />);

    const outer = container.querySelector(":scope > div");
    const inner = outer?.firstElementChild;

    expect(outer?.className).toBe("px-4 sm:px-7 lg:px-10");
    expect(inner?.className).toContain("mx-auto max-w-content");
  });

  it("forwards className and the rest of the props to the inner column", () => {
    const { container } = render(
      <PageContainer className="flex items-center" data-testid="column">
        <p>Isi</p>
      </PageContainer>,
    );
    const inner = container.querySelector("[data-testid=column]");

    expect(inner?.className).toContain("flex");
    expect(inner?.className).toContain("max-w-content");
    expect(screen.getByText("Isi").parentElement).toBe(inner);
  });
});
