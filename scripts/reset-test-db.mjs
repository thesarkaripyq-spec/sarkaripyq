import { Client } from "pg";
import { config } from "dotenv";

// Destructive on purpose (truncates catalog + user-owned tables) - only
// ever meant to run against the dedicated Phase 5 test project, never
// production. Always reads .env.test, never .env.local.
config({ path: ".env.test" });

const TEST_PROJECT_REF = "gadeobjbzjnpuvwvbrdq";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("SUPABASE_DB_URL is not set in .env.test.");
  process.exit(1);
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(TEST_PROJECT_REF)) {
  console.error(
    `Refusing: .env.test's NEXT_PUBLIC_SUPABASE_URL does not contain the ` +
      `test project ref (${TEST_PROJECT_REF}). Got: ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(empty)"}.`,
  );
  process.exit(1);
}

const client = new Client({ connectionString: dbUrl });
await client.connect();

try {
  await client.query(
    "truncate exams, subjects, papers, questions, options, bookmarks, practice_attempts, question_reports restart identity cascade;",
  );
  console.log("Test project catalog and user-owned tables truncated.");
} finally {
  await client.end();
}
