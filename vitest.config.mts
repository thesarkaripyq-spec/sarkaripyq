import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // API route logic and RLS/security behavior are covered by
      // e2e/*.spec.ts against the real test project instead (see
      // AUDIT.md Phase 5) - Playwright runs in a separate process, so
      // this tool has no visibility into that execution. This number
      // reflects unit-tested src/lib/ logic only, not overall coverage.
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/**/*.test.ts",
        // Thin client-factory wrappers around @supabase/* constructors -
        // nothing to unit test beyond "does it call the constructor",
        // which the type system already guarantees.
        "src/lib/supabase/client.ts",
        "src/lib/supabase/server.ts",
        "src/lib/supabase/public.ts",
        "src/lib/supabase/admin.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
});
