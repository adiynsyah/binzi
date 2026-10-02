// @vitest-environment jsdom
import "./test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

function renderMenu(onSelect?: () => void) {
  return render(
    <DropdownMenu>
      <DropdownMenuTrigger>Urutkan</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Urutkan</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onSelect}>Terbaru</DropdownMenuItem>
        <DropdownMenuItem disabled>Terkait</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Terpopuler</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
}

describe("DropdownMenu", () => {
  it("opens the menu from the trigger", async () => {
    renderMenu();
    // Radix opens on pointerdown (mouse), not on the click event alone.
    fireEvent.pointerDown(screen.getByRole("button", { name: "Urutkan" }), {
      button: 0,
    });

    expect(await screen.findByRole("menu")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Terbaru" })).toBeTruthy();
  });

  it("reports selection and closes", async () => {
    const onSelect = vi.fn();
    renderMenu(onSelect);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Urutkan" }), {
      button: 0,
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Terbaru" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });
});
