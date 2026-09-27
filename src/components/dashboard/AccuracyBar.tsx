import type { BreakdownRow } from "@/lib/data/dashboard";

// Single measure (accuracy) per category -> a status-colored progress bar
// (green = correct share) with the number printed directly, rather than a
// categorical palette: there's only one series here, not several to tell apart.
export function AccuracyBar({ row }: { row: BreakdownRow }) {
  const pct = row.attempted > 0 ? Math.round((row.correct / row.attempted) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-ink-900">{row.name}</span>
        <span className="text-ink-500">
          {pct}% <span className="text-ink-300">&middot; {row.correct}/{row.attempted}</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full bg-success-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
