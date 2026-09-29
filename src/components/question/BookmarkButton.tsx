"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

export function BookmarkButton({ questionId }: { questionId: string }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [pending, setPending] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState(false);

  // Adjusting state during render (react.dev/reference/react/useState) -
  // resets synchronously in the same commit when the question changes,
  // rather than in an effect. BookmarkButton isn't remounted when
  // navigating Next/Prev (no `key` in QuestionPractice), so without this
  // the previous question's bookmarked state would carry over.
  const [loadedForId, setLoadedForId] = useState(questionId);
  if (questionId !== loadedForId) {
    setLoadedForId(questionId);
    setBookmarked(false);
    setNeedsAuth(false);
    setError(false);
  }

  // This page is ISR-cached and shared across every visitor (see
  // ssc/[exam]/pyq/[year]/[shift]/page.tsx), so bookmark status can never be
  // baked into the server-rendered HTML - it has to be fetched per-user,
  // client-side.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bookmarks?questionId=${questionId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setBookmarked(Boolean(data.bookmarked));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [questionId]);

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
