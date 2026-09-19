import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ReleasePolicy } from "../../../../docs/contracts/domain.generated";
import { createServiceWorkerLifecycle } from "./service-worker-lifecycle";
import { RELEASE_POLICY_PATH, serviceWorkerUrlForBuild } from "./release-policy-client";
import type { UpdateSafetySnapshot } from "./pwa-lifecycle";

const workerSource = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
const lifecycleSource = readFileSync(new URL("./service-worker-lifecycle.ts", import.meta.url), "utf8");
const workspaceRuntimeSource = readFileSync(new URL("../app/workspace-runtime.tsx", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const sellPageSource = readFileSync(new URL("../app/sell/page.tsx", import.meta.url), "utf8");
const homePageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const runtimeSource = readFileSync(new URL("../app/pwa-lifecycle-runtime.tsx", import.meta.url), "utf8");
const manifest = JSON.parse(
  readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8"),
) as Record<string, unknown>;

const POLICY_B: ReleasePolicy = {
  latestBuild: "1.0.1",
  recommendedBuild: "1.0.1",
  minimumSupportedBuild: "1.0.0",
  minimumApiVersion: "1.0.0",
  minimumLocalSchema: 4,
};

function snapshot(overrides: Partial<UpdateSafetySnapshot> = {}): UpdateSafetySnapshot {
  return {
    activeTender: false,
    criticalOperationCount: 0,
    syncMutationInProgress: false,
    localMigrationInProgress: false,
    activeWindow: true,
    appBuild: "1.0.0",
    releasePolicy: POLICY_B,
    ...overrides,
  };
}

type FakeWorker = {
  state: string;
  postMessage: ReturnType<typeof vi.fn>;
  addEventListener: (type: string, listener: () => void) => void;
  listeners: Record<string, Array<() => void>>;
};

function createFakeWorker(state = "installed"): FakeWorker {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    state,
    postMessage: vi.fn(),
    listeners,
    addEventListener(type, listener) {
      listeners[type] ??= [];
      listeners[type].push(listener);
    },
  };
}

function installBrowserFakes() {
  const visibility = { state: "visible" };
  const documentListeners: Record<string, Array<() => void>> = {};
  const windowListeners: Record<string, Array<() => void>> = {};
  const registrations: Array<{ scriptURL: string; waiting: FakeWorker | null; update: ReturnType<typeof vi.fn> }> =
    [];

  const register = vi.fn(async (url: string) => {
    const waiting = createFakeWorker("installed");
    const registration = {
      scriptURL: `https://cetech-pos.local${url}`,
      installing: null as FakeWorker | null,
      waiting,
      update: vi.fn(async () => undefined),
      addEventListener: vi.fn(),
    };
    registrations.push(registration);
    return registration;
  });

  vi.stubGlobal("window", {
    addEventListener: (type: string, listener: () => void) => {
      windowListeners[type] ??= [];
      windowListeners[type].push(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      windowListeners[type] = (windowListeners[type] ?? []).filter((item) => item !== listener);
    },
  });
  vi.stubGlobal("document", {
    get visibilityState() {
      return visibility.state;
    },
    addEventListener: (type: string, listener: () => void) => {
      documentListeners[type] ??= [];
      documentListeners[type].push(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      documentListeners[type] = (documentListeners[type] ?? []).filter((item) => item !== listener);
    },
  });
  vi.stubGlobal("navigator", {
    onLine: true,
    serviceWorker: {
      controller: {},
      register,
    },
  });

  return { register, registrations, documentListeners, windowListeners, visibility };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("CORE-07 service worker safety invariants", () => {
  test("waiting updates are activated only by the explicit CORE-07 message", () => {
    expect(workerSource).toContain('event.data?.type === "CORE07_ACTIVATE_WAITING_UPDATE"');
    expect(workerSource).toContain("self.skipWaiting()");
    const installBlock = workerSource.slice(
      workerSource.indexOf('self.addEventListener("install"'),
      workerSource.indexOf('self.addEventListener("activate"'),
    );
    expect(installBlock).not.toContain("self.skipWaiting()");
    expect(lifecycleSource).not.toContain("skipWaiting");
  });

  test("each release can register a build-specific worker and cache namespace", () => {
    expect(lifecycleSource).toContain("serviceWorkerUrlForBuild(policy.latestBuild)");
    expect(lifecycleSource).toContain("navigator.serviceWorker.register(workerUrl");
    expect(workerSource).toContain('WORKER_URL.searchParams.get("build")');
    expect(workerSource).toContain('`cetech-pos-shell-${BUILD_ID}`');
    expect(serviceWorkerUrlForBuild("1.0.0")).not.toBe(serviceWorkerUrlForBuild("1.0.1"));
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

describe("installed build A discovers deployed build B", () => {
  test("release-policy discovery registers worker B while the running app remains A", async () => {
    const fakes = installBrowserFakes();
    const onUpdateReady = vi.fn();
    const fetchPolicy = vi.fn(async () => POLICY_B);
    const lifecycle = createServiceWorkerLifecycle({
      ownerId: "tab-a",
      appBuild: "1.0.0",
      fetchReleasePolicy: fetchPolicy,
      getSafetySnapshot: () => snapshot(),
      onUpdateReady,
    });

    await lifecycle.start();

    expect(fetchPolicy).toHaveBeenCalled();
    expect(fakes.register).toHaveBeenCalledWith("/sw.js?build=1.0.1", { scope: "/" });
    expect(fakes.register).not.toHaveBeenCalledWith("/sw.js?build=1.0.0", expect.anything());
    expect(lifecycle.discoveredWorkerUrl()).toBe("/sw.js?build=1.0.1");
    expect(onUpdateReady).toHaveBeenCalled();
    expect(fakes.registrations[0]?.waiting?.postMessage).not.toHaveBeenCalled();
  });

  test("a waiting B worker stays waiting while tender, critical work, or a passive window blocks activation", async () => {
    const fakes = installBrowserFakes();
    const lifecycle = createServiceWorkerLifecycle({
      ownerId: "tab-a",
      appBuild: "1.0.0",
      fetchReleasePolicy: async () => POLICY_B,
      getSafetySnapshot: () =>
        snapshot({
          activeTender: true,
          criticalOperationCount: 1,
          activeWindow: false,
        }),
      onUpdateReady: () => undefined,
    });

    await lifecycle.start();
    const decision = await lifecycle.activateWaitingUpdate();

    expect(decision).toEqual({
      safe: false,
      reasons: ["PASSIVE_WINDOW", "ACTIVE_TENDER", "CRITICAL_OPERATION_PENDING"],
    });
    expect(fakes.registrations[0]?.waiting?.postMessage).not.toHaveBeenCalled();
  });

  test("foreground, reconnect, and long-session checks re-run release discovery", async () => {
    const fakes = installBrowserFakes();
    const intervalSpy = vi.spyOn(globalThis, "setInterval");
    let now = 1_000;
    const fetchPolicy = vi.fn(async () => POLICY_B);
    const lifecycle = createServiceWorkerLifecycle({
      ownerId: "tab-a",
      appBuild: "1.0.0",
      fetchReleasePolicy: fetchPolicy,
      getSafetySnapshot: () => snapshot(),
      onUpdateReady: () => undefined,
      now: () => now,
      checkThrottleMs: 1_000,
      longSessionCheckMs: 5_000,
    });

    await lifecycle.start();
    expect(fetchPolicy).toHaveBeenCalledTimes(1);
    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 5_000);

    now = 3_000;
    fakes.visibility.state = "visible";
    for (const listener of fakes.documentListeners.visibilitychange ?? []) {
      listener();
    }
    await vi.waitFor(() => expect(fetchPolicy).toHaveBeenCalledTimes(2));

    now = 5_000;
    for (const listener of fakes.windowListeners.online ?? []) {
      listener();
    }
    await vi.waitFor(() => expect(fetchPolicy).toHaveBeenCalledTimes(3));

    now = 12_000;
    const scheduled = intervalSpy.mock.calls[0]?.[0];
    expect(typeof scheduled).toBe("function");
    (scheduled as () => void)();
    await vi.waitFor(() => expect(fetchPolicy).toHaveBeenCalledTimes(4));

    lifecycle.stop();
    intervalSpy.mockRestore();
  });
});

describe("shared lifecycle composition", () => {
  test("layout owns the lifecycle runtime during ordinary Sell use", () => {
    expect(layoutSource).toContain("PwaLifecycleRuntime");
    expect(layoutSource).toContain("appBuild={env.buildId}");
    expect(sellPageSource).toContain("pos-route-slot");
    expect(homePageSource).toContain("pos-route-slot");
    expect(sellPageSource).not.toContain("createServiceWorkerLifecycle");
    expect(homePageSource).not.toContain("createServiceWorkerLifecycle");
    expect(runtimeSource).toContain("createServiceWorkerLifecycle");
    expect(runtimeSource).toContain("bindPwaLifecycleEffects");
  });

  test("System status consumes shared lifecycle state without constructing a second controller", () => {
    expect(workspaceRuntimeSource).toContain("usePwaLifecycle");
    expect(workspaceRuntimeSource).not.toContain("createServiceWorkerLifecycle");
    expect(workspaceRuntimeSource).toContain("inspectLocalRecoveryState");
    expect(workspaceRuntimeSource).toContain("lifecycle.checkForUpdate()");
  });

  test("release discovery uses the canonical no-store endpoint rather than the current bundle identity", () => {
    expect(lifecycleSource).toContain("fetchReleasePolicy");
    expect(lifecycleSource).toContain("policy.latestBuild");
    expect(RELEASE_POLICY_PATH).toBe("/api/pos/v1/release-policy");
  });
});
