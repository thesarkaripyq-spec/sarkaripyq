import { test, expect } from "@playwright/test";

// Deliberately never sends a real, well-formed request that would reach
// resetPasswordForEmail() - every test here uses an invalid email or an
// early-rejected request, so none of it touches the mailer's 2/hour cap
// (see AUDIT.md Phase 5 / auth-signup.spec.ts for why that matters).
// Order in the route is: same-origin -> IP rate-limit -> Zod parse ->
// (only if valid) email-keyed rate-limit -> send. An invalid email still
// consumes the IP rate-limit budget without ever reaching the send.
//
// Desktop Chrome only: this route's 5/min limit would otherwise double-
// count across Desktop + Mobile sharing the same default "unknown" bucket.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "Desktop Chrome", "Rate-limited routes only need checking once per suite.");
});

test.describe("/api/auth/forgot-password", () => {
  test("rejects a cross-origin request before ever parsing the body", async ({ request }) => {
    const res = await request.post("/api/auth/forgot-password", {
      headers: { origin: "https://evil.com" },
      data: { email: "not-an-email" },
    });
    expect(res.status()).toBe(403);
  });

  test("rejects a malformed email", async ({ request }) => {
    const res = await request.post("/api/auth/forgot-password", { data: { email: "not-an-email" } });
    expect(res.status()).toBe(400);
  });

  test("rejects an unexpected body field (.strict())", async ({ request }) => {
    const res = await request.post("/api/auth/forgot-password", {
      data: { email: "test@example.com", bogus: "x" },
    });
    expect(res.status()).toBe(400);
  });

  // 5/60s per src/app/api/auth/forgot-password/route.ts, checked before
  // Zod - every one of these 6 requests uses an invalid email so none of
  // them can reach the actual send, regardless of which side of the limit
  // they land on. Own synthetic IP so exhausting this can't affect the
  // "malformed email"/"unexpected field" tests above.
  test("rate-limits at 5 requests per minute per IP", async ({ request }) => {
    const headers = { "x-forwarded-for": "203.0.113.10" };
    let lastStatus = 200;
    for (let i = 0; i < 6; i++) {
      const res = await request.post("/api/auth/forgot-password", { headers, data: { email: "not-an-email" } });
      lastStatus = res.status();
    }
    expect(lastStatus).toBe(429);
  });
});
