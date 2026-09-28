"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { TierToggle } from "@/components/exam/TierToggle";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatExamDate } from "@/lib/utils";
import type { Paper } from "@/types/database";

// Reads ?tier= client-side and filters the already-loaded, unfiltered
// papers list locally - see YearsFilter for why (static/ISR rendering,
// AUDIT.md A1/Phase 2).
export function PapersFilter({
  basePath,
  papers,
  tiers,
}: {
  basePath: string;
  papers: Paper[];
  tiers: string[];
}) {
  const searchParams = useSearchParams();
  const activeTier = searchParams.get("tier");

  const filtered = activeTier ? papers.filter((p) => p.tier === activeTier) : papers;

  return (
    <>
      <TierToggle tiers={tiers} activeTier={activeTier} basePath={basePath} />
      <div className="mx-auto max-w-content px-4 py-8">
        <div className="space-y-2.5">
          {filtered.length === 0 ? (
            <EmptyState title="No shifts published for this year yet" />
          ) : (
            filtered.map((paper) => (
              <Link
                key={paper.id}
                href={`${basePath}/${paper.slug}`}
                className="group flex items-center justify-between rounded-lg border border-ink-100 px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
              >
                <div>
                  <p className="font-semibold text-ink-900">
                    {paper.tier ? `${paper.tier} — ` : ""}
                    {paper.shift ?? "Shift"}
                  </p>
                  {paper.exam_date ? (
                    <p className="text-sm text-ink-500">{formatExamDate(paper.exam_date)}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-500">
                    {paper.question_count} Qs
                  </span>
                  <ChevronRight
                    size={16}
                    className="text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500"
                    aria-hidden
                  />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}
