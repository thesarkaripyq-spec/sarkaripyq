import { describe, expect, it } from "vitest";
import { getLevel } from "./level";

describe("getLevel", () => {
  it("starts at Beginner with 0 attempts", () => {
    expect(getLevel(0)).toEqual({ label: "Beginner", next: { label: "Intermediate", min: 25 }, progress: 0 });
  });

  it("computes progress toward the next tier", () => {
    expect(getLevel(24).progress).toBe(96); // round(24/25 * 100)
    expect(getLevel(375)).toEqual({ label: "Pro", next: { label: "Expert", min: 750 }, progress: 17 });
  });

  it("advances to the next tier exactly at its threshold", () => {
    expect(getLevel(25).label).toBe("Intermediate");
    expect(getLevel(100).label).toBe("Advanced");
    expect(getLevel(300).label).toBe("Pro");
  });

  it("caps out at Expert with no next tier and 100% progress", () => {
    expect(getLevel(750)).toEqual({ label: "Expert", next: null, progress: 100 });
    expect(getLevel(10_000)).toEqual({ label: "Expert", next: null, progress: 100 });
  });
});
