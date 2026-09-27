import { cn } from "@/lib/utils";

export function QuestionNavigation({
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={!hasPrev}
        className={cn(
          "flex-1 rounded-md border border-ink-100 py-2.5 text-sm font-medium text-ink-700",
          !hasPrev && "cursor-not-allowed opacity-40",
        )}
      >
        Previous
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        className={cn(
          "flex-1 rounded-md bg-brand-500 py-2.5 text-sm font-medium text-white",
          !hasNext && "cursor-not-allowed opacity-40",
        )}
      >
        Next
      </button>
    </div>
  );
}
