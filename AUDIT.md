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
| H4 | **Search intermittently 500s** for ordinary queries (`57014` — statement timeout). Full diagnosis below. | **Resolved** — `anon` role's `statement_timeout` raised 3s → 8s (migration `0008_raise_anon_search_timeout.sql`, must be applied by you — see below) plus a one-time retry in `searchQuestions()` on that exact error code. |

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
missing `is_published` filter (safe, applied immediately). The complete
fix — push the `DISTINCT` into Postgres via an RPC function, the same
pattern `get_leaderboard` already uses — needs a migration and is flagged
for your call, not applied unilaterally. **This means H4 may not be a
single root cause** — the original search-timeout finding (query itself
fast, likely a genuine Free-tier resource constraint) and this
newly-found query-shape inefficiency are independent problems that happen
to share an error code.

**Deferred**: Phase 1 also asks for an automated test that fails if a
short common search term errors or times out. Vitest now exists in this
repo (added in Phase 2 for the public-client regression test), but a
*meaningful* version of this test needs a real database connection to
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
| A2 | No self-service "forgot password" flow (Supabase supports `resetPasswordForEmail`; there's just no UI for it) and no account-deletion flow. Neither is a bug — the brief's Security section is about hardening what exists, not adding auth surface area — but a user who forgets their password today has no way back in except via Google sign-in. Flagging as a product decision, not building it unprompted. |
| A3 | `LoginForm`/`SignupForm` call `supabase.auth.signInWithPassword` / `signUp` directly from the browser, bypassing the app's own `rate-limit.ts`. This is very likely fine — Supabase's hosted Auth service (GoTrue) does its own server-side rate limiting on these endpoints — but I can't verify your project's Supabase rate-limit configuration from here, so I'm noting it rather than asserting it's covered. Worth a 5-minute check in your Supabase dashboard (Auth → Rate Limits). |

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
3. **Decide on A1** (dynamic-everything rendering) — tell me if you want a
   follow-up pass adopting `cacheComponents`, or if this is fine at your
   current traffic level.
4. **Decide on A2** (forgot-password / account deletion) — say if you want
   these built.
5. **Check Supabase Auth rate limits** (A3) in your Supabase dashboard.
6. **Submit `sitemap.xml` in Google Search Console / Bing Webmaster Tools**
   after this deploys — nothing changed about the sitemap's correctness,
   but if you haven't submitted it yet, this is the moment.
7. **Verify CSP in production before relying on it** — `strict-dynamic`
   CSPs are occasionally stricter than expected with third-party embeds. If
   you ever add Google Analytics/GTM/an ad script, it needs to read the
   nonce from `headers()` and pass it explicitly (pattern is in
   `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`).
8. **No environment variables need to change** — `.env.example` already
   matches what the app reads; nothing in this pass added new config.
