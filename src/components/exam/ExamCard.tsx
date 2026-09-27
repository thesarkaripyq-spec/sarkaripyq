import Link from "next/link";
import { ChevronRight, GraduationCap } from "lucide-react";
import type { Exam } from "@/types/database";

export function ExamCard({ exam, paperCount }: { exam: Exam; paperCount?: number }) {
  return (
    <Link
      href={`/ssc/${exam.slug}`}
      className="group flex items-center justify-between rounded-lg border border-ink-100 px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 group-hover:bg-brand-100">
          <GraduationCap size={18} aria-hidden />
        </span>
        <div>
          <p className="font-semibold text-ink-900">{exam.name}</p>
          {exam.full_name ? <p className="text-sm text-ink-500">{exam.full_name}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {typeof paperCount === "number" && paperCount > 0 ? (
          <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-500">
            {paperCount} papers
          </span>
        ) : null}
        <ChevronRight size={18} className="text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" aria-hidden />
      </div>
    </Link>
  );
}
