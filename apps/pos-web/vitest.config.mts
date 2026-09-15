import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appRoot, "../..");

/** Canonical unit/static discovery. Parsed by tests/tooling/test_vitest_discovery.py. */
const unitTestDiscovery = {
  environment: "node",
  include: [
    "src/app/**/*.test.*",
    "src/features/**/*.test.*",
    "src/ui/**/*.test.*",
    "src/core/**/*.test.*",
    "src/server/**/*.test.*",
    "src/local/**/*.test.*",
    "../../tests/frontend/**/*.test.*",
    "../../tests/integration/auth/**/*.test.*",
    "../../tests/integration/health/**/*.test.*",
    "../../tests/integration/sync/**/*.test.*",
    "../../tests/integration/sales/**/*.test.*",
    "../../tests/integration/payments/**/*.test.*",
    "../../tests/contracts/**/*.test.*",
  ],
  exclude: [
    "**/node_modules/**",
    "**/.next/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "**/coverage/**",
    "**/e2e/**",
    "tests/e2e/**",
    "**/*.pw.*",
    "../../tests/frontend/evidence/**",
  ],
} as const;

export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: unitTestDiscovery.environment,
    include: [...unitTestDiscovery.include],
    exclude: [...unitTestDiscovery.exclude],
  },
  server: {
    fs: {
      allow: [appRoot, repoRoot],
    },
  },
});
