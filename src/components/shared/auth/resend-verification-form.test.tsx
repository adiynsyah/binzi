// @vitest-environment jsdom
import "../../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResendVerificationForm } from "./resend-verification-form";
import { authClient } from "./auth-client";

// Card A-13: the 3c expired-verification state. The resend must go to the
// A-10 endpoint with /daftar/verifikasi as the destination so the fresh
// link lands back HERE, and the 3/hour bucket message (429) must be the
// shared one-hour copy.

vi.mock("./auth-client", () => ({
  authClient: { sendVerificationEmail: vi.fn() },
}));

const sendVerificationEmail = vi.mocked(authClient.sendVerificationEmail);

beforeEach(() => {
  vi.clearAllMocks();
});

function submit(email: string) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Kirim tautan verifikasi baru" }),
  );
}

describe("ResendVerificationForm", () => {
  it("shows the 3c copy", () => {
    render(<ResendVerificationForm />);
    expect(screen.getByText("Akun Anda belum aktif.")).toBeTruthy();
    expect(
      screen.getByText(
        "Kirim tautan verifikasi baru — yang lama otomatis dibatalkan.",
      ),
    ).toBeTruthy();
  });

  it("sends the resend to /daftar/verifikasi (the fresh link returns here)", async () => {
    sendVerificationEmail.mockResolvedValue({ data: null, error: null });
    render(<ResendVerificationForm />);
    submit("rina@email.com");
    await waitFor(() => {
      expect(sendVerificationEmail).toHaveBeenCalledWith({
        email: "rina@email.com",
        callbackURL: "/daftar/verifikasi",
      });
    });
    expect(
      screen.getByText(/Tautan verifikasi baru sudah dikirim/),
    ).toBeTruthy();
  });

  it("maps the 3/hour bucket to the one-hour copy", async () => {
    sendVerificationEmail.mockResolvedValue({
      data: null,
      error: { status: 429, code: "RATE_LIMITED" } as never,
    });
    render(<ResendVerificationForm />);
    submit("rina@email.com");
    expect(
      await screen.findByText("Terlalu banyak permintaan. Coba lagi dalam satu jam."),
    ).toBeTruthy();
  });
});
