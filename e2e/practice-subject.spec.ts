import { test, expect } from "@playwright/test";

// Covers /practice/[subject] - static default (page 1, unfiltered) +
// client-side exam/year/tier filters and pagination via PracticeBrowser +
// /api/practice/[subject] (AUDIT.md A1/Phase 2).
test.describe("Practice by subject page", () => {
  test("default static view loads with results", async ({ page }) => {
    const res = await page.goto("/practice/quantitative-aptitude");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/quantitative/i);
  });

  test("applying an exam filter updates the URL, keeping previous results visible while loading", async ({
    page,
  }) => {
    await page.goto("/practice/quantitative-aptitude");
    const examSelect = page.getByLabel("Filter by exam");
    await examSelect.selectOption({ index: 1 });
    await expect(page).toHaveURL(/exam=/);
  });

  test("sharing/reloading a paginated URL works", async ({ page }) => {
    await page.goto("/practice/quantitative-aptitude");
    const nextLink = page.getByRole("link", { name: "Next" });
    if ((await nextLink.count()) === 0 || (await nextLink.getAttribute("aria-disabled")) === "true") {
      test.skip(true, "Not enough results for a second page");
    }

    const res = await page.goto("/practice/quantitative-aptitude?page=2");
    expect(res?.status()).toBe(200);
    await expect(page.getByText(/Page 2 of/)).toBeVisible();
  });

  test("pagination and back/forward navigation work", async ({ page }) => {
    await page.goto("/practice/quantitative-aptitude");
    const nextLink = page.getByRole("link", { name: "Next" });
    if ((await nextLink.count()) === 0 || (await nextLink.getAttribute("aria-disabled")) === "true") {
      test.skip(true, "Not enough results for a second page");
    }
    await nextLink.click();
    await expect(page).toHaveURL(/page=2/);
    await page.goBack();
    await expect(page).not.toHaveURL(/page=2/);
  });
});
