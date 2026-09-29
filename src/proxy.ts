import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages that render per-user/interactive content and therefore already pay
// the cost of dynamic rendering (see AUDIT.md A1/Phase 2) - everything else
// is public catalog content that now renders statically/ISR, and can't use
// a per-request nonce (there is no request at static-generation time).
const DYNAMIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/dashboard",
  "/bookmarks",
  "/profile",
  "/search",
  "/auth/callback",
];

function isDynamicPath(pathname: string): boolean {
  return DYNAMIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const SHARED_DIRECTIVES = [
  "default-src 'self'",
  // 'unsafe-inline' kept for style-src on both variants: the dashboard's
  // bar-chart widths are set via React's `style` prop, which neither a
  // script nonce nor a script hash covers.
  "style-src 'self' 'unsafe-inline'",
  // All question/option diagram images are self-hosted in this project's
  // own Supabase Storage bucket ("question-images") - migrated 2026-09-29
  // from their original external hosts (hranker.com, testranking.in,
  // lh7-rt.googleusercontent.com) via scripts/testranking/migrate-images.mjs
  // + rewrite-image-urls.mjs. Verified via direct DB query: 0 remaining
  // references to those hosts except 1 image whose source itself 404s
  // upstream (was already broken before the migration, not a regression).
  // No external image host needs to be allowed here anymore.
  "img-src 'self' data: https://*.supabase.co",
  "font-src 'self' data:",
  // Google Analytics (gtag.js, loaded via @next/third-parties/google):
  // region1.google-analytics.com is the region-specific collect endpoint
  // GA can redirect to depending on where the request originates - both
  // are needed, not just the bare one.
  "connect-src 'self' https://*.supabase.co https://www.google-analytics.com https://region1.google-analytics.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
];

// `strict-dynamic` means only scripts carrying the nonce (or scripts
// inserted by a nonced script) can run - Next.js auto-attaches the nonce to
// its own framework/page bundles automatically (by parsing this header),
// so nothing in these routes needs to read the nonce explicitly.
//
// Known gap: the https://www.googletagmanager.com host-source below (per
// Next's own CSP docs example) is a fallback for browsers that don't
// support strict-dynamic - per the CSP3 spec, browsers that DO support it
// ignore host-source entries here entirely. GoogleAnalytics (rendered
// unconditionally in the root layout) is therefore not guaranteed to fire
// on this file's DYNAMIC_PATH_PREFIXES routes (login/signup/dashboard/
// etc.) in modern browsers, only on every other (STATIC_CSP) route, which
// covers all real content/traffic pages. Fixing this fully would mean
// reading the nonce via next/headers and passing it as GoogleAnalytics's
// nonce prop - deliberately not done here, since the root layout wraps
// every route and any Dynamic API call there forces the entire site out
// of static/ISR rendering (see AUDIT.md A1/Phase 2). Not worth that
// trade for analytics coverage on a handful of already-utility pages.
function buildDynamicCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com${isDev ? " 'unsafe-eval'" : ""}`,
    ...SHARED_DIRECTIVES.slice(1),
  ].join("; ");
}

// Verified directly (production build + real browser + console) before
// choosing this: a nonce/hash-only script-src is not viable for statically
// rendered pages. Next.js injects multiple inline bootstrap/RSC-payload
// <script> tags per page whose content is not fixed across pages (or even
// deterministic in general), so hash-listing them is impractical - without
// covering all of them, hydration fails outright (confirmed: React error
// #412). 'unsafe-inline' is therefore required here, not a shortcut.
// JSON-LD (Organization/WebSite/breadcrumb <script
// type="application/ld+json">) is unaffected either way: verified that its
// content stays fully present and DOM-readable regardless of whether CSP
// "blocks execution" of it - crawlers read the serialized text node, they
// don't execute it as JS.
const STATIC_CSP = [
  SHARED_DIRECTIVES[0],
  `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  ...SHARED_DIRECTIVES.slice(1),
].join("; ");

// Refreshes the Supabase auth session cookie on every request so server
// components always see an up-to-date session, and sets the Content-
// Security-Policy for the request - nonce+strict-dynamic on the dynamic,
// per-user routes, a static 'unsafe-inline' policy everywhere else.
export async function proxy(request: NextRequest) {
  const dynamic = isDynamicPath(request.nextUrl.pathname);
  const nonce = dynamic ? Buffer.from(crypto.randomUUID()).toString("base64") : null;
  const csp = nonce ? buildDynamicCsp(nonce) : STATIC_CSP;

  const requestHeaders = new Headers(request.headers);
  if (nonce) requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.headers.set("Content-Security-Policy", csp);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
