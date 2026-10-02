// @vitest-environment jsdom
import "./test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function renderTabs() {
  render(
    <Tabs defaultValue="berjalan">
      <TabsList>
        <TabsTrigger value="berjalan">Sedang berjalan</TabsTrigger>
        <TabsTrigger value="selesai">Selesai</TabsTrigger>
      </TabsList>
      <TabsContent value="berjalan">Konten sedang berjalan</TabsContent>
      <TabsContent value="selesai">Konten selesai</TabsContent>
    </Tabs>,
  );
}

describe("Tabs", () => {
  it("renders tab semantics with one selected tab", () => {
    renderTabs();
    expect(screen.getByRole("tablist")).toBeTruthy();
    const active = screen.getByRole("tab", {
      name: "Sedang berjalan",
      selected: true,
    });
    expect(active).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Selesai", selected: false }),
    ).toBeTruthy();
  });

  it("shows only the active panel", () => {
    renderTabs();
    // Radix keeps inactive panels in the DOM but hidden; role queries skip
    // hidden elements, text queries do not — so assert through the role.
    expect(
      screen.getByRole("tabpanel", { name: "Sedang berjalan" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("tabpanel", { name: "Selesai" }),
    ).toBeNull();
  });
});
