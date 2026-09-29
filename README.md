# SarkariPYQ

A free SSC (Staff Selection Commission) exam-prep site: previous-year
questions organized by exam, year, tier and shift, practice by subject,
a leaderboard, and per-user progress tracking. Not affiliated with SSC
or the Government of India.

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript
- **Tailwind CSS**
- **Supabase** — Postgres (with RLS), Auth, hosted on the free tier
- **Zod** for API input validation
- **Vitest** (unit tests) + **Playwright** (e2e/integration/security/SEO tests)
- **Lighthouse CI** for performance/accessibility/SEO regression checks

See `AGENTS.md` before writing code that touches Next.js APIs directly —
this project tracks Next's latest breaking changes, which may differ
from older training data.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase
   project's values (URL, anon key, service-role key — the last one is
   **required**, not optional; the app fails to boot in production
   without it, and warns in development). `NEXT_PUBLIC_SITE_URL`
   defaults to `http://localhost:3000` if unset.
3. `npm run dev` — starts the dev server at `http://localhost:3000`.

Database schema: `supabase/migrations/*.sql`, applied in filename order.
`npm run db:migrate` runs them all against whatever `SUPABASE_DB_URL`
points at in `.env.local` (a direct Postgres connection string, from
Supabase Dashboard → Project Settings → Database — this is separate
from the anon/service-role keys and only used by this script). See
"Adopting the Supabase CLI" in `AUDIT.md` for the CLI-based path
(`supabase migration new`, `supabase db push`) this project is
transitioning toward instead of that script, if you're setting up a
fresh project rather than an already-migrated one.

Sample catalog data (exams, subjects, papers, questions — not real user
accounts): `npm run db:seed`. The real PYQ corpus is imported separately
via the offline pipeline in `scripts/testranking/`, not this file.

## Testing

This project has four distinct kinds of tests, each covering something
the others don't:

| Command | What it runs | Needs |
|---|---|---|
| `npm run test:unit` | Vitest unit tests — pure `src/lib/` functions, mocked Supabase calls | Nothing extra |
| `npm run test:coverage` | Same as above, plus a coverage report (`coverage/index.html`) | Nothing extra |
| `npm run test:e2e` | Playwright — every page, every API route, security regressions (open redirect, CSP, RLS), SEO checks, against a **real, separate Supabase test project** | A test project + `.env.test` (see below) |
| `npm run lighthouse` | Lighthouse CI — Performance/Accessibility/Best Practices/SEO scores on key pages, mobile thresholds | `.env.local` filled in (audits real pages) |

### Unit tests (`npm run test:unit` / `npm run test:coverage`)

Cover `src/lib/`'s pure logic (level calculation, rate limiting,
same-origin checks, JSON-LD escaping, the statement-timeout retry
wrapper, env validation) with mocked or constructed inputs — no network,
no real database. Fast, safe to run constantly. See `AUDIT.md` for the
current coverage number and which paths are covered by e2e instead
(data-fetching functions in `src/lib/data/`, API route logic — Playwright
runs in a separate process, so this coverage tool has no visibility
into that execution even though it's real, tested code).

### End-to-end / integration / security / SEO tests (`npm run test:e2e`)

Runs against a **real, separate Supabase project** — never production,
and never mocked. This is deliberate: RLS policies, real auth flows,
and real CSP headers can't be verified against a mock.

**One-time setup, before the first run:**

1. Create a free Supabase project dedicated to testing (separate from
   whatever `.env.local` points at).
2. Apply the schema: `supabase link --project-ref <test-project-ref>`
   then `supabase db push` (or the CLI walkthrough in `AUDIT.md` if
   you're instead adopting the CLI on an already-migrated project).
3. Copy `.env.test.example` to `.env.test` and fill in the test
   project's own URL/keys. **Never point `.env.test` at the same
   project as `.env.local`** — this suite creates and deletes real
   auth users and writes real rows.
4. `npm run db:seed:test` — seeds the test project with a small
   catalog fixture (`supabase/seed/0001_sample_data.sql`).

**Then just run `npm run test:e2e`.** It builds and starts a real
production server with `NODE_ENV=test` (which makes Next load
`.env.test` and skip `.env.local` entirely — verified empirically, see
`AUDIT.md` Phase 5), then runs the full suite: every page, every API
route's success/validation/auth/rate-limit behavior, open-redirect and
CSP regression tests, a direct RLS check (two real signed-in users, one
can't read or write the other's data), and SEO checks (titles,
canonicals, JSON-LD, noindex on private pages).

If port 3000 is already in use (e.g. `npm run dev` running in another
terminal), override it: `PLAYWRIGHT_PORT=3100 npm run test:e2e`.

**Reset the test project's data** (if it drifts, or after changing the
seed file): `npm run db:reset:test` — truncates and re-seeds. Refuses
to run against anything that isn't unmistakably the test project
(checked against a hardcoded project ref, independent of whichever
`.env.test` happens to be on disk).

One test (`auth-signup.spec.ts`'s real-signup happy path) can
legitimately **skip** rather than pass — Supabase's built-in mailer is
hard-capped at 2 emails/hour and that specific test needs to send one.
See `LAUNCH_CHECKLIST.md` for the custom-SMTP fix; the test is written
to skip cleanly on this rather than flake red.

### Lighthouse (`npm run lighthouse`)

Builds, starts a real production server, and audits 6 key pages on
simulated mobile (matching Lighthouse's default "Moto G Power, slow 4G"
profile) against `.env.local` (real data, not the test project — this
measures real page weight/rendering, which the test project's small
seed dataset wouldn't represent accurately). Thresholds are enforced
(the command exits non-zero if any page misses one): Performance ≥85,
Accessibility ≥90, Best Practices ≥90, SEO ≥95. Override the port with
`LHCI_PORT=<port>` if 3000 is taken.

## All scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Start a production server (run `build` first) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:unit` | Vitest unit tests |
| `npm run test:coverage` | Vitest unit tests + coverage report |
| `npm run test:e2e` | Full Playwright suite against the test project |
| `npm run lighthouse` | Lighthouse CI against `.env.local` |
| `npm run db:migrate` | Apply `supabase/migrations/*.sql` to `SUPABASE_DB_URL` |
| `npm run db:seed` | Apply `supabase/seed/*.sql` to `SUPABASE_DB_URL` (`.env.local`) |
| `npm run db:seed:test` | Same, against `.env.test` |
| `npm run db:reset:test` | Truncate + reseed the test project |

## CI

`.github/workflows/ci.yml` runs lint/typecheck/unit-tests-with-coverage/
build on every push and PR, then the full e2e suite against the test
project if those pass. No deploy step — deployment is intentionally out
of scope for this repo's current pass; see `LAUNCH_CHECKLIST.md`.

Needs three repository secrets before the workflow will actually run
(Settings → Secrets and variables → Actions): `TEST_SUPABASE_URL`,
`TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY` — the test
project's own values, never production's.

## More context

- **`AUDIT.md`** — the full production-hardening audit this project has
  gone through: every finding, what was fixed and why, what's still
  open (search-timeout root cause, production CLI migration adoption),
  and the reasoning behind non-obvious decisions (static/ISR rendering,
  the CSP approach, the test-isolation mechanism).
- **`LAUNCH_CHECKLIST.md`** — everything left before this goes live,
  in order.
- **`AGENTS.md`** — Next.js version-specific guidance for anyone (human
  or AI) writing code here.
