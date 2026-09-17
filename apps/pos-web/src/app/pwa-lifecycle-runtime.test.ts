import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import { bindPwaLifecycleEffects } from "./pwa-lifecycle-runtime";

const layoutSource = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
const sellSource = readFileSync(new URL("./sell/page.tsx", import.meta.url), "utf8");
const healthRuntimeSource = readFileSync(new URL("./health/health-runtime.tsx", import.meta.url), "utf8");

describe("PwaLifecycleRuntime shared authority", () => {
  test("root layout mounts the runtime for every POS route including /sell", () => {
    expect(layoutSource).toContain("<PwaLifecycleRuntime");
    expect(sellSource).toContain('PosApp route="sell"');
    expect(sellSource).not.toContain("HealthRuntime");
  });

  test("bindPwaLifecycleEffects starts once and Store Health does not start a second coordinator", () => {
    const start = vi.fn(async () => undefined);
    const stop = vi.fn();
    const unbind = bindPwaLifecycleEffects({
      start,
      stop,
      checkForUpdate: vi.fn(async () => undefined),
      activationDecision: vi.fn(async () => ({ safe: true as const })),
      activateWaitingUpdate: vi.fn(async () => ({ safe: true as const })),
      discoveredWorkerUrl: () => "/sw.js?build=B",
    });
    expect(start).toHaveBeenCalledTimes(1);
    unbind();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(healthRuntimeSource).not.toContain("createSharedPwaLifecycle");
    expect(healthRuntimeSource).not.toContain("createServiceWorkerLifecycle");
  });
});
