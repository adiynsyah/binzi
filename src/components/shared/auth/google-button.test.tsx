// @vitest-environment jsdom
import "../../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GoogleButton } from "./google-button";
import { authClient } from "./auth-client";

// Card C-08 f: the Google button's redirect lifecycle — loading until the
// browser leaves, restored on a failed start (with focus returned, since
// loading locks via disabled and drops focus to <body>) and on a page
// restored from the back-forward cache. The auth client is mocked; no
// network, no real redirect.

vi.mock("./auth-client", () => ({
  authClient: { signIn: { social: vi.fn() } },
}));

const signInSocial = vi.mocked(authClient.signIn.social);

function renderButton(overrides: Partial<Parameters<typeof GoogleButton>[0]> = {}) {
  const props = {
    label: "Masuk dengan Google",
    callbackURL: "/belajar",
    errorCallbackURL: "/masuk",
    ...overrides,
  };
  return render(<GoogleButton {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GoogleButton", () => {
  it("klik → 'Mengalihkan…' terkunci; klik kedua tidak memanggil ulang", () => {
    // Deferred: keep the flow in flight so the loading state is assertable
    // (a resolved promise would restore the button before assertions).
    signInSocial.mockImplementation(
      () => new Promise(() => {}) as never,
    );
    renderButton();

    const button = screen.getByRole("button", {
      name: /Masuk dengan Google/,
    }) as HTMLButtonElement;
    fireEvent.click(button);

    const loading = screen.getByRole("button", {
      name: "Mengalihkan…",
    }) as HTMLButtonElement;
    expect(loading).toBeTruthy();
    expect(loading.disabled).toBe(true);
    expect(loading.getAttribute("aria-busy")).toBe("true");

    // A second activation (jsdom's fireEvent fires through disabled) must
    // not start a second flow — the handler guards its own re-entry.
    fireEvent.click(loading);
    expect(signInSocial).toHaveBeenCalledTimes(1);
  });

  it("signIn.social error → tombol normal, fokus kembali, onError terpanggil", async () => {
    signInSocial.mockResolvedValue({
      data: null,
      error: { status: 500, code: "FAILED_TO_FETCH_ACCESS_TOKEN" } as never,
    });
    const onError = vi.fn();
    renderButton({ onError });

    fireEvent.click(
      screen.getByRole("button", { name: /Masuk dengan Google/ }),
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
      const restored = screen.getByRole("button", {
        name: /Masuk dengan Google/,
      }) as HTMLButtonElement;
      expect(restored.disabled).toBe(false);
    });
    // loading locked the button with disabled → focus had fallen to
    // <body>; the failure must put it back (owner decision, card C-08 f).
    // Focus lands in the effect AFTER the re-enabling commit, so poll.
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: /Masuk dengan Google/ }),
      );
    });
  });

  it("signIn.social throw → tombol normal dan onError terpanggil", async () => {
    signInSocial.mockRejectedValue(new Error("network down"));
    const onError = vi.fn();
    renderButton({ onError });

    fireEvent.click(
      screen.getByRole("button", { name: /Masuk dengan Google/ }),
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });
    const button = screen.getByRole("button", {
      name: /Masuk dengan Google/,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it("pageshow persisted → tombol kembali normal (back-forward cache)", () => {
    signInSocial.mockImplementation(
      () => new Promise(() => {}) as never,
    );
    renderButton();

    fireEvent.click(
      screen.getByRole("button", { name: /Masuk dengan Google/ }),
    );
    expect(
      screen.getByRole("button", { name: "Mengalihkan…" }),
    ).toBeTruthy();

    // jsdom has no PageTransitionEvent constructor: a plain Event with the
    // persisted property patched on stands in for the browser's restore.
    const fire = (persisted: boolean) => {
      const event = new Event("pageshow") as PageTransitionEvent;
      Object.defineProperty(event, "persisted", { value: persisted });
      fireEvent(window, event);
    };

    // A fresh load (persisted: false) must NOT un-stick the button — only
    // a restore from the back-forward cache may.
    fire(false);
    expect(
      screen.getByRole("button", { name: "Mengalihkan…" }),
    ).toBeTruthy();

    fire(true);
    expect(
      screen.getByRole("button", { name: /Masuk dengan Google/ }),
    ).toBeTruthy();
  });
});
