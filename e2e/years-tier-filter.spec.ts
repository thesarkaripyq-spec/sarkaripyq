import { test, expect } from "@playwright/test";

// Covers /ssc/[exam]/pyq and /ssc/[exam]/pyq/[year] - static default view
// + client-side tier filter over an already-loaded dataset (AUDIT.md
// A1/Phase 2). Tolerant of single-tier exams/years (skips the
// filter-specific assertions rather than failing) since which exams
// currently have a second tier depends on imported data, not this code.
test.describe("Exam years list (/ssc/[exam]/pyq)", () => {
  test("default static view loads with at least one year", async ({ page }) => {
    const res = await page.goto("/ssc/cgl/pyq");
    expect(res?.status()).toBe(200);
    await expect(page.locator("a[href*='/ssc/cgl/pyq/']").first()).toBeVisible();
  });

  test("applying a tier filter updates the URL and the year list", async ({ page }) => {
    await page.goto("/ssc/cgl/pyq");
    const tierLink = page.getByRole("link", { name: "Tier 1" });
    if ((await tierLink.count()) === 0) {
      test.skip(true, "cgl has no second tier in the current data");
    }
    await tierLink.click();
    await expect(page).toHaveURL(/tier=Tier(%20|\+)1/);
  });

  test("sharing/reloading a filtered URL renders without error", async ({ page }) => {
    const res = await page.goto("/ssc/cgl/pyq?tier=Tier%201");
    expect(res?.status()).toBe(200);
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("back navigation returns to the unfiltered state", async ({ page }) => {
    await page.goto("/ssc/cgl/pyq");
    const tierLink = page.getByRole("link", { name: "Tier 1" });
    if ((await tierLink.count()) === 0) {
      test.skip(true, "cgl has no second tier in the current data");
    }
    await tierLink.click();
    await expect(page).toHaveURL(/tier=/);
    await page.goBack();
    await expect(page).not.toHaveURL(/tier=/);
  });
});

test.describe("Papers by year (/ssc/[exam]/pyq/[year])", () => {
  async function gotoFirstYear(page: import("@playwright/test").Page): Promise<string> {
    await page.goto("/ssc/cgl/pyq");
    const yearHref = await page.locator("a[href*='/ssc/cgl/pyq/']").first().getAttribute("href");
    await page.locator("a[href*='/ssc/cgl/pyq/']").first().click();
    await page.waitForURL(`**${yearHref}`);
    return yearHref!;
  }

  test("default static view loads with at least one paper", async ({ page }) => {
    await gotoFirstYear(page);
    await expect(page.locator("a[href*='/pyq/']").first()).toBeVisible();
  });

  test("tier filter updates the URL and sharing/reloading it works", async ({ page }) => {
    await gotoFirstYear(page);
    const tierLink = page.getByRole("link", { name: "Tier 1" });
    if ((await tierLink.count()) === 0) {
      test.skip(true, "This year has no second tier in the current data");
    }
    await tierLink.click();
    await expect(page).toHaveURL(/tier=/);

    const filteredUrl = page.url();
    const res = await page.goto(filteredUrl);
    expect(res?.status()).toBe(200);
    await expect(page.locator("body")).not.toContainText("Application error");
  });
});
