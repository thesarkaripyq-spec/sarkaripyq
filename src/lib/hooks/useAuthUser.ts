"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface AuthUser {
  email: string;
}

// undefined = not yet resolved (first paint / still checking)
// null = signed out
// AuthUser = signed in
//
// This is a UI-display concern only, not a security boundary - the actual
// protected pages (dashboard, bookmarks, profile) independently verify the
// user server-side via the cookie-aware client. getSession() (fast, reads
// the already-parsed local session, no network round trip) is enough here;
// getUser() (network-validated) is reserved for those server-side checks.
export function useAuthUser(): AuthUser | null | undefined {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user ? { email: data.session.user.email ?? "" } : null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ? { email: session.user.email ?? "" } : null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return user;
}
