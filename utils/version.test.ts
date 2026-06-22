import { describe, expect, it } from "vitest";

import { compareVersions } from "./version";

describe("compareVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("2.3.4", "2.3.4")).toBe(0);
  });

  it("strips a leading v on either side", () => {
    expect(compareVersions("v1.2.0", "1.2.0")).toBe(0);
    expect(compareVersions("v1.2.1", "v1.2.0")).toBe(1);
  });

  it("treats missing segments as 0", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("1", "1.0.0")).toBe(0);
    expect(compareVersions("1.2.1", "1.2")).toBe(1);
  });

  it("orders by major, then minor, then patch", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
    expect(compareVersions("1.1.0", "1.0.9")).toBe(1);
    expect(compareVersions("1.0.20", "1.0.19")).toBe(1);
    expect(compareVersions("1.0.19", "1.0.20")).toBe(-1);
  });

  it("matches the updater's real comparison (newer release > installed)", () => {
    // current app version is 1.0.19; a 1.0.20 release should be 'newer'
    expect(compareVersions("v1.0.20", "1.0.19")).toBe(1);
    expect(compareVersions("v1.0.19", "1.0.19")).toBe(0); // same -> no update offered
  });
});
