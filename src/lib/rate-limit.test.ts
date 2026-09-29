import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getClientIp, rateLimit } from "./rate-limit";

// rateLimit's bucket Map is module-level state shared across every call in
// this file, so each test uses its own unique key rather than resetting it.
describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit within the window, then rejects", () => {
    const key = "test-basic";
    expect(rateLimit(key, 3, 1000)).toBe(true);
    expect(rateLimit(key, 3, 1000)).toBe(true);
    expect(rateLimit(key, 3, 1000)).toBe(true);
    expect(rateLimit(key, 3, 1000)).toBe(false);
  });

  it("gives each key its own independent budget", () => {
    expect(rateLimit("test-key-a", 1, 1000)).toBe(true);
    expect(rateLimit("test-key-a", 1, 1000)).toBe(false);
    expect(rateLimit("test-key-b", 1, 1000)).toBe(true);
  });

  it("resets the budget once the window has passed", () => {
    const key = "test-window-reset";
    expect(rateLimit(key, 1, 1000)).toBe(true);
    expect(rateLimit(key, 1, 1000)).toBe(false);

    vi.setSystemTime(1001);
    expect(rateLimit(key, 1, 1000)).toBe(true);
  });
});

describe("getClientIp", () => {
  it("returns the first IP when x-forwarded-for has one", () => {
    const request = new Request("https://sarkaripyq.com", { headers: { "x-forwarded-for": "1.2.3.4" } });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("returns the first, trimmed IP from a comma-separated chain", () => {
    const request = new Request("https://sarkaripyq.com", {
      headers: { "x-forwarded-for": "1.2.3.4 , 5.6.7.8, 9.10.11.12" },
    });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("returns 'unknown' when the header is absent", () => {
    const request = new Request("https://sarkaripyq.com");
    expect(getClientIp(request)).toBe("unknown");
  });
});
