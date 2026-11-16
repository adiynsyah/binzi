import { describe, expect, it } from "vitest";

import { formatPlaybackClock } from "./playback-clock";

describe("formatPlaybackClock", () => {
  it.each([
    ["zero", 0, "00:00"],
    ["under a minute", 3, "00:03"],
    ["minutes + seconds (13d form)", 84, "01:24"],
    ["exactly one minute", 60, "01:00"],
    ["just under an hour", 3599, "59:59"],
    ["exactly one hour", 3600, "1:00:00"],
    ["over an hour", 3661, "1:01:01"],
    ["ten hours", 36000, "10:00:00"],
  ])("%s", (_label, input, expected) => {
    expect(formatPlaybackClock(input)).toBe(expected);
  });

  it("floors fractional seconds", () => {
    expect(formatPlaybackClock(84.9)).toBe("01:24");
  });

  it("never goes negative", () => {
    expect(formatPlaybackClock(-5)).toBe("00:00");
  });
});
