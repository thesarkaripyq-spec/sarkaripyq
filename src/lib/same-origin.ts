// Defense-in-depth CSRF check for state-changing routes. The primary
// protection is Supabase's SameSite cookie default, which already stops a
// cross-site <form>/fetch from carrying the session cookie in modern
// browsers; this catches anything that slips past that (older browsers,
// a misconfigured cookie) by rejecting requests whose Origin header
// doesn't match the request's own origin. Same-origin calls from this
// app's own frontend always match, so this never affects normal use.
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // no Origin header: not a cross-site browser request

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
