import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

/**
 * Vérification des policies contre le vrai projet Supabase. Séparée de `npm run test`
 * parce qu’elle exige un réseau, la migration appliquée et la clé de service.
 *   SUPABASE_RLS_TEST=1 npm run test:rls
 */
export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 90_000,
    pool: "threads",
    maxWorkers: 1,
    minWorkers: 1,
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
