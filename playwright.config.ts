import { defineConfig, devices } from "@playwright/test";

/**
 * Deux terrains de jeu séparés :
 * — 3100, séjour de démonstration local, sans compte : le parcours quotidien.
 * — 3101, application réelle avec comptes, démarrée seulement pour les tests
 *   multi-utilisateurs (SUPABASE_E2E=1), car ils exigent un projet Supabase migré.
 */
const WITH_ACCOUNTS = process.env.SUPABASE_E2E === "1";

const demoServer = {
  command: "npm run dev -- --port 3100",
  url: "http://127.0.0.1:3100",
  reuseExistingServer: false,
  env: { NEXT_PUBLIC_ENABLE_DEMO_SEED: "true" },
};

const accountsServer = {
  command: "npm run dev -- --port 3101",
  url: "http://127.0.0.1:3101",
  reuseExistingServer: false,
  timeout: 120_000,
  env: { NEXT_PUBLIC_ENABLE_DEMO_SEED: "false" },
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    trace: "on-first-retry",
    serviceWorkers: "allow",
  },
  webServer: WITH_ACCOUNTS ? [demoServer, accountsServer] : [demoServer],
  projects: [
    {
      name: "Mobile Chrome",
      testIgnore: /comptes\.spec\.ts/,
      use: { ...devices["Pixel 7"], baseURL: "http://127.0.0.1:3100" },
    },
    ...(WITH_ACCOUNTS
      ? [{
          name: "Comptes",
          testMatch: /comptes\.spec\.ts/,
          retries: 0,
          use: { ...devices["Pixel 7"], baseURL: "http://127.0.0.1:3101" },
        }]
      : []),
  ],
});
