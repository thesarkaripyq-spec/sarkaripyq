import { test, expect } from "@playwright/test";
import { createConfirmedTestUser, TEST_USER_PASSWORD } from "./fixtures/test-user";

// Uses an admin-created user (not the signup form) - this doesn't touch
// GoTrue's email-sending rate limit at all, unlike auth-signup.spec.ts's
// happy-path test.
test.describe("Account deletion", () => {
  test("deletes the account via the profile page and signs the user out", async ({ page }) => {
    const user = await createConfirmedTestUser("delete");

    await page.goto("/login");
    await page.getByLabel("Email address").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_USER_PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForURL("**/dashboard");

    await page.goto("/profile");
    await page.getByRole("button", { name: "Delete account" }).click();
    await page.getByRole("textbox").fill("DELETE");
    await page.getByRole("button", { name: "Permanently delete my account" }).click();

    await page.waitForURL((url) => url.pathname === "/");

    // The session is genuinely gone server-side, not just hidden client-side.
    await page.goto("/dashboard");
    await page.waitForURL("**/login");
  });
});
