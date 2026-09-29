import { test, expect } from "@playwright/test";
import { createConfirmedTestUser, deleteTestUser, TEST_USER_PASSWORD } from "./fixtures/test-user";

test.describe("Login", () => {
  let userId: string;
  let email: string;

  test.beforeEach(async () => {
    const user = await createConfirmedTestUser("login");
    userId = user.id;
    email = user.email;
  });

  test.afterEach(async () => {
    await deleteTestUser(userId);
  });

  test("logs in with correct credentials and lands on the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_USER_PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();

    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("shows an error on the wrong password and stays on the login page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("wrong-password-entirely");
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
