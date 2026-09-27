import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types/database";

export function SubjectTabs({
  subjects,
  activeSlug,
  basePath,
}: {
  subjects: Subject[];
  activeSlug: string | null;
  basePath: string;
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-ink-100 px-4 py-2.5">
      <Link
        href={basePath}
        className={cn(
          "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
          !activeSlug ? "border-brand-500 bg-brand-50 text-brand-600" : "border-ink-100 text-ink-500",
        )}
      >
        All
      </Link>
      {subjects.map((s) => (
        <Link
          key={s.id}
          href={`${basePath}?subject=${s.slug}`}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
            activeSlug === s.slug
              ? "border-brand-500 bg-brand-50 text-brand-600"
              : "border-ink-100 text-ink-500",
          )}
        >
          {s.name}
        </Link>
      ))}
    </div>
  );
}
