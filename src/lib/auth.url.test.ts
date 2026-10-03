// Unit tests for the preview base-URL resolution in src/lib/auth.ts
// (card A-10, PR decision c). Only the pure resolver is tested — the full
// getAuth() wiring needs a configured environment and a database.
import { afterEach, describe, expect, it } from "vitest";

import { vercelPreviewBaseURL } from "./auth";

const SNAPSHOT = { ...process.env } as Record<string, string | undefined>;

function withEnv(values: Record<string, string | undefined>, run: () => void) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const key of Object.keys(values)) {
      const original = SNAPSHOT[key];
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    }
  }
}

afterEach(() => {
  withEnv(
    {
      VERCEL_ENV: undefined,
      VERCEL_BRANCH_URL: undefined,
      VERCEL_URL: undefined,
    },
    () => undefined,
  );
});

describe("vercelPreviewBaseURL", () => {
  it("prefers VERCEL_BRANCH_URL on preview deployments", () => {
    withEnv(
      {
        VERCEL_ENV: "preview",
        VERCEL_BRANCH_URL: "binzi-a1b2c3-foo.vercel.app",
        VERCEL_URL: "binzi-z9y8x7.vercel.app",
      },
      () =>
        expect(vercelPreviewBaseURL()).toBe(
          "https://binzi-a1b2c3-foo.vercel.app",
        ),
    );
  });

  it("falls back to VERCEL_URL when the branch URL is absent", () => {
    withEnv(
      {
        VERCEL_ENV: "preview",
        VERCEL_BRANCH_URL: undefined,
        VERCEL_URL: "binzi-z9y8x7.vercel.app",
      },
      () =>
        expect(vercelPreviewBaseURL()).toBe("https://binzi-z9y8x7.vercel.app"),
    );
  });

  it("ignores preview hosts outside preview deployments", () => {
    withEnv(
      {
        VERCEL_ENV: "production",
        VERCEL_BRANCH_URL: "binzi-a1b2c3-foo.vercel.app",
      },
      () => expect(vercelPreviewBaseURL()).toBeUndefined(),
    );
  });

  it("returns undefined when no Vercel variables are set (local dev)", () => {
    withEnv(
      {
        VERCEL_ENV: undefined,
        VERCEL_BRANCH_URL: undefined,
        VERCEL_URL: undefined,
      },
      () => expect(vercelPreviewBaseURL()).toBeUndefined(),
    );
  });

  it("rejects malformed hosts and falls through", () => {
    withEnv(
      {
        VERCEL_ENV: "preview",
        VERCEL_BRANCH_URL: "https://has-scheme.example.com",
        VERCEL_URL: "",
      },
      () => expect(vercelPreviewBaseURL()).toBeUndefined(),
    );
  });
});
