import Link from "next/link";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <Link
        href={buildHref(Math.max(1, page - 1))}
        aria-disabled={page <= 1}
        className={cn(
          "rounded-md border border-ink-100 px-3 py-1.5 text-sm",
          page <= 1 ? "pointer-events-none opacity-40" : "text-ink-700 hover:border-ink-300",
        )}
      >
        Previous
      </Link>
      <span className="text-sm text-ink-500">
        Page {page} of {totalPages}
      </span>
      <Link
        href={buildHref(Math.min(totalPages, page + 1))}
        aria-disabled={page >= totalPages}
        className={cn(
          "rounded-md border border-ink-100 px-3 py-1.5 text-sm",
          page >= totalPages ? "pointer-events-none opacity-40" : "text-ink-700 hover:border-ink-300",
        )}
      >
        Next
      </Link>
    </div>
  );
}
