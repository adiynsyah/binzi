// @vitest-environment jsdom
import "./test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "./dialog";

function renderDialog() {
  return render(
    <Dialog>
      <DialogTrigger>Hapus draft</DialogTrigger>
      <DialogContent
        title="Hapus draft artikel?"
        description="Tindakan ini tidak bisa dibatalkan."
      >
        <DialogClose asChild>
          <button type="button">Biarkan</button>
        </DialogClose>
      </DialogContent>
    </Dialog>,
  );
}

function openDialog() {
  const trigger = screen.getByRole("button", { name: "Hapus draft" });
  fireEvent.click(trigger);
  return trigger;
}

describe("Dialog", () => {
  it("opens on trigger with the title as its accessible name", () => {
    renderDialog();
    openDialog();
    expect(
      screen.getByRole("dialog", { name: "Hapus draft artikel?" }),
    ).toBeTruthy();
  });

  it("links the description through aria-describedby", () => {
    renderDialog();
    openDialog();
    const dialog = screen.getByRole("dialog");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const node = describedBy ? document.getElementById(describedBy) : null;
    expect(node?.textContent).toContain("tidak bisa dibatalkan");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    renderDialog();
    const trigger = openDialog();
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document.body, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("closes from the labelled ✕ button", async () => {
    renderDialog();
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("locks page scroll while open (react-remove-scroll)", async () => {
    renderDialog();
    openDialog();
    // Radix locks body scroll via react-remove-scroll, which marks the
    // body element while a modal layer is active.
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(true);

    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() =>
      expect(document.body.hasAttribute("data-scroll-locked")).toBe(false),
    );
  });
});
