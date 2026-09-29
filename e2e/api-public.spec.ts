import { test, expect } from "@playwright/test";
import { findSeededPaperId } from "./fixtures/seed-data";

test.describe("/api/health", () => {
  test("returns 200 ok with no-store caching", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(res.headers()["cache-control"]).toBe("no-store");
  });
});

test.describe("/api/search", () => {
  test("returns results for a real query", async ({ request }) => {
    const res = await request.get("/api/search?q=train");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.results.length).toBeGreaterThan(0);
  });

  test("returns an empty array for a too-short query, without erroring", async ({ request }) => {
    const res = await request.get("/api/search?q=a");
    expect(res.status()).toBe(200);
    expect((await res.json()).results).toEqual([]);
  });

  // 30/60s per src/app/api/search/route.ts. Uses its own synthetic IP (via
  // x-forwarded-for, which getClientIp() trusts verbatim) so exhausting
  // this budget can't affect the "success"/"empty query" tests above,
  // which share the default "unknown" bucket with every other test that
  // doesn't set this header.
  test("rate-limits at 30 requests per minute per IP", async ({ request }) => {
    const headers = { "x-forwarded-for": "203.0.113.10" };
    let lastStatus = 200;
    for (let i = 0; i < 31; i++) {
      const res = await request.get(`/api/search?q=ratelimit${i}`, { headers });
      lastStatus = res.status();
    }
    expect(lastStatus).toBe(429);
  });
});

test.describe("/api/papers/[paperId]/practice", () => {
  test("returns the question list and first question for a real paper", async ({ request }) => {
    const paperId = await findSeededPaperId();
    const res = await request.get(`/api/papers/${paperId}/practice`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.questionNumbers.length).toBeGreaterThan(0);
    expect(body.currentQuestionNumber).toBe(1);
    expect(body.question).not.toBeNull();
    expect(res.headers()["cache-control"]).toContain("s-maxage=300");
  });

  test("rejects a non-uuid paperId", async ({ request }) => {
    const res = await request.get("/api/papers/not-a-uuid/practice");
    expect(res.status()).toBe(400);
  });

  test("rejects an unexpected query field (.strict())", async ({ request }) => {
    const paperId = await findSeededPaperId();
    const res = await request.get(`/api/papers/${paperId}/practice?bogus=1`);
    expect(res.status()).toBe(400);
  });

  test("falls back to the first question when ?q= is out of range, rather than erroring", async ({ request }) => {
    const paperId = await findSeededPaperId();
    const res = await request.get(`/api/papers/${paperId}/practice?q=999`);
    expect(res.status()).toBe(200);
    expect((await res.json()).currentQuestionNumber).toBe(1);
  });

  test("a well-formed but non-existent paperId returns an empty result, not a 404", async ({ request }) => {
    const res = await request.get("/api/papers/00000000-0000-0000-0000-000000000000/practice");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ questionNumbers: [], currentQuestionNumber: null, question: null });
  });
});

test.describe("/api/practice/[subject]", () => {
  test("returns paginated questions for a real subject", async ({ request }) => {
    const res = await request.get("/api/practice/quantitative-aptitude");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.total).toBeGreaterThan(0);
    expect(body.page).toBe(1);
    expect(res.headers()["cache-control"]).toContain("s-maxage=300");
  });

  test("returns 404 for a subject that doesn't exist", async ({ request }) => {
    const res = await request.get("/api/practice/not-a-real-subject");
    expect(res.status()).toBe(404);
  });

  test("rejects an unexpected query field (.strict())", async ({ request }) => {
    const res = await request.get("/api/practice/quantitative-aptitude?bogus=1");
    expect(res.status()).toBe(400);
  });

  test("rejects an invalid tier value", async ({ request }) => {
    const res = await request.get("/api/practice/quantitative-aptitude?tier=Tier%209");
    expect(res.status()).toBe(400);
  });
});
