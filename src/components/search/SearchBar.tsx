"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { MathHtml } from "@/components/ui/MathHtml";
import { EmptyState } from "@/components/ui/EmptyState";
import type { QuestionSearchResult } from "@/lib/data/questions";

const RESULTS_LIMIT = 24;

export function SearchBar({
  autoFocus = false,
  initialQuery = "",
  initialResults = [],
}: {
  autoFocus?: boolean;
  initialQuery?: string;
  initialResults?: QuestionSearchResult[];
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<QuestionSearchResult[]>(initialResults);
  const [loading, setLoading] = useState(false);
  // The server already rendered results for initialQuery - skip the redundant
  // first fetch and only refetch once the user actually changes the query.
  const skipNextFetch = useRef(true);

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }

    const trimmed = query.trim();
    // Keeps the URL shareable/refreshable without a full Next.js navigation
    // (which would re-render the whole route server-side on every keystroke).
    window.history.replaceState(null, "", trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");

    // Nothing to fetch for a short query - the render below ignores
    // `results` once the query drops under 2 characters anyway.
    if (trimmed.length < 2) return;

    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=${RESULTS_LIMIT}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [query]);

  const trimmedQuery = query.trim();

  return (
    <div>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="flex items-center gap-2 rounded-md border border-ink-100 px-3 py-2.5"
      >
        <Search size={18} className="text-ink-500" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={autoFocus}
          placeholder="Search SSC CGL questions..."
          className="w-full bg-transparent text-base text-ink-900 outline-none"
        />
      </form>

      <div className="mt-6">
        {trimmedQuery.length < 2 ? (
          <EmptyState title="Search SSC PYQs" description="Search by exam, subject, year or question text." />
        ) : results.length > 0 ? (
          <div className="space-y-2.5">
            {results.map((r) => (
              <Link
                key={r.id}
                href={`/ssc/${r.paper.exam.slug}/pyq/${r.paper.year}/${r.paper.slug}?q=${r.question_number}`}
                className="block rounded-lg border border-ink-100 px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                  {r.paper.exam.name} &bull; {r.paper.year}
                </p>
                <MathHtml className="mt-1 line-clamp-2 text-[15px] text-ink-900" html={r.question_html} />
              </Link>
            ))}
          </div>
        ) : loading ? null : (
          <EmptyState title={`No results for "${trimmedQuery}"`} description="Try different keywords." />
        )}
      </div>
    </div>
  );
}
