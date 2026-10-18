// Contract tests for the health & keep-alive endpoint logic (card A-18
// §1): status, JSON body, and `Cache-Control: no-store` asserted on the
// standard Response objects the routes actually send. Security cases from
// the card's "Selesai jika": the secret is checked before the ping runs,
// error details never reach the 503 body, a hanging ping is cut off after
// 5 s, and secret/header values never appear in console.* arguments.
// Fixture values only — never a real secret.
import { afterEach, describe, expect, it, vi } from "vitest";

import { getHealth, postKeepAlive } from "./health";

const SECRET = "fixture-cron-secret-0123456789abcdef";
const CONTRACT_503_BODY = {
  error: { code: "SERVICE_UNAVAILABLE", message: "Layanan sedang tidak tersedia." },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("getHealth", () => {
  it("200 { data: { status: 'ok' } } with Cache-Control: no-store when the ping succeeds", async () => {
    const response = await getHealth({ ping: () => Promise.resolve() });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: { status: "ok" } });
  });

  it("503 contract body without internal details; the original error is logged first", async () => {
    const error = new Error("connect ECONNREFUSED 10.0.0.42:6543");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await getHealth({
      ping: () => {
        throw error;
      },
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toEqual(CONTRACT_503_BODY);
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(body)).not.toContain("10.0.0.42");
    expect(errorSpy).toHaveBeenCalledWith("[GET /api/health]", error);
  });

  it("503 after the 5 s budget when the ping never settles (fake timers)", async () => {
    vi.useFakeTimers();
    // The timeout outcome is logged before the 503 — silence it here.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const hanging = new Promise<never>(() => {});

    const responsePromise = getHealth({ ping: () => hanging });
    const statusAssertion = expect(responsePromise).resolves.toHaveProperty(
      "status",
      503,
    );

    await vi.advanceTimersByTimeAsync(5_000);
    await statusAssertion;

    const response = await responsePromise;
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual(CONTRACT_503_BODY);
  });
});

describe("postKeepAlive", () => {
  it("200 { data: { status: 'ok' } } with Cache-Control: no-store when the secret matches", async () => {
    const response = await postKeepAlive({
      secret: SECRET,
      header: SECRET,
      ping: () => Promise.resolve(),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: { status: "ok" } });
  });

  it("401 UNAUTHORIZED (toErrorResponse shape) when the header is missing — ping NOT called", async () => {
    const ping = vi.fn();
    const response = await postKeepAlive({ secret: SECRET, header: null, ping });

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: { code: "UNAUTHORIZED", message: "Anda harus masuk terlebih dahulu" },
    });
    expect(ping).not.toHaveBeenCalled();
  });

  it("401 when the header is wrong (different length) — ping NOT called", async () => {
    const ping = vi.fn();
    const response = await postKeepAlive({
      secret: SECRET,
      header: SECRET.slice(0, 8),
      ping,
    });

    expect(response.status).toBe(401);
    expect(ping).not.toHaveBeenCalled();
  });

  it("401 when the header has the right length but wrong content — ping NOT called", async () => {
    const ping = vi.fn();
    const response = await postKeepAlive({
      secret: SECRET,
      header: `${SECRET.slice(0, -1)}X`,
      ping,
    });

    expect(response.status).toBe(401);
    expect(ping).not.toHaveBeenCalled();
  });

  it("401 for every request when the server secret is empty — one log line each, header value not echoed", async () => {
    const ping = vi.fn();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    for (const header of [null, "", SECRET]) {
      const response = await postKeepAlive({ secret: "", header, ping });
      expect(response.status).toBe(401);
    }

    expect(ping).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(3); // one line per rejected request
    for (const call of warnSpy.mock.calls) {
      expect(call.join(" ")).not.toContain(SECRET);
    }
  });

  it("401 when the server secret is undefined, even for an empty header", async () => {
    // The unset-secret warning is expected here — silence it.
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await postKeepAlive({
      secret: undefined,
      header: "",
      ping: () => Promise.resolve(),
    });

    expect(response.status).toBe(401);
  });

  it("503 contract body when the ping fails after a valid secret; error logged first", async () => {
    const error = new Error("connection terminated");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await postKeepAlive({
      secret: SECRET,
      header: SECRET,
      ping: () => Promise.reject(error),
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual(CONTRACT_503_BODY);
    expect(errorSpy).toHaveBeenCalledWith(
      "[POST /api/cron/keep-alive]",
      error,
    );
  });

  it("503 after the 5 s budget when the ping never settles and the secret is valid (fake timers)", async () => {
    vi.useFakeTimers();
    // The timeout outcome is logged before the 503 — silence it here.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const hanging = new Promise<never>(() => {});

    const responsePromise = postKeepAlive({
      secret: SECRET,
      header: SECRET,
      ping: () => hanging,
    });
    const statusAssertion = expect(responsePromise).resolves.toHaveProperty(
      "status",
      503,
    );

    await vi.advanceTimersByTimeAsync(5_000);
    await statusAssertion;

    const response = await responsePromise;
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual(CONTRACT_503_BODY);
  });

  it("never passes the secret or the header value to console.*", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrongHeader = `not-the-${SECRET}`;

    // Drive every path that logs: unset secret (warn), wrong header
    // (quiet), and a failing ping under the real secret (error).
    await postKeepAlive({
      secret: undefined,
      header: wrongHeader,
      ping: () => Promise.resolve(),
    });
    await postKeepAlive({
      secret: SECRET,
      header: wrongHeader,
      ping: () => Promise.resolve(),
    });
    await postKeepAlive({
      secret: SECRET,
      header: SECRET,
      ping: () => Promise.reject(new Error("db down")),
    });

    for (const spy of [errorSpy, warnSpy]) {
      for (const call of spy.mock.calls) {
        const text = call.map(String).join(" ");
        expect(text).not.toContain(SECRET);
        expect(text).not.toContain(wrongHeader);
      }
    }
  });
});
