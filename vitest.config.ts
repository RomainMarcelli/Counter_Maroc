import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // Next compile le JSX en runtime automatique : les tests de composants font pareil.
  esbuild: { jsx: "automatic" },
  test: {
    // Les tests de composants passent en jsdom via l’annotation @vitest-environment.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    pool: "threads",
    maxWorkers: 1,
    minWorkers: 1,
  },
});
