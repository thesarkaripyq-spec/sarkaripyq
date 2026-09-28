import { test, expect } from "@playwright/test";
import { createConfirmedTestUser, deleteTestUser, TEST_USER_PASSWORD } from "./fixtures/test-user";

// Admin-created user, not the signup form - doesn't touch GoTrue's
// email-sending rate limit (see auth-signup.spec.ts).
test.describe("Practice attempts", () => {
  let userId: string;

  test.beforeEach(async ({ page }) => {
    const user = await createConfirmedTestUser("attempts");
    userId = user.id;

    await page.goto("/login");
    await page.getByLabel("Email address").fill(user.email);
    await page.getByLabel("Password").fill(TEST_USER_PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForURL("**/dashboard");
  });

  test.afterEach(async () => {
    await deleteTestUser(userId);
  });

  test("answering a question records the attempt and the dashboard reflects it", async ({ page }) => {
    // CGL 2024 Tier 1 Shift 1, question 1 - correct answer is "72 km/h"
    // (see supabase/seed/0001_sample_data.sql).
    await page.goto("/ssc/cgl/pyq/2024/shift-1");

    const attemptRecorded = page.waitForResponse(
      (res) => res.url().includes("/api/attempts") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: /72 km\/h/ }).click();
    await attemptRecorded;

    await expect(page.getByText(/^Correct$/)).toBeVisible();

    await page.goto("/dashboard");
    const statsSection = page.locator("section").first();
    await expect(statsSection.getByText("1", { exact: true })).toBeVisible();
    await expect(statsSection.getByText("100%")).toBeVisible();
  });
});
