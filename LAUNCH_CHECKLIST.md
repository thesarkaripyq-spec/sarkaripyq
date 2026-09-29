# SarkariPYQ — Launch Checklist

Everything left before this goes live, in the order it makes sense to
tackle it. Each item says what to do and, where it matters, exactly
why. See `AUDIT.md` for the full reasoning behind anything summarized
here.

## 1. ~~Resolve H4 (search statement timeouts)~~ — done

Blocks A–D were finally run against production on 2026-09-29 (see
`AUDIT.md`'s H4 section for the full numbers). The real finding:
migration `0008_raise_anon_search_timeout.sql` had been recorded as
"applied" but never actually was — `anon`'s `statement_timeout` was
still 3s, not 8s, this whole time. Fixed live via `ALTER ROLE anon SET
statement_timeout = '8s';` in the SQL Editor, confirmed both `anon`
and `authenticated` now read 8s. Combined with Block A (2ms query,
zero disk reads) and Block D (99.45% cache hit ratio), this is a
better outcome than the original "Free-tier resource constraint"
theory — no compute-tier upgrade needed. Worth a quiet watch on
`withTimeoutRetry()`'s logging for any further 57014s, but nothing
else to do here for now.

## 2. Adopt the Supabase CLI for production migrations

Prepared, not run — deferred at your request until after Phase 5,
which just finished, so this is ready whenever you want to do it.
`supabase/config.toml` already exists (`supabase init` was run
locally, safe/no network call). What's left needs **your** account and
**you** to run the actual commands, since they write to the remote
migration ledger:

1. `supabase link --project-ref <production-project-ref>` — you type
   the database password yourself when prompted.
2. `supabase migration list` (read-only) — tells us whether the 9
   existing `NNNN_name.sql` files are recognized as-is, or need
   renaming to the CLI's timestamp convention first. See `AUDIT.md`'s
   "adopting the Supabase CLI for migrations" section for exactly what
   this will show and what to do with either outcome.
3. `supabase migration repair <versions> --status applied` — marks
   the 9 already-applied migrations as applied in the CLI's ledger
   without re-running them.
4. Once `supabase migration list` shows local and remote agreeing
   with nothing pending, tell me — I'll remove
   `scripts/run-migrations.mjs`/`db:migrate` and document
   `supabase migration new` + `supabase db push` as the replacement
   workflow.

## 3. Set up custom SMTP

**Why this is a hard requirement, not a nice-to-have**: Supabase
Auth's built-in email service is hard-capped at **2 messages per
hour**, and — this is the part that's easy to miss — that specific cap
**cannot be raised from the dashboard at all** while using the default
mailer. The "Rate Limits" page's adjustable values only take effect
once custom SMTP is configured (they start at 30/hour from there, then
you can raise them). Found this the hard way this session: raising
whatever the Rate Limits page allowed did nothing, because it wasn't
the actual bottleneck — the 2/hour ceiling is enforced independently
of that page. ([Source](https://supabase.com/docs/guides/auth/auth-smtp))

At real usage, 2 password-reset or signup-confirmation emails per hour
site-wide will get exhausted almost immediately and silently fail
every request after that. This has to be fixed before launch, not
after.

### Setup steps

Pick one provider — both have generous free tiers well beyond what a
launch-stage site needs (Resend: 3,000 emails/month, 100/day free;
Brevo: 300/day free). Recommending **Resend** below as the primary
walkthrough since it has an explicit "send with Supabase" integration
guide; Brevo's steps are similar in shape.

**3a. Create a Resend account and verify a sending domain**
   - Sign up at resend.com (needs your own account — not something I
     can do for you).
   - Dashboard → Domains → Add Domain. Use a subdomain if you'd
     rather keep your root domain's own DNS untouched (e.g.
     `mail.sarkaripyq.com`) — Resend supports this and it's the
     lower-risk choice, since it can't affect your main domain's
     existing email/DNS setup at all.
   - Resend's dashboard will show you the **exact DNS records to add**
     for that domain — typically an MX record (for bounce/return-path
     handling), an SPF TXT record, and a DKIM TXT record at
     `resend._domainkey.<your-sending-subdomain>`. **These values are
     generated per-account and per-domain** — copy them exactly as
     Resend displays them; don't reuse an example from a blog post or
     from anywhere else, including this document. If your DNS is
     behind Cloudflare, make sure the DKIM record is **not proxied**
     (grey-cloud it, not orange-cloud) or verification will never
     complete.
   - Wait for DNS propagation (usually minutes, can take up to ~24h)
     and confirm the domain shows "Verified" in Resend's dashboard
     before moving on — an unverified domain will send, but land in
     spam or get rejected outright.

**3b. Create a Resend API key**
   - Dashboard → API Keys → Create. Scope it to "Sending access" only
     — it doesn't need to read/manage anything else.

**3c. Enter the SMTP credentials in Supabase**
   - Supabase Dashboard → Authentication → Emails → SMTP Settings
     (also reachable via Authentication → Settings → look for
     "Custom SMTP").
   - Enable custom SMTP, then fill in:
     - **Host**: `smtp.resend.com`
     - **Port**: `465`
     - **Username**: `resend` (literally that word, not your email)
     - **Password**: the API key from step 3b
     - **Sender email**: an address `@` your verified sending domain
       (e.g. `no-reply@mail.sarkaripyq.com`) — using an unverified
       domain here will fail to send
     - **Sender name**: `SarkariPYQ` (or whatever display name you
       want recipients to see)
   - Save. Supabase will use this for every auth email going forward
     (signup confirmation, password reset, etc.) — no code change
     needed on this app's side, since it already just calls
     `supabase.auth.resetPasswordForEmail`/`signUp` and lets GoTrue
     handle the sending.

**3d. Send a real test email and check deliverability**
   - Trigger a real password reset against a mailbox you control and
     confirm it arrives (not just that Supabase returned success —
     GoTrue returns the same generic response whether or not sending
     actually worked, by design, for the anti-enumeration reasons
     documented in `src/app/api/auth/forgot-password/route.ts`).
   - Run the message through [mail-tester.com](https://www.mail-tester.com)
     once to confirm SPF/DKIM are actually passing and get a spam
     score before relying on this in production — a "domain verified"
     status in Resend confirms DNS is correct, not that a specific
     message will land in the inbox rather than spam.

### If you'd rather use Brevo instead

Same shape, different provider specifics:
- Brevo dashboard → Senders & IPs → Domains → authenticate your
  domain — this gives you a DKIM TXT record and a Brevo verification
  TXT record to add.
- A separate SPF record usually isn't needed for Brevo's shared-IP
  sending (Brevo controls the technical return-path domain, so SPF
  can pass without it) — but check what your specific dashboard's
  domain-setup wizard says, since this varies by account type. A
  DMARC TXT record is still recommended either way.
- SMTP credentials come from Brevo's SMTP & API page (an "SMTP key,"
  not your account password) — enter those into the same Supabase
  SMTP Settings screen as above.

### Not done as part of this pass

- Actually creating the Resend/Brevo account, verifying the domain,
  and entering credentials — needs your own account and access to
  your domain's DNS, none of which this environment has.
- Applying this to the Phase 5 test project too. The test project's
  signup e2e test already tolerates the 2/hour cap by skipping rather
  than failing (see `AUDIT.md` Phase 5) — worth doing only if you want
  that specific test to actually complete regularly rather than skip.

## 4. Check and set Supabase Auth rate limits

Two separate things to check, both in Dashboard → Authentication →
Rate Limits:

- **The email-sending limit** (see item 3 above) — only meaningfully
  adjustable *after* custom SMTP is configured. Once it is, it
  defaults to 30/hour; raise it to whatever your expected signup/reset
  volume needs.
- **"Sign in with password" / "Sign up" request limits** — these are
  separate from the email limit and from this app's own `rate-limit.ts`
  (which only covers this app's own API routes, not GoTrue's own
  endpoints that `LoginForm`/`SignupForm` call directly from the
  browser). Confirm the defaults are still appropriate for your
  expected traffic; the exact numbers aren't something I can verify
  without dashboard access.

Also confirm the "Reset Password" email template still points at
`{{ .ConfirmationURL }}` (Authentication → Email Templates) and hasn't
been customized away from it.

## 5. ~~Replace the legal page placeholders~~ — done

`/privacy` and `/terms` now carry real policy text (no more DRAFT
banner), `robots: { index: false }` has been removed from both, and
both are now listed in `sitemap.ts`. If the content hasn't been
reviewed by someone familiar with applicable law (liability limits,
governing law, data-subject rights under India's DPDP Act), that's
still worth doing before launch — but the placeholder/indexing
mechanics are done.

## 6. Turn on CI

`.github/workflows/ci.yml` is committed but won't run correctly until
3 repository secrets exist (Settings → Secrets and variables →
Actions): `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`,
`TEST_SUPABASE_SERVICE_ROLE_KEY` — the **test** project's values (the
same ones in your local `.env.test`), never production's.

## 7. ~~Get real Lighthouse scores~~ — done

Ran via `npm run lighthouse` on 2026-09-29 across `/`, `/ssc`,
`/ssc/cgl`, `/ssc/cgl/pyq`, `/practice`, `/books`. All 6 clear every
threshold (85+ Performance, 90+ Accessibility, 90+ Best Practices,
95+ SEO):

| Page | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` | 97 | 95 | 96 | 100 |
| `/ssc` | 97 | 95 | 96 | 100 |
| `/ssc/cgl` | 98 | 95 | 96 | 100 |
| `/ssc/cgl/pyq` | 97 | 95 | 96 | 100 |
| `/practice` | 98 | 95 | 96 | 100 |
| `/books` | 98 | 95 | 96 | 100 |

`.lighthouseci/assertion-results.json` is empty — zero threshold
violations.

## 8. Check your Supabase plan's actual backup/retention policy

Dashboard → Database → Backups. This project is on the Free tier,
which does not include continuous point-in-time recovery — check
whatever daily/retention policy currently applies. I didn't state a
specific number here since Supabase's free-tier backup terms are the
kind of thing that changes over time.

## 9. Confirm production environment variables are set wherever you deploy

Not just `.env.local` — whatever hosting platform you choose needs all
of `.env.example`'s variables set in its own environment configuration,
**especially `SUPABASE_SERVICE_ROLE_KEY`**, which `src/instrumentation.ts`
now enforces at boot (the server fails to start in production without
it, rather than failing silently later at the moment someone tries to
delete their account).

## 10. Test account deletion yourself with a disposable account

The `/api/profile/delete` → `admin.auth.deleteUser()` flow is built
and e2e-tested against the test project, but was deliberately never
run against a real production account from here — too destructive to
rehearse against real data. Create a throwaway real account and delete
it yourself before trusting this in production.

## 11. Submit `sitemap.xml`

Google Search Console / Bing Webmaster Tools, once this deploys.
Nothing about the sitemap's correctness changed in this pass — if you
haven't submitted it yet, this is the moment.

## 12. Deployment

Everything above should be done first. Deployment itself — choosing a
host, configuring that host's own environment variables, DNS, TLS — is
intentionally not detailed here: it was out of scope for this entire
hardening/testing pass from the start, and deserves its own focused
pass rather than being squeezed in as the last line of this checklist.
