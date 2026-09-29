"use client";

import Link from "next/link";
import { User as UserIcon } from "lucide-react";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { SignOutButton } from "@/components/auth/SignOutButton";

// Desktop header auth section. Renders a neutral placeholder while the
// client-side session check resolves (near-instant - see useAuthUser -
// but the root layout has no server-side knowledge either way, so there's
// always a brief window before this mounts).
export function AuthStatus() {
  const user = useAuthUser();

  if (user === undefined) {
    return (
      <div className="hidden items-center gap-2 pl-1 md:flex" aria-hidden>
        <div className="h-9 w-24 animate-pulse rounded-md bg-ink-50" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="hidden items-center gap-2 pl-1 md:flex">
        <Link
          href="/dashboard"
          title={user.email}
          className="flex items-center gap-2 rounded-md border border-ink-100 px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300"
        >
          <UserIcon size={16} aria-hidden />
          Dashboard
        </Link>
        <SignOutButton />
      </div>
    );
  }

  return (
    <div className="hidden items-center gap-3 pl-1 md:flex">
      <Link
        href="/login"
        className="text-sm font-semibold text-ink-700 transition-colors hover:text-brand-600"
      >
        Login
      </Link>
      <Link
        href="/signup"
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-subtle transition-colors hover:bg-brand-700"
      >
        Sign Up Free
      </Link>
    </div>
  );
}
