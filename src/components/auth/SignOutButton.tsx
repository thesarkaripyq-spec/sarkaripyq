"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="flex items-center gap-2 rounded-md border border-ink-100 px-4 py-2 text-sm font-semibold text-ink-700 hover:border-ink-300 disabled:opacity-50"
    >
      <LogOut size={16} aria-hidden />
      {pending ? "Logging out…" : "Logout"}
    </button>
  );
}
