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

  test("API/business responses are excluded from service-worker caching", () => {
    expect(workerSource).toContain('url.pathname.startsWith("/api/")');
    expect(workerSource).toContain('url.pathname.startsWith("/_next/static/")');
    expect(workerSource).not.toContain("cache.put(request, response.clone());\n        return response;\n      }),\n    );\n    return;\n  }\n\n  if (request.mode");
  });

  test("manifest is standalone and uses the controlled root scope", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
  });
});
