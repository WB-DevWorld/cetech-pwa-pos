import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "shell-viewports.pw.ts",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  timeout: 30_000,
});
