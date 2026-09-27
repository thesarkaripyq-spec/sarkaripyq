// Best-effort in-memory rate limiter, keyed per server instance.
// NOTE: on a multi-instance/serverless deployment this does not share state
// across instances — swap for a shared store (e.g. Upstash Redis) before
// relying on it as the only abuse defense at scale.

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

// NOTE: this trusts X-Forwarded-For as-is. That's only safe behind a proxy
// that overwrites/strips any client-supplied value before it reaches this
// app (true on platforms like Vercel) - if deployed anywhere that forwards
// the header verbatim, a client can spoof it to get a fresh bucket per
// request and bypass this limiter entirely. Confirm that guarantee holds
// for wherever this app is actually hosted.
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}
