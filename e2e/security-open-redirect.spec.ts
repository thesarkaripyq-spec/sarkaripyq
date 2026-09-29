import { test, expect } from "@playwright/test";

// safeNextPath() in src/app/auth/callback/route.ts: rejects anything that
// doesn't start with "/", starts with "//", or starts with "/<scheme>:" -
// falling back to /dashboard. No `code` param needed for these - a
// missing code just skips the token exchange and redirects anyway.
test.describe("Open redirect protection (/auth/callback)", () => {
  const payloads: { next: string; description: string }[] = [
    { next: "//evil.com", description: "protocol-relative" },
    { next: "@evil.com", description: "no leading slash, userinfo-style" },
    { next: "https://evil.com", description: "absolute URL" },
    { next: "/https:/evil.com", description: "leading slash then a smuggled scheme" },
    { next: "/javascript:alert(1)", description: "smuggled javascript: scheme" },
    { next: "/JaVaScRiPt:alert(1)", description: "case-variant smuggled scheme" },
    { next: "%2F%2Fevil.com", description: "URL-encoded protocol-relative (decodes to //evil.com)" },
    { next: "%40evil.com", description: "URL-encoded userinfo-style (decodes to @evil.com)" },
  ];

  for (const { next, description } of payloads) {
    test(`rejects ${description}: next=${next}`, async ({ request }) => {
      const res = await request.get(`/auth/callback?next=${next}`, { maxRedirects: 0 });
      expect(res.status()).toBeGreaterThanOrEqual(300);
      expect(res.status()).toBeLessThan(400);

      const location = res.headers()["location"] ?? "";
      const redirectOrigin = new URL(location, res.url()).origin;
      expect(redirectOrigin).toBe(new URL(res.url()).origin);
      expect(location).toContain("/dashboard");
    });
  }

  test("a legitimate same-origin next path passes through unmodified", async ({ request }) => {
    const res = await request.get("/auth/callback?next=/reset-password", { maxRedirects: 0 });
    const location = res.headers()["location"] ?? "";
    expect(location).toContain("/reset-password");
  });

  test("a real leading slash followed by a literally-encoded '//' stays same-origin (not caught by name, but not exploitable)", async ({
    request,
  }) => {
    // Not decoded to an actual "//" by this point - the outer query string's
    // own decoding already happened, and this value has no *further*
    // encoding for the request to decode again. safeNextPath() lets it
    // through as a literal path segment on this app's own origin, not an
    // off-site redirect - this pins that behavior down explicitly rather
    // than assuming it's covered by the plain "//evil.com" case above.
    const res = await request.get("/auth/callback?next=/%2F%2Fevil.com", { maxRedirects: 0 });
    const location = res.headers()["location"] ?? "";
    const redirectOrigin = new URL(location, res.url()).origin;
    expect(redirectOrigin).toBe(new URL(res.url()).origin);
  });
});
