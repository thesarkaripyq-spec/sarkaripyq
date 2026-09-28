import { test, expect } from "@playwright/test";
import { deleteTestUser, findTestUserIdByEmail, testUserEmail } from "./fixtures/test-user";

// Drives the real signup form end to end. Confirm-email is off on the
// test project (see AUDIT.md Phase 5), so signUp() issues a session
// immediately - matches SignupForm.tsx's data.session branch, not the
// "check your email" one.
test.describe("Signup", () => {
  test("creates an account and lands on the dashboard", async ({ page }) => {
    const email = testUserEmail("signup");
    const name = "E2E Test User";

    await page.goto("/signup");
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Test-password-1");
    await page.getByLabel("Confirm password").fill("Test-password-1");
    await page.getByRole("button", { name: "Create account" }).click();

    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);

    const userId = await findTestUserIdByEmail(email);
    if (userId) await deleteTestUser(userId);
  });

  test("rejects mismatched passwords without hitting the network", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Name").fill("Mismatch Test");
    await page.getByLabel("Email address").fill(testUserEmail("mismatch"));
    await page.getByLabel("Password", { exact: true }).fill("Test-password-1");
    await page.getByLabel("Confirm password").fill("Different-password-2");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText(/passwords don't match/i)).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
  });
});
