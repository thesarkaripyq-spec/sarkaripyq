import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import type { RawAttempt } from "@/lib/data/dashboard";

export function ContinuePracticeCard({ last }: { last: RawAttempt | null }) {
  if (!last) {
    return (
      <div className="rounded-lg border border-ink-100 p-5">
        <p className="font-semibold text-ink-900">Continue practice</p>
        <p className="mt-1 text-sm text-ink-500">You haven&apos;t attempted any questions yet.</p>
        <Link
          href="/ssc"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Start practicing
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ink-100 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          <PlayCircle size={20} aria-hidden />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Continue where you left off</p>
          <p className="font-semibold text-ink-900">
            {last.exam.name} {last.paper.year} &bull; {last.subject.name} &bull; Q{last.questionNumber}
          </p>
        </div>
      </div>
      <Link
        href={`/ssc/${last.exam.slug}/pyq/${last.paper.year}/${last.paper.slug}?q=${last.questionNumber}`}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Continue practice
        <ArrowRight size={14} aria-hidden />
      </Link>
    </div>
  );
}
