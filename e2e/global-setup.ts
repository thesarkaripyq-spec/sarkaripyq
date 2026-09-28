import { config } from "dotenv";

// Refuses to run at all unless .env.test points at the dedicated Phase 5
// test project - never production. Hardcoded on purpose: this is a fixed
// expected value to check .env.test against, not something that should
// itself come from an env var (that would just be checking .env.test
// against itself).
const TEST_PROJECT_REF = "gadeobjbzjnpuvwvbrdq";

// This runs in Playwright's own Node process, which - unlike the `next
// build`/`next start` child processes it spawns - has no built-in
// .env.test loading of its own, so .env.test is loaded explicitly here
// rather than assumed to already be in process.env.
export default function globalSetup(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      `Refusing to run e2e tests: NODE_ENV is "${process.env.NODE_ENV}", not "test". ` +
        `Next.js only loads .env.test (and skips .env.local entirely) when ` +
        `NODE_ENV=test - run this via "npm run test:e2e", not "playwright test" directly.`,
    );
  }

  const result = config({ path: ".env.test" });
  if (result.error) {
    throw new Error(`Refusing to run e2e tests: couldn't load .env.test (${result.error.message}).`);
  }

  const url = result.parsed?.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.includes(TEST_PROJECT_REF)) {
    throw new Error(
      `Refusing to run e2e tests: .env.test's NEXT_PUBLIC_SUPABASE_URL does not match ` +
        `the test project (expected it to contain "${TEST_PROJECT_REF}"). Got: ` +
        `${url || "(empty)"}. This check exists specifically so a misconfigured ` +
        `.env.test can never let tests run against the production project.`,
    );
  }
}
