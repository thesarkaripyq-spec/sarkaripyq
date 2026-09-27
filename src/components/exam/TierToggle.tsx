import Link from "next/link";
import { cn } from "@/lib/utils";

export function TierToggle({
  tiers,
  activeTier,
  basePath,
}: {
  tiers: string[];
  activeTier: string | null;
  basePath: string;
}) {
  if (tiers.length < 2) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2.5">
      <Link
        href={basePath}
        className={cn(
          "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
          !activeTier ? "border-brand-500 bg-brand-50 text-brand-600" : "border-ink-100 text-ink-500",
        )}
      >
        All
      </Link>
      {tiers.map((tier) => (
        <Link
          key={tier}
          href={`${basePath}?tier=${encodeURIComponent(tier)}`}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
            activeTier === tier ? "border-brand-500 bg-brand-50 text-brand-600" : "border-ink-100 text-ink-500",
          )}
        >
          {tier}
        </Link>
      ))}
    </div>
  );
}
