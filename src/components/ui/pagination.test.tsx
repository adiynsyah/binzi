// @vitest-environment jsdom
import "./test-env";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PAGE_SIZE, Pagination, pageWindow } from "./pagination";

const noop = () => {};

describe("pageWindow", () => {
  it("shows every page when there are few", () => {
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("collapses long ranges around the current page", () => {
    expect(pageWindow(6, 20)).toEqual([1, "ellipsis", 5, 6, 7, "ellipsis", 20]);
    expect(pageWindow(1, 20)).toEqual([1, 2, "ellipsis", 20]);
    expect(pageWindow(20, 20)).toEqual([1, "ellipsis", 19, 20]);
    expect(pageWindow(2, 20)).toEqual([1, 2, 3, "ellipsis", 20]);
    expect(pageWindow(19, 20)).toEqual([1, "ellipsis", 18, 19, 20]);
  });
});

describe("Pagination", () => {
  it("exports the 9-per-page constant", () => {
    expect(PAGE_SIZE).toBe(9);
  });

  it("renders a labelled nav landmark with the current page marked", () => {
    render(
      <Pagination
        currentPage={6}
        totalPages={20}
        onPageChange={noop}
        label="Navigasi artikel"
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "Navigasi artikel" }),
    ).toBeTruthy();

    const current = screen.getByText("6");
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("5").getAttribute("aria-current")).toBeNull();

    // Long range → exactly two ellipses.
    expect(screen.queryAllByText("…")).toHaveLength(2);
  });

  it("disables previous on the first and next on the last page", () => {
    const first = render(
      <Pagination currentPage={1} totalPages={3} onPageChange={noop} label="Nav" />,
    );
    expect(
      screen
        .getByRole("button", { name: "Halaman sebelumnya" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Halaman berikutnya" })
        .hasAttribute("disabled"),
    ).toBe(false);
    first.unmount();

    render(
      <Pagination currentPage={3} totalPages={3} onPageChange={noop} label="Nav" />,
    );
    expect(
      screen
        .getByRole("button", { name: "Halaman sebelumnya" })
        .hasAttribute("disabled"),
    ).toBe(false);
    expect(
      screen
        .getByRole("button", { name: "Halaman berikutnya" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("reports page clicks from pages and edge buttons", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={2}
        totalPages={3}
        onPageChange={onPageChange}
        label="Nav"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Halaman berikutnya" }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);

    fireEvent.click(screen.getByText("1"));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });
});
