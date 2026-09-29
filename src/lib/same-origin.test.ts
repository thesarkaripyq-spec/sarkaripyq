import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./same-origin";

function requestWithOrigin(origin: string | null, url = "https://sarkaripyq.com/api/attempts") {
  const headers = new Headers();
  if (origin !== null) headers.set("origin", origin);
  return new Request(url, { headers });
}

describe("isSameOrigin", () => {
  it("allows a request with no Origin header (non-browser/non-cross-site)", () => {
    expect(isSameOrigin(requestWithOrigin(null))).toBe(true);
  });

  it("allows a matching origin", () => {
    expect(isSameOrigin(requestWithOrigin("https://sarkaripyq.com"))).toBe(true);
  });

  it("rejects a mismatched origin", () => {
    expect(isSameOrigin(requestWithOrigin("https://evil.com"))).toBe(false);
  });

  it("rejects a same-host but different-scheme/port origin", () => {
    expect(isSameOrigin(requestWithOrigin("http://sarkaripyq.com"))).toBe(false);
  });

  it("rejects an unparsable Origin header rather than throwing", () => {
    expect(isSameOrigin(requestWithOrigin("not-a-url"))).toBe(false);
  });
});
