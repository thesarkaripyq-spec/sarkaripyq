// Retries a Supabase query at most ONCE on a Postgres statement timeout
// (57014), after a short backoff - and always logs it. This is a
// mitigation for a resource-constraint theory (see AUDIT.md H4), not a
// confirmed fix for a root cause: it must never silently absorb a real,
// ongoing problem. Every timeout is logged when it happens; if the retry
// ALSO times out, that's logged as an error, not swallowed - that pattern
// (both attempts timing out) is the signal that this is no longer a
// one-off and needs re-investigating, not just retrying harder.
const RETRY_DELAY_MS = 250;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTimeoutRetry<T extends { error: { code?: string } | null }>(
  run: () => PromiseLike<T>,
  label: string,
): Promise<T> {
  const result = await run();
  if (result.error?.code !== "57014") return result;

  console.warn(`[db-timeout] ${label}: statement timeout (57014); retrying once after ${RETRY_DELAY_MS}ms`);
  await sleep(RETRY_DELAY_MS);

  const retried = await run();
  if (retried.error?.code === "57014") {
    console.error(
      `[db-timeout] ${label}: retry ALSO timed out - this is no longer a one-off, treat as a real problem, not a transient blip.`,
    );
  } else if (!retried.error) {
    console.warn(`[db-timeout] ${label}: retry succeeded.`);
  }
  return retried;
}
