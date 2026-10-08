import { defineConfig } from "@playwright/test";

/**
 * Lane C local override: avoids reusing whatever is already bound to :3000
 * on the contributor machine (observed: unrelated Next app → 404 /sell).
 * Fixture-only; not a production or CI config change.
 */
const host = "127.0.0.1";
const port = 3017;
const origin = `http://${host}:${port}`;

const webServer = {
  command: `pnpm --dir apps/pos-web build && pnpm --dir apps/pos-web exec next start --hostname ${host} --port ${port}`,
  cwd: "../../..",
  url: origin,
  reuseExistingServer: false,
  timeout: 240_000,
};

export default defineConfig({
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL: origin,
    trace: "off",
  },
  webServer,
  projects: [
    {
      name: "e2e",
      testDir: "../../../apps/pos-web/e2e",
      testMatch: ["**/*.spec.ts"],
    },
    {
      name: "lane-c-timings",
      testDir: ".",
      testMatch: ["lane-c-browser-fixture-timings.spec.ts"],
    },
  ],
});
