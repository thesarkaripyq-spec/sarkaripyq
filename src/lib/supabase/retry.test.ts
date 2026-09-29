import { afterEach, describe, expect, it, vi } from "vitest";
import { withTimeoutRetry } from "./retry";

describe("withTimeoutRetry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns immediately on success, without retrying", async () => {
    const run = vi.fn().mockResolvedValue({ data: [1], error: null });
    const result = await withTimeoutRetry(run, "test.success");

    expect(result).toEqual({ data: [1], error: null });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("returns immediately on a non-57014 error, without retrying", async () => {
    const run = vi.fn().mockResolvedValue({ data: null, error: { code: "42703" } });
    const result = await withTimeoutRetry(run, "test.other-error");

    expect(result).toEqual({ data: null, error: { code: "42703" } });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once on 57014 and returns the retry's result on success", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: "57014" } })
      .mockResolvedValueOnce({ data: [1], error: null });

    const result = await withTimeoutRetry(run, "test.retry-succeeds");

    expect(result).toEqual({ data: [1], error: null });
    expect(run).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledTimes(2); // "retrying once" + "retry succeeded"
  });

  it("logs an error (not just a warning) if the retry also times out", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn().mockResolvedValue({ data: null, error: { code: "57014" } });

    const result = await withTimeoutRetry(run, "test.retry-also-fails");

    expect(result).toEqual({ data: null, error: { code: "57014" } });
    expect(run).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledTimes(1); // just "retrying once"
    expect(console.error).toHaveBeenCalledTimes(1); // "persisted after retry"
  });
});
