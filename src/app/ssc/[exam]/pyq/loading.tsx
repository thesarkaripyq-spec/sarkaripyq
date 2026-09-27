import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-content px-4 py-8">
      <div className="flex flex-wrap gap-2.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-20" />
        ))}
      </div>
    </div>
  );
}
