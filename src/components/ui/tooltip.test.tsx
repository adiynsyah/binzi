// @vitest-environment jsdom
import "./test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

function renderTooltip() {
  return render(
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="Artikel">
            A
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          Artikel
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  );
}

describe("Tooltip", () => {
  it("hides the label until the trigger is focused", () => {
    renderTooltip();

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows the label on keyboard focus", async () => {
    renderTooltip();
    fireEvent.focus(screen.getByRole("button", { name: "Artikel" }));

    expect(await screen.findByRole("tooltip")).toBeTruthy();
    expect(screen.getByRole("tooltip").textContent).toBe("Artikel");
  });

  it("hides the label again after the trigger loses focus", async () => {
    renderTooltip();
    const trigger = screen.getByRole("button", { name: "Artikel" });
    fireEvent.focus(trigger);
    await screen.findByRole("tooltip");

    fireEvent.blur(trigger);
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });
});
