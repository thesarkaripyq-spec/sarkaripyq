"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-content px-4 py-16">
      <ErrorState onRetry={reset} />
    </div>
  );
}
