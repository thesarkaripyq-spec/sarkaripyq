import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/same-origin";
import { siteUrl } from "@/lib/utils";

const bodySchema = z.object({ email: z.string().trim().email().max(255) }).strict();

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const ip = getClientIp(request);
  if (!rateLimit(`forgot-password-ip:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();

  // Same generic response either way below, on purpose - this specific
  // limit exists to stop inbox-bombing one target from many IPs, not to
  // signal anything to the caller, so it silently no-ops rather than
  // returning a different status than the success path would.
  const withinEmailLimit = rateLimit(`forgot-password-email:${email}`, 3, 600_000);

  if (withinEmailLimit) {
    const supabase = await createClient();
    // Reusing the existing OAuth callback route: it already validates
    // `next` as a safe same-origin path and exchanges the code for a
    // session (see src/app/auth/callback/route.ts) - the recovery link
    // uses the exact same code-exchange flow as Google sign-in.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });
  }

  // Identical response whether the email exists, is malformed-but-valid,
  // or just got rate-limited - never reveals which, so this can't be used
  // to enumerate accounts.
  return NextResponse.json({ ok: true });
}
