import { test, expect } from "@playwright/test";
import { createConfirmedTestUser, deleteTestUser, TEST_USER_PASSWORD } from "./fixtures/test-user";
import { findSeededQuestionId } from "./fixtures/seed-data";

// Desktop Chrome only: several routes here have a tiny per-IP rate limit
// (3-5/min), and Desktop + Mobile both hitting the same route under the
// same default "unknown" IP bucket in parallel would double-count against
// it - not a real bug, just two projects sharing one budget meant for one.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "Desktop Chrome", "Rate-limited routes only need checking once per suite.");
});

async function loginViaUi(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_USER_PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL("**/dashboard");
}

test.describe("/api/attempts", () => {
  // afterEach still runs even when the top-level beforeEach above skips a
  // non-Desktop-Chrome project, so userId may never have been assigned -
  // guarded rather than passing undefined to deleteTestUser().
  let userId: string | undefined;

  test.beforeEach(async ({ page }) => {
    const user = await createConfirmedTestUser("api-attempts");
    userId = user.id;
    await loginViaUi(page, user.email);
  });

  test.afterEach(async () => {
    if (userId) await deleteTestUser(userId);
  });

  test("records an attempt when authenticated", async ({ page }) => {
    const questionId = await findSeededQuestionId();
    const res = await page.request.post("/api/attempts", {
      data: { questionId, selectedOptionId: null, isCorrect: true },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true, recorded: true });
  });

  test("rejects an unexpected body field (.strict())", async ({ page }) => {
    const questionId = await findSeededQuestionId();
    const res = await page.request.post("/api/attempts", {
      data: { questionId, selectedOptionId: null, isCorrect: true, bogus: "x" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects a non-uuid questionId", async ({ page }) => {
    const res = await page.request.post("/api/attempts", {
      data: { questionId: "not-a-uuid", selectedOptionId: null, isCorrect: true },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("/api/attempts - unauthenticated and cross-origin", () => {
  test("silently no-ops when logged out, rather than erroring", async ({ request }) => {
    const questionId = await findSeededQuestionId();
    const res = await request.post("/api/attempts", {
      data: { questionId, selectedOptionId: null, isCorrect: true },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true, recorded: false });
  });

  test("rejects a cross-origin request", async ({ request }) => {
    const questionId = await findSeededQuestionId();
    const res = await request.post("/api/attempts", {
      headers: { origin: "https://evil.com" },
      data: { questionId, selectedOptionId: null, isCorrect: true },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe("/api/bookmarks", () => {
  let userId: string | undefined;

  test.beforeEach(async ({ page }) => {
    const user = await createConfirmedTestUser("api-bookmarks");
    userId = user.id;
    await loginViaUi(page, user.email);
  });

  test.afterEach(async () => {
    if (userId) await deleteTestUser(userId);
  });

  test("POST then DELETE round-trips when authenticated", async ({ page }) => {
    const questionId = await findSeededQuestionId();

    const postRes = await page.request.post("/api/bookmarks", { data: { questionId } });
    expect(postRes.status()).toBe(200);
    expect(await postRes.json()).toEqual({ ok: true, bookmarked: true });

    const deleteRes = await page.request.delete("/api/bookmarks", { data: { questionId } });
    expect(deleteRes.status()).toBe(200);
    expect(await deleteRes.json()).toEqual({ ok: true, bookmarked: false });
  });

  test("rejects an unexpected body field (.strict())", async ({ page }) => {
    const questionId = await findSeededQuestionId();
    const res = await page.request.post("/api/bookmarks", { data: { questionId, bogus: "x" } });
    expect(res.status()).toBe(400);
  });
});

test.describe("/api/bookmarks - unauthenticated, cross-origin, wrong-user", () => {
  test("returns 401 when logged out", async ({ request }) => {
    const questionId = await findSeededQuestionId();
    const res = await request.post("/api/bookmarks", { data: { questionId } });
    expect(res.status()).toBe(401);
  });

  test("rejects a cross-origin request", async ({ request }) => {
    const questionId = await findSeededQuestionId();
    const res = await request.post("/api/bookmarks", {
      headers: { origin: "https://evil.com" },
      data: { questionId },
    });
    expect(res.status()).toBe(403);
  });

  test("deleting another user's bookmark by question id affects nothing, not an error", async ({ browser }) => {
    const questionId = await findSeededQuestionId();
    const userA = await createConfirmedTestUser("api-bookmarks-wrong-user-a");
    const userB = await createConfirmedTestUser("api-bookmarks-wrong-user-b");

    try {
      const contextA = await browser.newContext();
      const pageA = await contextA.newPage();
      await loginViaUi(pageA, userA.email);
      const bookmarkRes = await pageA.request.post("/api/bookmarks", { data: { questionId } });
      expect(bookmarkRes.status()).toBe(200);
      await contextA.close();

      const contextB = await browser.newContext();
      const pageB = await contextB.newPage();
      await loginViaUi(pageB, userB.email);
      const deleteAsB = await pageB.request.delete("/api/bookmarks", { data: { questionId } });
      expect(deleteAsB.status()).toBe(200); // no error - just affects 0 rows
      await contextB.close();

      // Confirm A's bookmark is still there via A's own session again.
      const contextA2 = await browser.newContext();
      const pageA2 = await contextA2.newPage();
      await loginViaUi(pageA2, userA.email);
      await pageA2.goto("/bookmarks");
      await expect(pageA2.getByText(/train 150m long/i)).toBeVisible();
      await contextA2.close();
    } finally {
      await Promise.all([deleteTestUser(userA.id), deleteTestUser(userB.id)]);
    }
  });
});

test.describe("/api/profile/reset", () => {
  test("resets progress when authenticated", async ({ page }) => {
    const user = await createConfirmedTestUser("api-profile-reset");
    await loginViaUi(page, user.email);
    try {
      const res = await page.request.post("/api/profile/reset");
      expect(res.status()).toBe(200);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("returns 401 when logged out", async ({ request }) => {
    const res = await request.post("/api/profile/reset");
    expect(res.status()).toBe(401);
  });

  test("rejects a cross-origin request", async ({ request }) => {
    const res = await request.post("/api/profile/reset", { headers: { origin: "https://evil.com" } });
    expect(res.status()).toBe(403);
  });

  // 3/60s per src/app/api/profile/reset/route.ts. Own synthetic IP (see
  // api-public.spec.ts's search rate-limit test for why) so exhausting
  // this can't affect the "success"/"401" tests above.
  test("rate-limits at 3 requests per minute per IP", async ({ request }) => {
    const headers = { "x-forwarded-for": "203.0.113.10" };
    let lastStatus = 200;
    for (let i = 0; i < 4; i++) {
      const res = await request.post("/api/profile/reset", { headers });
      lastStatus = res.status();
    }
    expect(lastStatus).toBe(429);
  });
});

test.describe("/api/profile/delete - rejection paths only (not the real deletion; see account-deletion.spec.ts)", () => {
  // Own synthetic IP: account-deletion.spec.ts makes real calls to this
  // same 3/min-limited route under the default "unknown" bucket (once per
  // browser project) - without this, these rejection tests would compete
  // for the same tiny budget and intermittently 429 either side.
  const headers = { "x-forwarded-for": "203.0.113.11" };

  test("returns 401 when logged out", async ({ request }) => {
    const res = await request.post("/api/profile/delete", { headers });
    expect(res.status()).toBe(401);
  });

  test("rejects a cross-origin request", async ({ request }) => {
    const res = await request.post("/api/profile/delete", { headers: { ...headers, origin: "https://evil.com" } });
    expect(res.status()).toBe(403);
  });
});

test.describe("/api/questions/[id]/report", () => {
  test("accepts an anonymous report (no account required)", async ({ request }) => {
    const questionId = await findSeededQuestionId();
    const res = await request.post(`/api/questions/${questionId}/report`, {
      data: { reason: "This question looks wrong." },
    });
    expect(res.status()).toBe(200);
  });

  test("rejects an empty reason", async ({ request }) => {
    const questionId = await findSeededQuestionId();
    const res = await request.post(`/api/questions/${questionId}/report`, { data: { reason: "" } });
    expect(res.status()).toBe(400);
  });

  test("rejects an unexpected body field (.strict())", async ({ request }) => {
    const questionId = await findSeededQuestionId();
    const res = await request.post(`/api/questions/${questionId}/report`, {
      data: { reason: "Wrong answer.", bogus: "x" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects a cross-origin request", async ({ request }) => {
    const questionId = await findSeededQuestionId();
    const res = await request.post(`/api/questions/${questionId}/report`, {
      headers: { origin: "https://evil.com" },
      data: { reason: "Wrong answer." },
    });
    expect(res.status()).toBe(403);
  });

  // 5/60s per src/app/api/questions/[id]/report/route.ts. Own synthetic
  // IP so this can't affect the tests above sharing the default bucket.
  test("rate-limits at 5 requests per minute per IP", async ({ request }) => {
    const questionId = await findSeededQuestionId();
    const headers = { "x-forwarded-for": "203.0.113.10" };
    let lastStatus = 200;
    for (let i = 0; i < 6; i++) {
      const res = await request.post(`/api/questions/${questionId}/report`, {
        headers,
        data: { reason: `Report number ${i}.` },
      });
      lastStatus = res.status();
    }
    expect(lastStatus).toBe(429);
  });
});

test.describe("/api/auth/signout", () => {
  test("returns 200 regardless of session state", async ({ request }) => {
    const res = await request.post("/api/auth/signout");
    expect(res.status()).toBe(200);
  });
});
