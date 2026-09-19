import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import { bindPwaLifecycleEffects } from "./pwa-lifecycle-runtime";

const layoutSource = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
const sellSource = readFileSync(new URL("./sell/page.tsx", import.meta.url), "utf8");
const runtimeSource = readFileSync(new URL("./pwa-lifecycle-runtime.tsx", import.meta.url), "utf8");

describe("PwaLifecycleRuntime shared authority", () => {
  test("root layout mounts the runtime for every POS route including /sell", () => {
    expect(layoutSource).toContain("<PwaLifecycleRuntime");
    expect(sellSource).toContain("pos-route-slot");
    expect(sellSource).not.toContain("HealthRuntime");
  });

  test("bindPwaLifecycleEffects starts once and the shared runtime owns update-ready UI", () => {
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
    expect(runtimeSource).toContain("UpdateReadyDialog");
    expect(runtimeSource).toContain("activateWaitingUpdate");
    expect(runtimeSource).toContain("setInterval(refreshDecision, 2000)");
  });
});
