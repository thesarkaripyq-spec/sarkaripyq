import type { Instrumentation } from "next";
import { validateEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export function register() {
  validateEnv();
}

// Baseline visibility into uncaught server errors via structured logs, even
// without a dedicated error-tracking service wired up. If one gets added
// later (e.g. Sentry), its captureException call belongs right here too.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;

  logger.error("unhandled request error", {
    message,
    digest,
    path: request.path,
    method: request.method,
    routeType: context.routeType,
  });
};
