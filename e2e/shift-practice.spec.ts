import { test, expect, type Page } from "@playwright/test";

// Covers /ssc/[exam]/pyq/[year]/[shift] - static default (first question,
// unfiltered) + client-side subject filter/question navigation via
// PracticeSession + /api/papers/[paperId]/practice (AUDIT.md A1/Phase 2).
//
// Client-side (soft) navigations resolve the URL before the new content
// finishes rendering, so every step here waits for real content (the Next
// button), not just for the URL to change.
async function gotoFirstShift(page: Page): Promise<string> {
  await page.goto("/ssc/cgl/pyq");
  const yearHref = await page.locator("a[href*='/ssc/cgl/pyq/']").first().getAttribute("href");
  await page.locator("a[href*='/ssc/cgl/pyq/']").first().click();
  await page.waitForURL(`**${yearHref}`);

  const shiftHref = await page.locator(`a[href^="${yearHref}/"]`).first().getAttribute("href");
  await page.locator(`a[href^="${yearHref}/"]`).first().click();
  await page.waitForURL(`**${shiftHref}`);
  await page.getByRole("button", { name: /next/i }).waitFor();

  return shiftHref!;
}

test.describe("Shift practice page", () => {
  test("default static view loads the first question with working nav", async ({ page }) => {
    await gotoFirstShift(page);
    await expect(page.getByRole("button", { name: /next/i })).toBeVisible();
    await expect(page.getByText(/Question 1 \//)).toBeVisible();
  });

  test("next-question navigation updates the URL, and back/forward work", async ({ page }) => {
    await gotoFirstShift(page);
    const nextButton = page.getByRole("button", { name: /next/i });
    if (await nextButton.isDisabled()) {
      test.skip(true, "This paper has only one question");
    }

    await nextButton.click();
    await expect(page).toHaveURL(/q=2/);
    await expect(page.getByText(/Question 2 \//)).toBeVisible();

    await page.goBack();
    await expect(page).not.toHaveURL(/q=2/);
    await page.goForward();
    await expect(page).toHaveURL(/q=2/);
  });

  test("a subject filter tab updates the URL and question set", async ({ page }) => {
    const basePath = await gotoFirstShift(page);
    const subjectLink = page.locator(`a[href^="${basePath}?subject="]`).first();
    if ((await subjectLink.count()) === 0) {
      test.skip(true, "No subject tabs rendered for this paper");
    }
    await subjectLink.click();
    await expect(page).toHaveURL(/subject=/);
    await expect(page.getByRole("button", { name: /next/i })).toBeVisible();
  });

  test("sharing/reloading a filtered URL (?q=2) shows that question directly", async ({ page }) => {
    const basePath = await gotoFirstShift(page);
    const res = await page.goto(`${basePath}?q=2`);
    expect(res?.status()).toBe(200);
    await page.getByRole("button", { name: /next/i }).waitFor();
    await expect(page.getByText(/Question 2 \//)).toBeVisible();
  });
});
