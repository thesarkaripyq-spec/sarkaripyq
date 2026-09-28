"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

// Isolates useSearchParams() so only this tiny, invisible component - not
// its siblings - is subject to the Suspense-deferred-to-client rendering
// that hook requires on a statically generated page (see AUDIT.md
// A1/Phase 2). Reports the current query string via callback whenever it
// changes, including browser back/forward, since useSearchParams tracks
// every URL change, not just navigations this page initiates itself.
export function SearchParamsBridge({ onChange }: { onChange: (params: URLSearchParams) => void }) {
  const searchParams = useSearchParams();
  const serialized = searchParams.toString();

  useEffect(() => {
    onChange(new URLSearchParams(serialized));
  }, [serialized, onChange]);

  return null;
}
