// @vitest-environment jsdom
import "../../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authClient } from "@/components/shared/auth/auth-client";

import { RevokeAllSessionsButton } from "./revoke-all-sessions-button";

// Card S5-05 (9e): revoke → signOut (cookie only, its error ignored) →
// /masuk + refresh, in exactly that order. A revoke failure keeps the user
// on the page with the one generic banner — signOut and navigation must
// not have run.

vi.mock("@/components/shared/auth/auth-client", () => ({
  authClient: { revokeSessions: vi.fn(), signOut: vi.fn() },
}));

const mockRouter = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

const revokeSessions = vi.mocked(authClient.revokeSessions);
const signOut = vi.mocked(authClient.signOut);

beforeEach(() => {
  vi.clearAllMocks();
});

function clickRevoke() {
  fireEvent.click(
    screen.getByRole("button", { name: "Keluar dari semua perangkat" }),
  );
}

describe("RevokeAllSessionsButton", () => {
  it("revokes, signs out for the cookie, then lands on /masuk — in that order", async () => {
    revokeSessions.mockResolvedValue({ data: null, error: null } as never);
    signOut.mockResolvedValue({
      data: { success: true },
      error: null,
    } as never);
    render(<RevokeAllSessionsButton />);
    clickRevoke();

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith("/masuk");
    });
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
    expect(revokeSessions).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
    const revokeOrder = revokeSessions.mock.invocationCallOrder[0]!;
    const signOutOrder = signOut.mock.invocationCallOrder[0]!;
    const replaceOrder = mockRouter.replace.mock.invocationCallOrder[0]!;
    const refreshOrder = mockRouter.refresh.mock.invocationCallOrder[0]!;
    expect(revokeOrder).toBeLessThan(signOutOrder);
    expect(signOutOrder).toBeLessThan(replaceOrder);
    expect(replaceOrder).toBeLessThan(refreshOrder);
  });

  it("a failing signOut does not strand the user — navigation still runs", async () => {
    revokeSessions.mockResolvedValue({ data: null, error: null } as never);
    signOut.mockResolvedValue({
      data: null,
      error: { status: 500, code: "INTERNAL_SERVER_ERROR" },
    } as never);
    render(<RevokeAllSessionsButton />);
    clickRevoke();

    // The sessions are already revoked; the cookie cleanup failing must
    // not turn the flow into a dead end.
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith("/masuk");
    });
  });

  it("a revoke failure stays on the page with the generic banner", async () => {
    revokeSessions.mockResolvedValue({
      data: null,
      error: { status: 500, code: "INTERNAL_SERVER_ERROR" },
    } as never);
    render(<RevokeAllSessionsButton />);
    clickRevoke();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Terjadi kesalahan. Coba lagi.")).toBeTruthy();
    expect(signOut).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });
});
