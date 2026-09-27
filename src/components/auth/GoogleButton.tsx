"use client";

import { createClient } from "@/lib/supabase/client";

export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <button
      type="button"
      onClick={handleGoogle}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-ink-100 px-4 py-2.5 text-sm font-semibold text-ink-700 hover:border-ink-300"
    >
      <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.9 5.5 29.8 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5 44.5 35.3 44.5 24c0-1.2-.1-2.4-.3-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.6 18.9 12.5 24 12.5c3.1 0 5.8 1.1 8 3l6-6C34.9 5.5 29.8 3.5 24 3.5c-7.6 0-14.2 4.3-17.7 10.6z" />
        <path fill="#4CAF50" d="M24 44.5c5.7 0 10.7-1.9 14.6-5.1l-6.7-5.7c-2 1.4-4.7 2.3-7.9 2.3-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.7 39.9 16.3 44.5 24 44.5z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.7 5.7C41.4 36.4 44.5 30.9 44.5 24c0-1.2-.1-2.4-.3-3.5z" />
      </svg>
      {label}
    </button>
  );
}
