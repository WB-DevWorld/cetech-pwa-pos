import { defineConfig } from "@playwright/test";

const host = "127.0.0.1";
const port = 3000;
const origin = `http://${host}:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: origin,
    trace: "off",
  },
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm build && pnpm start",
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
