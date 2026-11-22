// @vitest-environment jsdom
import "../../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileNameForm } from "./profile-name-form";

// Card S5-05: the Data akun form — client-side name rules (required, ≤128,
// trimmed server-side anyway), the exact PATCH /api/user/profile call with
// body { name } ONLY, the success banner + refresh, and the two error
// surfaces (401 session-ended copy from StartCourseButton, one generic
// copy for everything else). The in-flight guard must survive a fetch that
// never settles.

const mockRouter = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function responseOf(status: number, ok = status < 400) {
  return { ok, status, json: async () => ({}) } as unknown as Response;
}

function fillName(value: string) {
  fireEvent.change(screen.getByLabelText("Nama lengkap"), {
    target: { value },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));
}

describe("ProfileNameForm", () => {
  it("rejects a blank name without calling the API", async () => {
    render(
      <ProfileNameForm
        name="Rina Tester"
        email="rina@example.com"
        emailVerified
      />,
    );
    fillName("   ");
    submit();
    expect(await screen.findByText("Nama wajib diisi")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects 129 characters without calling the API", async () => {
    render(
      <ProfileNameForm
        name="Rina Tester"
        email="rina@example.com"
        emailVerified
      />,
    );
    fillName("a".repeat(129));
    submit();
    expect(await screen.findByText("Nama maksimal 128 karakter")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("PATCHes exactly { name } and banners + refreshes on success", async () => {
    fetchMock.mockResolvedValue(responseOf(200));
    render(
      <ProfileNameForm
        name="Rina Tester"
        email="rina@example.com"
        emailVerified
      />,
    );
    fillName("Rina P. Tester");
    submit();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/user/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Rina P. Tester" }),
    });
    expect(await screen.findByText("Nama disimpan.")).toBeTruthy();
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
  });

  it("401 keeps the StartCourseButton session-ended copy", async () => {
    fetchMock.mockResolvedValue(responseOf(401));
    render(
      <ProfileNameForm
        name="Rina Tester"
        email="rina@example.com"
        emailVerified
      />,
    );
    fillName("Rina Baru");
    submit();
    expect(
      await screen.findByText(
        "Sesi Anda berakhir. Muat ulang halaman untuk masuk lagi.",
      ),
    ).toBeTruthy();
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it("500 collapses into the one generic copy", async () => {
    fetchMock.mockResolvedValue(responseOf(500));
    render(
      <ProfileNameForm
        name="Rina Tester"
        email="rina@example.com"
        emailVerified
      />,
    );
    fillName("Rina Baru");
    submit();
    expect(
      await screen.findByText(
        "Terjadi kesalahan. Coba lagi.",
      ),
    ).toBeTruthy();
  });

  it("a rejected fetch also lands on the generic copy", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(
      <ProfileNameForm
        name="Rina Tester"
        email="rina@example.com"
        emailVerified
      />,
    );
    fillName("Rina Baru");
    submit();
    expect(
      await screen.findByText(
        "Terjadi kesalahan. Coba lagi.",
      ),
    ).toBeTruthy();
  });

  it("locks the button while the request is in flight", async () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => {}));
    render(
      <ProfileNameForm
        name="Rina Tester"
        email="rina@example.com"
        emailVerified
      />,
    );
    fillName("Rina Baru");
    submit();
    const busy = (await screen.findByRole("button", {
      name: "Menyimpan…",
    })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
