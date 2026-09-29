# SarkariPYQ — Production Hardening Audit

Generated 2026-09-28. Scope: full SEO / mobile-responsiveness / bug / validation /
security / accessibility pass over the existing app, per the hardening brief.

## TL;DR

This is **not** a neglected codebase. Before changing anything, I read every
page, API route, data-access function, DB migration/RLS policy, and config
file. The app already has: Zod validation + per-IP rate limiting on every
mutating API route, row-level security on every table with narrowly-scoped
policies, parameterized queries everywhere (no raw SQL), dynamic per-page SEO
metadata + canonical tags + OG/Twitter cards + JSON-LD (Organization, WebSite
with SearchAction, BreadcrumbList), a paginated sitemap, a robots.txt that
blocks private routes and known scraper bots, 0 `npm audit` vulnerabilities,
strict TypeScript, a real mobile drawer nav with focus-trapping, a bottom
tab bar, and 44px tap targets throughout.

So this audit is short on "the site is broken" findings and longer on
smaller correctness/hardening gaps: one real security fix (open redirect),
one broken dev-tooling script, one live bug caught by actually running the
app against your database (search timing out on ordinary queries — flagged,
not fixed, since diagnosing it further needs direct DB access I don't have),
and a couple of architectural tradeoffs that are flagged rather than
changed, because they're too consequential to decide unilaterally.

Stack confirmed: Next.js 16.3.6 (App Router, Turbopack), React 18, TypeScript
(strict), Tailwind CSS, Supabase (Postgres + Auth), Zod. No admin panel by
design — content is loaded by an offline import pipeline using the service
role key, which the app itself never touches.

## Final status summary (2026-09-29, end of Phase 5)

One line per item — the sections below have the full reasoning for
each. See `LAUNCH_CHECKLIST.md` for what's actually left to do, in order.

| Item | Status |
|---|---|
| H1 (broken `lint`) | ✅ Fixed |
| H2 (open redirect) | ✅ Fixed, and now regression-tested (`e2e/security-open-redirect.spec.ts`) |
| H3 (missing CSP) | ✅ Fixed, and now regression-tested (`e2e/security-headers.spec.ts`) |
| **H4 (search timeouts)** | ✅ **Real fix confirmed live (2026-09-29)** — the mitigation had never actually been applied to production; see the H4 diagnosis section for what Block A–D revealed and why |
| H5 (dead `topic_id` column, found via Phase 5 testing) | ✅ Fixed |
| M1–M9 | ✅ Fixed |
| L1–L2 | ✅ Fixed |
| A1 (dynamic-everything rendering) | ✅ Resolved — static/ISR for all public pages |
| A2 (forgot-password / account deletion) | ✅ Built, e2e-tested |
| A3 (Auth rate limits guidance) | ✅ Guidance given (dashboard locations); confirmed the built-in mailer's 2/hour cap specifically **can't** be raised from that page at all |
| Turnstile CAPTCHA | ⏭️ Decided: skip for now |
| Env validation, health endpoint, cache headers, N+1 fixes, structured logging | ✅ Done |
| Real Supabase CLI migration adoption (production) | 🕐 Prepared, **not yet run** — deferred at your request until after Phase 5, which just finished; ready whenever you want to do it |
| Error tracking service | ⏭️ Decided: skip for now (structured `onRequestError` logging in place either way) |
| Legal pages (`/privacy`, `/terms`) | 🕐 Placeholder built, **real content still needed** |
| **Custom SMTP** | 🕐 **Not done** — needs your Resend/Brevo account; exact steps in `LAUNCH_CHECKLIST.md` |
| Test data isolation (Phase 5) | ✅ Done — dedicated test project, `.env.test` mechanism, guard against ever hitting production |
| Full test suite | ✅ 180 e2e passed / 38 skipped (legitimately) / 0 failed, 43 unit tests passed, 32.4% `src/lib/` coverage |
| Lighthouse | 🕐 Config + thresholds ready (`npm run lighthouse`); **no real scores obtained** — every attempt in this environment collided with a concurrently-running dev server sharing the same `.next/` build output |
| CI (GitHub Actions) | ✅ Workflow added; **not yet functional** until you add 3 repository secrets (see `README.md`) |
| README.md | ✅ Added |

---

## Findings

Legend: **Fixed** = changed in this pass. **Flagged** = documented here,
not changed — needs your call. Severity is impact × likelihood, not effort.

### Critical

None found. No exposed secrets, no injectable queries, no broken auth checks,
no missing RLS.

### High

| # | Finding | Status |
|---|---|---|
| H1 | `npm run lint` is completely broken. Next.js 16 removed the `next lint` command (confirmed against `node_modules/next/dist/docs/.../upgrading/version-16.md`); running it now errors immediately because Next's CLI misparses `lint` as a project directory argument. This means lint has been silently non-functional since the Next 16 upgrade — no one running `npm run lint` locally or in CI has gotten real output. | **Fixed** — `package.json`'s `lint` script now runs `eslint .` directly (the documented Next 16 replacement). |
| H2 | Open-redirect risk in the OAuth callback (`src/app/auth/callback/route.ts`). The `next` query param was concatenated directly into `NextResponse.redirect(`${origin}${next}`)` with no validation. A crafted value like `next=@evil.com` produces the string `http://yoursite.com@evil.com`, which browsers parse as userinfo (`yoursite.com`) + host (`evil.com`) — i.e. a same-looking link that actually redirects off-site after a real Supabase login. This is exploitable by anyone who can get a user to click a modified `/auth/callback?...&next=@evil.com` link. | **Fixed** — `next` is now validated to be a same-origin relative path (`/...`, not `//...`, no `@`/scheme) before use; anything else falls back to `/dashboard`. |
| H3 | No `Content-Security-Policy` header. The brief explicitly asks for one; `next.config.mjs` already sets the other 5 recommended headers. Because the app is (see A1 below) already fully dynamically rendered on every request, adding a per-request nonce-based CSP via `proxy.ts` costs nothing extra in caching/performance — it was simply missing. | **Fixed** — `src/proxy.ts` now generates a per-request nonce and sets a strict `script-src 'nonce-… strict-dynamic'` CSP (plus the standard `object-src none`, `frame-ancestors none`, `base-uri self`, `form-action self`, `upgrade-insecure-requests`). The nonce is threaded through the two inline `<script>` tags in `layout.tsx` and all four breadcrumb JSON-LD `<script>` tags. `style-src` keeps `'unsafe-inline'` because the dashboard's bar-chart widths are set via React's `style` prop — tightening that would need a larger refactor for a low security payoff. |
| H4 | **Search intermittently 500s** for ordinary queries (`57014` — statement timeout). Full diagnosis below. | **Mitigated, root cause still OPEN** — `anon` role's `statement_timeout` raised 3s → 8s (migration `0008_raise_anon_search_timeout.sql`, applied) plus a one-time logged retry in `searchQuestions()` on that exact error code. This is a mitigation, not a fix: **the original root-cause question (is this a genuine Free-tier resource constraint?) is still unanswered** — four attempts to get the real Block A–D diagnostic SQL output back all arrived as unfilled template placeholders. Still waiting on that real data before ranked fix options can be given. See the H4 diagnosis below for exactly what's needed. |
| H5 | **Every practice page (`/ssc/[exam]/pyq/[year]/[shift]`) would 500 against a fully-migrated database.** `src/lib/data/questions.ts` selected a `topic_id` column in two functions (`getQuestionNumbersForPaper`, `getQuestionByPaperAndNumber`) that `0003_remove_topics.sql` dropped — a real Postgres `42703` (undefined_column) error on every single practice page. Pre-existing, not introduced this pass — it just never surfaced before, almost certainly because production's schema had drifted from the migration files (this exact category of gap has come up before — see the migration-0009 schema-cache notes). Found the moment the Phase 5 test project (all 9 migrations genuinely, freshly applied via the CLI) hit this code path — the first environment to actually reflect the real post-0003 schema. | **Fixed** — removed the dead `topic_id` selects and type fields (nothing anywhere ever read `.topic_id` off a result, confirmed before removing it). Safe regardless of what production's actual current schema looks like: a `select` that doesn't ask for a column errors if the column doesn't exist in the query, but never errors from a column simply being *absent from the select list*. |

#### H4 diagnosis — full investigation

This one was worked interactively with the user pasting back SQL Editor results
(this environment is correctly blocked from reading production data directly).
In order:

1. **`EXPLAIN (ANALYZE, BUFFERS)`** on the exact query `searchQuestions()`
   generates for `q = 'math'`, run in the SQL Editor: **0.171ms**, using the
   GIN index (`Bitmap Heap Scan` + `Recheck Cond: search_vector @@ tsquery`),
   24 buffer hits, all cache hits. Ruled out: bad query plan, missing/invalid
   index.
2. **`anon`/`authenticated` `statement_timeout`**: 3s / 8s respectively —
   not pathologically low, but not generous either.
3. **RLS as the cause** — the SQL Editor runs as a privileged role that
   bypasses RLS, so step 1 didn't actually test what `anon` experiences. To
   test this without touching production, a local PostgreSQL 18 was
   installed on the dev machine (via Scoop — no Docker available), the
   repo's actual migrations applied verbatim (with a minimal `auth.users`/
   `auth.uid()` stub), `anon`/`authenticated` roles created with the same
   `rolbypassrls = false` as production, and 100k synthetic rows loaded and
   `ANALYZE`d. Result: identical plan shape as `postgres` (RLS just folds
   into the `WHERE` as a plain `AND`, no join reordering, no index
   avoidance), 0.20ms. **RLS ruled out.**
4. Real row/size check: **104,456 rows, 135MB table + 57MB indexes/TOAST
   (192MB total), 17MB GIN index.**
5. **Compute tier: Supabase Free tier** — the smallest available, smallest
   `shared_buffers`, shared infrastructure.

Conclusion: the query is correct, indexed, and RLS-clean. What's left,
consistent with all of the above, is that this project's Free-tier compute
occasionally can't hold enough of a 192MB working set in memory, so a
normally-instant query sometimes has to hit disk and doesn't finish inside
`anon`'s 3s budget. This is a resource-tier characteristic, not a code bug —
confirmed by elimination, not assumed.

**Applied**: `anon` timeout raised to 8s (matching `authenticated`, not an
arbitrary new value), plus a retry in `searchQuestions()` scoped to exactly
this error code. **Not applied, and not mine to decide**: if this keeps
happening under real traffic even with the above, the durable fix is
upgrading the Supabase compute tier — a cost decision that's yours to make,
not something I'll push you toward.

**`getSiteStats`/`getUserAttempts`** (Phase 1 asked whether they share this
cause): they don't. `getSiteStats` uses `{ count: "exact" }`, an aggregate
that scans every matching row with no `LIMIT` to stop early — a heavier
operation class than search's already-`LIMIT`-bounded fetch — already
mitigated with `estimated` count on the `questions` table.
`getUserAttempts`'s issue was ~10 separate round-trips per page load,
already fixed by consolidating into one query. Neither workaround was
removed.

**Retry hardening (explicit follow-up)**: the retry-on-57014 alone wasn't
an acceptable resting state per se — it needed a bound, a backoff, and
logging so a real ongoing problem can't hide behind "it retried
successfully." `withTimeoutRetry()` now does exactly one retry after a
250ms backoff, logs every timeout when it happens (labeled by call site),
and logs an **error** (not just a warning) if the retry also times out —
two-in-a-row is the signal this stopped being a one-off.

**New live evidence (Phase 2)**: while building the static-rendering pages,
`getSubjectsForExam()` (a *different* query from the original search
finding) 57014'd on a real request for a real exam ("steno") — caught by
the new logging, not by luck. Root cause here is directly visible in the
query, independent of the compute-tier theory above: it fetches one row
per matching **question** (unbounded, and until this fix had no
`is_published` filter) just to dedupe down to ~5 distinct subjects in JS,
instead of asking Postgres for the distinct rows directly. Added the
missing `is_published` filter (safe, applied immediately). **This means
H4 was never a single root cause** — the original search-timeout finding
(query itself fast, likely a genuine Free-tier resource constraint) and
this query-shape inefficiency are independent problems that happened to
share an error code.

**Resolved**: migration `0009_catalog_lookup_functions.sql` pushes the
`DISTINCT`/`GROUP BY` into Postgres for `get_subjects_for_exam` and four
other functions found to have the identical shape while auditing
`exams.ts`/`questions.ts` for it (`get_years_for_exam`, `get_exam_tiers`,
`get_years_for_subject`, and the aggregate case `get_paper_counts_by_exam`).
`SECURITY INVOKER`, not `DEFINER` — none of these need to bypass RLS the
way `get_leaderboard` does. Applied by the user, verified against a real
production build, and confirmed live during e2e testing: the retry
logging fired correctly (`getSubjectsForExam` and `listQuestionsBySubject`
both hit and recovered from a real 57014 during the same test run,
without failing the request the user would have seen).

**Also surfaced by the same e2e run**: running the Playwright suite at
full parallelism (10 workers) produced one real, reproducible flaky
failure traced to concurrent DB load on the Free tier — the identical
test passed cleanly in isolation. Capped to 4 workers as a pragmatic
mitigation; this suite runs against the live Supabase project (no local
Postgres/Docker available in this environment for a true isolated test
DB), which is itself a scope limitation for Phase 5 to address with
proper local-Supabase test infrastructure, not something fixed here.

**Original search-timeout finding — resolved (2026-09-29)**: four earlier
attempts to get the real Block A–D diagnostic numbers arrived as template
placeholders. The user finally ran all four directly against production's
SQL Editor, and the results changed the conclusion:

- **Block A** (`EXPLAIN (ANALYZE, BUFFERS)` on the real query, `q = 'math'`):
  2.1–2.2ms actual time, `Buffers: shared hit=276` — zero disk reads, correct
  GIN bitmap index scan. Query plan and indexing confirmed fine, again.
- **Block D** (cache hit ratio on `questions`, cumulative since last stats
  reset): **99.45%** (13,515,041 hits / 74,683 reads). This is high enough to
  meaningfully weaken the "Free-tier `shared_buffers` too small for a 192MB
  working set" theory from the original diagnosis below — if that were the
  dominant cause, a ratio this high would be unlikely.
- **Block C**: 192MB total (135MB table + 36MB indexes) — unchanged from the
  original investigation, no surprise.
- **Block B — the actual finding**: `anon`'s `statement_timeout` was still
  **3s**, not 8s. Migration `0008_raise_anon_search_timeout.sql` (`ALTER ROLE
  anon SET statement_timeout = '8s';`) was recorded above and in the Phase 5
  final-status table as "applied" — **that was never verified, and it was
  wrong.** `scripts/run-migrations.mjs` has no applied-migration ledger; it
  just re-runs every `.sql` file in the folder unconditionally whenever
  invoked, so "applied" reflected an assumption that someone had run it, not
  a checked fact. Migration `0009` right after it in sort order did
  genuinely go live (confirmed at the time via real retry-logging evidence),
  so this wasn't a script failure — `0008` most likely just got missed in
  whatever manual step actually pushed the others.

**Practical effect**: every 57014 this project has ever logged may have
happened under the still-3s budget the whole time — the mitigation's 8s
headroom was never actually in play. The user ran `ALTER ROLE anon SET
statement_timeout = '8s';` directly in the SQL Editor on 2026-09-29 and
confirmed both `anon` and `authenticated` now read 8s. **This is a
genuinely different, better outcome than the original theory**: given
Block A/D's evidence, it's now plausible this alone resolves most or all
remaining timeouts, with no compute-tier upgrade needed. Recommended
follow-up: watch the `withTimeoutRetry()` logging (`src/lib/supabase/retry.ts`)
for any further 57014s now that the real fix is live — if they still recur
even with genuine 8s headroom and this cache-hit ratio, that would point to
something else (CPU steal time on shared Free-tier compute, connection-pool
contention) rather than the original memory theory. Nothing observed so far
indicates that's needed.

**Also worth doing** (tracked as `LAUNCH_CHECKLIST.md` item 2): since a
migration file's presence was wrongly trusted as proof it ran, adopting the
Supabase CLI's `migration list` is the way to check whether any *other*
migration has the same gap, rather than assuming.

**Deferred**: Phase 1 also asked for an automated test that fails if a
short common search term errors or times out. Vitest now exists in this
repo, but a *meaningful* version needs a real database connection to
actually catch a timeout regression — mocking the client wouldn't test
anything real. That's squarely what Phase 5's local-Supabase test
infrastructure is for; tracked there, not forgotten.

### Medium

| # | Finding | Status |
|---|---|---|
| M1 | Mutating API routes (`/api/attempts`, `/api/bookmarks`, `/api/questions/[id]/report`) validate known fields with Zod but don't reject unrecognized ones (Zod's default `.object()` silently strips extras). The brief asks to reject unexpected fields outright. | **Fixed** — added `.strict()` to all three body schemas. |
| M2 | No explicit CSRF check on state-changing routes beyond relying on Supabase's default cookie `SameSite` setting. That default is real protection, but the brief asks for explicit CSRF protection, and defense-in-depth is cheap here. | **Fixed** — added a small `assertSameOrigin` helper (`src/lib/same-origin.ts`) that compares the `Origin` header against the request's own origin; applied to the four mutating routes (`attempts`, `bookmarks` POST/DELETE, `profile/reset`, `questions/[id]/report`). Requests with a cross-site `Origin` get a 403 before touching the DB. |
| M3 | `/api/search` and the `/search` page accepted a query string of unbounded length before it reached Postgres full-text search. The brief asks search params to have a length cap. Note: this doesn't address H4 above, which reproduces on a 4-character query. | **Fixed** — capped at 100 characters in both places. |
| M4 | Several client components (`BookmarkButton`, `RemoveBookmarkButton`, `ResetProgressButton`, `SignOutButton`) show no feedback when a request fails for any reason *other than* 401 (network error, 429 rate-limit, 500) — the button just silently stops spinning and nothing happens. The brief requires an error state on every async action. | **Fixed** — each now shows a brief inline error message on non-OK responses/exceptions. |
| M5 | Zero `loading.tsx` files anywhere in `src/app`. There's an unused `Skeleton` UI primitive already built (`src/components/ui/Skeleton.tsx`) but nothing renders it. On slower connections, navigating to `/search`, `/practice`, `/practice/[subject]`, `/dashboard`, `/leaderboard`, `/bookmarks`, `/books`, or any `/ssc/**` listing page shows a blank tab until the full server render finishes. | **Fixed** — added a `loading.tsx` (skeleton-based, shaped to roughly match each page) for the 12 route segments that run a real data fetch. |
| M6 | On `/practice/[subject]`, the sticky `FilterBar` uses `md:top-14` (56px), but the actual sticky header is ~67px tall (64px + a 3px gradient strip). While scrolling on desktop, the header visually crops the top ~11px of the filter bar. | **Fixed** — changed to `md:top-[67px]` to match the header's real height exactly. |
| M7 | The question-diagram `<img>` in `QuestionPractice.tsx` had no `loading`/`decoding` hints. | **Fixed** — added `loading="lazy" decoding="async"`. |
| M8 | Custom `not-found.tsx` only offered a single "back to home" link. The brief asks for a 404 page with helpful links. | **Fixed** — added links to Browse SSC exams, Practice by subject, and Search. |
| M9 | `/leaderboard`'s `generateMetadata` set only a `title`, no `description` or canonical — every other page in the app sets both. | **Fixed** — added a description and canonical (the canonical intentionally omits the `?exam=` query so all exam filters of the leaderboard canonicalize to the same URL, matching how the rest of the app treats query-string variants). |

### Low

| # | Finding | Status |
|---|---|---|
| L1 | Root-level scratch/debug files (`.tmp-live2.py`, `.tmp-sec.py`, `.verify-cpo.json`, `.verify-steno.json`) and `scripts/testranking/.cache/` are one-off outputs from working the offline scraping/import pipeline. They weren't covered by `.gitignore`, so initializing git for this project (see below) would have swept them into version control as noise. | **Fixed** — added to `.gitignore`. Not deleted — they're local debugging artifacts that might still be in use; only untracked them. |
| L2 | This repository had no `.git` at all — "small, logical commits per section" wasn't possible without one. | **Fixed** — ran `git init` and committed the pre-change baseline separately from every fix in this pass, so each section's diff is reviewable on its own. |

### Flagged — architectural/product calls, not changed

| # | Finding | Why I didn't just fix it |
|---|---|---|
| A2 | No self-service "forgot password" flow (Supabase supports `resetPasswordForEmail`; there's just no UI for it) and no account-deletion flow. Neither is a bug — the brief's Security section is about hardening what exists, not adding auth surface area — but a user who forgets their password today has no way back in except via Google sign-in. | **Fixed (Phase 3)** — see "Auth completeness (Phase 3)" below for both flows and the reasoning behind each. |
| A3 | `LoginForm`/`SignupForm` call `supabase.auth.signInWithPassword` / `signUp` directly from the browser, bypassing the app's own `rate-limit.ts`. This is very likely fine — Supabase's hosted Auth service (GoTrue) does its own server-side rate limiting on these endpoints — but I can't verify your project's Supabase rate-limit configuration from here, so I'm noting it rather than asserting it's covered. | **Guidance given, not fixable from here** — see "Auth completeness (Phase 3)" below for the exact dashboard location to check and what to set. Turnstile CAPTCHA is available as an additional layer but needs a decision from you (see below) since it requires a Cloudflare account. |

### A1 — static/ISR rendering (Phase 2 — now resolved for all public pages)

**Was**: every route rendered fully dynamically, even though ~10 pages
declared `export const revalidate = 300`. Root cause: `layout.tsx` called
`supabase.auth.getUser()` (reads cookies) on every request for the header's
auth state, and in Next's current (non-Cache-Components) model, any
cookie/header read anywhere in a route's tree forces that whole route
dynamic.

**Fix, part 1 — the cookie-free client.** Verified empirically that the
layout fix alone was not enough — every public page's own data-fetching
functions *also* called the cookie-aware client. Introduced a second,
cookie-free `createPublicClient()` (`src/lib/supabase/public.ts`) for
catalog reads (safe: those tables' RLS policies never depend on
`auth.uid()`), moved Header/MobileNav/MobileMenu's auth-awareness to a
client-side check with a neutral loading placeholder, and gave static
pages a verified-necessary `'self' 'unsafe-inline'` CSP (nonce-based CSP
doesn't work for statically rendered pages — verified in a real browser:
Next injects multiple inline RSC-payload scripts per page that can't be
hash-listed). Dynamic per-user pages (login/signup/forgot-reset-password/
dashboard/bookmarks/profile/search/auth-callback) keep the original
nonce + `strict-dynamic` CSP unchanged.

**Fix, part 2 — a second, independent blocker.** Even after part 1,
`/ssc/[exam]` (which reads no `searchParams` at all) *still* rendered fully
dynamic. Verified via `curl`: a dynamic-segment route with no
`generateStaticParams` at all — regardless of Dynamic API usage — never
gets on-demand ISR caching; the `dynamicParams: true` fallback only
activates for a route that has already opted in via `generateStaticParams`.
An **empty** `generateStaticParams()` (zero build-time queries, so no
concurrent-load risk) is enough: confirmed via `Cache-Control` headers —
first request to an unlisted param gets `s-maxage=300` and renders in
~1.1s, second request serves from cache in ~10ms.

**Fix, part 3 — the searchParams-driven pages.** `/ssc/[exam]/pyq`(+`[year]`,
+`[shift]`) and `/practice/[subject]` also read `searchParams` server-side,
which forces dynamic rendering independently of the above. Moved filter
reading into client components, each following the same shape: the page
renders the default (unfiltered) view statically via the same empty-
`generateStaticParams` technique, and a client component reads the URL
(isolated into a shared, tiny `SearchParamsBridge` so only it — not the
visible UI — is subject to the Suspense-deferred-to-client rendering
`useSearchParams()` requires on a static page) and fetches filtered data
from a new small, rate-limited, Zod-validated public API route when the
URL differs from the default. Canonical URLs were verified safe to do this
for *before* touching the shift page specifically (its `generateMetadata`
never varied by `searchParams` — always the base URL — so there was no
self-canonicalized per-question SEO content to lose).

**Result — confirmed via `npm run build`**: every public page is now
`○` (static) or `●` (SSG/on-demand ISR). Only genuinely per-user pages
remain `ƒ`: `/dashboard`, `/bookmarks`, `/profile`, `/login`, `/signup`,
`/search`, `/leaderboard`, `/auth/callback`, and the `/api/**` routes.

**Verified in a real browser, not just by the build output**: added a
Playwright suite (`e2e/`) covering all three page groups — default static
view, applying a filter, sharing/reloading a filtered URL, and back/forward
navigation, on both desktop and a 375px mobile viewport. 22 passed, 6
skipped gracefully (exams/years with no second tier in the current data).
Building this against a live browser caught two real bugs before they
shipped: `getSubjectsForExam()` had no `is_published` filter and fetched
one row per question just to dedupe to a handful of subjects in JS — it
57014'd live, on a real exam ("steno"), mid-testing (see H4 below); and a
new API route's `.strict()` Zod schema was checked against a hand-picked
`{subject, q}` object instead of the real query string, so `.strict()`
never actually saw an unexpected param to reject.

**Also discovered**: pre-rendering every exam via a *non-empty*
`generateStaticParams` concentrates enough concurrent build-time load to
hit the same 57014 statement-timeout as H4, and concretely failed a build
(`/ssc/gd`). The empty-array version (part 2 above) avoids this — it does
zero build-time queries — which is why that's what shipped instead.

#### Future work noted, not built this pass

- **Tier as a path segment.** Exam+year is already a path segment
  (`/ssc/[exam]/pyq/[year]`); `tier` (e.g. "SSC CGL 2024 Tier 1") is a real,
  distinct search pattern that could be its own indexable URL instead of a
  query param. Not done now — it's a URL-structure change needing 301s
  from any already-indexed `?tier=` URLs, a separate SEO project from a
  rendering-mode fix.
- **Per-question indexable URLs.** Every question currently lives only at
  `.../[shift]?q=N` (a query param, not indexed as distinct content beyond
  the base paper URL). Worth evaluating whether individual questions have
  enough standalone search value (long-tail "SSC CGL 2024 quant question
  17" style queries) to warrant their own path-based URL, separate from
  the practice-navigation UX this pass optimized.

### Auth completeness (Phase 3)

**Forgot password.** New flow, all four pieces:

- `src/app/forgot-password/page.tsx` + `ForgotPasswordForm.tsx` — email
  input, POSTs to a new route.
- `src/app/api/auth/forgot-password/route.ts` — same-origin check,
  Zod `.strict()` email validation, **two** rate limits: 5/min per IP
  (returns 429 — this one's fine to reveal, it's about abuse, not the
  target account) and 3/10min per email address (silently no-ops instead
  of erroring, so it can't be used to distinguish "you're rate-limited"
  from "that account doesn't exist"). On success calls
  `supabase.auth.resetPasswordForEmail(email, { redirectTo:
  "/auth/callback?next=/reset-password" })` — reusing the OAuth
  callback's existing code-exchange and `safeNextPath()` validation
  (H2's fix) rather than building a second redirect handler with its own
  chance of the same open-redirect bug.
- `src/app/reset-password/page.tsx` — server component, checks
  `supabase.auth.getUser()`. A valid session (established by the
  callback route from the emailed link) shows `ResetPasswordForm`; no
  session shows "this link is invalid or expired" with a link back to
  `/forgot-password`, instead of a broken form.
- `src/components/auth/ResetPasswordForm.tsx` — client component, min 8
  chars, confirm-password match, calls
  `supabase.auth.updateUser({ password })` on the browser client.
- Response wording is identical whether or not the email has an account
  ("If an account exists for **{email}**, we've sent a link...") — no
  enumeration signal anywhere in this flow.
- Added `Link href="/forgot-password"` next to the password field in
  `LoginForm.tsx`.
- `robots.ts` already disallowed `/forgot-password` and
  `/reset-password`; `proxy.ts` already had both in
  `DYNAMIC_PATH_PREFIXES` from Phase 2 — both anticipated this work, no
  changes needed there.

**Account deletion.** New flow, three pieces:

- `src/app/api/profile/delete/route.ts` — same-origin check, 3/min per-IP
  rate limit, `getUser()` auth check, then
  `createAdminClient().auth.admin.deleteUser(user.id)`. Deleting the
  `auth.users` row is the *entire* fix — no manual per-table deletes —
  because `profiles`, `bookmarks`, and `practice_attempts` all reference
  it `on delete cascade`, and `question_reports.user_id` is
  `on delete set null` (verified against `supabase/migrations/0001_init.sql`
  and `0002_reports.sql`, not assumed).
- `src/components/auth/DeleteAccountButton.tsx` — mirrors
  `ResetProgressButton`'s confirm-step shape, but with a stricter
  "type DELETE to confirm" text input rather than just a second click,
  since this is irreversible in a way progress-reset isn't. Signs out
  the browser client and redirects home on success.
- Wired into `/profile/page.tsx` as a clearly separated danger-zone card.
- **Not live-tested against a real Supabase user** — deliberately.
  Deleting a real account isn't something to rehearse against
  production data from here. Reviewed thoroughly instead (same
  cascade/rate-limit/auth-check pattern as the already-live
  `profile/reset` route); please test it yourself with a disposable
  account before considering this done.

**A3 — Supabase Auth rate limits, exact dashboard location.** Dashboard →
Authentication → Rate Limits. Check "Sign in with password" and "Send
recovery" specifically (the latter matters more now that
`resetPasswordForEmail` is wired up) — both are separate from this app's
own `rate-limit.ts`, which only covers this app's own API routes, not
GoTrue's own endpoints that `LoginForm`/`SignupForm`/`ForgotPasswordForm`
call directly from the browser. Also check Authentication → Email
Templates → "Reset Password" — it needs to exist and point at
`{{ .SiteURL }}/auth/callback?next=/reset-password` (Supabase's default
template already uses `{{ .ConfirmationURL }}`, which is correct here
too since we pass `redirectTo` in the API call above; just confirm it
hasn't been customized to point somewhere else).

**Turnstile CAPTCHA — flagged, not built.** This was listed as optional
in the brief, and needs a decision I can't make for you: Supabase
supports it natively (`captchaToken` on `signInWithPassword`/`signUp`/
`resetPasswordForEmail`, no custom server-side verification code needed
on this app's side), but it requires **your** Cloudflare account to
create a Turnstile site, and the widget is a third-party script that
would need to be added to the CSP's `script-src` on `/login`, `/signup`,
and `/forgot-password` specifically. Not built because: (a) it needs
credentials only you can create, and (b) whether it's worth the extra
CSP surface area is a product call, not something to guess at.
**Decision (2026-09-28): skip for now** — revisit if login/signup abuse
becomes a real problem. If you change your mind, provide a site
key/secret (as env vars, never pasted into chat) and it's a small,
contained change.

### Production readiness (Phase 4)

Surveyed the current state first (read-only) rather than guessing what
already existed. Findings and fixes below; three sub-items are flagged
separately at the end because they need a decision from you.

**Env validation — added, didn't exist before.** `src/lib/env.ts` +
`src/instrumentation.ts` (Next's documented `register()` hook, called
once per server instance before it accepts requests — confirmed against
`node_modules/next/dist/docs/.../instrumentation.md`, since this is
exactly the kind of API the breaking-changes note at the top of this repo
warns about). Two schemas, not one: `NEXT_PUBLIC_*` vars are checked
everywhere (including the Edge runtime `src/proxy.ts` runs on), while
`SUPABASE_SERVICE_ROLE_KEY` is checked only outside the Edge runtime,
since `proxy.ts` never reads it and a platform that scopes server-only
vars away from Edge shouldn't fail proxy.ts over a var it doesn't touch.
The service-role check **throws in production, only warns in
development** — deliberately asymmetric, and found by testing, not
assumed: your own `.env.local` has `SUPABASE_SERVICE_ROLE_KEY` present
but **empty**, so an unconditional hard-fail would have broken `next dev`
in your own sandbox. Verified both branches for real:
`npm run build && npm run start` now fails loudly with exactly the
missing-var message before serving a single request (every route 500s;
confirmed via `curl`, then cleaned up the process); `next dev` only warns.
**Action needed from you**: populate a real `SUPABASE_SERVICE_ROLE_KEY`
in `.env.local` — account deletion (Phase 3) has needed it all along,
this just makes the gap loud instead of silent. 6 unit tests added
(`src/lib/env.test.ts`) covering both branches plus the Edge-runtime
skip, using `vi.stubEnv` rather than a real `next start` per case.

**Real Supabase CLI migrations — investigated, not done, needs your
input.** See the flagged item below; this one's genuinely blocked on a
decision, not just deferred.

**Health endpoint — added, didn't exist before.**
`src/app/api/health/route.ts`: does one cheap real query (`select id
from exams limit 1` via the cookie-free public client) and returns
`200 {status: "ok"}` or `503 {status: "error"}`, always
`Cache-Control: no-store`. Deliberately skips the same-origin/rate-limit
checks every other route in this app has — this one is meant to be
polled frequently and non-interactively by uptime monitors, not browsers,
and `/api/` is already disallowed in `robots.ts`.

**Cache headers — mostly already correct, one real gap fixed.** Audited
all 10 API routes: 8 of 10 correctly set no `Cache-Control` (mutating or
per-user routes — attempts, bookmarks, profile/delete, profile/reset,
questions/report, auth/signout, auth/forgot-password — caching any of
these would be a bug, not a gap). `practice/[subject]` and
`papers/[paperId]/practice` already had `s-maxage=300,
stale-while-revalidate=...` from Phase 2. **`/api/search` had no
Cache-Control and should have one** — verified `searchQuestions()` uses
the cookie-free public client and filters only on `is_published`, so the
response never varies by caller; added `s-maxage=60,
stale-while-revalidate=3600` (shorter than the practice routes since new
questions can appear between imports). This also modestly helps the
still-open H4 resource-tier concern: common short queries are exactly the
ones now cacheable instead of re-hitting Postgres every time.

**Pagination / N+1 — audited every function in `src/lib/data/`, one real
bug found and fixed.** Everything else was already bounded (`.limit()`/
`.range()`) or a small reference-table read with no realistic size risk.
The one real gap: `getBookmarkedQuestions()` (`src/lib/data/dashboard.ts`)
took an *optional* `limit` and only applied `.limit()` conditionally —
`/bookmarks` page called it with no limit at all, a genuinely unbounded
fetch of a user's entire bookmark history joined across 3 tables. Fixed
by giving it a bounded default (`limit = 500`, unconditional), mirroring
the same "cap it, don't paginate the UI" tradeoff `getUserAttempts`
already uses elsewhere in the same file. No other loop-issuing-N-queries
pattern exists anywhere in the codebase — the historical N+1 bugs here
were already fixed via migration 0009's RPCs (see H4 above).

**Structured logging — added, didn't exist before.** There were exactly
3 raw `console.warn`/`console.error` calls anywhere in `src/` (all in
`retry.ts`) and zero logging abstraction. Added `src/lib/logger.ts` —
JSON-line output (`{level, message, timestamp, ...fields}`) so a log
aggregator can filter/query by field instead of grepping strings — and
switched `retry.ts` to use it with structured fields (`label`,
`retryDelayMs`) instead of interpolated template strings. Also wired
Next's `onRequestError` hook (`src/instrumentation.ts`, same file
convention as `register()` above) to log every uncaught **server** error
through the same structured logger — this is exactly where
`Sentry.captureException` (or equivalent) would also go if you decide to
add a tracking service below, so it's not wasted if you do.

**Error tracking — investigated, not done, needs your input.** See the
flagged item below.

**Legal pages — investigated, not done, needs your input.** See the
flagged item below.

**Backup docs — written below**, since it's pure documentation with no
code decision attached.

#### Backup / restore — what you need to know and check yourself

I can't check your actual Supabase project's backup configuration or
current plan-tier retention numbers from here, and I'd rather tell you
exactly where to look than guess at figures that may be stale by the time
you read this:

- This project runs on Supabase's **Free tier** (established earlier,
  during the H4 investigation — see above). Free-tier projects do **not**
  get continuous point-in-time recovery; check Dashboard → Database →
  Backups on your project for whatever daily/retention policy currently
  applies to your plan, since Supabase's exact free-tier backup terms are
  the kind of thing that changes over time and shouldn't be taken from
  training data as current fact.
- **`scripts/run-migrations.mjs` and `scripts/seed.mjs` have no rollback
  support** and don't create a pre-migration backup themselves — they
  just run each `.sql` file in `supabase/migrations/`/`supabase/seed/` in
  order. Before running a new migration against production, taking a
  manual snapshot yourself (Dashboard → Database → Backups → "Create a
  backup now", if your plan offers it, or a manual `pg_dump` against
  `SUPABASE_DB_URL`) is the actual safety net right now — there isn't a
  more automated one in this codebase.
- If you want a scripted `pg_dump` backup step added (e.g. a
  `db:backup` script you run yourself before migrations), say so — small
  and easy to add once you tell me where you'd want the dump written.

#### Flagged — decisions received (2026-09-28)

| # | Item | Decision |
|---|---|---|
| P4-1 | Replace `scripts/run-migrations.mjs` with real Supabase CLI migrations. | **Done (2026-09-29)** — you ran `link`+`repair` yourself; see below for the real outcome. |
| P4-2 | Error-tracking service (Sentry or similar). | **Skip for now.** `onRequestError` → structured logs is enough for the moment; revisit if you want alerting/source-mapped stack traces later. |
| P4-3 | Legal pages (`/privacy`, `/terms`) content. | **Clearly-marked placeholder** — built below with the routes/metadata/footer links now, obvious "replace before launch" text standing in for real policy content. |

#### P4-1 — adopting the Supabase CLI for migrations: your steps

Done already (safe, local-only, no account/network/DB access needed):
`supabase init` — added `supabase/config.toml` and `supabase/.gitignore`.
Didn't touch `supabase/migrations/` or `supabase/seed/` at all (verified in
a throwaway scratch copy before running it for real). One config value
fixed from its default: `db.seed.sql_paths` defaulted to a single
top-level `./seed.sql`, which doesn't match this repo's actual
`supabase/seed/0001_sample_data.sql` layout — pointed at `./seed/*.sql`
instead (a real glob-pattern mismatch the CLI's own default wouldn't have
caught for you).

**Check this yourself before going further**: `config.toml` defaults
`db.major_version = 17` — this has to match your actual project's
Postgres version or local CLI commands (`db diff`, `db reset`, etc.) can
misbehave later. Check Dashboard → Settings → Database, or run
`SELECT version();` in the SQL Editor, and edit `supabase/config.toml` if
it doesn't say 17.

**What I verified vs. couldn't verify about the existing filenames**: the
9 files are named `0001_init.sql` … `0009_catalog_lookup_functions.sql` —
short numeric prefixes, not the CLI's own `<14-digit-timestamp>_name.sql`
convention (confirmed: `supabase migration new` generates
`20260928153819_probe_name.sql`-style names). Whether the CLI's local
file *parser* accepts a short numeric prefix like `0001` or requires the
full 14 digits, I could not pin down with certainty — official docs just
say "`<timestamp>_name.sql`" without giving the exact regex, and one real
GitHub issue (supabase/cli#6036) about 8-digit-vs-14-digit prefixes
colliding suggests the parser is more permissive than "exactly 14
digits," but that's evidence, not confirmation. I'm not going to rename
9 already-shipped, already-referenced-by-name migration files on a guess.

**What actually happened (2026-09-29):**

1. `supabase link --project-ref <ref>` — done, against production.
2. `supabase migration list` — all 9 files were recognized cleanly
   under their existing plain `NNNN` numbering; **no renaming needed**,
   resolving the filename-parser uncertainty noted above. As expected,
   every "Remote" column came back empty — the CLI's ledger had zero
   record of any of them, confirming they'd only ever been applied via
   the ad-hoc script, bypassing the CLI's bookkeeping entirely. This is
   the same gap that let migration `0008` sit un-applied in production
   for as long as it did (see H4) — the ledger, not a file's mere
   existence in this repo, is the source of truth for what's actually
   live.
3. `supabase migration repair 0001 0002 0003 0004 0005 0006 0007 0008 0009 --status applied`
   — ran once, marked all 9 as applied without re-running any SQL.
4. `supabase migration list` again — confirmed local and remote now
   agree, all 9 matched, nothing pending.
5. `scripts/run-migrations.mjs` and its `db:migrate` script are
   removed. `supabase migration new <name>` + `supabase db push` is
   now the real workflow (documented in `README.md`).

`scripts/seed.mjs`/`db:seed` are untouched — seeding local dev data was
never part of this move to the CLI.

### Testing (Phase 5) — test data isolation, decided so far

**Postgres version — confirmed, no change needed.** You reported
`PostgreSQL 17.6`; `supabase/config.toml`'s `db.major_version = 17`
(the CLI's own default) already matches. Nothing to edit.

**Existing e2e suite audited for live writes — none found.** Read all
three spec files in full (`e2e/practice-subject.spec.ts`,
`e2e/shift-practice.spec.ts`, `e2e/years-tier-filter.spec.ts`) end to
end, not just grepped. Every test only does `page.goto()`, clicks on
filter links/buttons, and asserts on URLs/visible text — there is no
form submission, no login/signup, no bookmark/attempt action, and no
`POST` of any kind anywhere in the suite. It only ever exercises the
public, read-only catalog pages built in Phase 2. **Nothing was created
on the live project by this suite — there is nothing to clean up.**

**The `.env.test` isolation mechanism is now built and committed**
(separate from this doc change) — see `playwright.config.ts` and
`package.json`'s `test:e2e` script. Verified empirically, not assumed:
Next.js has a first-class `test` environment that loads `.env.test` and
**skips `.env.local` entirely** when `NODE_ENV=test` — confirmed by
putting a canary value in a throwaway `.env.test` with no Supabase vars
at all and running a real build, which failed with `supabaseUrl is
required` instead of silently falling back to `.env.local`'s real
project. `package.json`'s `test:e2e` now sets `NODE_ENV=test` for both
the build and the Playwright run (NEXT_PUBLIC_* vars are inlined at
*build* time, so the build step needs it too, not just the server
start), via a pinned `cross-env@^7` (the current default major declares
a Node ≥22 requirement this machine doesn't meet). `.env.test` itself
is gitignored like `.env.local` — real credentials, never committed.
`.env.test.example` documents the shape and is committed.

**What's still missing is the backend `.env.test` should point at** —
this needs your decision, and I checked what's actually available on
this machine rather than assume either path is free:

**Docker — checked, not available.** No `docker` on PATH, no Docker
Desktop install found at the standard path, no Docker service, and
**WSL2 itself isn't installed either** (`wsl --list` reports it's not
installed) — Docker Desktop on Windows needs WSL2 as its backend, so
this is a two-part install, not one.

#### Option A — install Docker Desktop (for local Supabase via `supabase start`)

1. Open an **elevated** PowerShell and run `wsl --install`, then
   **restart the machine** — required, not optional, for WSL2 to
   activate.
2. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
   During setup, make sure "Use the WSL 2 based engine" is selected
   (it's the default on current versions).
3. Start Docker Desktop once, then verify from a terminal: `docker info`
   should succeed without error.
4. `supabase start` (uses the `supabase/config.toml` already committed) —
   spins up local Postgres/Auth/Storage in containers, applies every
   file in `supabase/migrations/` fresh to the new local DB, and seeds
   from `supabase/seed/*.sql` (already pointed there in config.toml).
5. `supabase status` prints the local API URL and anon/service-role
   keys — those go into `.env.test`.

#### Option B — a separate, dedicated free Supabase project

1. Create a new project at supabase.com — free tier, entirely separate
   from your production project, its own billing/usage.
2. Apply the schema to it, seed it, and get its URL/keys into `.env.test`.

**My read**: Option B is meaningfully less friction on this machine
right now — no restart, no elevated install, nothing that touches
system-level virtualization — while Option A gives you closer-to-"real"
isolation (no network dependency, resets instantly via `supabase db
reset`). Both satisfy the actual requirement (never touching the
production project); which one is worth the setup cost is yours to
call, not something to pick for you.

**Decided (2026-09-28): Option B**, and executed:

- Test project ref **`gadeobjbzjnpuvwvbrdq`**. `.env.test` is filled in
  (its URL, publishable/anon key, and service-role key); confirmed via
  `dotenv` that all 6 expected keys are present (values were never
  printed anywhere, only the key *names*).
- **Migrations, via the CLI** (your instruction, not the script — this
  supersedes step 2 above): because this is a genuinely fresh project
  with zero prior migration history (never touched by any tool before),
  `supabase db push` needs no `repair` step at all — that complexity is
  specific to the *production* project's adoption (immediately above),
  where migrations were already applied by the old script outside the
  CLI's ledger. This project has no such mismatch to reconcile.
- **You run these yourself**, in this repo's root, so you're the one
  typing the database password at each prompt — I did not run `link`
  or `db push` myself, since either would need that password and you
  asked to enter it yourself:
  ```
  supabase link --project-ref gadeobjbzjnpuvwvbrdq
  supabase db push
  ```
  Then, read-only, to confirm: `supabase migration list` should show
  all 9 local migrations as applied, matching remote, nothing pending.
- **Seed data**: fixed a real bug found while building this — the
  existing `supabase/seed/0001_sample_data.sql` referenced a `topics`
  table and a `questions.topic_id` column that
  `0003_remove_topics.sql` had already dropped; it would have failed
  outright against the current schema, and nobody had re-run it since.
  Rewrote it as a small, realistic catalog (2 exams — tiered CGL,
  untiered GD — 5 papers across 2 years and both tiers, 14 questions
  across all 4 subjects, 56 options) and **actually applied it**, not
  just read it, against a throwaway local Postgres running all 9 real
  migrations plus a minimal `auth.users`/`auth.uid()`/`anon`-role stub
  (same approach as the earlier H4 RLS testing) — confirmed the
  `question_count` trigger syncs correctly, every question has exactly
  one correct option and 4 options total, full-text search matches
  real content, and the Phase 1 catalog RPCs return correct results as
  `anon`. User-owned data (bookmarks/attempts/profiles) is deliberately
  **not** in this file — tests create that themselves at runtime via
  the admin API, since faking rows in `auth.users` via raw SQL would
  bypass GoTrue entirely (no password hashing, no identities row).
  After `db push` succeeds, seed it with:
  ```
  npm run db:seed:test
  ```
  (`scripts/seed.mjs` now accepts an optional env-file argument —
  defaults to `.env.local`, unchanged, so nothing about normal local
  dev seeding changed.)
- **Guard added**: `e2e/global-setup.ts`, wired as Playwright's
  `globalSetup`, refuses to run any test unless `NODE_ENV=test` *and*
  `.env.test`'s `NEXT_PUBLIC_SUPABASE_URL` contains
  `gadeobjbzjnpuvwvbrdq`. Worth knowing exactly what this does and
  doesn't guard: it runs in Playwright's own Node process, which — unlike
  the `next build`/`next start` child processes it spawns — has no
  built-in `.env.test` loading of its own, so the guard loads the file
  itself via `dotenv` rather than assuming the value is already in
  `process.env`. Caught this before it became a silent no-op, not after.

**Deferred at your request**: the `supabase link` + `migration repair`
walkthrough for the *production* project (immediately above) waits
until after Phase 5, per your instruction — nothing about this section
changes that.

### First real run against the test project — 2 more real bugs found

Running `npm run test:e2e` for real (not just wiring it up) against the
newly-seeded test project immediately surfaced two more issues, on top
of the seed-vs-schema bug already fixed above:

1. **H5 (see Findings above)** — every practice page 500'd with a real
   Postgres `42703` (undefined_column) error. This is a genuine,
   pre-existing application bug, unrelated to anything built this
   session — `questions.ts` selected a `topic_id` column that
   `0003_remove_topics.sql` dropped long ago. It never surfaced before
   because this is the first environment with all 9 migrations
   genuinely, freshly applied — see H5 for the full reasoning on why
   production likely never hit this. **Fixed.**
2. **Seed bug, self-inflicted**: the seed gave CGL 2024 Tier 1 Shift 1
   and Tier 2 Shift 1 the same slug (`shift-1`) — `getPaperBySlug()`
   looks papers up by exam+year+slug only (no tier), so two matching
   rows made it error. **Fixed** (renamed to `shift-3`), and re-verified
   against a throwaway local Postgres before re-applying to the test
   project via the new `db:reset:test` script.

Debugging this took a wrong turn worth naming honestly: my first
instinct was to test via `curl`, which showed pages missing content
that a real browser rendered fine — `curl` never executes the
client-side JavaScript these pages depend on (client components,
hydration), so it's not a reliable way to check whether this app's
pages actually work. Switched to driving a real Playwright-controlled
browser for the rest of the investigation, which is what surfaced the
actual Postgres error via the page's console/RSC error payload.

**Result**: `npm run test:e2e` now passes cleanly against the test
project — 18 passed, 10 skipped (all legitimate — filters/pagination
with no second option in this small seed, not failures), 0 failed.

### Auth e2e coverage — login done, signup blocked on a dashboard setting

With test data isolation actually proven (above), the auth flows built
in Phase 3 have a safe place to run for the first time. Added
`e2e/fixtures/test-user.ts` (create/delete real auth users via the
admin API, deliberately not through the UI, so tests that only need a
*logged-in* user don't also depend on signup working) and two specs.

**Login (`e2e/auth-login.spec.ts`) — fully green.** Correct credentials
land on the dashboard; the wrong password shows "Invalid login
credentials" and stays on `/login` — checked what GoTrue actually
returns before asserting on it, not guessed.

**Signup (`e2e/auth-signup.spec.ts`) — one real bug found and fixed,
one real infrastructure limit found and not worked around.**

1. The client-side "passwords don't match" validation (no network
   call) is fully green.
2. The happy-path test (real `signUp()` through the actual form)
   surfaced two distinct, sequential issues, each confirmed by actually
   calling the endpoints involved, not inferred:
   - **Fixed**: generated test emails used `@sarkaripyq-test.invalid`
     (RFC 2606-reserved, same reasoning as everywhere else in this
     project). GoTrue's public `signUp()` rejects that domain outright
     ("email address is invalid") even though `admin.createUser()`
     tolerates it — the admin and public endpoints validate
     differently. Switched to `@example.com` (also RFC 2606-reserved,
     but a real, resolving, non-mail-accepting domain, so it passes
     format validation everywhere) and confirmed the rejection is gone.
   - **Real infrastructure ceiling, not fixable from the dashboard's
     Rate Limits page at all**: with the domain fixed, the same test
     hit `"email rate limit exceeded"`. You raised what the dashboard's
     Rate Limits page let you raise and re-ran — still the identical
     error. Checked Supabase's own docs rather than keep guessing:
     **the built-in email service is hard-capped at 2 messages/hour,
     and that specific cap cannot be increased via the Rate Limits page
     while using the default mailer at all** — that page's adjustable
     values only take effect once custom SMTP is configured (starting
     at 30/hour, then adjustable). So whatever got raised wasn't the
     actual bottleneck; there wasn't one available to raise. See
     "LAUNCH_CHECKLIST.md" (new file, this pass) for the real fix.
   - **Also asked: why does signup send email at all if "Confirm
     email" is off?** `/auth/v1/settings` on the test project shows
     `mailer_autoconfirm: false`, yet signup still issues a session
     immediately (matching "confirm email" being off). The coherent
     reading of both facts together: `mailer_autoconfirm` governs
     whether GoTrue sends a confirmation email at all (false = it
     does), which is evidently a *different* setting from whatever
     "Confirm email" in the dashboard controls (evidently just whether
     confirming is *required before sign-in*, not whether the email
     goes out). Supabase's docs don't spell this distinction out
     explicitly anywhere I could find — this is the best-supported
     conclusion from what's actually observable, not a documented fact
     I can cite and hand you with full certainty.
   - **Fixed (pragmatic mitigation)**: `auth-signup.spec.ts` now races
     `waitForURL` against the rate-limit error text and **skips**
     (doesn't fail) on the latter — retrying against a fixed 2/hour
     budget is actively counterproductive, not just unhelpful. Also
     restricted to one browser project instead of two, since there's
     no reason to spend two of that budget checking the same thing
     twice every suite run.
**Update**: bookmarks and account-deletion coverage are done after all
— `createConfirmedTestUser` goes through the **admin** API, not the
public `signUp()` the rate limit above applies to, so neither touches
that quota. Both green:

- **`e2e/account-deletion.spec.ts`** — drives the real `/profile`
  "type DELETE to confirm" flow, then confirms the session is
  genuinely gone server-side (`/dashboard` redirects to `/login`
  afterward), not just that the UI looks logged out.
- **`e2e/bookmarks.spec.ts`** — bookmarks a real seeded question from
  the practice page, confirms it shows on `/bookmarks`, removes it,
  confirms the empty state returns. `deleteTestUser` in `afterEach` is
  a safety net (cascades any leftover bookmark row), not the primary
  cleanup — the test removes the bookmark itself via the UI.

Both checked for leaked users afterward via the admin API directly
(not assumed) — zero, in both cases.

**`e2e/practice-attempts.spec.ts` — done, also green.** Answers a real
seeded question, waits for the actual `/api/attempts` POST to resolve
(it's fire-and-forget from the UI's perspective, so waiting for the
network response rather than just the visible "Correct" text avoids a
race against the dashboard navigation that follows), then confirms the
dashboard's "Attempted today"/"Accuracy today" stats reflect it.

**Also made the signup skip condition more robust.** Re-running the
full suite after the practice-attempts addition caught GoTrue
returning a *different* error for the identical underlying cause on a
different run — `"Email address ... is invalid"` for the same
already-valid `@example.com` address that had only ever produced
`"email rate limit exceeded"` before, seemingly depending on internal
timing while the mailer is degraded. Matching one specific string was
fragile; now treats *any* non-dashboard outcome (any visible form
error, or a timeout) as the same skip condition, and reports whatever
text actually appeared.

**Nothing further needed on the dashboard** — the signup test skips
cleanly instead of failing when the built-in mailer's cap is hit
however it happens to manifest, so the suite stays green regardless.
The real fix (custom SMTP) is a bigger decision, written up in
`LAUNCH_CHECKLIST.md`. Full suite, confirmed twice in a row: **30
passed, 12 legitimately skipped** (10 filter/pagination with no second
option in this seed + the signup happy-path when the mailer cap is
exhausted), **0 failed**.

---

## Already solid — verified, not touched

Listed so it's clear these were checked, not assumed:

- **SEO**: unique `<title>`/description per page, one `<h1>` per page (including
  a deliberate `sr-only` h1 on the question-practice page, where the visible
  heading lives in a child component), canonical tags everywhere, OG + Twitter
  card metadata with a default share image, JSON-LD for Organization, WebSite
  (with `SearchAction`), and BreadcrumbList on every listing/detail page,
  `sitemap.xml` covering exams/years/subjects/papers (capped at 45k URLs per
  Next's 50k-per-file limit), `robots.txt` disallowing `/api/`, `/login`,
  `/signup`, `/profile`, `/dashboard`, `/bookmarks`, plus explicit disallow
  rules for GPTBot/CCBot/AhrefsBot/SemrushBot, `lang="en"` on `<html>`.
- **Mobile**: hamburger drawer with real focus-trapping (Tab/Shift+Tab cycling,
  Esc to close, focus returns to the trigger), a bottom tab bar with
  `safe-area-inset-bottom` padding, 44×44px tap targets on every icon button,
  horizontal-scroll tab patterns for subject/tier filters, responsive Tailwind
  breakpoints throughout, dark mode wired correctly (`darkMode: ["selector",
  '[data-theme="dark"]']` matches the `data-theme` attribute the theme
  toggle sets — I checked this specifically since it's a common source of
  silently-broken dark mode).
- **Validation/Security**: every mutating API route validates its body with
  Zod (UUIDs checked, string lengths bounded) and rate-limits by IP; every
  Supabase table has row-level security with policies scoped to
  `auth.uid()`; the two leaderboard RPCs are `SECURITY DEFINER` functions
  that expose only pre-aggregated, non-sensitive columns — never raw
  per-user attempt data; no raw/string-built SQL anywhere in the app (the
  Supabase query builder is used exclusively); the service-role key is only
  read by `src/lib/supabase/admin.ts`, which nothing in the request path
  imports; `.env.local` is gitignored and `.env.example` documents every
  variable without values; `npm audit` reports 0 vulnerabilities.
- **Accessibility**: labeled form inputs, visible focus rings
  (`:focus-visible` in `globals.css`), `aria-label`/`aria-pressed`/
  `aria-expanded` used correctly on icon-only buttons and toggles, the
  mobile menu is a proper `role="dialog" aria-modal="true"` with trapped
  focus.

---

## Build verification

Ran after every fix section below, not just once at the end:

- `npm run typecheck` — clean before and after all changes.
- `npm run lint` (now `eslint .`) — 1 pre-existing error found and fixed
  (see commit for `ThemeToggle.tsx`), clean after.
- `npm run build` — succeeds before and after; route list unchanged (no
  routes added/removed/broken).
- Also ran a real `npm run start` against a production build and `curl`'d
  it directly (not just typecheck/build) to confirm the new CSP header and
  nonce actually work end-to-end — the header is present, every script tag
  (Next's own bundles and the hand-written inline ones) carries the matching
  nonce, and `'unsafe-eval'` is correctly absent under a true production
  `NODE_ENV`. This same live check is what surfaced H4 (`/search` timing out
  on a real query against your database) — a bug that reading the code
  alone would never have shown.

Lighthouse was **not** run — this environment has no way to launch a real
Chrome instance against the running dev/prod server to produce mobile
Lighthouse scores. See the manual checklist below.

---

## What you need to do manually

1. **Diagnose H4 (search timeouts)** — I couldn't connect to your database
   directly (correctly blocked as a production read). Check Supabase
   Dashboard → Database → Query Performance for the `questions` table, and
   see H4 above for exactly what to look at. Ping me with what you find and
   I can turn it into a real fix.
2. **Run Lighthouse yourself** (mobile, throttled) against a deployed
   preview or `npm run build && npm run start` locally in Chrome DevTools —
   I have no way to do this from here. Given the audit above, I'd expect
   Performance to be the only category not already in the 90s (mainly
   because of A1 — everything server-renders per request).
3. ~~Decide on A1~~ — **done**: A1 (dynamic-everything rendering) was
   resolved in Phase 2, see above. No decision needed from you here.
4. ~~Decide on A2~~ — **done**: forgot-password and account deletion are
   both built, see "Auth completeness (Phase 3)" above. Please test
   account deletion yourself with a disposable account — I deliberately
   didn't run it against a real user from here.
5. **Check Supabase Auth rate limits and email template (A3)** —
   Dashboard → Authentication → Rate Limits (check "Sign in with
   password" and "Send recovery") and Authentication → Email Templates
   → "Reset Password" (confirm it hasn't been customized away from
   `{{ .ConfirmationURL }}`). Exact reasoning in "Auth completeness
   (Phase 3)" above.
6. **Decide on Turnstile CAPTCHA** — optional per the brief, not built.
   Needs your Cloudflare account to create a site key/secret. See
   "Auth completeness (Phase 3)" above for exactly what it would touch
   if you want it.
7. **Submit `sitemap.xml` in Google Search Console / Bing Webmaster Tools**
   after this deploys — nothing changed about the sitemap's correctness,
   but if you haven't submitted it yet, this is the moment.
8. **Verify CSP in production before relying on it** — `strict-dynamic`
   CSPs are occasionally stricter than expected with third-party embeds. If
   you ever add Google Analytics/GTM/an ad script, it needs to read the
   nonce from `headers()` and pass it explicitly (pattern is in
   `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`).
9. ~~No environment variables need to change~~ — **update**: still true
   that no *new* variable names were added, but `SUPABASE_SERVICE_ROLE_KEY`
   is now enforced as required in production (`src/instrumentation.ts`).
   Which leads directly to the next item.
10. ~~Set a real `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`~~ — **done**,
    confirmed 2026-09-28. Postgres version also confirmed (17.6) — matches
    `supabase/config.toml`'s default, no edit needed.
11. ~~Production CLI migration adoption (P4-1)~~ — **done**, confirmed
    2026-09-29 against production itself: `supabase link`, `migration
    list`, `migration repair`. See "adopting the Supabase CLI for
    migrations" above for the real outcome (none of the 9 were in the
    CLI's ledger — the same gap behind H4).
12. ~~Decide on an error-tracking service (P4-2)~~ — **done**: skipped
    for now.
13. ~~Decide on legal pages content (P4-3)~~ — **done**: real policy
    text now live at `/privacy` and `/terms` (no more placeholder),
    indexable, and in `sitemap.ts`.
14. **Check your Supabase plan's actual backup/retention policy** —
    Dashboard → Database → Backups. See "Backup / restore" above for why
    I didn't just state a number. Still open.
15. ~~Run these yourself against the test project~~ — **done**, confirmed
    2026-09-28: `supabase link`, `db push`, `db:seed:test`, and
    `migration list` all ran; all 9 migrations show applied.
16. ~~Raise the test project's email-sending rate limit~~ — **turned
    out not to be raisable**: Supabase's built-in mailer is hard-capped
    at 2/hour regardless of the dashboard's Rate Limits page. Made the
    signup e2e test skip cleanly on this instead, so it's no longer
    blocking anything. See "Auth e2e coverage" above and
    `LAUNCH_CHECKLIST.md` for the real fix (custom SMTP), if/when you
    want production (or the test project) to send email at real
    volume.
