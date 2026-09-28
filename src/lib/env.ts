import { z } from "zod";
import { logger } from "@/lib/logger";

// Validated once at server startup (see src/instrumentation.ts) so a
// missing/malformed var fails the boot with a clear message instead of
// surfacing later as an unrelated crash on whichever request touches it
// first. Existing call sites (supabase/client.ts, server.ts, public.ts,
// admin.ts, proxy.ts) keep reading process.env directly - this only adds
// the fail-fast check, it doesn't replace those reads.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_AMAZON_AFFILIATE_TAG: z.string().optional(),
});

// Split from the schema above because src/proxy.ts runs on the Edge
// runtime and only ever reads the public vars - a platform that scopes
// server-only vars away from its Edge runtime shouldn't fail proxy.ts on
// a var it never touches.
const serverOnlySchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

function describeIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
}

export function validateEnv(): void {
  const publicResult = publicSchema.safeParse(process.env);
  if (!publicResult.success) {
    throw new Error(
      `Invalid public environment configuration (check .env.local against .env.example):\n${describeIssues(publicResult.error)}`,
    );
  }

  if (process.env.NEXT_RUNTIME === "edge") return;

  const serverResult = serverOnlySchema.safeParse(process.env);
  if (!serverResult.success) {
    const message = `Invalid server-only environment configuration (check .env.local against .env.example):\n${describeIssues(serverResult.error)}`;
    // Hard-fails a real deployment (a missing secret there is a genuine
    // config bug that must block boot), but only warns in development -
    // plenty of local work never touches the admin client, and shouldn't
    // be blocked from `next dev` over a secret it doesn't need yet.
    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }
    logger.warn("server-only env validation failed (allowed in development)", { detail: message });
  }
}
