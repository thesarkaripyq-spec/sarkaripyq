import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("info logs a JSON line via console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("hello", { userId: "123" });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed).toMatchObject({ level: "info", message: "hello", userId: "123" });
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("warn logs a JSON line via console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("careful", { label: "x" });

    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed).toMatchObject({ level: "warn", message: "careful", label: "x" });
  });

  it("error logs a JSON line via console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("broke", { code: "57014" });

    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed).toMatchObject({ level: "error", message: "broke", code: "57014" });
  });
});
