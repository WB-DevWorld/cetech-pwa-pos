import { defineConfig } from "@playwright/test";

/** Isolated Chromium harness — no Next webServer (composition under test is bundled). */
export default defineConfig({
  testDir: ".",
  testMatch: /orders-history-reprint-composition\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    trace: "off",
  },
});
