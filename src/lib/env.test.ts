import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_PUBLIC_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("validateEnv", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", VALID_PUBLIC_ENV.NEXT_PUBLIC_SUPABASE_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", VALID_PUBLIC_ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("NEXT_RUNTIME", undefined);
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("passes silently when every var is present and valid", async () => {
    const { validateEnv } = await import("./env");
    expect(() => validateEnv()).not.toThrow();
  });

  it("throws when a public var is missing, regardless of NODE_ENV", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    const { validateEnv } = await import("./env");
    expect(() => validateEnv()).toThrow(/public environment configuration/);
  });

  it("throws when a public var is malformed (not a URL)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url");
    const { validateEnv } = await import("./env");
    expect(() => validateEnv()).toThrow(/public environment configuration/);
  });

  it("in development, warns instead of throwing when the service-role key is missing", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { validateEnv } = await import("./env");

    expect(() => validateEnv()).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("in production, throws when the service-role key is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
    const { validateEnv } = await import("./env");

    expect(() => validateEnv()).toThrow(/server-only environment configuration/);
  });

  it("skips the server-only check entirely on the edge runtime, even if the key is missing", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
    const { validateEnv } = await import("./env");

    expect(() => validateEnv()).not.toThrow();
  });
});
