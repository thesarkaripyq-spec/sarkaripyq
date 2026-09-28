# SarkariPYQ — Launch Checklist

Started during Phase 5 (testing) because it surfaced a real launch
blocker; will grow through Phase 6. Each item says what to do and,
where it matters, exactly why.

## Email: custom SMTP is required before launch

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

**1. Create a Resend account and verify a sending domain**
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

**2. Create a Resend API key**
   - Dashboard → API Keys → Create. Scope it to "Sending access" only
     — it doesn't need to read/manage anything else.

**3. Enter the SMTP credentials in Supabase**
   - Supabase Dashboard → Authentication → Emails → SMTP Settings
     (also reachable via Authentication → Settings → look for
     "Custom SMTP").
   - Enable custom SMTP, then fill in:
     - **Host**: `smtp.resend.com`
     - **Port**: `465`
     - **Username**: `resend` (literally that word, not your email)
     - **Password**: the API key from step 2
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

**4. Raise the new (now-adjustable) rate limit if needed**
   - Dashboard → Authentication → Rate Limits → the email-sending
     limit now defaults to 30/hour (up from the hard 2/hour on the
     built-in mailer) and can be raised further from this same page
     if your traffic needs it.

**5. Send a real test email and check deliverability**
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
