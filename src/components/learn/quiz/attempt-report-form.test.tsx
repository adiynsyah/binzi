// @vitest-environment jsdom
import "../../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AttemptReportForm } from "./attempt-report-form";

// Card S3-03 §5: the 7i report form — category required, story ≥ 20
// characters (the server's own Zod contract, so nothing invalid reaches
// fetch), the exact POST body, success → reset + refresh, and the 409 /
// 401 / other error copy.

const mockRouter = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

const fetchMock = vi.fn();
const ATTEMPT_ID = "3f2c8f4e-8b1a-4c8e-9a51-0d6c2e7b9a10";
const STORY = "Halaman berubah putih setelah menekan tombol kumpulkan.";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function responseOf(status: number) {
  return { ok: status < 400, status, json: async () => ({}) } as unknown as Response;
}

function renderForm() {
  return render(
    <AttemptReportForm attemptId={ATTEMPT_ID} cancelHref="/belajar/k/m/quiz" />,
  );
}

function storyBox(): HTMLTextAreaElement {
  return screen.getByLabelText(/Ceritakan singkat/) as HTMLTextAreaElement;
}

function fill(category: string | null, story: string) {
  if (category) fireEvent.click(screen.getByLabelText(category));
  fireEvent.change(storyBox(), { target: { value: story } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Kirim laporan" }));
}

describe("AttemptReportForm", () => {
  it("renders the four categories in a fieldset with a legend, none preselected", () => {
    renderForm();
    const group = screen.getByRole("group", { name: "Apa yang terjadi?" });
    const radios = group.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(4);
    expect([...radios].some((radio) => (radio as HTMLInputElement).checked)).toBe(false);
    expect(screen.getByLabelText("Lainnya")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Batal" }).getAttribute("href")).toBe(
      "/belajar/k/m/quiz",
    );
    expect(
      screen.getByRole("link", { name: "Syarat & Ketentuan" }).getAttribute("href"),
    ).toBe("/syarat-ketentuan");
  });

  it("kategori wajib: no category → error on the group, no fetch", async () => {
    renderForm();
    fill(null, STORY);
    submit();
    expect(await screen.findByText("Pilih apa yang terjadi.")).toBeTruthy();
    const group = screen.getByRole("group", { name: "Apa yang terjadi?" });
    expect(group.getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cerita < 20 karakter → error, no fetch", async () => {
    renderForm();
    fill("Lainnya", "terlalu pendek");
    submit();
    expect(await screen.findByText("Ceritakan minimal 20 karakter.")).toBeTruthy();
    expect(storyBox().getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sukses → exact POST, reset (kembali lagi → kosong) and refresh", async () => {
    fetchMock.mockResolvedValue(responseOf(201));
    renderForm();
    fill("Timer habis padahal baru mulai", `  ${STORY}  `);
    submit();
    await waitFor(() => expect(mockRouter.refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(`/api/quiz/attempts/${ATTEMPT_ID}/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category: "TIMER_ENDED_EARLY", description: STORY }),
    });
    await waitFor(() => expect(storyBox().value).toBe(""));
    expect(
      (screen.getByLabelText("Timer habis padahal baru mulai") as HTMLInputElement)
        .checked,
    ).toBe(false);
  });

  it.each([
    [409, "Attempt ini sudah dilaporkan."],
    [401, "Sesi Anda berakhir. Muat ulang halaman untuk masuk lagi."],
    [500, "Terjadi kesalahan. Coba lagi."],
  ])("%i → %s, no refresh", async (status, message) => {
    fetchMock.mockResolvedValue(responseOf(status));
    renderForm();
    fill("Lainnya", STORY);
    submit();
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining(message),
    );
    expect(mockRouter.refresh).not.toHaveBeenCalled();
    // The input stays for a retry.
    expect(storyBox().value).toBe(STORY);
  });

  it("a network failure shows the generic error", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    renderForm();
    fill("Lainnya", STORY);
    submit();
    expect(await screen.findByText("Terjadi kesalahan. Coba lagi.")).toBeTruthy();
  });
});
