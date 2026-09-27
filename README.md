# SARKARIPYQ

SSC Previous Year Questions — practice platform. Next.js (App Router) + TypeScript + Tailwind CSS + Supabase Postgres.

## Stack

- **Frontend + API**: Next.js 16 (App Router). Route Handlers under `src/app/api/**` act as the backend layer, talking to Supabase server-side.
- **Database**: Supabase Postgres — see `supabase/migrations/`.
- **Auth**: Supabase Auth (cookie-based sessions via `@supabase/ssr`), used only for bookmarks and practice-attempt history. Browsing and practicing questions never requires an account.
- No admin panel is included by design — content is managed via the migrations/seed scripts and a separate import pipeline.

## Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings > API.
   - `SUPABASE_DB_URL` — Project Settings > Database > Connection string (used only by the migration/seed scripts, never by the app).
   - `SUPABASE_SERVICE_ROLE_KEY` — reserved for the offline import pipeline; the app itself never reads it.
3. Install dependencies and apply the schema:

   ```bash
   npm install
   npm run db:migrate   # applies supabase/migrations/*.sql in order
   npm run db:seed       # optional: loads a handful of sample questions for local testing
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

## Loading real PYQ data

`supabase/seed/0001_sample_data.sql` is sample data only, for exercising the UI locally. The real question corpus is loaded by a separate import pipeline (not part of this app) that writes directly into `exams`, `papers`, `questions`, `options`, etc. using the service role key. Anything published (`is_published = true`) becomes visible on the site immediately — no deploy needed.

## Routes

- `/` — homepage
- `/ssc` — SSC exam list
- `/ssc/[exam]` — exam overview (subjects, link to PYQ years)
- `/ssc/[exam]/pyq` — years list
- `/ssc/[exam]/pyq/[year]` — shifts/papers for that year
- `/ssc/[exam]/pyq/[year]/[shift]` — question practice (supports `?q=<number>` and `?subject=<slug>`)
- `/practice` — subject picker
- `/practice/[subject]` — subject-wide question browser (exam/topic/year filters, paginated)
- `/search` — full-text question search

## Scripts

- `npm run dev` / `build` / `start`
- `npm run lint` — ESLint (flat config, `eslint-config-next`)
- `npm run typecheck` — `tsc --noEmit`
- `npm run db:migrate` / `npm run db:seed` — run `.sql` files against `SUPABASE_DB_URL`
