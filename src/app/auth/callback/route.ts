import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Only a same-origin relative path is a safe post-login destination. A bare
// `${origin}${next}` concatenation is not enough on its own: a value like
// "@evil.com" turns into "https://oursite.com@evil.com", which browsers
// parse as userinfo+host and actually redirect to evil.com. Requiring a
// single leading slash (and rejecting "//host" and any embedded scheme)
// rules that out.
function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next)) return "/dashboard";
  return next;
}

// Handles the redirect back from an OAuth provider (Google) and exchanges
// the auth code for a session.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
