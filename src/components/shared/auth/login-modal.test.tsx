// @vitest-environment jsdom
import "../../ui/test-env";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoginModal } from "./login-modal";
import { authClient } from "./auth-client";

// Card A-13, screen 2c: the mid-flow login modal. Generic copy is the
// default (card note h); the S2 context props restore the full wording.
// No consumer pages exist yet — this locks the CONTRACT in.

vi.mock("./auth-client", () => ({
  authClient: {
    signIn: { social: vi.fn() },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const signInSocial = vi.mocked(authClient.signIn.social);

function renderModal(overrides: Partial<Parameters<typeof LoginModal>[0]> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    googleEnabled: true,
    ...overrides,
  };
  return render(<LoginModal {...props} />);
}

describe("LoginModal", () => {
  it("uses generic copy without S2 context (note h)", () => {
    renderModal();
    expect(
      screen.getByRole("dialog", { name: "Masuk untuk lanjut" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Belum punya akun? Mendaftar gratis."),
    ).toBeTruthy();
  });

  it("restores the full 2c wording with context props", () => {
    renderModal({ contextTitle: "Materi 2", courseName: "Gizi Seimbang" });
    expect(
      screen.getByRole("dialog", { name: "Masuk untuk lanjut ke Materi 2" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Belum punya akun? Mendaftar otomatis mendaftarkan Anda ke kursus Gizi Seimbang — gratis.",
      ),
    ).toBeTruthy();
  });

  it("starts the Google flow toward the requested page", () => {
    renderModal({ nextPath: "/belajar/gizi/materi-2" });
    fireEvent.click(
      screen.getByRole("button", { name: /Lanjut dengan Google/ }),
    );
    expect(signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/belajar/gizi/materi-2",
      errorCallbackURL: "/masuk?next=%2Fbelajar%2Fgizi%2Fmateri-2",
    });
  });

  it("sends the email path to /masuk carrying next", () => {
    renderModal({ nextPath: "/belajar/materi-1" });
    fireEvent.click(
      screen.getByRole("button", { name: "Masuk dengan email" }),
    );
    // Router is mocked; the click must not start a Google flow.
    expect(signInSocial).not.toHaveBeenCalled();
  });

  it("offers no Google action when the provider is inactive", () => {
    renderModal({ googleEnabled: false });
    expect(
      screen.queryByRole("button", { name: /Lanjut dengan Google/ }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Masuk dengan email" }),
    ).toBeTruthy();
  });
});
