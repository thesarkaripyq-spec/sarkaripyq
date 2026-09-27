"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

export function BookmarkButton({ questionId }: { questionId: string }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [pending, setPending] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    setPending(true);
    setNeedsAuth(false);
    setError(false);
    try {
      const res = await fetch("/api/bookmarks", {
        method: bookmarked ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      if (res.status === 401) {
        setNeedsAuth(true);
        return;
      }
      if (res.ok) {
        setBookmarked((v) => !v);
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
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? "Remove bookmark" : "Bookmark this question"}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-md border",
          bookmarked ? "border-brand-500 text-brand-500" : "border-ink-100 text-ink-500 hover:border-ink-300",
        )}
      >
        <Bookmark size={16} fill={bookmarked ? "currentColor" : "none"} aria-hidden />
      </button>
      {needsAuth ? (
        <p className="absolute right-0 top-full z-10 mt-1 w-40 rounded-md border border-ink-100 bg-white p-2 text-xs text-ink-500 shadow-card">
          Sign in to save bookmarks.
        </p>
      ) : null}
      {error ? (
        <p className="absolute right-0 top-full z-10 mt-1 w-40 rounded-md border border-danger-50 bg-white p-2 text-xs text-danger-500 shadow-card">
          Something went wrong. Try again.
        </p>
      ) : null}
    </div>
  );
}
