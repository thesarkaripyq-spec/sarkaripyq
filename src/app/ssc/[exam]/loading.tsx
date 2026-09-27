import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-content px-4 py-8">
      <Skeleton className="h-4 w-40" />
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="mt-8 h-4 w-48" />
      <Skeleton className="mt-3 h-16 sm:max-w-sm" />
    </div>
  );
}
