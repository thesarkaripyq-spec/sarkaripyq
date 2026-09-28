"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TierToggle } from "@/components/exam/TierToggle";
import { EmptyState } from "@/components/ui/EmptyState";

interface YearTierRow {
  year: number;
  tier: string;
}

// Reads ?tier= client-side and filters the already-loaded, unfiltered
// (year, tier) list locally - no server round-trip per tier selection.
// This is what lets the parent page render statically/ISR (see AUDIT.md
// A1/Phase 2) while the tier filter still works, including on a
// shared/reloaded filtered URL (this component reads the real URL on
// mount via useSearchParams, it doesn't assume the unfiltered state).
export function YearsFilter({
  basePath,
  yearsWithTiers,
  tiers,
}: {
  basePath: string;
  yearsWithTiers: YearTierRow[];
  tiers: string[];
}) {
  const searchParams = useSearchParams();
  const activeTier = searchParams.get("tier");

  const filtered = activeTier ? yearsWithTiers.filter((r) => r.tier === activeTier) : yearsWithTiers;
  const years = [...new Set(filtered.map((r) => r.year))].sort((a, b) => b - a);

  const yearHref = (year: number) =>
    `${basePath}/${year}${activeTier ? `?tier=${encodeURIComponent(activeTier)}` : ""}`;

  return (
    <>
      <TierToggle tiers={tiers} activeTier={activeTier} basePath={basePath} />
      <div className="mx-auto max-w-content px-4 py-8">
        {years.length === 0 ? (
          <EmptyState title="No papers published yet" description="Check back soon." />
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {years.map((year) => (
              <Link
                key={year}
                href={yearHref(year)}
                className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-semibold text-ink-900 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
              >
                {year}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
