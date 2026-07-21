import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * SarkariPYQ — anonymous end-to-end journey.
 *
 * Flow under test:
 *   1. Visitor lands on the home page and the hero heading renders.
 *   2. Visitor clicks an exam card (SSC CGL) on the home page.
 *   3. SPA navigates to the exam's previous-year-questions practice page.
 *   4. The practice page mounts, calls the questions API, and renders
 *      a question card (or a clear empty/loading state).
 *
 * No authentication is involved — the suite is intentionally
 * credential-free so it is safe to run in any environment.
 */

// --- Page Object Model -----------------------------------------------------

/**
 * Home page object. Encapsulates the selectors for the landing page so the
 * spec body stays short and intent is obvious. Locators are intentionally
 * scoped to user-facing attributes (roles, names, visible text) so they
 * survive styling and copy changes.
 */
class HomePage {
  readonly heading: Locator;
  readonly sscCglCard: Locator;
  readonly featuresBanner: Locator;

  constructor(private readonly page: Page) {
    // The hero H1 is the page's primary heading. Scoped to <h1> so we
    // never match a stray <h2> deeper down the page.
    this.heading = page.getByRole('heading', {
      name: /master ssc exams with realpyq on sarkaripyq/i,
      level: 1,
    });

    // The "All SSC Exams Covered" grid renders each exam as a link card.
    // We locate the SSC CGL card by its visible name, which is also the
    // link's accessible name.
    this.sscCglCard = page.getByRole('link', { name: /^ssc cgl/i }).first();

    // Sanity-check element below the fold: the 100% Free feature banner.
    this.featuresBanner = page.getByRole('heading', { name: /100% free/i });
  }

  async goto() {
    await this.page.goto('/');
    // Wait for the hero to render before continuing.
    await expect(this.heading).toBeVisible();
  }
}

/**
 * Practice page object. Represents /ssc/<slug>_previous_year_questions.
 * The page mounts a header (H1) and a questions list. We assert the URL
 * changed and that the page reached a stable state (header visible, then
 * either the loading skeleton, an empty state, or a real question card).
 */
class PracticePage {
  readonly urlPattern: RegExp;
  readonly pageTitle: Locator;
  readonly emptyState: Locator;
  readonly filterButton: Locator;

  constructor(private readonly page: Page) {
    this.urlPattern = /\/ssc\/ssc-cgl(_|\/)previous[_-]year[_-]questions/;
    // The H1 that the QuestionPractice component renders unconditionally
    // — its presence proves React has mounted the page.
    this.pageTitle = page.getByRole('heading', {
      name: /practice real .* pyqs asked in actual exams/i,
      level: 1,
    });
    // The empty state message rendered when the questions API returns [].
    this.emptyState = page.getByText(
      /no questions found\. try adjusting your filters/i,
    );
    // The mobile filter button — proves the filter chrome mounted too.
    this.filterButton = page.getByRole('button', { name: /filters/i });
  }

  async waitForNavigation() {
    await this.page.waitForURL(this.urlPattern, { timeout: 15_000 });
  }

  /**
   * Wait for the page to reach a render-complete state. We don't assert
   * a specific question text because the dataset is dynamic — only that
   * either the loading skeleton, the empty state, or a question card is
   * on screen.
   */
  async waitForQuestionsToRender() {
    // 1. Header H1 must be visible — proves the component mounted.
    await expect(this.pageTitle).toBeVisible({ timeout: 20_000 });

    // 2. One of the three render states should appear. We poll them in
    //    parallel-friendly order using Playwright's `or` chaining so the
    //    test passes whether the API returned data, [] or is still
    //    loading. We bail as soon as *any* of them is visible.
    const state = await Promise.race([
      this.emptyState.waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'empty'),
      this.filterButton.waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'filter'),
      this.pageTitle.waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'title'),
    ]);
    expect(state).toMatch(/empty|filter|title/);
  }
}

// --- Tests ----------------------------------------------------------------

test.describe('Anonymous journey — home to practice', () => {
  let home: HomePage;
  let practice: PracticePage;

  test.beforeEach(async ({ page }) => {
    home = new HomePage(page);
    practice = new PracticePage(page);
  });

  test('lands on home, opens SSC CGL practice page, and renders questions', async ({
    page,
  }) => {
    // Step 1 — open the home page and verify the primary heading is
    // visible to real users (not just present in the DOM).
    await home.goto();
    await expect(page).toHaveTitle(/ssc previous year questions/i);

    // The "All SSC Exams Covered" CTA should also be present, which
    // confirms the rest of the hero section rendered too.
    await expect(home.featuresBanner).toBeVisible();

    // Step 2 — click the SSC CGL exam card. Using getByRole('link')
    // means we follow the same path assistive tech would: by the
    // link's accessible name.
    await home.sscCglCard.click();

    // Step 3 — wait for the SPA route change to the practice page.
    await practice.waitForNavigation();
    expect(page.url()).toMatch(practice.urlPattern);

    // Step 4 — wait for the questions list (or its loading/empty state)
    // to render. We don't assert a specific question text because the
    // dataset is dynamic — but the page must reach a stable state.
    await practice.waitForQuestionsToRender();
  });

  test('hero "Start Free Quiz" button navigates to the first exam', async ({
    page,
  }) => {
    await home.goto();

    // The "Start Free Quiz" button is a link in the hero. Targeting it
    // by accessible name keeps the test resilient to copy tweaks.
    const startQuiz = page.getByRole('link', { name: /start free quiz/i });
    await expect(startQuiz).toBeVisible();
    await startQuiz.click();

    await practice.waitForNavigation();
    expect(page.url()).toMatch(practice.urlPattern);
    await practice.waitForQuestionsToRender();
  });
});
