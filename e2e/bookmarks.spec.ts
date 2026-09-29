import { test, expect } from "@playwright/test";
import { createConfirmedTestUser, deleteTestUser, TEST_USER_PASSWORD } from "./fixtures/test-user";

// Admin-created user, not the signup form - doesn't touch GoTrue's
// email-sending rate limit (see auth-signup.spec.ts).
test.describe("Bookmarks", () => {
  let userId: string;

  test.beforeEach(async ({ page }) => {
    const user = await createConfirmedTestUser("bookmarks");
    userId = user.id;

    await page.goto("/login");
    await page.getByLabel("Email address").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_USER_PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForURL("**/dashboard");
  });

  test.afterEach(async () => {
    // Cascades any leftover bookmark row too - deleteTestUser is the
    // safety net, not the primary cleanup (the test itself removes the
    // bookmark via the UI).
    await deleteTestUser(userId);
  });

  test("bookmarking a question shows it on /bookmarks, and removing it clears it", async ({ page }) => {
    await page.goto("/ssc/cgl/pyq/2024/shift-1");
    await page.getByRole("button", { name: "Bookmark this question" }).click();
    await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();

    await page.goto("/bookmarks");
    await expect(page.getByText(/train 150m long/i)).toBeVisible();

    await page.getByRole("button", { name: "Remove bookmark" }).click();
    await expect(page.getByText(/no bookmarks yet/i)).toBeVisible();
  });
});
