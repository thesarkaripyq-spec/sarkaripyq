"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { MathHtml } from "@/components/ui/MathHtml";
import type { QuestionSearchResult } from "@/lib/data/questions";

export function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuestionSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-md border border-ink-100 px-3 py-2.5">
        <Search size={18} className="text-ink-500" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoFocus={autoFocus}
          placeholder="Search SSC CGL questions..."
          className="w-full text-base"
        />
      </form>

      {open && results.length > 0 ? (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-96 overflow-y-auto rounded-md border border-ink-100 bg-white shadow-card">
          {results.map((r) => (
            <Link
              key={r.id}
              href={`/ssc/${r.paper.exam.slug}/pyq/${r.paper.year}/${r.paper.slug}?q=${r.question_number}`}
              className="block border-b border-ink-50 px-4 py-3 last:border-0 hover:bg-ink-50"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                {r.paper.exam.name} &bull; {r.paper.year}
              </p>
              <MathHtml className="mt-1 line-clamp-2 text-sm text-ink-900" html={r.question_html} />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
