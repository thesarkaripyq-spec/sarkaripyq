import { test, expect } from "@playwright/test";

// The 5 headers below come from next.config.mjs (applied to every route);
// CSP is set per-request in src/proxy.ts instead, with a different shape
// for dynamic (per-user) vs static (public) paths.
const EXPECTED_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
};

test.describe("Security headers", () => {
  for (const path of ["/", "/login", "/ssc"]) {
    test(`sets all 5 next.config.mjs headers on ${path}`, async ({ request }) => {
      const res = await request.get(path);
      const headers = res.headers();
      for (const [name, value] of Object.entries(EXPECTED_HEADERS)) {
        expect(headers[name], `expected ${name} on ${path}`).toBe(value);
      }
    });
  }
});

test.describe("CSP shape per route type", () => {
  // DYNAMIC_PATH_PREFIXES in src/proxy.ts.
  const dynamicPaths = ["/login", "/signup", "/dashboard", "/search"];
  // Everything else: public catalog pages.
  const staticPaths = ["/", "/ssc", "/practice", "/books"];

  for (const path of dynamicPaths) {
    test(`${path} gets a nonce + strict-dynamic CSP`, async ({ request }) => {
      const res = await request.get(path);
      const csp = res.headers()["content-security-policy"] ?? "";
      expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
      // style-src legitimately keeps 'unsafe-inline' on every route (see
      // proxy.ts's SHARED_DIRECTIVES) - only script-src matters here.
      const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    });
  }

  for (const path of staticPaths) {
    test(`${path} gets a plain 'unsafe-inline' CSP, no nonce`, async ({ request }) => {
      const res = await request.get(path);
      const csp = res.headers()["content-security-policy"] ?? "";
      const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
      expect(scriptSrc).toContain("'unsafe-inline'");
      expect(scriptSrc).not.toContain("nonce-");
      expect(scriptSrc).not.toContain("strict-dynamic");
    });
  }

  test("every CSP includes the shared baseline directives regardless of route type", async ({ request }) => {
    for (const path of ["/", "/login"]) {
      const res = await request.get(path);
      const csp = res.headers()["content-security-policy"] ?? "";
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain("upgrade-insecure-requests");
    }
  });
});
