import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const workerSource = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
const manifest = JSON.parse(
  readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8"),
) as Record<string, unknown>;

describe("CORE-07 service worker safety invariants", () => {
  test("waiting updates are activated only by the explicit CORE-07 message", () => {
    expect(workerSource).toContain('event.data?.type === "CORE07_ACTIVATE_WAITING_UPDATE"');
    expect(workerSource).toContain("self.skipWaiting()");
    const installBlock = workerSource.slice(
      workerSource.indexOf('self.addEventListener("install"'),
      workerSource.indexOf('self.addEventListener("activate"'),
    );
    expect(installBlock).not.toContain("self.skipWaiting()");
  });

  test("API/business and navigation responses are excluded from persistent caching", () => {
    const apiGuard = 'if (url.pathname.startsWith("/api/")) return;';
    const staticBranch = 'if (url.pathname.startsWith("/_next/static/")) {';
    const navigationBranch = 'if (request.mode === "navigate") {';

    const apiGuardIndex = workerSource.indexOf(apiGuard);
    const staticBranchIndex = workerSource.indexOf(staticBranch);
    const navigationBranchIndex = workerSource.indexOf(navigationBranch);

    expect(apiGuardIndex).toBeGreaterThanOrEqual(0);
    expect(staticBranchIndex).toBeGreaterThan(apiGuardIndex);
    expect(navigationBranchIndex).toBeGreaterThan(staticBranchIndex);

    const staticCacheBlock = workerSource.slice(staticBranchIndex, navigationBranchIndex);
    expect(staticCacheBlock).toContain("cache.put(request, response.clone())");

    const navigationBlock = workerSource.slice(navigationBranchIndex);
    expect(navigationBlock).not.toContain("cache.put(request");
    expect(navigationBlock).toContain("fetch(request).catch");
    expect(navigationBlock).toContain("cache.match(OFFLINE_URL)");
  });

  test("manifest is standalone and uses the controlled root scope", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
  });
});
