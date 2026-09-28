import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cookie-free, session-free client for PUBLIC catalog reads only (exams,
// subjects, papers, questions, options, sitemap data). Safe because RLS on
// those tables never depends on auth.uid() - only on is_published/
// is_active - so this gets identical results to the cookie-aware client
// for these tables. Deliberately does not call cookies()/headers(), so
// pages that only need this client are free to render statically/ISR
// instead of being forced dynamic on every request.
//
// Never use this for user-scoped data (bookmarks, attempts, profile,
// leaderboard rank) - those must go through src/lib/supabase/server.ts.
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
