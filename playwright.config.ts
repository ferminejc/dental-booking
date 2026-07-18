import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",

  // The one spec here performs a real write against the dev DB (and
  // self-cleans by cancelling what it books) — keep this single-worker and
  // non-parallel so a future second spec can't race it against the same
  // database.
  fullyParallel: false,
  workers: 1,
  retries: 0,

  timeout: 45_000,
  reporter: "list",

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  // Starts `npm run dev`, which loads .env.local itself exactly like any
  // other local `npm run dev` — i.e. this runs against the regular dev
  // DATABASE_URL. See README's "E2E tests" section for why that's
  // intentional at this project's scale, not an oversight.
  //
  // To point this at a dedicated DATABASE_URL_TEST instead (once that
  // database has a seeding story — see README), override just that one var
  // for the spawned process, no shell interpolation needed:
  //   webServer: { ..., env: { DATABASE_URL: process.env.DATABASE_URL_TEST ?? "" } }
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
