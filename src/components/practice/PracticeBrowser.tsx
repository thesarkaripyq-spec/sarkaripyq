"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { FilterBar } from "@/components/exam/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { MathHtml } from "@/components/ui/MathHtml";
import { SearchParamsBridge } from "@/components/ui/SearchParamsBridge";
import type { Exam } from "@/types/database";
import type { SubjectBrowseItem } from "@/lib/data/questions";

const PAGE_SIZE = 20;

interface Filters {
  exam?: string;
  year?: string;
  tier?: string;
}

interface BrowseState {
  items: SubjectBrowseItem[];
  total: number;
  page: number;
  filters: Filters;
}

type BrowseResponse = { items: SubjectBrowseItem[]; total: number };

function keyFor(filters: Filters, page: number): string {
  return `${filters.exam ?? ""}:${filters.year ?? ""}:${filters.tier ?? ""}:${page}`;
}

export function PracticeBrowser({
  subjectSlug,
  basePath,
  exams,
  years,
  initialItems,
  initialTotal,
}: {
  subjectSlug: string;
  basePath: string;
  exams: Exam[];
  years: number[];
  initialItems: SubjectBrowseItem[];
  initialTotal: number;
}) {
  const [state, setState] = useState<BrowseState>({
    items: initialItems,
    total: initialTotal,
    page: 1,
    filters: {},
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // The server already rendered page 1 with no filters - skip the
  // redundant fetch on a normal, unfiltered page load.
  const currentKeyRef = useRef(keyFor({}, 1));
  // Keyed cache of in-flight/completed fetches so a prefetched next page -
  // or a page the user already visited - resolves instantly instead of
  // re-fetching.
  const cacheRef = useRef(new Map<string, Promise<BrowseResponse>>());

  const fetchPage = useCallback(
    (filters: Filters, page: number): Promise<BrowseResponse> => {
      const key = keyFor(filters, page);
      let promise = cacheRef.current.get(key);
      if (!promise) {
        const url = new URL(`/api/practice/${subjectSlug}`, window.location.origin);
        if (filters.exam) url.searchParams.set("exam", filters.exam);
        if (filters.year) url.searchParams.set("year", filters.year);
        if (filters.tier) url.searchParams.set("tier", filters.tier);
        url.searchParams.set("page", String(page));

        promise = fetch(url).then((res) =>
          res.ok ? res.json() : Promise.reject(new Error("request failed")),
        );
        cacheRef.current.set(key, promise);
        // Don't let a failed request poison the cache for a future retry.
        promise.catch(() => cacheRef.current.delete(key));
      }
      return promise;
    },
    [subjectSlug],
  );

  const handleParamsChange = useCallback(
    (params: URLSearchParams) => {
      const filters: Filters = {
        exam: params.get("exam") ?? undefined,
        year: params.get("year") ?? undefined,
        tier: params.get("tier") ?? undefined,
      };
      const page = Math.max(1, Number(params.get("page")) || 1);
      const key = keyFor(filters, page);
      if (key === currentKeyRef.current) return;
      currentKeyRef.current = key;

      setLoading(true);
      setError(false);

      fetchPage(filters, page)
        .then((data) => {
          setState({ items: data.items ?? [], total: data.total ?? 0, page, filters });
          // Prefetch the next page in the background so clicking "Next"
          // renders instantly if it's already resolved by then.
          const totalPages = Math.max(1, Math.ceil((data.total ?? 0) / PAGE_SIZE));
          if (page < totalPages) fetchPage(filters, page + 1).catch(() => {});
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    },
    [fetchPage],
  );

  const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));

  function buildHref(p: number) {
    const params = new URLSearchParams();
    if (state.filters.exam) params.set("exam", state.filters.exam);
    if (state.filters.year) params.set("year", state.filters.year);
    if (state.filters.tier) params.set("tier", state.filters.tier);
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <>
      <Suspense fallback={null}>
        <SearchParamsBridge onChange={handleParamsChange} />
      </Suspense>

      <div className="mx-auto max-w-content px-4 pt-8">
        <div className="flex items-center gap-2">
          <p className="mt-1 text-ink-500">
            {state.total} question{state.total === 1 ? "" : "s"} across SSC exams.
          </p>
          {loading ? <Loader2 size={14} className="animate-spin text-brand-500" aria-label="Loading" /> : null}
        </div>
      </div>

      <div className="mx-auto max-w-content">
        <FilterBar basePath={basePath} exams={exams} years={years} selected={state.filters} />
      </div>

      <div className="mx-auto max-w-content px-4 py-6">
        {error ? (
          <p className="text-sm text-danger-500">Couldn&apos;t load questions. Please try again.</p>
        ) : state.items.length === 0 ? (
          <EmptyState title="No questions match these filters" description="Try clearing a filter." />
        ) : (
          <div className={loading ? "space-y-2.5 opacity-60 transition-opacity" : "space-y-2.5 transition-opacity"}>
            {state.items.map((item) => (
              <Link
                key={item.id}
                href={`/ssc/${item.paper.exam.slug}/pyq/${item.paper.year}/${item.paper.slug}?q=${item.question_number}`}
                className="block rounded-lg border border-ink-100 px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                  {item.paper.exam.name} &bull; {item.paper.year}
                </p>
                <MathHtml className="mt-1 line-clamp-2 text-[15px] text-ink-900" html={item.question_html} />
              </Link>
            ))}
          </div>
        )}

        <Pagination page={state.page} totalPages={totalPages} buildHref={buildHref} />
      </div>
    </>
  );
}
