"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function signOut() {
    setPending(true);
    setError(false);
    try {
      const res = await fetch("/api/auth/signout", { method: "POST" });
      if (res.ok) {
        // Also sign out the browser client directly: Header/MobileNav now
        // read auth state client-side (see useAuthUser), which is driven
        // by this client's own session, not just the server-side cookie
        // clear above. Without this, the header could keep showing the
        // user as logged in until the access token's natural expiry.
        await createClient().auth.signOut();
        router.push("/");
        router.refresh();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="flex items-center gap-2 rounded-md border border-ink-100 px-4 py-2 text-sm font-semibold text-ink-700 hover:border-ink-300 disabled:opacity-50"
      >
        <LogOut size={16} aria-hidden />
        {pending ? "Logging out…" : "Logout"}
      </button>
      {error ? <p className="mt-2 text-xs text-danger-500">Something went wrong. Please try again.</p> : null}
    </div>
  );
}
