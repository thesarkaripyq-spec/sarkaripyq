import { afterEach, describe, expect, it, vi } from "vitest";
import { cn, formatExamDate } from "./utils";

describe("cn", () => {
  it("merges class names and drops falsy values", () => {
    expect(cn("a", false, "b", undefined, null, "c")).toBe("a b c");
  });
});

describe("formatExamDate", () => {
  it("returns null for a null input", () => {
    expect(formatExamDate(null)).toBeNull();
  });

  it("formats an ISO date string in en-IN long form", () => {
    expect(formatExamDate("2024-09-11")).toBe("11 September 2024");
  });
});

describe("siteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("falls back to localhost when NEXT_PUBLIC_SITE_URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    const { siteUrl } = await import("./utils");
    expect(siteUrl).toBe("http://localhost:3000");
  });

  it("uses NEXT_PUBLIC_SITE_URL when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://sarkaripyq.com");
    const { siteUrl } = await import("./utils");
    expect(siteUrl).toBe("https://sarkaripyq.com");
  });
});
