import { test, expect } from "@playwright/test";

const PUBLIC_PAGES = ["/", "/ssc", "/ssc/cgl", "/ssc/cgl/pyq", "/practice", "/practice/quantitative-aptitude", "/books"];

test.describe("SEO: key public pages", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} has title, description, canonical, and exactly one h1`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);

      await expect(page).toHaveTitle(/.+/);
      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveAttribute("content", /.{10,}/);

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      const href = await canonical.getAttribute("href");
      expect(href).toBeTruthy();

      await expect(page.locator("h1")).toHaveCount(1);
    });

    test(`${path} has at least one valid JSON-LD block`, async ({ page }) => {
      await page.goto(path);
      const scripts = page.locator('script[type="application/ld+json"]');
      const count = await scripts.count();
      expect(count).toBeGreaterThanOrEqual(1);

      for (let i = 0; i < count; i++) {
        const raw = await scripts.nth(i).textContent();
        expect(() => JSON.parse(raw ?? "")).not.toThrow();
      }
    });
  }
});

test.describe("SEO: sitemap and robots", () => {
  test("sitemap.xml returns 200 with real XML content", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("<urlset");
    expect(body).toContain("<url>");
  });

  test("robots.txt returns 200 and disallows private/auth pages", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    for (const path of ["/api/", "/login", "/signup", "/dashboard", "/bookmarks", "/profile"]) {
      expect(body).toContain(`Disallow: ${path}`);
    }
    expect(body).toContain("Sitemap:");
  });
});

test.describe("SEO: private and auth pages are noindexed", () => {
  // /dashboard, /bookmarks, /profile redirect to /login when logged out
  // (checked here, unauthenticated), so this actually verifies /login's
  // own noindex tag for those three via the redirect chain - still a
  // meaningful assertion (an unauthenticated visit never exposes an
  // indexable page), just not each page's own metadata independently.
  const noindexPages = ["/login", "/signup", "/forgot-password", "/dashboard", "/bookmarks", "/profile", "/search"];

  for (const path of noindexPages) {
    test(`${path} sets robots noindex`, async ({ page }) => {
      await page.goto(path);
      const robotsMeta = page.locator('meta[name="robots"]');
      await expect(robotsMeta).toHaveAttribute("content", /noindex/);
    });
  }
});
