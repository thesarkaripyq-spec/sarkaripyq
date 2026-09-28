// Retries a Supabase query once on a Postgres statement timeout (57014).
// See AUDIT.md H4: root-caused (not a bad plan, missing index, or RLS
// issue) to this project's Free-tier compute occasionally not finishing
// an otherwise-fast, correctly indexed query under a cold cache or a
// burst of concurrent load - concretely reproduced during
// `generateStaticParams` prerendering multiple exam pages at once, which
// is exactly the kind of load spike this helps with. A retry gives the
// query a second chance instead of surfacing a false failure for what's
// usually transient. Anything else (a real error) is returned as-is.
export async function withTimeoutRetry<T extends { error: { code?: string } | null }>(
  run: () => PromiseLike<T>,
): Promise<T> {
  const result = await run();
  if (result.error?.code === "57014") {
    return run();
  }
  return result;
}
