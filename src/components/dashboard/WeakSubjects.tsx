import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";
import type { BreakdownRow } from "@/lib/data/dashboard";

const WEAK_THRESHOLD = 60; // accuracy % below this counts as weak
const MIN_ATTEMPTS = 5; // ignore subjects with too few attempts to mean anything

export function WeakSubjects({ subjects }: { subjects: BreakdownRow[] }) {
  const weak = subjects
    .filter((s) => s.attempted >= MIN_ATTEMPTS)
    .map((s) => ({ ...s, accuracy: Math.round((s.correct / s.attempted) * 100) }))
    .filter((s) => s.accuracy < WEAK_THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy);

  if (weak.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        {subjects.length === 0
          ? "Attempt a few questions in each subject to see where you need work."
          : "No weak spots yet — keep it up, or attempt more questions for a fuller picture."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {weak.map((s) => (
        <div
          key={s.slug}
          className="flex items-center justify-between gap-3 rounded-lg border border-danger-500/20 bg-danger-50 px-4 py-3"
        >
          <div className="flex items-center gap-2.5">
            <TriangleAlert size={16} className="shrink-0 text-danger-500" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-ink-900">{s.name}</p>
              <p className="text-xs text-ink-500">
                {s.accuracy}% accuracy &bull; {s.correct}/{s.attempted}
              </p>
            </div>
          </div>
          <Link
            href={`/practice/${s.slug}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-ink-900 shadow-subtle hover:bg-ink-50"
          >
            Practice now
            <ArrowRight size={12} aria-hidden />
          </Link>
        </div>
      ))}
    </div>
  );
}
