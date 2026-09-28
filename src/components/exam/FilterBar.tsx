"use client";

import { useRouter } from "next/navigation";
import type { Exam } from "@/types/database";

const TIERS = ["Tier 1", "Tier 2"];

// Applies filters immediately on change instead of a submit button - the
// results list is already client-driven (see PracticeBrowser), so there's
// no separate "Apply" step needed. useRouter() (unlike useSearchParams())
// doesn't require a Suspense boundary, so this can navigate directly.
export function FilterBar({
  basePath,
  exams,
  years,
  selected,
}: {
  basePath: string;
  exams: Exam[];
  years: number[];
  selected: { exam?: string; year?: string; tier?: string };
}) {
  const router = useRouter();

  function updateFilter(key: "exam" | "year" | "tier", value: string) {
    const params = new URLSearchParams();
    const next = { ...selected, [key]: value || undefined };
    if (next.exam) params.set("exam", next.exam);
    if (next.year) params.set("year", next.year);
    if (next.tier) params.set("tier", next.tier);
    // A new filter invalidates the current page number.
    router.push(`${basePath}${params.toString() ? `?${params}` : ""}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap gap-2 border-b border-ink-100 bg-white px-4 py-3 md:sticky md:top-[67px]">
      <select
        aria-label="Filter by exam"
        value={selected.exam ?? ""}
        onChange={(e) => updateFilter("exam", e.target.value)}
        className="rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-700"
      >
        <option value="">All exams</option>
        {exams.map((e) => (
          <option key={e.id} value={e.slug}>
            {e.name}
          </option>
        ))}
      </select>

      {years.length > 0 ? (
        <select
          aria-label="Filter by year"
          value={selected.year ?? ""}
          onChange={(e) => updateFilter("year", e.target.value)}
          className="rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-700"
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      ) : null}

      <select
        aria-label="Filter by tier"
        value={selected.tier ?? ""}
        onChange={(e) => updateFilter("tier", e.target.value)}
        className="rounded-md border border-ink-100 px-3 py-2 text-sm text-ink-700"
      >
        <option value="">All tiers</option>
        {TIERS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}
