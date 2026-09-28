import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn(() => ({ mocked: true }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

// createPublicClient() exists specifically so public catalog pages don't
// pull cookies()/headers() into their render tree and get forced dynamic
// (see AUDIT.md Phase 2). If it ever starts calling either, this mock
// throws instead of silently succeeding, so that regression fails this
// test loudly instead of only showing up much later as "pages went
// dynamic again" in a build output nobody was watching.
vi.mock("next/headers", () => ({
  cookies: () => {
    throw new Error("createPublicClient() must never call cookies()");
  },
  headers: () => {
    throw new Error("createPublicClient() must never call headers()");
  },
}));

describe("createPublicClient", () => {
  beforeEach(() => {
    createClientMock.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("never touches request-scoped cookies/headers", async () => {
    const { createPublicClient } = await import("./public");
    expect(() => createPublicClient()).not.toThrow();
  });

  it("is built from the anon key with no session persistence or refresh (never sends a user session)", async () => {
    const { createPublicClient } = await import("./public");
    createPublicClient();

    expect(createClientMock).toHaveBeenCalledWith("https://example.supabase.co", "test-anon-key", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });
});
